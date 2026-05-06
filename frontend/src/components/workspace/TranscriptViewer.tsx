import { useEffect, useMemo, useRef } from 'react';
import { FileText } from 'lucide-react';
import { EmptyState } from '../layout/EmptyState';
import type { TranscriptSegment, Speaker } from '../../lib/types';

interface TranscriptViewerProps {
  /** Cleaned full text (used as fallback when segments aren't available). */
  cleanText: string;
  /** Raw STT output, used only as a deeper fallback. */
  rawText: string;
  /** Segments with timestamps + speaker — the preferred render path. */
  segments?: TranscriptSegment[];
  /** Map of speaker id -> human label. */
  speakers?: Speaker[];
  /** Called when a student clicks a timestamp to seek the audio. */
  onSeek?: (seconds: number) => void;
  /** Currently-playing time, used to highlight the active segment. */
  currentTime?: number;
}

function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Document-style transcript. Segments flow as continuous prose with the
 * speaker as a left-margin label and a hover-revealed timestamp button. One
 * click on the timestamp seeks the global AudioPlayer.
 */
export function TranscriptViewer({
  cleanText,
  rawText,
  segments,
  speakers,
  onSeek,
  currentTime = 0,
}: TranscriptViewerProps) {
  const speakerLabel = useMemo(() => {
    const map = new Map<string, string>();
    speakers?.forEach((s) => map.set(s.id, s.label));
    return (id?: string) => (id ? (map.get(id) ?? id) : '');
  }, [speakers]);

  const hasSegments = Array.isArray(segments) && segments.length > 0;
  const fallbackText = cleanText || rawText;

  // Active segment index — gently scroll into view during playback so the
  // student doesn't have to chase the active line by hand.
  const activeIdx = useMemo(() => {
    if (!hasSegments) return -1;
    return segments!.findIndex(
      (s) => currentTime >= s.start && currentTime < s.end,
    );
  }, [hasSegments, segments, currentTime]);

  const lastScrolledIdx = useRef<number>(-1);
  const activeRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (activeIdx < 0 || activeIdx === lastScrolledIdx.current) return;
    lastScrolledIdx.current = activeIdx;
    // Respect prefers-reduced-motion: jump instead of smooth scroll so we
    // don't trigger motion sickness for users with that pref.
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    activeRef.current?.scrollIntoView({
      block: 'center',
      behavior: prefersReduced ? 'auto' : 'smooth',
    });
  }, [activeIdx]);

  if (!hasSegments && !fallbackText) {
    return (
      <EmptyState
        icon={FileText}
        title="No transcript yet"
        description="The transcript will appear here once this lecture finishes processing."
        size="md"
      />
    );
  }

  return (
    <article
      data-focus-zone
      tabIndex={0}
      aria-label="Lecture transcript"
      className="max-w-3xl mx-auto focus:outline-2 focus:outline-[var(--color-primary)] focus:outline-offset-4 rounded-sm"
    >
      {hasSegments ? (
        <ol className="list-none p-0 m-0 space-y-4">
          {segments.map((seg, i) => {
            const label = speakerLabel(seg.speaker);
            const isActive = i === activeIdx;
            return (
              <li
                key={`${seg.start}-${i}`}
                ref={isActive ? activeRef : undefined}
                className="group grid grid-cols-[7rem_1fr] gap-4 items-baseline scroll-mt-24"
                aria-current={isActive ? 'true' : undefined}
              >
                <div className="flex flex-col items-start text-left">
                  {label && (
                    <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-subtle)]">
                      {label}
                    </span>
                  )}
                  {onSeek ? (
                    <button
                      type="button"
                      onClick={() => onSeek(seg.start)}
                      className="text-xs font-mono tabular-nums text-[var(--color-text-subtle)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-[var(--color-primary-strong)] focus-visible:text-[var(--color-primary-strong)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] focus-visible:outline-offset-2 rounded-sm transition-opacity"
                      aria-label={`Play from ${formatTimestamp(seg.start)}`}
                    >
                      {formatTimestamp(seg.start)}
                    </button>
                  ) : (
                    <span className="text-xs font-mono tabular-nums text-[var(--color-text-subtle)] opacity-0 group-hover:opacity-100">
                      {formatTimestamp(seg.start)}
                    </span>
                  )}
                </div>
                <p
                  className={`leading-7 ${
                    isActive
                      ? 'text-[var(--color-text)]'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                >
                  {seg.text}
                </p>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="space-y-4">
          {fallbackText.split(/\n{2,}/).map((paragraph, i) => (
            <p
              key={i}
              className="text-[var(--color-text-muted)] leading-7"
            >
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </article>
  );
}
