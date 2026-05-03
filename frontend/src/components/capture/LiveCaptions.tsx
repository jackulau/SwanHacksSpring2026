import { useEffect, useRef } from 'react';
import { Hand } from 'lucide-react';
import type { CaptionSegment } from '../../lib/types';

interface LiveCaptionsProps {
  captions: CaptionSegment[];
  fontSize?: number;
  showSpeakerLabels?: boolean;
  showConfidence?: boolean;
}

export function LiveCaptions({
  captions,
  fontSize = 18,
  showSpeakerLabels = true,
  showConfidence = false,
}: LiveCaptionsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [captions]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] soft-shadow p-5 space-y-2"
      role="log"
      aria-label="Live captions"
      aria-live="polite"
    >
      {captions.length === 0 && (
        <p className="text-[var(--color-text-muted)] text-center py-8">
          Captions will appear here...
        </p>
      )}
      {captions.map((segment, i) => (
        <div
          key={i}
          className={`${
            segment.isFinal ? 'text-white' : 'text-[var(--color-text-muted)]'
          }`}
          style={{
            fontSize,
            opacity: showConfidence
              ? 0.5 + segment.confidence * 0.5
              : 1,
          }}
        >
          {segment.source === 'sign' && (
            <Hand className="inline-block w-4 h-4 mr-1 text-[var(--color-primary-strong)]" />
          )}
          {showSpeakerLabels && segment.speaker && (
            <span className="text-[var(--color-primary-strong)] font-medium mr-2">
              {segment.speaker}:
            </span>
          )}
          <span className={segment.source === 'sign' ? 'italic text-[var(--color-primary-strong)]' : ''}>
            {segment.text}
          </span>
        </div>
      ))}
    </div>
  );
}
