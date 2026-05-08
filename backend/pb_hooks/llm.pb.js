/// <reference path="../pb_data/types.d.ts" />
//
// llm.pb.js — server-side proxies for Anthropic, OpenAI, and a small
// /api/knowledge/ask synthesis route. Frontend providers POST to these
// endpoints; the API key never leaves the server.
//
// Configure via env (loaded from backend/.env by dev.sh):
//   ANTHROPIC_API_KEY
//   OPENAI_API_KEY
//   OPENAI_MODEL          (optional, default gpt-5)
//   ANTHROPIC_MODEL       (optional, default claude-opus-4-7)
//   ANTHROPIC_VISION_MODEL (optional, default claude-opus-4-7)
//   OPENAI_VISION_MODEL    (optional, default gpt-5)
//
// All endpoints require an authenticated PB user; server-side route
// handlers don't auto-enforce auth, so we read e.requestInfo().auth
// and reject unauthenticated calls.

function requireAuth(e) {
  const info = e.requestInfo();
  if (!info || !info.auth) {
    return { error: e.json(401, { error: "auth required" }) };
  }
  return { info };
}

// ───────────── Anthropic Messages chat ─────────────
routerAdd("POST", "/api/llm/anthropic", (e) => {
  const guard = requireAuth(e);
  if (guard.error) return guard.error;
  const apiKey = $os.getenv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return e.json(503, { error: "ANTHROPIC_API_KEY not configured" });
  }
  const model = $os.getenv("ANTHROPIC_MODEL") || "claude-opus-4-7";

  const body = guard.info.body || {};
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return e.json(400, { error: "messages[] required" });
  }
  const maxTokens = Number(body.max_tokens) > 0 ? Number(body.max_tokens) : 1024;
  const temperature =
    typeof body.temperature === "number" ? body.temperature : 0.7;

  // Split system message out — Anthropic wants it as its own field.
  let systemText = "";
  const cleaned = [];
  for (const m of messages) {
    if (m.role === "system") {
      systemText = systemText
        ? `${systemText}\n\n${m.content}`
        : String(m.content || "");
    } else {
      cleaned.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || ""),
      });
    }
  }

  const payload = {
    model: body.model || model,
    max_tokens: Math.min(8192, maxTokens),
    temperature,
    system: systemText || undefined,
    messages: cleaned,
  };

  try {
    const res = $http.send({
      method: "POST",
      url: "https://api.anthropic.com/v1/messages",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      timeout: 60,
    });
    if (res.statusCode >= 400) {
      return e.json(res.statusCode, {
        error: "anthropic upstream",
        detail: res.body,
      });
    }
    const data = JSON.parse(res.body);
    const text = (data.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    return e.json(200, { text });
  } catch (err) {
    return e.json(502, { error: String(err) });
  }
});

// ───────────── OpenAI chat completions ─────────────
routerAdd("POST", "/api/llm/openai", (e) => {
  const guard = requireAuth(e);
  if (guard.error) return guard.error;
  const apiKey = $os.getenv("OPENAI_API_KEY");
  if (!apiKey) {
    return e.json(503, { error: "OPENAI_API_KEY not configured" });
  }
  const model = $os.getenv("OPENAI_MODEL") || "gpt-5";

  const body = guard.info.body || {};
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return e.json(400, { error: "messages[] required" });
  }
  const maxTokens = Number(body.max_tokens) > 0 ? Number(body.max_tokens) : 1024;
  const temperature =
    typeof body.temperature === "number" ? body.temperature : 0.7;

  const payload = {
    model: body.model || model,
    max_tokens: Math.min(8192, maxTokens),
    temperature,
    messages: messages.map((m) => ({
      role: m.role,
      content: String(m.content || ""),
    })),
  };
  if (body.response_format === "json") {
    payload.response_format = { type: "json_object" };
  }

  try {
    const res = $http.send({
      method: "POST",
      url: "https://api.openai.com/v1/chat/completions",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      timeout: 60,
    });
    if (res.statusCode >= 400) {
      return e.json(res.statusCode, {
        error: "openai upstream",
        detail: res.body,
      });
    }
    const data = JSON.parse(res.body);
    const text = data?.choices?.[0]?.message?.content ?? "";
    return e.json(200, { text });
  } catch (err) {
    return e.json(502, { error: String(err) });
  }
});

// ───────────── Anthropic vision proxy for ASL frames ─────────────
routerAdd("POST", "/api/asl/recognize-anthropic", (e) => {
  const guard = requireAuth(e);
  if (guard.error) return guard.error;
  const apiKey = $os.getenv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return e.json(503, { error: "ANTHROPIC_API_KEY not configured" });
  }
  const model = $os.getenv("ANTHROPIC_VISION_MODEL") || "claude-opus-4-7";
  const body = guard.info.body || {};
  const frames = Array.isArray(body.frames) ? body.frames : [];
  if (frames.length === 0) {
    return e.json(400, { error: "frames[] (base64 JPEGs) required" });
  }

  const content = [
    {
      type: "text",
      text:
        "These are sequential frames sampled from a short video of someone " +
        "signing in American Sign Language. Output JSON with " +
        '{"transcription": <string>, "confidence": <number 0-1>}. ' +
        "If unclear, transcription:'[unclear]' and confidence < 0.4. " +
        "Be concise; do not narrate.",
    },
  ];
  for (const f of frames.slice(0, 12)) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: f },
    });
  }

  try {
    const res = $http.send({
      method: "POST",
      url: "https://api.anthropic.com/v1/messages",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: body.model || model,
        max_tokens: 100,
        messages: [{ role: "user", content }],
      }),
      timeout: 30,
    });
    if (res.statusCode >= 400) {
      return e.json(res.statusCode, {
        error: "anthropic upstream",
        detail: res.body,
      });
    }
    const data = JSON.parse(res.body);
    const text = (data.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    let parsed = null;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    } catch {}
    if (!parsed) {
      return e.json(200, {
        transcription: "[unclear]",
        confidence: 0.3,
        raw: text,
      });
    }
    return e.json(200, parsed);
  } catch (err) {
    return e.json(502, { error: String(err) });
  }
});

