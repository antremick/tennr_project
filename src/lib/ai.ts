
import type { Referral, CompletenessResult, AuthPrediction, ImpactScore, SlotOption } from '../types'
import slotsFixture from '../fixtures/slots.json'

export function assessCompleteness(ref: Referral): CompletenessResult {
  const required = ['patient.name','patient.dob','patient.phone','specialty','dx','cpt']
  const missing: string[] = []
  const lowConf: string[] = []

  if (!ref.patient.name) missing.push('patient.name')
  if (!ref.patient.dob) missing.push('patient.dob')
  if (!ref.patient.phone) missing.push('patient.phone')
  if (!ref.specialty) missing.push('specialty')
  if (!ref.dx?.length) missing.push('dx')
  if (!ref.cpt?.length) missing.push('cpt')

  if (ref.documents.some(d => d.confidence < 0.8)) {
    lowConf.push('document.ocr_confidence')
  }

  const base = 100
  const penalty = missing.length * 15 + lowConf.length * 5
  const score = Math.max(0, base - penalty)

  const draftReferrerAsk = missing.length
    ? `Thanks for the referral. To proceed, we need: ${missing.join(', ')}. Please fax back with signatures if applicable.`
    : `We have what we need to proceed. If any additional studies exist, please include them to speed prior auth.`

  const est = ref.coverage271.copayEstimate
  const draftPatientSMS = `Hi ${ref.patient.name.split(' ')[0]}, this is the clinic. We’re reviewing your referral for ${ref.specialty}. Estimated copay ~$${est}. Reply YES to hold the next available ${ref.telefit ? 'tele' : 'in-person'} slot.`

  return { score, missing, lowConfidence: lowConf, draftReferrerAsk, draftPatientSMS }
}

export function predictAuth(ref: Referral): AuthPrediction {
  const needAuth = ref.coverage271.priorAuthRequired
  const band: 'low'|'medium'|'high' =
    needAuth ? (ref.cpt.includes('93306') ? 'high' : 'medium') : 'low'
  const reason = needAuth ? 'Payer requires prior authorization for this service.' : 'No prior auth required per eligibility summary.'
  const checklist = needAuth
    ? ['Signed order', 'Recent notes supporting necessity', 'Any relevant imaging/labs', 'Payer-specific auth form']
    : ['None required; verify benefits on day of visit']

  return { band, reason, checklist }
}

export function scoreImpact(ref: Referral): ImpactScore {
  const factors: string[] = []
  let value = 0

  if (ref.specialty === 'Cardiology' || ref.dx.includes('R07.9')) { value += 30; factors.push('cardio/CP signal') }
  if (ref.coverage271.priorAuthRequired) { value += 20; factors.push('auth needed') }

  const completeness = assessCompleteness(ref)
  if (completeness.missing.length) { value += 20; factors.push('missing critical fields') }
  if (completeness.lowConfidence.length) { value += 10; factors.push('low OCR confidence') }

  if (ref.distanceMiles > 60) { value += 10; factors.push('long travel') }
  if (ref.telefit) { value += 5; factors.push('telefit available') }

  return { value, factors }
}

export function suggestSlots(ref: Referral): SlotOption[] {
  const list = (slotsFixture as SlotOption[])
    .filter(s => ref.specialty.toLowerCase().includes('cardio') ? s.provider.toLowerCase().includes('cardio') || s.provider.toLowerCase().includes('vascular') : true)
    .sort((a,b)=> new Date(a.start).getTime()-new Date(b.start).getTime())
    .slice(0,3)

  return list.sort((a,b)=> {
    const pa = ref.telefit && a.modality==='tele' ? -1 : 0
    const pb = ref.telefit && b.modality==='tele' ? -1 : 0
    return pa - pb
  })
}
