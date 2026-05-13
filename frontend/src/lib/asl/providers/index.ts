// VLM provider abstraction for ASL transcription.
//
// Each provider takes a list of base64 JPEG frames and returns a
// {transcription, confidence} pair. Providers are pluggable so we
// can swap anthropic / openai / google or fall back to a deterministic
// "stub" when no API key is configured.
//
// All real-API providers go through PB JS hooks (server-side) so the
// API key never lands in the browser. The stub runs entirely client-
// side — useful for offline demos, broken keys, and CI.

export interface VlmTranscription {
  transcription: string;
  confidence: number;
  raw?: string;
  latencyMs?: number;
}

export interface VlmProvider {
  readonly id: VlmProviderId;
  readonly model: string;
  /**
   * Run a transcription on the given frames. `frames` is an ordered
   * list of base64-encoded JPEGs (no data: prefix). Provider may sub-
   * sample; the contract is "do your best with what you got."
   */
  transcribe(frames: string[], opts?: TranscribeOptions): Promise<VlmTranscription>;
  /** Identify whether the provider has the credentials it needs. */
  isAvailable(): Promise<boolean>;
}

export type VlmProviderId = "stub" | "google" | "anthropic" | "openai";

export interface TranscribeOptions {
  promptOverride?: string;
  abortSignal?: AbortSignal;
}

export const PROMPT_TEXT =
  "These are sequential frames sampled from a short video of someone " +
  "signing in American Sign Language. Output JSON with " +
  '{"transcription": <string>, "confidence": <number 0-1>}. ' +
  "If the sign is unclear or partial, return transcription:'[unclear]' " +
  "and confidence < 0.4. Be concise; do not narrate.";

/**
 * Stub provider — deterministic round-robin labels with confidence 0.5.
 * Only used when no real provider is available; lets the rest of the
 * pipeline (segmenter, persistence, chat UI) run end-to-end without a
 * live key. The label cycles through a small preset so the UI shows
 * variety; the timestamp seed makes it not totally constant.
 */
export class StubProvider implements VlmProvider {
  readonly id = "stub" as const;
  readonly model = "stub-deterministic";
  private readonly preset = [
    "hello",
    "thank you",
    "please",
    "[unclear]",
    "yes",
    "no",
    "help",
    "good",
  ];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async transcribe(frames: string[]): Promise<VlmTranscription> {
    const seed = Math.floor(Date.now() / 1000) % this.preset.length;
    const word = this.preset[(seed + frames.length) % this.preset.length];
    const conf = word === "[unclear]" ? 0.35 : 0.55;
    // Emulate a small inference delay so the UI's "thinking" state shows.
    await new Promise((r) => setTimeout(r, 250));
    return { transcription: word, confidence: conf, latencyMs: 250 };
  }
}

/**
 * Google provider — calls the existing `/api/asl/recognize` PB hook
 * which forwards to Gemini Vision with the server-side GEMINI_API_KEY.
 * Returns 503 if the key isn't set; we surface that as unavailable.
 */
export class GoogleProvider implements VlmProvider {
  readonly id = "google" as const;
  readonly model: string;

  constructor(model = "gemini-2.0-flash") {
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch("/api/asl/recognize", { method: "POST" });
      // 400 (bad body) means the route exists; 503 means key missing.
      return res.status !== 503 && res.status !== 404;
    } catch {
      return false;
    }
  }

  async transcribe(
    frames: string[],
    opts?: TranscribeOptions,
  ): Promise<VlmTranscription> {
    const t0 = performance.now();
    const res = await fetch("/api/asl/recognize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames }),
      signal: opts?.abortSignal,
    });
    const latencyMs = performance.now() - t0;
    if (!res.ok) {
      throw new Error(`google: HTTP ${res.status}`);
    }
    const data = (await res.json()) as { label?: string | null; raw?: string };
    const label = (data.label ?? "[unclear]").trim() || "[unclear]";
    return {
      transcription: label,
      confidence: label === "[unclear]" ? 0.35 : 0.7,
      raw: data.raw,
      latencyMs,
    };
  }
}

/**
 * Anthropic provider — POSTs to a server-side hook that forwards to
 * the Anthropic Messages API with vision content blocks. The hook is
 * not wired yet (requires a PB restart to land); the provider exists
 * so the UI can offer it as a choice and fall through to stub when
 * the endpoint isn't there.
 */
export class AnthropicProvider implements VlmProvider {
  readonly id = "anthropic" as const;
  readonly model: string;

  constructor(model = "claude-opus-4-7") {
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch("/api/asl/recognize-anthropic", {
        method: "POST",
      });
      return res.status !== 404 && res.status !== 503;
    } catch {
      return false;
    }
  }

  async transcribe(
    frames: string[],
    opts?: TranscribeOptions,
  ): Promise<VlmTranscription> {
    const t0 = performance.now();
    const res = await fetch("/api/asl/recognize-anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames, model: this.model }),
      signal: opts?.abortSignal,
    });
    const latencyMs = performance.now() - t0;
    if (!res.ok) throw new Error(`anthropic: HTTP ${res.status}`);
    const data = (await res.json()) as VlmTranscription;
    return { ...data, latencyMs };
  }
}

/**
 * OpenAI provider — symmetric to Anthropic; targets a
 * /api/asl/recognize-openai hook.
 */
export class OpenAIProvider implements VlmProvider {
  readonly id = "openai" as const;
  readonly model: string;

  constructor(model = "gpt-5") {
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch("/api/asl/recognize-openai", {
        method: "POST",
      });
      return res.status !== 404 && res.status !== 503;
    } catch {
      return false;
    }
  }

  async transcribe(
    frames: string[],
    opts?: TranscribeOptions,
  ): Promise<VlmTranscription> {
    const t0 = performance.now();
    const res = await fetch("/api/asl/recognize-openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames, model: this.model }),
      signal: opts?.abortSignal,
    });
    const latencyMs = performance.now() - t0;
    if (!res.ok) throw new Error(`openai: HTTP ${res.status}`);
    const data = (await res.json()) as VlmTranscription;
    return { ...data, latencyMs };
  }
}

/**
 * Resolve a provider by id, falling back to stub if the requested
 * provider can't see its credentials. Probes are cheap (single-shot
 * HEAD-like POST that the server replies to without burning quota).
 */
export async function resolveProvider(
  preferred: VlmProviderId,
): Promise<VlmProvider> {
  const candidates: VlmProvider[] = [
    preferred === "anthropic"
      ? new AnthropicProvider()
      : preferred === "openai"
      ? new OpenAIProvider()
      : preferred === "google"
      ? new GoogleProvider()
      : new StubProvider(),
  ];
  for (const c of candidates) {
    if (await c.isAvailable()) return c;
  }
  return new StubProvider();
}

export const ALL_PROVIDER_IDS: VlmProviderId[] = [
  "google",
  "anthropic",
  "openai",
  "stub",
];
