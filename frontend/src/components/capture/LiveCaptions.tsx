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
      className="flex-1 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900/50 p-4 space-y-2"
      role="log"
      aria-label="Live captions"
      aria-live="polite"
    >
      {captions.length === 0 && (
        <p className="text-zinc-500 text-center py-8">
          Captions will appear here...
        </p>
      )}
      {captions.map((segment, i) => (
        <div
          key={i}
          className={`${
            segment.isFinal ? 'text-zinc-100' : 'text-zinc-400'
          }`}
          style={{
            fontSize,
            opacity: showConfidence
              ? 0.5 + segment.confidence * 0.5
              : 1,
          }}
        >
          {segment.source === 'sign' && (
            <Hand className="inline-block w-4 h-4 mr-1 text-indigo-400" />
          )}
          {showSpeakerLabels && segment.speaker && (
            <span className="text-indigo-400 font-medium mr-2">
              {segment.speaker}:
            </span>
          )}
          <span className={segment.source === 'sign' ? 'italic text-indigo-300' : ''}>
            {segment.text}
          </span>
        </div>
      ))}
    </div>
  );
}
