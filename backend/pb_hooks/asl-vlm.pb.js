/// <reference path="../pb_data/types.d.ts" />

// Gemini Vision proxy for ASL sign recognition.
//
// Frontend ships an array of base64-encoded JPEG frames (sampled across one
// motion segment from the webcam). We forward them to Gemini with a tightly-
// constrained prompt and return the predicted single-word label, or null if
// the model says "unclear". The API key never leaves the server.
//
// Configure via env: GEMINI_API_KEY=...   (and optionally GEMINI_MODEL).

routerAdd("POST", "/api/asl/recognize", (e) => {
  const apiKey = $os.getenv("GEMINI_API_KEY");
  if (!apiKey) {
    return e.json(503, {
      error: "GEMINI_API_KEY not configured on server",
    });
  }
  const model = $os.getenv("GEMINI_MODEL") || "gemini-2.0-flash";

  const info = e.requestInfo();
  const frames = info && info.body && info.body.frames;
  if (!Array.isArray(frames) || frames.length === 0) {
    return e.json(400, {
      error: "frames[] (array of base64 JPEG strings) required",
    });
  }
  if (frames.length > 16) {
    return e.json(400, { error: "max 16 frames per request" });
  }

  const prompt =
    "These are sequential frames from a webcam capturing one ASL " +
    "(American Sign Language) sign. Identify the sign. Reply with only the " +
    "single English word (or short phrase) for the sign, in lowercase " +
    "(e.g. 'school', 'help', 'thank you'). If you cannot determine the sign " +
    "confidently, reply 'unclear'. No explanation, no punctuation.";

  const parts = [{ text: prompt }];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (typeof f !== "string") continue;
    const comma = f.indexOf(",");
    const b64 = comma >= 0 ? f.substring(comma + 1) : f;
    parts.push({
      inline_data: { mime_type: "image/jpeg", data: b64 },
    });
  }

  const start = Date.now();
  let res;
  try {
    res = $http.send({
      url:
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        model +
        ":generateContent?key=" +
        apiKey,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 16 },
      }),
      timeout: 15,
    });
  } catch (err) {
    return e.json(502, {
      error: "Gemini request failed",
      detail: String(err),
    });
  }
  const latencyMs = Date.now() - start;

  if (res.statusCode !== 200) {
    return e.json(res.statusCode, {
      error: "Gemini API error",
      statusCode: res.statusCode,
      detail: res.raw,
      latencyMs: latencyMs,
    });
  }

  const data = res.json || JSON.parse(res.raw);
  let raw = "";
  try {
    raw = data.candidates[0].content.parts[0].text || "";
  } catch (_) {
    raw = "";
  }
  const trimmed = String(raw).trim();
  const cleaned = trimmed.toLowerCase().replace(/[^a-z' \-]/g, "");
  const isUnclear = !cleaned || cleaned === "unclear";

  return e.json(200, {
    label: isUnclear ? null : cleaned,
    raw: trimmed,
    latencyMs: latencyMs,
    model: model,
  });
});
