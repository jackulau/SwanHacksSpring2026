import { useState, useRef, useCallback } from 'react';
import type { NormalizedLandmarkList } from '@mediapipe/hands';
import type { HandLandmarks } from './useMediaPipeHands';

interface SignLanguageState {
  currentBuffer: string;
  lastWord: string;
  confidence: number;
  isDetecting: boolean;
}

const CONFIDENCE_THRESHOLD = 0.75;
const DEBOUNCE_MS = 400;
const SPACE_GAP_MS = 800;

const ASL_LETTERS: Record<string, (features: number[]) => number> = {};

function extractFeatures(landmarks: NormalizedLandmarkList): number[] {
  const features: number[] = [];
  const wrist = landmarks[0];

  for (let i = 1; i < 21; i++) {
    features.push(landmarks[i].x - wrist.x);
    features.push(landmarks[i].y - wrist.y);
    features.push(landmarks[i].z - wrist.z);
  }

  const fingerTips = [4, 8, 12, 16, 20];
  const fingerMCPs = [2, 5, 9, 13, 17];
  for (let i = 0; i < 5; i++) {
    const tip = landmarks[fingerTips[i]];
    const mcp = landmarks[fingerMCPs[i]];
    features.push(
      Math.sqrt(
        (tip.x - mcp.x) ** 2 + (tip.y - mcp.y) ** 2 + (tip.z - mcp.z) ** 2,
      ),
    );
  }

  const thumbTip = landmarks[4];
  for (const tipIdx of [8, 12, 16, 20]) {
    const tip = landmarks[tipIdx];
    features.push(
      Math.sqrt(
        (thumbTip.x - tip.x) ** 2 +
          (thumbTip.y - tip.y) ** 2 +
          (thumbTip.z - tip.z) ** 2,
      ),
    );
  }

  return features;
}

function isFingerExtended(landmarks: NormalizedLandmarkList, fingerTip: number, fingerMCP: number): boolean {
  return landmarks[fingerTip].y < landmarks[fingerMCP].y;
}

function classifyBasicGesture(landmarks: NormalizedLandmarkList): { letter: string; confidence: number } | null {
  const indexExtended = isFingerExtended(landmarks, 8, 5);
  const middleExtended = isFingerExtended(landmarks, 12, 9);
  const ringExtended = isFingerExtended(landmarks, 16, 13);
  const pinkyExtended = isFingerExtended(landmarks, 20, 17);

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const thumbExtended = thumbTip.x < landmarks[3].x;

  if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    const thumbNearIndex = Math.abs(thumbTip.x - indexTip.x) < 0.05 && Math.abs(thumbTip.y - indexTip.y) < 0.05;
    if (thumbNearIndex) return { letter: 'D', confidence: 0.8 };
    return { letter: 'D', confidence: 0.7 };
  }

  if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
    return { letter: 'V', confidence: 0.85 };
  }

  if (!indexExtended && !middleExtended && !ringExtended && !pinkyExtended && !thumbExtended) {
    return { letter: 'S', confidence: 0.75 };
  }

  if (indexExtended && middleExtended && ringExtended && pinkyExtended && thumbExtended) {
    return { letter: 'B', confidence: 0.8 };
  }

  if (indexExtended && middleExtended && ringExtended && !pinkyExtended) {
    return { letter: 'W', confidence: 0.8 };
  }

  if (!indexExtended && !middleExtended && !ringExtended && pinkyExtended) {
    return { letter: 'I', confidence: 0.75 };
  }

  if (indexExtended && pinkyExtended && !middleExtended && !ringExtended) {
    return { letter: 'Y', confidence: 0.8 };
  }

  if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
    return { letter: 'A', confidence: 0.75 };
  }

  const thumbIndexDist = Math.sqrt(
    (thumbTip.x - indexTip.x) ** 2 + (thumbTip.y - indexTip.y) ** 2,
  );
  if (thumbIndexDist < 0.04 && !middleExtended && !ringExtended && !pinkyExtended) {
    return { letter: 'O', confidence: 0.7 };
  }

  if (indexExtended && middleExtended && ringExtended && pinkyExtended && !thumbExtended) {
    return { letter: 'F', confidence: 0.7 };
  }

  return null;
}

export function useSignLanguage(onWord: (word: string) => void) {
  const [state, setState] = useState<SignLanguageState>({
    currentBuffer: '',
    lastWord: '',
    confidence: 0,
    isDetecting: false,
  });

  const bufferRef = useRef('');
  const lastLetterRef = useRef('');
  const lastLetterTimeRef = useRef(0);
  const lastSignTimeRef = useRef(0);
  const holdCountRef = useRef(0);

  const processLandmarks = useCallback(
    (handData: HandLandmarks) => {
      if (handData.landmarks.length === 0) {
        const gap = Date.now() - lastSignTimeRef.current;
        if (gap > SPACE_GAP_MS && bufferRef.current.length > 0) {
          const word = bufferRef.current;
          bufferRef.current = '';
          lastLetterRef.current = '';
          holdCountRef.current = 0;
          setState((s) => ({ ...s, currentBuffer: '', lastWord: word, confidence: 0 }));
          onWord(word);
        }
        return;
      }

      const landmarks = handData.landmarks[0];
      const result = classifyBasicGesture(landmarks);

      if (!result || result.confidence < CONFIDENCE_THRESHOLD) {
        setState((s) => ({ ...s, confidence: result?.confidence ?? 0 }));
        return;
      }

      lastSignTimeRef.current = Date.now();

      if (result.letter === lastLetterRef.current) {
        holdCountRef.current++;
        if (holdCountRef.current === Math.ceil(DEBOUNCE_MS / 33)) {
          bufferRef.current += result.letter;
          setState((s) => ({
            ...s,
            currentBuffer: bufferRef.current,
            confidence: result.confidence,
          }));
          holdCountRef.current = 0;
          lastLetterRef.current = '';
        }
      } else {
        lastLetterRef.current = result.letter;
        holdCountRef.current = 1;
        lastLetterTimeRef.current = Date.now();
      }

      setState((s) => ({ ...s, confidence: result.confidence, isDetecting: true }));
    },
    [onWord],
  );

  const reset = useCallback(() => {
    bufferRef.current = '';
    lastLetterRef.current = '';
    holdCountRef.current = 0;
    setState({
      currentBuffer: '',
      lastWord: '',
      confidence: 0,
      isDetecting: false,
    });
  }, []);

  return {
    ...state,
    processLandmarks,
    reset,
    extractFeatures,
  };
}
