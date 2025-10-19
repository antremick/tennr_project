import React, { useMemo, useState } from "react";
import type { Referral, SlotOption } from "../types";
import { assessCompleteness, predictAuth, suggestSlots } from "../lib/ai";
import { evalCompletenessLLM, evalAuthLLM } from "../lib/remote";
import CoverageCard from "./CoverageCard";
import { Badge } from "./Badges";

export default function ReferralDetail({
  referral,
  lowConnectivity,
  onQueue,
  useLLM,
}: {
  referral: Referral;
  lowConnectivity: boolean;
  onQueue: (action: string) => void;
  useLLM?: boolean;
}) {
  const [comp, setComp] = useState(() => assessCompleteness(referral));
  const [auth, setAuth] = useState(() => predictAuth(referral));
  const slots = useMemo(() => suggestSlots(referral), [referral]);

  const [held, setHeld] = useState<SlotOption | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (useLLM) {
        try {
          const c = await evalCompletenessLLM(referral);
          const a = await evalAuthLLM(referral);
          if (!cancelled) {
            setComp(c);
            setAuth(a);
          }
        } catch (e) {
          console.warn("LLM fallback to local due to error", e);
          if (!cancelled) {
            setComp(assessCompleteness(referral));
            setAuth(predictAuth(referral));
          }
        }
      } else {
        setComp(assessCompleteness(referral));
        setAuth(predictAuth(referral));
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [referral, useLLM]);

  function holdSlot(s: SlotOption) {
    if (lowConnectivity) {
      onQueue(
        `Hold slot for ${referral.patient.name} @ ${s.provider} ${new Date(
          s.start
        ).toLocaleString()}`
      );
    } else {
      setHeld(s);
    }
  }

  function notifyReferrer() {
    if (lowConnectivity) {
      onQueue(`Fax to referrer: ${comp.draftReferrerAsk}`);
    } else {
      alert("Fax drafted (mock):\n" + comp.draftReferrerAsk);
    }
  }

  function notifyPatient() {
    if (lowConnectivity) {
      onQueue(`SMS to patient: ${comp.draftPatientSMS}`);
    } else {
      alert("SMS drafted (mock):\n" + comp.draftPatientSMS);
    }
  }

  return (
    <div className="vstack" style={{ gap: 12 }}>
      <div className="card">
        <div className="hstack" style={{ justifyContent: "space-between" }}>
          <div className="vstack" style={{ gap: 2 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {referral.patient.name} · {referral.specialty}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              DOB {referral.patient.dob} · {referral.patient.zip} ·{" "}
              {referral.source}
            </div>
          </div>
          <div className="badges">
            <Badge label={`Distance ${referral.distanceMiles}mi`} />
            {referral.telefit ? (
              <Badge label="Telefit" />
            ) : (
              <Badge label="In-person only" />
            )}
          </div>
        </div>

        <div className="section kv">
          <div className="muted">DX / CPT</div>
          <div>
            {referral.dx.join(", ")} · {referral.cpt.join(", ")}
          </div>
          <div className="muted">Docs</div>
          <div>{referral.documents.map((d) => d.filename).join(", ")}</div>
          <div className="muted">OCR confidence</div>
          <div>
            {Math.round(
              Math.min(...referral.documents.map((d) => d.confidence)) * 100
            )}
            %
          </div>
        </div>
      </div>

      <div className="card">
        <div className="hstack" style={{ justifyContent: "space-between" }}>
          <div className="pill">Completeness</div>
          <div style={{ fontWeight: 700 }}>{comp.score}/100</div>
        </div>
        <div className="section">
          {comp.missing.length ? (
            <div className="badges">
              {comp.missing.map((m) => (
                <Badge key={m} tone="warn" label={`Missing ${m}`} />
              ))}
            </div>
          ) : (
            <div className="muted">Looks complete.</div>
          )}
          {comp.lowConfidence.length ? (
            <div style={{ marginTop: 6 }} className="badges">
              {comp.lowConfidence.map((m) => (
                <Badge key={m} tone="danger" label={`Low ${m}`} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="section hstack" style={{ gap: 8 }}>
          <button className="button" onClick={notifyReferrer}>
            Fix & Notify Referrer
          </button>
          <button className="button" onClick={notifyPatient}>
            Notify Patient
          </button>
        </div>
      </div>

      <CoverageCard cov={referral.coverage271} />

      <div className="card">
        <div className="hstack" style={{ justifyContent: "space-between" }}>
          <div className="pill">Auth Predictor</div>
          <div className="badges">
            <Badge
              label={auth.band.toUpperCase()}
              tone={
                auth.band === "high"
                  ? "danger"
                  : auth.band === "medium"
                  ? "warn"
                  : "ok"
              }
            />
          </div>
        </div>
        <div className="section">
          <div className="muted">{auth.reason}</div>
          <div className="hr" />
          <div className="vstack">
            {auth.checklist.map((c, i) => (
              <div key={i}>• {c}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="hstack" style={{ justifyContent: "space-between" }}>
          <div className="pill">Slot Assist</div>
          {held ? (
            <div className="badge ok">
              Held: {held.provider} · {new Date(held.start).toLocaleString()}
            </div>
          ) : null}
        </div>
        <div className="section vstack">
          {slots.map((s, i) => (
            <div
              key={i}
              className="hstack"
              style={{ justifyContent: "space-between" }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{s.provider}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {new Date(s.start).toLocaleString()} · {s.modality}
                </div>
              </div>
              <div className="hstack" style={{ gap: 8 }}>
                <div className="badge">
                  {s.driveMinutes ? `${s.driveMinutes} min drive` : "No travel"}
                </div>
                <button className="button" onClick={() => holdSlot(s)}>
                  Hold
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
