
import React from 'react'
import type { Coverage271 } from '../types'
import { Badge } from './Badges'

export default function CoverageCard({cov}:{cov:Coverage271}){
  return (
    <div className="card">
      <div className="hstack" style={{justifyContent:'space-between'}}>
        <div className="hstack" style={{gap:10}}>
          <span className="pill">Coverage</span>
          <div className="muted">{cov.payer} · {cov.plan}</div>
        </div>
        <div className="badges">
          <Badge label={cov.active ? 'Active' : 'Inactive'} tone={cov.active ? 'ok':'danger'} />
          <Badge label={cov.inNetwork ? 'In-network' : 'OON'} tone={cov.inNetwork ? 'ok' : 'warn'} />
          <Badge label={cov.priorAuthRequired ? 'Auth likely' : 'No auth'} tone={cov.priorAuthRequired ? 'warn' : 'ok'} />
        </div>
      </div>
      <div className="section kv">
        <div className="muted">Deductible remaining</div>
        <div>${cov.deductibleRemaining}</div>
        <div className="muted">Copay est.</div>
        <div>${cov.copayEstimate}</div>
        <div className="muted">Notes</div>
        <div>{cov.notes ?? '—'}</div>
      </div>
    </div>
  )
}
