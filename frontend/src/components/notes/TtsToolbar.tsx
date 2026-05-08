import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pause,
  Play,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import type { NoteBlock } from "../../lib/types";
import { getTts } from "../../lib/tts";

interface TtsToolbarProps {
  blocks: NoteBlock[];
  title: string;
  readOnly: boolean;
}

type PlaybackState = "idle" | "playing" | "paused";

const ACTIVE_BLOCK_CLASS = "tts-active-block";

/**
 * Block-by-block TTS playback toolbar. Plays one block at a time and
 * advances on the utterance's `onend` event so the user can scrub to
 * the prev/next block, change speed mid-stream, or pick a voice.
 *
 * The active block is visually highlighted by toggling a class on the
 * `[data-block-id="<id>"]` row inside the page editor — that lookup
 * stays decoupled from the editor implementation.
 */
export function TtsToolbar({ blocks, title, readOnly: _readOnly }: TtsToolbarProps) {
  const tts = useMemo(() => getTts(), []);
  const [state, setState] = useState<PlaybackState>("idle");
  const [index, setIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Imperative refs so the utterance `onend` callback always sees the
  // latest playback intent without re-binding the speech queue every
  // time React re-renders.
  const indexRef = useRef(0);
  const stateRef = useRef<PlaybackState>("idle");
  const rateRef = useRef(1);
  const voiceRef = useRef<string>("");
  const blocksRef = useRef<NoteBlock[]>(blocks);
  const titleRef = useRef<string>(title);
  const advancingRef = useRef(false);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);
  useEffect(() => {
    voiceRef.current = voiceURI;
  }, [voiceURI]);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  // Build the readable sequence: the title prepended to all blocks that
  // have any spoken text.
  const sequence = useMemo(() => buildSequence(title, blocks), [title, blocks]);
  const sequenceRef = useRef(sequence);
  useEffect(() => {
    sequenceRef.current = sequence;
  }, [sequence]);

  // Voice list — populated via `voiceschanged` because some browsers
  // ship voices asynchronously after construction.
  useEffect(() => {
    if (!tts.available) return;
    const refresh = () => {
      const next = tts.voices("en").slice(0, 5);
      setVoices(next);
      setVoiceURI((cur) => (cur || (next[0]?.voiceURI ?? "")));
    };
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", refresh);
    };
  }, [tts]);

  /** Toggle the highlight class on the row for `id`. */
  const setActiveHighlight = useCallback((id: string | null) => {
    document
      .querySelectorAll(`.${ACTIVE_BLOCK_CLASS}`)
      .forEach((el) => el.classList.remove(ACTIVE_BLOCK_CLASS));
    if (id) {
      const el = document.querySelector<HTMLElement>(
        `[data-block-id="${id}"]`,
      );
      el?.classList.add(ACTIVE_BLOCK_CLASS);
    }
  }, []);

  /**
   * Speak the entry at the given index. Subsequent indices play via the
   * `onend` callback; we mark `advancingRef` to distinguish a natural
   * end from a user-initiated cancel (which also fires onend).
   */
  const speakAt = useCallback(
    (i: number) => {
      const seq = sequenceRef.current;
      if (i < 0 || i >= seq.length) {
        setState("idle");
        setActiveHighlight(null);
        return;
      }
      const entry = seq[i];
      setIndex(i);
      setActiveHighlight(entry.blockId);
      setState("playing");
      advancingRef.current = false;
      // Use the underlying SpeechSynthesisUtterance directly so we can
      // attach an `onend` callback. The wrapper's `speak()` would also
      // work but doesn't surface end events.
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(entry.text);
      u.rate = rateRef.current;
      u.lang = "en-US";
      const v = tts
        .voices()
        .find((vc) => vc.voiceURI === voiceRef.current);
      if (v) u.voice = v;
      u.onend = () => {
        if (advancingRef.current) return;
        if (stateRef.current !== "playing") return;
        const next = indexRef.current + 1;
        if (next >= sequenceRef.current.length) {
          setState("idle");
          setActiveHighlight(null);
          return;
        }
        speakAt(next);
      };
      window.speechSynthesis.speak(u);
    },
    [tts, setActiveHighlight],
  );

  const onPlayPause = useCallback(() => {
    if (!tts.available) return;
    if (state === "playing") {
      tts.pause();
      setState("paused");
      return;
    }
    if (state === "paused") {
      tts.resume();
      setState("playing");
      return;
    }
    if (sequence.length === 0) return;
    speakAt(Math.min(indexRef.current, sequence.length - 1));
  }, [state, sequence, speakAt, tts]);

  const onStop = useCallback(() => {
    advancingRef.current = true;
    tts.cancel();
    setState("idle");
    setIndex(0);
    setActiveHighlight(null);
  }, [tts, setActiveHighlight]);

  const onPrev = useCallback(() => {
    if (sequence.length === 0) return;
    const target = Math.max(0, indexRef.current - 1);
    advancingRef.current = true;
    speakAt(target);
  }, [sequence.length, speakAt]);

  const onNext = useCallback(() => {
    if (sequence.length === 0) return;
    const target = indexRef.current + 1;
    if (target >= sequence.length) {
      onStop();
      return;
    }
    advancingRef.current = true;
    speakAt(target);
  }, [sequence.length, speakAt, onStop]);

  // When the rate changes mid-playback, restart the current entry so
  // the new rate takes effect — SpeechSynthesisUtterance doesn't expose
  // a live rate setter.
  const onRateChange = useCallback(
    (next: number) => {
      setRate(next);
      rateRef.current = next;
      if (stateRef.current === "playing") {
        advancingRef.current = true;
        speakAt(indexRef.current);
      }
    },
    [speakAt],
  );

  const onVoiceChange = useCallback(
    (next: string) => {
      setVoiceURI(next);
      voiceRef.current = next;
      if (stateRef.current === "playing") {
        advancingRef.current = true;
        speakAt(indexRef.current);
      }
    },
    [speakAt],
  );

  // On unmount cancel any in-flight speech and clear the highlight so
  // we don't leave outlines behind on navigation.
  useEffect(() => {
    return () => {
      tts.cancel();
      document
        .querySelectorAll(`.${ACTIVE_BLOCK_CLASS}`)
        .forEach((el) => el.classList.remove(ACTIVE_BLOCK_CLASS));
    };
  }, [tts]);

  if (!tts.available) return null;

  const total = sequence.length;
  const positionLabel = total === 0 ? "0 / 0" : `${Math.min(index + 1, total)} / ${total}`;

  return (
    <div
      data-tts-toolbar
      className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]/40"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2 text-xs">
        <Volume2
          className="w-3.5 h-3.5 text-[var(--color-text-subtle)]"
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={onPrev}
          disabled={total === 0}
          aria-label="Previous block"
          className="px-1.5 h-6 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] disabled:opacity-40"
        >
          <SkipBack className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onPlayPause}
          disabled={total === 0}
          aria-label={state === "playing" ? "Pause" : "Play"}
          aria-pressed={state === "playing"}
          className="px-1.5 h-6 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] disabled:opacity-40"
        >
          {state === "playing" ? (
            <Pause className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={total === 0}
          aria-label="Next block"
          className="px-1.5 h-6 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] disabled:opacity-40"
        >
          <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={state === "idle"}
          aria-label="Stop"
          className="px-1.5 h-6 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] disabled:opacity-40"
        >
          <Square className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <span className="text-[var(--color-text-subtle)] tabular-nums">
          {positionLabel}
        </span>

        <div className="flex items-center gap-1.5 ml-2">
          <label
            htmlFor="tts-rate"
            className="text-[var(--color-text-subtle)]"
          >
            Speed
          </label>
          <input
            id="tts-rate"
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={rate}
            onChange={(e) => onRateChange(Number(e.target.value))}
            className="w-24 accent-[var(--color-primary)]"
          />
          <span className="text-[var(--color-text-muted)] tabular-nums w-8">
            {rate.toFixed(1)}x
          </span>
        </div>

        {voices.length > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <label
              htmlFor="tts-voice"
              className="text-[var(--color-text-subtle)]"
            >
              Voice
            </label>
            <select
              id="tts-voice"
              value={voiceURI}
              onChange={(e) => onVoiceChange(e.target.value)}
              className="bg-transparent border border-[var(--color-border)] rounded px-1.5 h-6 text-[var(--color-text)]"
            >
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

interface SpeakEntry {
  blockId: string;
  text: string;
}

/**
 * Flatten a page into a list of (blockId, text) pairs the TTS engine
 * can iterate over. The title is yielded first under the id of the
 * first block so its highlight lights up the page header area's
 * neighbour rather than nothing.
 */
function buildSequence(title: string, blocks: NoteBlock[]): SpeakEntry[] {
  const out: SpeakEntry[] = [];
  const firstId = blocks[0]?.id ?? "";
  if (title.trim() && firstId) {
    out.push({ blockId: firstId, text: title.trim() });
  }
  for (const b of blocks) {
    const text = blockText(b);
    if (text) out.push({ blockId: b.id, text });
  }
  return out;
}

function blockText(b: NoteBlock): string {
  switch (b.type) {
    case "paragraph":
    case "heading":
    case "bullet_item":
    case "numbered_item":
    case "todo":
    case "toggle":
    case "quote":
    case "callout":
    case "example":
      return b.text || "";
    case "code":
      return b.code || "";
    case "math":
      return b.expression || "";
    case "key_term":
      return `${b.term}. ${b.definition}`;
    case "bullet_list":
      return (b.items || []).join(". ");
    case "image":
      return b.caption || b.alt || "";
    case "embed":
      return b.title || "";
    case "page_ref":
      return b.title || "";
    case "table":
      return (b.rows || []).map((r) => r.join(", ")).join(". ");
    case "divider":
      return "";
    default:
      return "";
  }
}
