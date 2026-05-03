import { useState, useRef, useCallback } from 'react';

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  error: string | null;
}

export interface AudioRecorderControls {
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  getStream: () => MediaStream | null;
}

export function useAudioRecorder(): [AudioRecorderState, AudioRecorderControls] {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioBlob: null,
    error: null,
  });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const startTimeRef = useRef(0);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
        audioBitsPerSecond: 64000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setState((s) => ({ ...s, isRecording: false, isPaused: false, audioBlob: blob }));
        clearInterval(timerRef.current);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorderRef.current = recorder;
      recorder.start(250);
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        setState((s) => ({
          ...s,
          duration: Math.floor((Date.now() - startTimeRef.current) / 1000),
        }));
      }, 1000);

      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        audioBlob: null,
        error: null,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        error: e instanceof Error ? e.message : 'Microphone access denied',
      }));
    }
  }, []);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const pause = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause();
      setState((s) => ({ ...s, isPaused: true }));
    }
  }, []);

  const resume = useCallback(() => {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume();
      setState((s) => ({ ...s, isPaused: false }));
    }
  }, []);

  const getStream = useCallback(() => streamRef.current, []);

  return [state, { start, stop, pause, resume, getStream }];
}
