
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { task, referral } = req.body || {};
    if (!task || !referral) {
      res.status(400).json({ error: 'Missing task or referral' });
      return;
    }

    const model = process.env.EVAL_MODEL || 'gpt-4o-mini';
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      res.status(500).json({ error: 'Server missing OPENAI_API_KEY' });
      return;
    }

    const system = `You are a clinical operations assistant for a rural specialty clinic's referral desk.
Return ONLY strict JSON (no markdown) matching the required schema for the task.
Be concise, conservative, and avoid hallucinating. Cite the exact fields you used in brief 'rationale' strings if applicable.
Never include PHI beyond what is already provided. Never return additional free text outside JSON.`;

    let user;
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
Strict JSON only.`;
    } else if (task === 'auth') {
      user = `Task: auth
Referral JSON:
${JSON.stringify(referral, null, 2)}

Return JSON with keys:
- band: one of low|medium|high (estimate auth complexity based on payer, dx, cpt, notes)
- reason: short justification grounded in the referral and typical payer rules
- checklist: 3-6 bullet items needed to submit prior auth, or 'None required' if not needed
Strict JSON only.`;
    } else {
      res.status(400).json({ error: 'Unsupported task' });
      return;
    }

    const payload = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.2
    };

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const t = await resp.text();
      res.status(resp.status).json({ error: 'OpenAI error', detail: t });
      return;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end === -1) {
      res.status(502).json({ error: 'Model did not return JSON', raw: content });
      return;
    }
    const jsonText = content.slice(start, end + 1);
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      res.status(502).json({ error: 'Failed to parse JSON from model', jsonText });
      return;
    }

    res.status(200).json({ ok: true, task, result: parsed, model });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
}
