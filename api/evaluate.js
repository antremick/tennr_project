// api/evaluate.js
// Enhanced: robust JSON body parsing, OpenAI header forwarding, optional debug raw output
// + Server-side self rate-limiting (token bucket), retry/backoff for 429/5xx, payload trimming
export const config = { runtime: 'nodejs' }

// --- Best-effort global rate limiter (per warm instance) ---
const _rl = {
  capacity: 2,       // allow short burst
  refillPerSec: 1,   // ~1 request/second sustained
  tokens: 2,
  last: Date.now()
}
async function throttleGlobal() {
  const now = Date.now()
  const elapsed = (now - _rl.last) / 1000
  _rl.tokens = Math.min(_rl.capacity, _rl.tokens + elapsed * _rl.refillPerSec)
  _rl.last = now
  if (_rl.tokens >= 1) { _rl.tokens -= 1; return }
  const need = 1 - _rl.tokens
  const waitMs = Math.ceil((need / _rl.refillPerSec) * 1000) + Math.floor(Math.random() * 120)
  await new Promise(r => setTimeout(r, waitMs))
  const now2 = Date.now()
  const elapsed2 = (now2 - _rl.last) / 1000
  _rl.tokens = Math.min(_rl.capacity, _rl.tokens + elapsed2 * _rl.refillPerSec)
  _rl.last = now2
  _rl.tokens = Math.max(0, _rl.tokens - 1)
}

// --- Trim referral payload to reduce token usage ---
function sanitizeReferral(r) {
  const copy = JSON.parse(JSON.stringify(r || {}))
  if (Array.isArray(copy.documents)) {
    copy.documents = copy.documents.slice(0, 1).map(d => ({
      ...d,
      text: (d.text || '').slice(0, 3000)
    }))
  }
  return copy
}

