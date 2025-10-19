
import React, { useEffect, useMemo, useState } from 'react'
import type { Referral } from './types'
import referralsFixture from './fixtures/referrals.json'
import Worklist from './components/Worklist'
import ReferralDetail from './components/ReferralDetail'
import { Chip } from './components/Badges'

type QueueItem = { id: string, action: string, ts: number }

export default function App(){
  const [items, setItems] = useState<Referral[]>(() => referralsFixture as unknown as Referral[])
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '')
  const active = useMemo(()=> items.find(i=>i.id===activeId) ?? items[0], [items, activeId])

  const [lowConnectivity, setLowConnectivity] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [useLLM, setUseLLM] = useState(false)

  function enqueue(action:string){
    const item: QueueItem = { id: Math.random().toString(36).slice(2), action, ts: Date.now() }
    setQueue(q=>[...q, item])
  }
  function flushQueue(){
    alert('Processed queued actions:\n' + queue.map(q=>`• ${q.action}`).join('\n'))
    setQueue([])
  }

  useEffect(()=>{
    if (!active && items.length) setActiveId(items[0].id)
  },[items, active])

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <div className="logo">BC</div>
          <div>
            <div style={{fontWeight:800}}>Backline Referral Copilot</div>
            <div className="tagline">Receiver-side, rural-first triage • AI at the center</div>
          </div>
        </div>
        <div className="toolbar">
          <div className="pill">Demo mode · fixtures</div>\n          <button className="button ghost" onClick={()=>setUseLLM(v=>!v)}>{useLLM ? 'ChatGPT: ON' : 'ChatGPT: OFF'}</button>
          <button className="button ghost" onClick={()=>setLowConnectivity(v=>!v)}>
            {lowConnectivity ? 'Low Connectivity: ON' : 'Low Connectivity: OFF'}
          </button>
          {queue.length>0 && (
            <button className="button warn" onClick={flushQueue}>Process {queue.length} queued</button>
          )}
          <a className="button primary" href="#" onClick={(e)=>e.preventDefault()}>Export FHIR (stub)</a>
        </div>
      </div>

      <div className="layout">
        <Worklist items={items} activeId={active?.id} onSelect={setActiveId} />
        <div className="vstack">
          {active ? (
            <ReferralDetail referral={active} lowConnectivity={lowConnectivity} onQueue={enqueue} useLLM={useLLM} />
          ) : (
            <div className="card">No referrals</div>
          )}
          <div className="card">
            <div className="hstack" style={{justifyContent:'space-between'}}>
              <div className="pill">Outbox</div>
              <div className="muted">{queue.length} queued</div>
            </div>
            <div className="section queue">
              {queue.length ? queue.map(q=>(
                <div key={q.id}>• {new Date(q.ts).toLocaleTimeString()} — {q.action}</div>
              )) : <div className="muted">Nothing queued.</div>}
            </div>
          </div>
        </div>
      </div>

      <div style={{marginTop:16, display:'flex', gap:8, alignItems:'center'}}>
        <Chip label="First-pass ready" />
        <span className="muted" style={{fontSize:13}}>
          This is a mocked, client-only demo. Replace fixtures with live rails (Stedi/Twilio) when ready.
        </span>
      </div>
    </div>
  )
}
