
import React from 'react'

export function Chip({label}:{label:string}) {
  return <span className="pill">{label}</span>
}

export function Badge({label, tone}:{label:string, tone?:'ok'|'warn'|'danger'}) {
  return <span className={['badge', tone ?? ''].join(' ')}>{label}</span>
}