async function callOpenAIWithRetries(payload, key, maxAttempts = 4) {
  let attempt = 0
  let lastErrText = ''
  let lastHeaders = {}
  while (attempt < maxAttempts) {
    attempt++
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(payload)
    })

    // capture rate headers every time
    lastHeaders = {
      limitRequests: resp.headers.get('x-ratelimit-limit-requests'),
      remainingRequests: resp.headers.get('x-ratelimit-remaining-requests'),
      resetRequests: resp.headers.get('x-ratelimit-reset-requests'),
      limitTokens: resp.headers.get('x-ratelimit-limit-tokens'),
      remainingTokens: resp.headers.get('x-ratelimit-remaining-tokens'),
      resetTokens: resp.headers.get('x-ratelimit-reset-tokens'),
      reqId: resp.headers.get('x-request-id'),
      apiModel: resp.headers.get('openai-model'),
      processingMs: resp.headers.get('openai-processing-ms')
    }

    if (resp.ok) return { resp, rate: lastHeaders }

    const status = resp.status
    lastErrText = await resp.text().catch(() => '(no body)')

    const retryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504
    if (!retryable || attempt >= maxAttempts) {
      return { resp, rate: lastHeaders, errText: lastErrText }
    }

    // Respect Retry-After if present; otherwise exponential backoff with jitter
    const retryAfter = Number(resp.headers.get('retry-after') || 0)
    const base = retryAfter ? retryAfter * 1000 : 400 * Math.pow(2, attempt - 1)
    const jitter = Math.floor(Math.random() * 200)
    const delay = Math.min(4000, base + jitter)
    console.warn(`[eval] retryable ${status} attempt ${attempt}/${maxAttempts}; waiting ${delay}ms`, lastHeaders)
    await new Promise(r => setTimeout(r, delay))
  }
  return { errText: lastErrText, rate: lastHeaders }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    // Support a debug flag via query or header to expose raw model text in responses
    let debug = false
    try {
      const u = new URL(req.url, 'http://localhost')
      debug = u.searchParams.get('debug') === '1'
    } catch {}
    if (!debug && (req.headers['x-debug'] === '1' || req.headers['x-debug'] === 'true')) debug = true

    // Read JSON body even if the platform didn't parse it
    const body = await (async () => {
      if (req.body && typeof req.body === 'object') return req.body
      const chunks = []
      for await (const c of req) chunks.push(c)
      const raw = Buffer.concat(chunks).toString('utf8') || '{}'
      try { return JSON.parse(raw) } catch { return {} }
    })()

    const { task, referral } = body || {}
    if (!task || !referral) {
      res.status(400).json({ error: 'Missing task or referral' })
      return
    }

    const key = process.env.OPENAI_API_KEY
    const model = process.env.EVAL_MODEL || 'gpt-4o-mini'
    if (!key) {
      res.status(500).json({ error: 'Server missing OPENAI_API_KEY' })
      return
    }

    const system = `You are a clinical operations assistant for a rural specialty clinic's referral desk.
Return ONLY strict JSON (no markdown) matching the required schema for the task.
Be concise, conservative, and avoid hallucinating. Cite the exact fields you used in brief 'rationale' strings if applicable.
Never include PHI beyond what is already provided. Never return additional free text outside JSON.`

    let user
    const safeReferral = sanitizeReferral(referral)
    if (task === 'completeness') {
      user = `Task: completeness
Referral JSON:
${JSON.stringify(safeReferral, null, 2)}

Return JSON with keys:
- score: 0-100 integer
- missing: array of dotted paths (e.g., "patient.dob")
- lowConfidence: array of reasons (e.g., "document.ocr_confidence")
- draftReferrerAsk: one short paragraph asking only for missing items (fax-safe)
- draftPatientSMS: 160-char SMS summarizing next step and basic cost (use tele if telefit true)
Strict JSON only.`
    } else if (task === 'auth') {
      user = `Task: auth
Referral JSON:
${JSON.stringify(safeReferral, null, 2)}

Return JSON with keys:
- band: one of low|medium|high (estimate auth complexity based on payer, dx, cpt, notes)
- reason: short justification grounded in the referral and typical payer rules
- checklist: 3-6 bullet items needed to submit prior auth, or 'None required' if not needed
Strict JSON only.`
    } else {
      res.status(400).json({ error: 'Unsupported task' })
      return
    }

    const payload = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.2
    }

    // --- Self-throttle before calling OpenAI ---
    await throttleGlobal()

    // --- Call OpenAI with retry/backoff & capture rate headers ---
    const { resp, rate, errText } = await callOpenAIWithRetries(payload, key)
    const reqId = rate?.reqId
    const apiModel = rate?.apiModel
    const processingMs = rate?.processingMs

    if (!resp || !resp.ok) {
      console.error('OpenAI error', resp?.status, reqId, errText)
      res.status(resp?.status || 502).json({ error: 'OpenAI error', detail: errText, openai: { reqId, apiModel, processingMs }, rate })
      return
    }

    const data = await resp.json()
    const content = data?.choices?.[0]?.message?.content || ''
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start === -1 || end === -1) {
      console.error('Model did not return JSON', reqId, content)
      res.status(502).json({ error: 'Model did not return JSON', raw: debug ? content : undefined, openai: { reqId, apiModel, processingMs }, rate })
      return
    }

    let parsed
    try {
      parsed = JSON.parse(content.slice(start, end + 1))
    } catch (e) {
      console.error('Failed to parse JSON', reqId, e, content)
      res.status(502).json({ error: 'Failed to parse JSON from model', raw: debug ? content : undefined, openai: { reqId, apiModel, processingMs }, rate })
      return
    }

    console.log(`[eval] task=${task} model=${model} openai.reqId=${reqId} timeMs=${processingMs || 'n/a'}`)

    res.status(200).json({
      ok: true,
      task,
      result: parsed,
      model,
      openai: { reqId, apiModel, processingMs: processingMs ? Number(processingMs) : null },
      rate,
      ...(debug ? { raw: content } : {})
    })
  } catch (e) {
    console.error('Handler crash', e)
    res.status(500).json({ error: 'Server error', detail: String(e) })
  }
}
