import React, { useMemo, useState } from "react";
import type { Referral, SlotOption } from "../types";
import { assessCompleteness, predictAuth, suggestSlots } from "../lib/ai";
import { evalBundleLLM, extractPdfText } from "../lib/remote";
import CoverageCard from "./CoverageCard";
import DistanceAnalysis from "./DistanceAnalysis";
import InsuranceAnalysis from "./InsuranceAnalysis";
import { Badge } from "./Badges";

export default function ReferralDetail({
  referral,
  lowConnectivity,
  onQueue,
  useLLM,
  onUpdate,
}: {
  referral: Referral;
  lowConnectivity: boolean;
  onQueue: (action: string) => void;
  useLLM?: boolean;
  onUpdate?: (updated: Referral) => void;
}) {
  const [comp, setComp] = useState(() => assessCompleteness(referral));
  const [auth, setAuth] = useState(() => predictAuth(referral));
  const slots = useMemo(() => suggestSlots(referral), [referral]);
  const [held, setHeld] = useState<SlotOption | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [aiSummary, setAiSummary] = useState("");

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (useLLM) {
        try {
          const b = await evalBundleLLM(referral);
          const mergedComp = {
            ...b.completeness,
            draftReferrerAsk: b.messages?.referrerAsk || "",
            draftPatientSMS: b.messages?.patientSMS || "",
          };
          if (!cancelled) {
            setComp(mergedComp);
            setAuth(b.auth);
            setAiSummary(b.summary || "");
          }
        } catch (e) {
          console.warn("LLM fallback to local due to error", e);
          if (!cancelled) {
            setComp(assessCompleteness(referral));
            setAuth(predictAuth(referral));
            setAiSummary("");
          }
        }
      } else {
        setComp(assessCompleteness(referral));
        setAuth(predictAuth(referral));
        setAiSummary("");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [referral, useLLM]);

  async function analyzePdf() {
    try {
      setBusy(true);
      // pick the first PDF doc
      const pdfDoc = referral.documents.find((d) => /\.pdf$/i.test(d.filename));
      if (!pdfDoc) {
        alert("No PDF attached.");
        return;
      }

      // PDFs live in /public/docs
      const path = `/docs/${pdfDoc.filename}`;
      const text = await extractPdfText(path);
      if (!text) {
        alert("PDF extraction returned empty text.");
        return;
      }

      // create an updated referral with the extracted text and higher confidence
      const updated: Referral = {
        ...referral,
        documents: referral.documents.map((d) =>
          d.id === pdfDoc.id
            ? { ...d, text, confidence: Math.max(d.confidence, 0.98) }
            : d
        ),
      };

      // push up to the parent list
      onUpdate?.(updated);

      // re-run evaluation (LLM if enabled)
      if (useLLM) {
        console.log("Calling evalBundleLLM with updated referral:", updated);
        const b = await evalBundleLLM(updated);
        const mergedComp = {
          ...b.completeness,
          draftReferrerAsk: b.messages?.referrerAsk || "",
          draftPatientSMS: b.messages?.patientSMS || "",
        };
        setComp(mergedComp);
        setAuth(b.auth);
        setAiSummary(b.summary || "");
      } else {
        setComp(assessCompleteness(updated));
        setAuth(predictAuth(updated));
      }
    } catch (e: any) {
      console.error("analyzePdf failed", e);

      // Provide more specific error messages
      let errorMessage = "Analyze PDF failed: ";
      if (e?.message?.includes("400")) {
        errorMessage +=
          "Invalid request format. Please check the referral data.";
      } else if (e?.message?.includes("429")) {
        errorMessage += "Rate limit exceeded. Please try again in a moment.";
      } else if (e?.message?.includes("500")) {
        errorMessage += "Server error. Please try again later.";
      } else {
        errorMessage += e?.message || e;
      }

      alert(errorMessage);
    } finally {
      setBusy(false);
    }
  }

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
    if (lowConnectivity) onQueue(`Fax to referrer: ${comp.draftReferrerAsk}`);
    else alert("Fax drafted (mock):\n" + comp.draftReferrerAsk);
  }

  function notifyPatient() {
    if (lowConnectivity) onQueue(`SMS to patient: ${comp.draftPatientSMS}`);
    else alert("SMS drafted (mock):\n" + comp.draftPatientSMS);
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {referral.documents.map((d) => (
              <a
                key={d.id}
                href={`/docs/${d.filename}`}
                target="_blank"
                rel="noreferrer"
              >
                {d.filename}
              </a>
            ))}
          </div>
          <div className="muted">OCR confidence</div>
          <div>
            {Math.round(
              Math.min(...referral.documents.map((d) => d.confidence)) * 100
            )}
            %
          </div>
        </div>

        <div className="section hstack" style={{ gap: 8 }}>
          <button className="button" onClick={notifyReferrer}>
            Fix & Notify Referrer
          </button>
          <button className="button" onClick={notifyPatient}>
            Notify Patient
          </button>
          <button
            className="button primary"
            onClick={analyzePdf}
            disabled={busy}
          >
            {busy ? "Analyzing…" : "Analyze PDF (LLM - Not Implemented)"}
          </button>
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
      </div>

      {useLLM && aiSummary ? (
        <div className="card">
          <div className="pill">AI Summary</div>
          <div className="section">
            <div className="muted">{aiSummary}</div>
          </div>
        </div>
      ) : null}

      <DistanceAnalysis
        distanceMiles={referral.distanceMiles}
        telefit={referral.telefit}
        patientName={referral.patient.name}
        onNotifyPatient={notifyPatient}
      />

      <InsuranceAnalysis
        coverage={referral.coverage271}
        patientName={referral.patient.name}
        specialty={referral.specialty}
        dx={referral.dx}
        cpt={referral.cpt}
        onNotifyPatient={notifyPatient}
      />

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
