import { useRef, useEffect } from 'react';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { HAND_CONNECTIONS } from '@mediapipe/hands';
import { Camera, Hand } from 'lucide-react';
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
        color: '#6366f1',
        lineWidth: 2,
      });
      drawLandmarks(ctx, landmarks as any, {
        color: '#818cf8',
        lineWidth: 1,
        radius: 3,
      });
    }

    ctx.restore();
  }, [isActive, currentLandmarks]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Hand className="w-4 h-4" />
          Sign Language Detection
        </div>
        <button
          onClick={onToggle}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            isActive
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
          }`}
        >
          {isActive ? 'On' : 'Off'}
        </button>
      </div>

      {isActive && (
        <>
          <div className="relative rounded-lg overflow-hidden bg-zinc-900 aspect-video">
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
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/60">
                <p className="text-zinc-400 text-sm">Show your hands to the camera</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-zinc-400">Detected: </span>
              <span className="text-indigo-300 font-mono font-bold">
                {currentBuffer || '—'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Confidence:</span>
              <div className="w-16 h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-200"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
              <span className="text-zinc-400 w-10 text-right">
                {Math.round(confidence * 100)}%
              </span>
            </div>
          </div>

          {lastWord && (
            <div className="text-sm text-indigo-300">
              Last signed word: <span className="font-bold">{lastWord}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