// ───────────── OpenAI vision proxy for ASL frames ─────────────
routerAdd("POST", "/api/asl/recognize-openai", (e) => {
  const guard = requireAuth(e);
  if (guard.error) return guard.error;
  const apiKey = $os.getenv("OPENAI_API_KEY");
  if (!apiKey) {
    return e.json(503, { error: "OPENAI_API_KEY not configured" });
  }
  const model = $os.getenv("OPENAI_VISION_MODEL") || "gpt-5";
  const body = guard.info.body || {};
  const frames = Array.isArray(body.frames) ? body.frames : [];
  if (frames.length === 0) {
    return e.json(400, { error: "frames[] (base64 JPEGs) required" });
  }

  const content = [
    {
      type: "text",
      text:
        "These are sequential frames from a webcam capturing one ASL sign. " +
        "Output JSON with {transcription, confidence}. If unclear, return " +
        '{"transcription":"[unclear]","confidence":0.3}.',
    },
  ];
  for (const f of frames.slice(0, 8)) {
    content.push({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64," + f },
    });
  }

  try {
    const res = $http.send({
      method: "POST",
      url: "https://api.openai.com/v1/chat/completions",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: body.model || model,
        max_tokens: 100,
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
      }),
      timeout: 30,
    });
    if (res.statusCode >= 400) {
      return e.json(res.statusCode, {
        error: "openai upstream",
        detail: res.body,
      });
    }
    const data = JSON.parse(res.body);
    const text = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }
    if (!parsed) {
      return e.json(200, {
        transcription: "[unclear]",
        confidence: 0.3,
        raw: text,
      });
    }
    return e.json(200, parsed);
  } catch (err) {
    return e.json(502, { error: String(err) });
  }
});

// ───────────── Knowledge ask synthesis ─────────────
routerAdd("POST", "/api/knowledge/ask", (e) => {
  const guard = requireAuth(e);
  if (guard.error) return guard.error;

  const body = guard.info.body || {};
  const question = String(body.question || "").trim();
  const citations = Array.isArray(body.citations) ? body.citations : [];
  if (!question) return e.json(400, { error: "question required" });

  const prompt =
    "You are a focused study companion. Answer the user's question using " +
    "ONLY the provided source excerpts. Cite sources inline using their " +
    "[index]. Be concise. If the sources don't answer the question, say so.";

  const sourcesBlock = citations
    .map(
      (c) =>
        `[${c.index}] ${c.title || "Untitled"} (${c.source_type})\n${(c.text || "").slice(0, 1200)}`,
    )
    .join("\n\n");

  const messages = [
    { role: "system", content: prompt },
    {
      role: "user",
      content: `Question: ${question}\n\nSources:\n${sourcesBlock}`,
    },
  ];

  // Prefer Anthropic, then OpenAI, then 503 stub.
  const ant = $os.getenv("ANTHROPIC_API_KEY");
  const oai = $os.getenv("OPENAI_API_KEY");
  const apiKey = ant || oai;
  if (!apiKey) {
    return e.json(503, { error: "no LLM provider configured" });
  }

  try {
    if (ant) {
      const res = $http.send({
        method: "POST",
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "x-api-key": ant,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: $os.getenv("ANTHROPIC_MODEL") || "claude-opus-4-7",
          max_tokens: 800,
          system: prompt,
          messages: [
            {
              role: "user",
              content: `Question: ${question}\n\nSources:\n${sourcesBlock}`,
            },
          ],
        }),
        timeout: 60,
      });
      if (res.statusCode >= 400) {
        return e.json(res.statusCode, {
          error: "anthropic upstream",
          detail: res.body,
        });
      }
      const data = JSON.parse(res.body);
      const text = (data.content || [])
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      return e.json(200, { answer: text });
    }
    const res = $http.send({
      method: "POST",
      url: "https://api.openai.com/v1/chat/completions",
      headers: {
        Authorization: "Bearer " + oai,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: $os.getenv("OPENAI_MODEL") || "gpt-5",
        max_tokens: 800,
        messages,
      }),
      timeout: 60,
    });
    if (res.statusCode >= 400) {
      return e.json(res.statusCode, {
        error: "openai upstream",
        detail: res.body,
      });
    }
    const data = JSON.parse(res.body);
    const answer = data?.choices?.[0]?.message?.content ?? "";
    return e.json(200, { answer });
  } catch (err) {
    return e.json(502, { error: String(err) });
  }
});
