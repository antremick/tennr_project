
import React from 'react'
import type { Referral } from '../types'
import { scoreImpact, assessCompleteness } from '../lib/ai'
import { Badge } from './Badges'

export default function Worklist({items, activeId, onSelect}:{items:Referral[], activeId?:string, onSelect:(id:string)=>void}) {
  const ranked = [...items].sort((a,b)=> scoreImpact(b).value - scoreImpact(a).value)

  return (
    <div className="card">
      <div className="hstack" style={{justifyContent:'space-between'}}>
        <div className="hstack" style={{gap:10}}>
          <div className="pill">Worklist</div>
          <div className="muted">{ranked.length} referrals</div>
        </div>
      </div>
      <div className="section">
        {ranked.map(r=>{
          const imp = scoreImpact(r)
          const comp = assessCompleteness(r)
          return (
            <div key={r.id} className={['worklist-item', activeId===r.id?'active':''].join(' ')} onClick={()=>onSelect(r.id)}>
              <div className="hstack" style={{justifyContent:'space-between'}}>
                <div className="vstack" style={{gap:2}}>
                  <div style={{fontWeight:600}}>{r.patient.name} · {r.specialty}</div>
                  <div className="muted" style={{fontSize:12}}>Received {new Date(r.receivedAt).toLocaleString()} · {r.source}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div className="muted" style={{fontSize:12}}>Impact</div>
                  <div style={{fontWeight:700}}>{imp.value}</div>
                </div>
              </div>
              <div className="badges" style={{marginTop:6}}>
                {comp.missing.length ? <Badge tone="warn" label="Missing info" /> : <Badge tone="ok" label="Complete-ish" />}
                {r.coverage271.priorAuthRequired ? <Badge tone="warn" label="Auth likely" /> : <Badge tone="ok" label="No auth" />}
                {r.telefit ? <Badge label="Telefit" /> : <Badge label="In-person" />}
                {r.distanceMiles>60 ? <Badge tone="warn" label="Long travel" /> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
