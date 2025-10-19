// src/lib/remote.ts
import type { Referral, CompletenessResult, AuthPrediction } from "../types";

export async function evalCompletenessLLM(
  ref: Referral
): Promise<CompletenessResult> {
  const r = await fetch("/api/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "completeness", referral: ref }),
  });
  if (!r.ok) throw new Error(`LLM completeness failed: ${r.status}`);
  const data = await r.json();
  return data.result as CompletenessResult;
}

export async function evalAuthLLM(ref: Referral): Promise<AuthPrediction> {
  const r = await fetch("/api/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "auth", referral: ref }),
  });
  if (!r.ok) throw new Error(`LLM auth failed: ${r.status}`);
  const data = await r.json();
  return data.result as AuthPrediction;
}

// NEW: PDF extraction (serverless)
export async function extractPdfText(pdfPathOrUrl: string): Promise<string> {
  const isAbs = /^https?:\/\//i.test(pdfPathOrUrl);
  const r = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      isAbs ? { url: pdfPathOrUrl } : { path: pdfPathOrUrl }
    ),
  });
  if (!r.ok) throw new Error(`PDF extract failed: ${r.status}`);
  const data = await r.json();
  return (data.text ?? "").trim();
}

export type BundleEval = {
  summary: string;
  messages: { referrerAsk: string; patientSMS: string };
  completeness: CompletenessResult;
  auth: AuthPrediction;
};

export async function evalBundleLLM(ref: Referral): Promise<BundleEval> {
  const r = await fetch("/api/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: "bundle", referral: ref }),
  });
  if (!r.ok) throw new Error(`LLM bundle failed: ${r.status}`);
  const data = await r.json();
  return data.result as BundleEval;
}