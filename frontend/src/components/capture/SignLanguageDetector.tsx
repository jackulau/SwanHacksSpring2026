import { useRef, useEffect } from 'react';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { HAND_CONNECTIONS } from '@mediapipe/hands';
import { Hand } from 'lucide-react';
import type { HandLandmarks } from '../../hooks/useMediaPipeHands';

interface SignLanguageDetectorProps {
  isActive: boolean;
  currentLandmarks: HandLandmarks | null;
  currentBuffer: string;
  confidence: number;
  lastWord: string;
  onToggle: () => void;
}

export function SignLanguageDetector({
  isActive,
  currentLandmarks,
  currentBuffer,
  confidence,
  lastWord,
  onToggle,
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Hand className="w-4 h-4" />
          Sign language detection
        </div>
        <button
          onClick={onToggle}
          className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
            isActive
              ? 'bg-[var(--color-primary)] text-black'
              : 'bg-black border border-[var(--color-border)] text-white hover:border-[var(--color-border-strong)]'
          }`}
        >
          {isActive ? 'On' : 'Off'}
        </button>
      </div>

      {isActive && (
        <>
          <div className="relative rounded-2xl overflow-hidden bg-black border border-[var(--color-border)] aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full object-cover -scale-x-100"
              autoPlay
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
            />
            {currentLandmarks && currentLandmarks.landmarks.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <p className="text-[var(--color-text-muted)] text-sm">Show your hands to the camera</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-[var(--color-text-muted)]">Detected: </span>
              <span className="text-[var(--color-primary-strong)] font-mono font-bold">
                {currentBuffer || '—'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-muted)]">Confidence:</span>
              <div className="w-16 h-2 bg-[var(--color-input)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--color-primary)] transition-all duration-200"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <span className="text-[var(--color-text-muted)] w-10 text-right">
                {Math.round(confidence * 100)}%
              </span>
            </div>
          </div>

          {lastWord && (
            <div className="text-sm text-[var(--color-primary-strong)]">
              Last signed word: <span className="font-bold">{lastWord}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
