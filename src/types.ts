
export type Modality = 'in-person' | 'tele'

export interface Coverage271 {
  active: boolean
  payer: string
  plan: string
  inNetwork: boolean
  deductibleRemaining: number
  copayEstimate: number
  priorAuthRequired: boolean
  notes?: string
}

export interface ReferralDoc {
  id: string
  type: 'fax' | 'email' | 'portal'
  filename: string
  text: string
  confidence: number
}

export interface Referral {
  id: string
  receivedAt: string
  patient: {
    name: string
    dob: string
    phone: string
    zip: string
  }
  specialty: string
  dx: string[]
  cpt: string[]
  source: 'fax' | 'email' | 'portal'
  distanceMiles: number
  telefit: boolean
  coverage271: Coverage271
  documents: ReferralDoc[]
}

export interface CompletenessResult {
  score: number // 0-100
  missing: string[]
  lowConfidence: string[]
  draftReferrerAsk: string
  draftPatientSMS: string
}

export interface AuthPrediction {
  band: 'low' | 'medium' | 'high'
  reason: string
  checklist: string[]
}

export interface ImpactScore {
  value: number
  factors: string[]
}

export interface SlotOption {
  provider: string
  start: string
  modality: Modality
  driveMinutes: number
}
