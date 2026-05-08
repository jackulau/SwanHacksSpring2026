// Text-to-speech wrapper around the browser's SpeechSynthesis API.
// Used by the note page reading mode and the ASL-to-note review surface
// so a user can listen to their own content. No external dependencies;
// gracefully no-ops on browsers without speechSynthesis.

export interface TtsOptions {
  rate?: number;
  pitch?: number;
  voiceURI?: string;
  lang?: string;
}

export class Tts {
  readonly available: boolean;
  private utter: SpeechSynthesisUtterance | null = null;

  constructor() {
    this.available =
      typeof window !== "undefined" &&
      typeof window.speechSynthesis !== "undefined";
  }

  /**
   * List voices that match the requested language prefix (e.g. "en"
   * matches "en-US" and "en-GB"). Returns [] when the browser hasn't
   * finished loading voices yet — pass through `voiceschanged` event
   * for a refreshed list.
   */
  voices(langPrefix?: string): SpeechSynthesisVoice[] {
    if (!this.available) return [];
    const all = window.speechSynthesis.getVoices();
    if (!langPrefix) return all;
    const lp = langPrefix.toLowerCase();
    return all.filter((v) => v.lang.toLowerCase().startsWith(lp));
  }

  speak(text: string, opts: TtsOptions = {}): void {
    if (!this.available || !text) return;
    this.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = opts.rate ?? 1;
    u.pitch = opts.pitch ?? 1;
    u.lang = opts.lang ?? "en-US";
    if (opts.voiceURI) {
      const voice = this.voices().find((v) => v.voiceURI === opts.voiceURI);
      if (voice) u.voice = voice;
    }
    this.utter = u;
    window.speechSynthesis.speak(u);
  }

  pause(): void {
    if (!this.available) return;
    window.speechSynthesis.pause();
  }

  resume(): void {
    if (!this.available) return;
    window.speechSynthesis.resume();
  }

  cancel(): void {
    if (!this.available) return;
    window.speechSynthesis.cancel();
    this.utter = null;
  }

  get speaking(): boolean {
    if (!this.available) return false;
    return window.speechSynthesis.speaking;
  }

  get paused(): boolean {
    if (!this.available) return false;
    return window.speechSynthesis.paused;
  }
}

let _shared: Tts | null = null;
export function getTts(): Tts {
  if (!_shared) _shared = new Tts();
  return _shared;
}
