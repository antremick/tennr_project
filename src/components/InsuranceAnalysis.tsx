import React from "react";
import { Badge } from "./Badges";
import type { Coverage271 } from "../types";

interface InsuranceAnalysisProps {
  coverage: Coverage271;
  patientName: string;
  specialty: string;
  dx: string[];
  cpt: string[];
  onNotifyPatient: (message: string) => void;
}

export default function InsuranceAnalysis({
  coverage,
  patientName,
  specialty,
  dx,
  cpt,
  onNotifyPatient,
}: InsuranceAnalysisProps) {
  // Analyze reimbursement likelihood based on coverage data
  const analyzeReimbursementLikelihood = () => {
    let score = 0;
    let factors: string[] = [];
    let riskLevel: "low" | "medium" | "high" = "low";

    // Check if coverage is active
    if (!coverage.active) {
      score = 0;
      factors.push("No active coverage");
      riskLevel = "high";
    } else {
      score = 50; // Base score for active coverage

      // Network status (most important factor)
      if (coverage.inNetwork) {
        score += 30;
        factors.push("In-network provider");
      } else {
        score -= 20;
        factors.push("Out-of-network provider");
        riskLevel = "high";
      }

      // Prior authorization requirement
      if (coverage.priorAuthRequired) {
        score -= 15;
        factors.push("Prior authorization required");
        if (riskLevel === "low") riskLevel = "medium";
      } else {
        score += 10;
        factors.push("No prior auth needed");
      }

      // Deductible status
      if (coverage.deductibleRemaining > 0) {
        if (coverage.deductibleRemaining > 2000) {
          score -= 10;
          factors.push("High deductible remaining");
          if (riskLevel === "low") riskLevel = "medium";
        } else {
          score += 5;
          factors.push("Low deductible remaining");
        }
      } else {
        score += 15;
        factors.push("Deductible met");
      }

      // Copay estimate
      if (coverage.copayEstimate > 100) {
        score -= 5;
        factors.push("High copay estimate");
      } else if (coverage.copayEstimate < 25) {
        score += 5;
        factors.push("Low copay estimate");
      }

      // Payer type analysis
      const payer = coverage.payer.toLowerCase();
      if (payer.includes("medicare")) {
        score += 10;
        factors.push("Medicare coverage (reliable)");
      } else if (payer.includes("medicaid")) {
        score += 5;
        factors.push("Medicaid coverage");
      } else if (payer.includes("commercial") || payer.includes("private")) {
        score += 8;
        factors.push("Commercial insurance");
      } else if (payer.includes("self-pay") || payer.includes("uninsured")) {
        score -= 25;
        factors.push("Self-pay/uninsured");
        riskLevel = "high";
      }

      // Specialty-specific considerations
      if (
        specialty.toLowerCase().includes("cardiology") ||
        specialty.toLowerCase().includes("oncology")
      ) {
        score += 5;
        factors.push("Specialty typically well-covered");
      }
    }

    // Ensure score is between 0-100
    score = Math.max(0, Math.min(100, score));

    // Determine final risk level based on score
    if (score < 40) riskLevel = "high";
    else if (score < 70) riskLevel = "medium";
    else riskLevel = "low";

    return { score, factors, riskLevel };
  };

  const analysis = analyzeReimbursementLikelihood();

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "high":
        return "#dc2626";
      case "medium":
        return "#d97706";
      case "low":
        return "#059669";
      default:
        return "#6b7280";
    }
  };

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case "high":
        return "High Risk";
      case "medium":
        return "Medium Risk";
      case "low":
        return "Low Risk";
      default:
        return "Unknown";
    }
  };

  const generatePatientMessage = () => {
    const firstName = patientName.split(" ")[0];

    if (analysis.riskLevel === "high") {
      if (!coverage.active) {
        return `Hi ${firstName}, we need to verify your insurance coverage before your appointment. Please call us at (555) 123-4567 to update your insurance information.`;
      } else if (!coverage.inNetwork) {
        return `Hi ${firstName}, you're out-of-network with ${coverage.payer}. This may result in higher out-of-pocket costs. We can help you understand your options. Call (555) 123-4567.`;
      } else {
        return `Hi ${firstName}, we need to verify some insurance details before your appointment. Please call us at (555) 123-4567 to discuss coverage and costs.`;
      }
    } else if (analysis.riskLevel === "medium") {
      if (coverage.priorAuthRequired) {
        return `Hi ${firstName}, your visit requires prior authorization from ${coverage.payer}. We're handling this for you. You'll be notified once approved. Call (555) 123-4567 with questions.`;
      } else {
        return `Hi ${firstName}, your appointment is confirmed. Estimated copay: $${coverage.copayEstimate}. Call (555) 123-4567 if you have questions about coverage.`;
      }
    } else {
      return `Hi ${firstName}, your appointment is confirmed with ${coverage.payer}. Estimated copay: $${coverage.copayEstimate}. See you soon!`;
    }
  };

  const patientMessage = generatePatientMessage();

  return (
    <div className="card">
      <div className="hstack" style={{ justifyContent: "space-between" }}>
        <div className="pill">Insurance Analysis</div>
        <div className="hstack" style={{ gap: 8 }}>
          <Badge
            label={getRiskLabel(analysis.riskLevel)}
            tone={
              analysis.riskLevel === "high"
                ? "danger"
                : analysis.riskLevel === "medium"
                ? "warn"
                : "ok"
            }
          />
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: getRiskColor(analysis.riskLevel),
            }}
          >
            {analysis.score}%
          </div>
        </div>
      </div>

      <div className="section">
        <div className="muted" style={{ marginBottom: 12 }}>
          Reimbursement likelihood based on coverage analysis
        </div>

        {analysis.riskLevel === "high" && (
          <div
            style={{
              padding: 12,
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 6,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 600, color: "#dc2626", marginBottom: 4 }}>
              ⚠️ High Reimbursement Risk
            </div>
            <div style={{ fontSize: 14, color: "#7f1d1d" }}>
              Significant risk of payment issues. Consider:
            </div>
            <ul
              style={{ margin: "4px 0 0 16px", fontSize: 14, color: "#7f1d1d" }}
            >
              <li>Verifying coverage before appointment</li>
              <li>Discussing payment options with patient</li>
              <li>Requesting prior authorization if needed</li>
            </ul>
          </div>
        )}

        {analysis.riskLevel === "medium" && (
          <div
            style={{
              padding: 12,
              backgroundColor: "#fffbeb",
              border: "1px solid #fed7aa",
              borderRadius: 6,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 600, color: "#d97706", marginBottom: 4 }}>
              ⚡ Medium Risk - Action Needed
            </div>
            <div style={{ fontSize: 14, color: "#92400e" }}>
              Some verification or authorization may be required.
            </div>
          </div>
        )}

        <div className="vstack" style={{ gap: 8, marginBottom: 12 }}>
          {analysis.factors.map((factor, index) => (
            <div
              key={index}
              className="hstack"
              style={{ gap: 8, alignItems: "center" }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor:
                    factor.includes("No active") ||
                    factor.includes("Out-of-network") ||
                    factor.includes("Self-pay")
                      ? "#dc2626"
                      : factor.includes("Prior authorization") ||
                        factor.includes("High deductible")
                      ? "#d97706"
                      : "#059669",
                }}
              />
              <span style={{ fontSize: 14 }}>{factor}</span>
            </div>
          ))}
        </div>

        <div className="hr" style={{ margin: "12px 0" }} />

        <div
          className="vstack"
          style={{ gap: 4, fontSize: 14, marginBottom: 12 }}
        >
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            <span className="muted">Payer:</span>
            <span style={{ fontWeight: 600 }}>{coverage.payer}</span>
          </div>
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            <span className="muted">Plan:</span>
            <span>{coverage.plan}</span>
          </div>
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            <span className="muted">Network status:</span>
            <span>
              {coverage.inNetwork ? "✅ In-network" : "❌ Out-of-network"}
            </span>
          </div>
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            <span className="muted">Prior auth:</span>
            <span>
              {coverage.priorAuthRequired ? "⚠️ Required" : "✅ Not required"}
            </span>
          </div>
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            <span className="muted">Deductible remaining:</span>
            <span>${coverage.deductibleRemaining}</span>
          </div>
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            <span className="muted">Est. copay:</span>
            <span>${coverage.copayEstimate}</span>
          </div>
        </div>

        {patientMessage && (
          <button
            className="button"
            onClick={() => onNotifyPatient(patientMessage)}
            style={{ width: "100%" }}
          >
            Notify Patient About Insurance
          </button>
        )}
      </div>
    </div>
  );
}
