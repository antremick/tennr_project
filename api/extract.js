// api/extract.js
// Node serverless fn that downloads a PDF (public/docs or remote URL) and extracts text.
// Requires: `npm i pdf-parse`
export const config = { runtime: "nodejs18" };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Body can be { url } or { path: '/docs/xxx.pdf' }
    const body = await (async () => {
      if (req.body && typeof req.body === "object") return req.body;
      const chunks = [];
      for await (const c of req) chunks.push(c);
      try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      } catch {
        return {};
      }
    })();

    let { url, path } = body || {};
    if (!url && path) {
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const proto = req.headers["x-forwarded-proto"] || "https";
      url = new URL(path, `${proto}://${host}`).toString();
    }
    if (!url) {
      res.status(400).json({ error: "Missing url or path" });
      return;
    }

    const resp = await fetch(url);
    if (!resp.ok) {
      const t = await resp.text().catch(() => "(no body)");
      res
        .status(400)
        .json({ error: "Failed to fetch PDF", status: resp.status, detail: t });
      return;
    }
    const ab = await resp.arrayBuffer();
    const buffer = Buffer.from(ab);

    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);

    res.status(200).json({
      ok: true,
      meta: { url, nPages: parsed.numpages ?? null, info: parsed.info ?? null },
      text: parsed.text || "",
    });
  } catch (e) {
    console.error("extract error", e);
    res.status(500).json({ error: "Server error", detail: String(e) });
  }
}
