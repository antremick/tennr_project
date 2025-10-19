
import type { Referral, CompletenessResult, AuthPrediction } from '../types'

export async function evalCompletenessLLM(ref: Referral): Promise<CompletenessResult> {
  const r = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'completeness', referral: ref })
  })
  if (!r.ok) throw new Error(`LLM completeness failed: ${r.status}`)
  const data = await r.json()
  return data.result as CompletenessResult
}

export async function evalAuthLLM(ref: Referral): Promise<AuthPrediction> {
  const r = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'auth', referral: ref })
  })
  if (!r.ok) throw new Error(`LLM auth failed: ${r.status}`)
  const data = await r.json()
  return data.result as AuthPrediction
}
