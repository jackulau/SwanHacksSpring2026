import { useEffect, useRef } from 'react';
import { Hand } from 'lucide-react';
import type { CaptionSegment } from '../../lib/types';

interface LiveCaptionsProps {
  captions: CaptionSegment[];
  fontSize?: number;
  showSpeakerLabels?: boolean;
  showConfidence?: boolean;
  /** Compact, in-flow rendering. No card chrome — just text. */
  placeholder?: string;
}

/**
 * Continuous, typographic transcription view. Reads as a single paragraph
 * (Otter-style) rather than a stack of bubbles. Final segments are bright,
 * interim segments fade muted so the eye knows what's settled.
 */
export function LiveCaptions({
  captions,
  fontSize = 22,
  showSpeakerLabels = true,
  showConfidence = false,
  placeholder = 'Captions will appear here as you speak.',
}: LiveCaptionsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [captions]);

  // Group consecutive segments by speaker for paragraph-like flow. Uncertain
  // segments (confidence < 0.55) get a dotted underline rather than fading
  // their opacity — the reader still sees the words, but knows to verify.
  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto leading-relaxed font-serif tracking-tight text-balance"
      role="log"
      aria-label="Live captions"
      aria-live="polite"
      aria-atomic="false"
      style={{ fontSize, maxHeight: '60vh' }}
    >
      {captions.length === 0 ? (
        <p className="text-[var(--color-text-subtle)] italic" style={{ fontSize: fontSize - 4 }}>
          {placeholder}
        </p>
      ) : (
        <p className="text-[var(--color-text)]">
          {captions.map((segment, i) => {
            const isSign = segment.source === 'sign';
            const prev = captions[i - 1];
            const speakerChanged =
              showSpeakerLabels &&
              segment.speaker &&
              segment.speaker !== prev?.speaker;
            const uncertain =
              showConfidence && segment.isFinal && segment.confidence < 0.55;

            return (
              <span key={i}>
                {speakerChanged && (
                  <span className="block mt-4 text-xs uppercase tracking-wider text-[var(--color-primary-strong)] font-sans font-medium">
                    {segment.speaker}
                  </span>
                )}
                {isSign && (
                  <Hand
                    className="inline-block w-4 h-4 mr-1 text-[var(--color-primary-strong)] -translate-y-0.5"
                    aria-hidden="true"
                  />
                )}
                <span
                  title={uncertain ? `Low confidence (${Math.round(segment.confidence * 100)}%)` : undefined}
                  className={[
                    isSign
                      ? 'italic text-[var(--color-primary-strong)]'
                      : segment.isFinal
                        ? 'text-[var(--color-text)]'
                        : 'text-[var(--color-text-muted)] italic',
                    uncertain
                      ? 'decoration-dotted decoration-[var(--color-warning)] underline underline-offset-4'
                      : '',
                  ].join(' ')}
                >
                  {segment.text}
                </span>{' '}
              </span>
            );
          })}
        </p>
      )}
    </div>
  );
}
