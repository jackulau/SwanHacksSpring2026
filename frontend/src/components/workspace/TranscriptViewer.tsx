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
        <h3 className="text-lg font-semibold text-zinc-100">Transcript</h3>
        <button
          onClick={() => setShowRaw((s) => !s)}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showRaw ? 'Show Cleaned' : 'Show Raw'}
        </button>
      </div>

      <div
        className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6"
        data-focus-zone
      >
        {text ? (
          <div className="prose prose-invert max-w-none">
            {text.split('\n\n').map((paragraph, i) => (
              <p key={i} className="text-zinc-300 leading-relaxed mb-4 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 text-center py-8">No transcript available.</p>
        )}
      </div>

      {showRaw && cleanText && (
        <p className="text-xs text-zinc-600 text-center">
          Showing raw STT output. Toggle to see AI-cleaned version.
        </p>
      )}
    </div>
  );
}
