import { useState, useRef, useCallback, useEffect } from 'react';
import { Hands, type NormalizedLandmarkList } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export interface HandLandmarks {
  landmarks: NormalizedLandmarkList[];
  /** Per-hand 'Left' / 'Right' label from MediaPipe, parallel to `landmarks`. */
  handedness: string[];
  timestamp: number;
}

interface MediaPipeHandsState {
  isLoaded: boolean;
  isRunning: boolean;
  error: string | null;
  currentLandmarks: HandLandmarks | null;
}

interface MediaPipeHandsConfig {
  maxNumHands?: number;
  modelComplexity?: 0 | 1;
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
}

export function useMediaPipeHands(config: MediaPipeHandsConfig = {}) {
  const [state, setState] = useState<MediaPipeHandsState>({
    isLoaded: false,
    isRunning: false,
    error: null,
    currentLandmarks: null,
  });

  const handsRef = useRef<Hands | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onLandmarksRef = useRef<((landmarks: HandLandmarks) => void) | null>(null);

  const initialize = useCallback(
    async (videoElement: HTMLVideoElement) => {
      try {
        videoRef.current = videoElement;

        const hands = new Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: config.maxNumHands ?? 2,
          modelComplexity: config.modelComplexity ?? 1,
          minDetectionConfidence: config.minDetectionConfidence ?? 0.7,
          minTrackingConfidence: config.minTrackingConfidence ?? 0.5,
        });

        hands.onResults((results) => {
          // MediaPipe ships handedness as parallel arrays to multiHandLandmarks.
          // Without these labels, downstream featurization can't tell left from
          // right and falls back to detection order, which scrambles two-hand
          // signs roughly 50% of the time.
          const handedness = ((results.multiHandedness as Array<{ label?: string }> | undefined) ?? [])
            .map((h) => h?.label ?? '');
          const landmarkData: HandLandmarks = {
            landmarks: (results.multiHandLandmarks as NormalizedLandmarkList[]) || [],
            handedness,
            timestamp: Date.now(),
          };
          setState((s) => ({ ...s, currentLandmarks: landmarkData }));
          onLandmarksRef.current?.(landmarkData);
        });

        await hands.initialize();
        handsRef.current = hands;
        console.log('[ASL] MediaPipe Hands initialized', {
          maxNumHands: config.maxNumHands ?? 2,
          modelComplexity: config.modelComplexity ?? 1,
          minDetectionConfidence: config.minDetectionConfidence ?? 0.7,
          minTrackingConfidence: config.minTrackingConfidence ?? 0.5,
        });
        setState((s) => ({ ...s, isLoaded: true }));
      } catch (e) {
        console.error('[ASL] MediaPipe Hands init failed', e);
        setState((s) => ({
          ...s,
          error: e instanceof Error ? e.message : 'Failed to load MediaPipe Hands',
        }));
      }
    },
    [config.maxNumHands, config.modelComplexity, config.minDetectionConfidence, config.minTrackingConfidence],
  );

  const start = useCallback(() => {
    if (!handsRef.current || !videoRef.current) return;

    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        if (handsRef.current && videoRef.current) {
          await handsRef.current.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480,
    });

    camera.start();
    cameraRef.current = camera;
    setState((s) => ({ ...s, isRunning: true }));
  }, []);

  const stop = useCallback(() => {
    cameraRef.current?.stop();
    cameraRef.current = null;
    setState((s) => ({ ...s, isRunning: false, currentLandmarks: null }));
  }, []);

  const setOnLandmarks = useCallback((cb: (landmarks: HandLandmarks) => void) => {
    onLandmarksRef.current = cb;
  }, []);

  useEffect(() => {
    return () => {
      stop();
      handsRef.current?.close();
    };
  }, [stop]);

  return {
    ...state,
    initialize,
    start,
    stop,
    setOnLandmarks,
  };
}
