import { useRef, useEffect } from 'react';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { HAND_CONNECTIONS } from '@mediapipe/hands';
import { Hand, X } from 'lucide-react';
import type { HandLandmarks } from '../../hooks/useMediaPipeHands';

interface SignLanguageDetectorProps {
  isActive: boolean;
  currentLandmarks: HandLandmarks | null;
  currentBuffer: string;
  confidence: number;
  lastWord: string;
  onToggle: () => void;
  // DTW word recognizer status (optional — backwards compatible).
  wordRecognizer?: {
    isReady: boolean;
    loadError: string | null;
    templateCount: number;
    segmenterState: "idle" | "active" | "cooldown";
    activeFrames: number;
    lastWord: string | null;
    lastDistance: number | null;
    lastCandidates: { label: string; distance: number }[];
    /** Closest candidate when DTW gated the segment. UI surfaces this so the
     *  user knows the camera saw something even when no caption was emitted. */
    lastReject?: { topLabel: string; distance: number; reason: string } | null;
    /** Last result from the Gemini Vision pipeline. Surfaced as the canonical
     *  prediction since it's open-vocabulary and far more accurate than DTW. */
    vlm?: {
      pending: boolean;
      lastWord: string | null;
      lastRaw: string;
      lastLatencyMs: number | null;
      lastError: string | null;
    };
  };
}

/**
 * Compact, togglable corner panel for sign language detection.
 *
 * When inactive: nothing renders here — the parent decides where to put the
 * "Sign language" toggle button. When active: a small video preview with
 * landmarks overlay and inline status. Designed to live in a corner of the
 * capture surface, not to compete with the transcript.
 */
export function SignLanguageDetector({
  isActive,
  currentLandmarks,
  currentBuffer,
  confidence,
  lastWord,
  onToggle,
  wordRecognizer,
}: SignLanguageDetectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!isActive || !currentLandmarks || !canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);

    for (const landmarks of currentLandmarks.landmarks) {
      drawConnectors(ctx, landmarks as any, HAND_CONNECTIONS, {
        color: '#5fbf78',
        lineWidth: 2,
      });
      drawLandmarks(ctx, landmarks as any, {
        color: '#4ade80',
        lineWidth: 1,
        radius: 3,
      });
    }

    ctx.restore();
  }, [isActive, currentLandmarks]);

  if (!isActive) return null;

  return (
    <aside
      aria-label="Sign language detection"
      className="w-72 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
          <Hand className="w-3.5 h-3.5" aria-hidden="true" />
          Sign language
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Disable sign language detection"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-1 rounded-md transition-colors"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </header>

      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover -scale-x-100"
          autoPlay
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          aria-hidden="true"
        />
        {currentLandmarks && currentLandmarks.landmarks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <p className="text-[var(--color-text-muted)] text-xs">
              Show your hands to the camera
            </p>
          </div>
        )}
      </div>

      <div className="px-3 py-2 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-text-muted)]">Buffer</span>
          <span className="text-[var(--color-primary-strong)] font-mono font-medium">
            {currentBuffer || '—'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--color-text-muted)] shrink-0">Conf.</span>
          <div
            className="flex-1 h-1 bg-[var(--color-input)] overflow-hidden rounded-sm"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(confidence * 100)}
          >
            <div
              className="h-full bg-[var(--color-primary)] transition-all duration-200"
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
          <span className="text-[var(--color-text-muted)] font-mono w-8 text-right">
            {Math.round(confidence * 100)}%
          </span>
        </div>
        {lastWord && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Last word:{' '}
            <span className="text-[var(--color-primary-strong)] font-medium">
              {lastWord}
            </span>
          </p>
        )}
        {wordRecognizer?.vlm && (
          <div className="pt-2 border-t border-[var(--color-border)] space-y-1">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <span>Gemini Vision</span>
              <span
                className={
                  wordRecognizer.vlm.pending
                    ? "text-[var(--color-primary-strong)] font-mono"
                    : wordRecognizer.vlm.lastError
                      ? "text-[var(--color-record)] font-mono"
                      : "text-[var(--color-text-muted)] font-mono"
                }
              >
                {wordRecognizer.vlm.pending
                  ? "thinking…"
                  : wordRecognizer.vlm.lastError
                    ? "error"
                    : wordRecognizer.vlm.lastLatencyMs !== null
                      ? `${wordRecognizer.vlm.lastLatencyMs}ms`
                      : "idle"}
              </span>
            </div>
            {wordRecognizer.vlm.lastWord && (
              <p className="text-xs text-[var(--color-text-muted)]">
                Predicted:{' '}
                <span className="text-[var(--color-primary-strong)] font-medium">
                  {wordRecognizer.vlm.lastWord}
                </span>
              </p>
            )}
            {!wordRecognizer.vlm.lastWord &&
              wordRecognizer.vlm.lastRaw &&
              !wordRecognizer.vlm.pending && (
                <p className="text-[11px] text-[var(--color-text-subtle)]">
                  Said:{' '}
                  <span className="font-mono">{wordRecognizer.vlm.lastRaw}</span>
                </p>
              )}
            {wordRecognizer.vlm.lastError && (
              <p
                className="text-[11px] text-[var(--color-record)] truncate"
                title={wordRecognizer.vlm.lastError}
              >
                {wordRecognizer.vlm.lastError}
              </p>
            )}
          </div>
        )}
        {wordRecognizer && (
          <div className="pt-2 border-t border-[var(--color-border)] space-y-1">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <span>DTW words</span>
              <span>
                {wordRecognizer.isReady
                  ? `${wordRecognizer.templateCount} templates`
                  : wordRecognizer.loadError
                    ? "load failed"
                    : "loading…"}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">Segmenter</span>
              <span
                className={
                  wordRecognizer.segmenterState === "active"
                    ? "text-[var(--color-primary-strong)] font-mono"
                    : "text-[var(--color-text-muted)] font-mono"
                }
              >
                {wordRecognizer.segmenterState}
                {wordRecognizer.segmenterState === "active"
                  ? ` ${wordRecognizer.activeFrames}fr`
                  : ""}
              </span>
            </div>
            {wordRecognizer.lastWord && (
              <p className="text-xs text-[var(--color-text-muted)]">
                Last sign:{' '}
                <span className="text-[var(--color-primary-strong)] font-medium">
                  {wordRecognizer.lastWord}
                </span>
                {wordRecognizer.lastDistance !== null && (
                  <span className="text-[var(--color-text-subtle)] font-mono ml-1">
                    {wordRecognizer.lastDistance.toFixed(2)}
                  </span>
                )}
              </p>
            )}
            {wordRecognizer.lastReject && (
              <p
                className="text-[11px] text-[var(--color-text-subtle)]"
                title={wordRecognizer.lastReject.reason}
              >
                Near miss:{' '}
                <span className="font-mono">
                  {wordRecognizer.lastReject.topLabel}
                </span>{' '}
                <span className="font-mono">
                  ({wordRecognizer.lastReject.distance.toFixed(2)})
                </span>
              </p>
            )}
            {wordRecognizer.lastCandidates.length > 0 && (
              <ul className="text-[11px] font-mono text-[var(--color-text-subtle)] leading-tight">
                {wordRecognizer.lastCandidates.slice(0, 3).map((c) => (
                  <li key={c.label} className="flex justify-between">
                    <span>{c.label}</span>
                    <span>{c.distance.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
