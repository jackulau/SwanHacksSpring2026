// Voice notes — a thin wrapper around the browser's SpeechRecognition
// API so the rest of the app can stream a live transcript without
// directly poking at vendor-prefixed globals.
//
// Browser support is limited (Chromium-based desktop and Safari iOS at
// time of writing). Callers should branch on `recorder.available` and
// degrade gracefully when the API is missing.

export interface VoiceTranscript {
  /** The text for this chunk. Interim chunks may be revised. */
  text: string;
  /** True when the engine is committed to this segment. */
  isFinal: boolean;
}

/**
 * Minimal structural type for the SpeechRecognition constructor. We
 * fall back to this when the global declared by
 * `@types/dom-speech-recognition` isn't available (e.g. in test
 * environments that don't pull in DOM types).
 */
type SpeechRecognitionCtor = new () => SpeechRecognition;

interface SpeechRecognitionWindow {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as SpeechRecognitionWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface VoiceNoteRecorderOptions {
  lang?: string;
}

/**
 * Wraps `SpeechRecognition` with a small, callback-driven surface.
 *
 * Lifecycle:
 *   const r = new VoiceNoteRecorder({ lang: "en-US" });
 *   if (!r.available) { /* show fallback *\/ }
 *   r.start((chunk) => { ... });   // continuous, with interim results
 *   r.stop();
 *
 * The recorder is single-shot — call `start` once, then `stop`. The UI
 * layer recreates the instance on the next session. Some Chromium
 * builds raise a transient `no-speech` error when the user pauses;
 * we swallow it and keep the session alive by auto-restarting until
 * `stop()` is called.
 */
export class VoiceNoteRecorder {
  readonly available: boolean;
  private readonly Ctor: SpeechRecognitionCtor | null;
  private readonly lang: string;
  private rec: SpeechRecognition | null = null;
  private onChunk: ((t: VoiceTranscript) => void) | null = null;
  private stopped = false;

  constructor(options: VoiceNoteRecorderOptions = {}) {
    this.Ctor = getCtor();
    this.available = this.Ctor !== null;
    this.lang = options.lang ?? (typeof navigator !== "undefined" ? navigator.language : "en-US");
  }

  start(onChunk: (t: VoiceTranscript) => void): void {
    if (!this.Ctor) return;
    if (this.rec) return; // already started
    this.onChunk = onChunk;
    this.stopped = false;
    const rec = new this.Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = this.lang;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      // Walk every result the engine has produced since `resultIndex`.
      // Final results emit once; interim results stream as they're
      // refined, so the UI gets a steady "live transcript" feed.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result || result.length === 0) continue;
        const text = result[0].transcript;
        if (!text) continue;
        this.onChunk?.({ text, isFinal: result.isFinal });
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      // `no-speech` and `aborted` are normal end-of-utterance signals
      // for some engines; let `onend` handle restart logic.
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.stopped = true;
      }
    };

    rec.onend = () => {
      // Continuous mode auto-stops on long silences in some browsers.
      // Restart unless the caller explicitly stopped us.
      if (this.stopped) {
        this.rec = null;
        return;
      }
      try {
        rec.start();
      } catch {
        // Some browsers throw if start() is called while still ending;
        // if that happens we simply give up and let stop() finalize.
        this.rec = null;
      }
    };

    this.rec = rec;
    try {
      rec.start();
    } catch {
      // Already-started or permission denied.
      this.rec = null;
    }
  }

  stop(): void {
    this.stopped = true;
    const rec = this.rec;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      // ignore — engine already stopped
    }
    this.rec = null;
  }
}
