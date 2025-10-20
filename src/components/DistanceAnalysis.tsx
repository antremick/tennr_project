import React from "react";
import { Badge } from "./Badges";

interface DistanceAnalysisProps {
  distanceMiles: number;
  telefit: boolean;
  patientName: string;
  onNotifyPatient: (message: string) => void;
}

export default function DistanceAnalysis({
  distanceMiles,
  telefit,
  patientName,
  onNotifyPatient,
}: DistanceAnalysisProps) {
  // Define service area limits
  const MAX_DISTANCE_MILES = 50; // Adjust based on your service area
  const WARNING_DISTANCE_MILES = 30; // Distance where we start warning

  const isTooFar = distanceMiles > MAX_DISTANCE_MILES;
  const isWarningDistance = distanceMiles > WARNING_DISTANCE_MILES && !isTooFar;

  const getDistanceStatus = () => {
    if (isTooFar) {
      return {
        tone: "danger" as const,
        label: `Too far (${distanceMiles}mi)`,
        message: `Patient is ${distanceMiles} miles away, exceeding our ${MAX_DISTANCE_MILES}mi service area.`,
      };
    } else if (isWarningDistance) {
      return {
        tone: "warn" as const,
        label: `Far (${distanceMiles}mi)`,
        message: `Patient is ${distanceMiles} miles away. Consider telemedicine if appropriate.`,
      };
    } else {
      return {
        tone: "ok" as const,
        label: `Close (${distanceMiles}mi)`,
        message: `Patient is within our service area at ${distanceMiles} miles.`,
      };
    }
  };

  const status = getDistanceStatus();

  const generatePatientMessage = () => {
    if (isTooFar) {
      return `Hi ${
        patientName.split(" ")[0]
      }, we're ${distanceMiles} miles from you, which is outside our service area. We can help you find a closer provider or discuss telemedicine options. Please call us at (555) 123-4567.`;
    } else if (isWarningDistance && !telefit) {
      return `Hi ${
        patientName.split(" ")[0]
      }, you're ${distanceMiles} miles from our clinic. We offer telemedicine visits that might be more convenient. Would you like to schedule a virtual appointment? Call (555) 123-4567.`;
    } else if (isWarningDistance && telefit) {
      return `Hi ${
        patientName.split(" ")[0]
      }, you're ${distanceMiles} miles away. We've scheduled your telemedicine appointment. You'll receive a video link before your visit.`;
    }
    return null;
  };

  const patientMessage = generatePatientMessage();

  return (
    <div className="card">
      <div className="hstack" style={{ justifyContent: "space-between" }}>
        <div className="pill">Distance Analysis</div>
        <Badge label={status.label} tone={status.tone} />
      </div>

      <div className="section">
        <div className="muted" style={{ marginBottom: 8 }}>
          {status.message}
        </div>

        {isTooFar && (
          <div
            style={{
              padding: 12,
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 6,
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 600, color: "#dc2626", marginBottom: 4 }}>
              ⚠️ Service Area Alert
            </div>
            <div style={{ fontSize: 14, color: "#7f1d1d" }}>
              This patient is outside our service area. Consider:
            </div>
            <ul
              style={{ margin: "4px 0 0 16px", fontSize: 14, color: "#7f1d1d" }}
            >
              <li>Referring to a closer provider</li>
              <li>Offering telemedicine if clinically appropriate</li>
              <li>Discussing travel arrangements with patient</li>
            </ul>
          </div>
        )}

        {isWarningDistance && !telefit && (
          <div
            style={{
              padding: 12,
              backgroundColor: "#fffbeb",
              border: "1px solid #fed7aa",
              borderRadius: 6,
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 600, color: "#d97706", marginBottom: 4 }}>
              💡 Telemedicine Opportunity
            </div>
            <div style={{ fontSize: 14, color: "#92400e" }}>
              Patient is far but telemedicine could be a good option for this
              visit.
            </div>
          </div>
        )}

        {patientMessage && (
          <div className="hstack" style={{ gap: 8, marginTop: 8 }}>
            <button
              className="button"
              onClick={() => onNotifyPatient(patientMessage)}
              style={{ flex: 1 }}
            >
              Notify Patient About Distance
            </button>
          </div>
        )}

        <div className="hr" style={{ margin: "12px 0" }} />

        <div className="vstack" style={{ gap: 4, fontSize: 14 }}>
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            <span className="muted">Service area limit:</span>
            <span>{MAX_DISTANCE_MILES} miles</span>
          </div>
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            <span className="muted">Patient distance:</span>
            <span style={{ fontWeight: 600 }}>{distanceMiles} miles</span>
          </div>
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            <span className="muted">Telemedicine available:</span>
            <span>{telefit ? "✅ Yes" : "❌ No"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
