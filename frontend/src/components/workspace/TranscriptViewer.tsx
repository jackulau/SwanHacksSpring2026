import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface TranscriptViewerProps {
  rawText: string;
  cleanText: string;
}

export function TranscriptViewer({ rawText, cleanText }: TranscriptViewerProps) {
  const [showRaw, setShowRaw] = useState(false);
  const text = showRaw ? rawText : cleanText;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Transcript</h3>
        <button
          onClick={() => setShowRaw((s) => !s)}
          className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-white transition-colors"
        >
          {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showRaw ? 'Show Cleaned' : 'Show Raw'}
        </button>
      </div>

      <div
        className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-2xl p-6 soft-shadow"
        data-focus-zone
      >
        {text ? (
          <div className="prose prose-invert max-w-none">
            {text.split('\n\n').map((paragraph, i) => (
              <p key={i} className="text-[var(--color-text-muted)] leading-relaxed mb-4 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-[var(--color-text-subtle)] text-center py-8">No transcript available.</p>
        )}
      </div>

      {showRaw && cleanText && (
        <p className="text-xs text-[var(--color-text-subtle)] text-center">
          Showing raw STT output. Toggle to see AI-cleaned version.
        </p>
      )}
    </div>
  );
}
