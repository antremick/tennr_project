// api/evaluate.js
// Enhanced: robust JSON body parsing, OpenAI header forwarding, optional debug raw output
export const config = { runtime: 'nodejs18.x' }

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    // Support a debug flag via query or header to expose raw model text in responses
    let debug = false
    try {
      // Vercel provides req.url; default base protects against relative URL
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
    if (task === 'completeness') {
      user = `Task: completeness
Referral JSON:
${JSON.stringify(referral, null, 2)}

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
${JSON.stringify(referral, null, 2)}

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

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${key}`
      },
      body: JSON.stringify(payload)
    })

    // Capture useful OpenAI headers for observability
    const reqId = resp.headers.get('x-request-id')
    const apiModel = resp.headers.get('openai-model')
    const processingMs = resp.headers.get('openai-processing-ms')

    if (!resp.ok) {
      const t = await resp.text().catch(() => '(no body)')
      console.error('OpenAI error', resp.status, reqId, t)
      res.status(resp.status).json({ error: 'OpenAI error', detail: t, openai: { reqId, apiModel } })
      return
    }

    const data = await resp.json()
    const content = data?.choices?.[0]?.message?.content || ''
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start === -1 || end === -1) {
      console.error('Model did not return JSON', reqId, content)
      res.status(502).json({ error: 'Model did not return JSON', raw: debug ? content : undefined, openai: { reqId, apiModel, processingMs: processingMs ? Number(processingMs) : null } })
      return
    }

    let parsed
    try {
      parsed = JSON.parse(content.slice(start, end + 1))
    } catch (e) {
      console.error('Failed to parse JSON', reqId, e, content)
      res.status(502).json({ error: 'Failed to parse JSON from model', raw: debug ? content : undefined, openai: { reqId, apiModel, processingMs: processingMs ? Number(processingMs) : null } })
      return
    }

    console.log(`[eval] task=${task} model=${model} openai.reqId=${reqId} timeMs=${processingMs || 'n/a'}`)

    res.status(200).json({
      ok: true,
      task,
      result: parsed,
      model,
      openai: { reqId, apiModel, processingMs: processingMs ? Number(processingMs) : null },
      ...(debug ? { raw: content } : {})
    })
  } catch (e) {
    console.error('Handler crash', e)
    res.status(500).json({ error: 'Server error', detail: String(e) })
  }
}
