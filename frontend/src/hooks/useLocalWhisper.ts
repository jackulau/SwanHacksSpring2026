import { useState, useRef, useCallback, useEffect } from 'react';
import { pipeline, type AutomaticSpeechRecognitionOutput } from '@huggingface/transformers';
import type { CaptionSegment } from '../lib/types';

const WHISPER_MODEL = 'onnx-community/whisper-tiny.en';
const CHUNK_INTERVAL_MS = 8000;

type Transcriber = Awaited<ReturnType<typeof pipeline<'automatic-speech-recognition'>>>;

let _transcriber: Transcriber | null = null;
let _loading: Promise<Transcriber> | null = null;

async function loadTranscriber(
  onProgress?: (p: number) => void,
): Promise<Transcriber> {
  if (_transcriber) return _transcriber;
  if (_loading) return _loading;

  _loading = pipeline('automatic-speech-recognition', WHISPER_MODEL, {
    dtype: 'q8' as any,
    device: 'wasm' as any,
    progress_callback: (info: any) => {
      if (info.status === 'progress' && onProgress) {
        onProgress(Math.round(info.progress ?? 0));
      }
    },
  }) as Promise<Transcriber>;

  _transcriber = await _loading;
  _loading = null;
  return _transcriber;
}

function concatFloat32(arrays: Float32Array[]): Float32Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const result = new Float32Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

interface WhisperState {
  isConnected: boolean;
  captions: CaptionSegment[];
  error: string | null;
  modelLoading: boolean;
  modelProgress: number;
}

export function useLocalWhisper() {
  const [state, setState] = useState<WhisperState>({
    isConnected: false,
    captions: [],
    error: null,
    modelLoading: false,
    modelProgress: 0,
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const samplesRef = useRef<Float32Array[]>([]);
  const processedRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const busyRef = useRef(false);

  const processChunk = useCallback(async () => {
    if (busyRef.current) return;
    const newSamples = samplesRef.current.slice(processedRef.current);
    if (newSamples.length === 0) return;

    busyRef.current = true;
    processedRef.current = samplesRef.current.length;

    try {
      const pcm = concatFloat32(newSamples);
      if (pcm.length < 1600) {
        busyRef.current = false;
        return;
      }

      const t = await loadTranscriber();
      const result = await t(pcm) as AutomaticSpeechRecognitionOutput;
      const text = result?.text?.trim();

      if (text && text !== '[BLANK_AUDIO]' && text !== '[ Silence ]') {
        const segment: CaptionSegment = {
          text,
          source: 'audio',
          timestamp: Date.now() / 1000,
          confidence: 0.85,
          isFinal: true,
        };
        setState((s) => ({ ...s, captions: [...s.captions, segment] }));
      }
    } catch {
      // skip failed chunk
    }
    busyRef.current = false;
  }, []);

  const connect = useCallback(
    async (stream: MediaStream) => {
      setState((s) => ({ ...s, modelLoading: true, error: null }));

      try {
        await loadTranscriber((p) =>
          setState((s) => ({ ...s, modelProgress: p })),
        );
      } catch {
        setState((s) => ({
          ...s,
          modelLoading: false,
          error: 'Failed to load Whisper model. Check your connection for the initial download (~40 MB).',
        }));
        return;
      }

      setState((s) => ({ ...s, modelLoading: false, isConnected: true }));
      samplesRef.current = [];
      processedRef.current = 0;

      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      // ScriptProcessorNode is deprecated but universally supported and simpler
      // than AudioWorklet for this use case.
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        samplesRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      intervalRef.current = setInterval(processChunk, CHUNK_INTERVAL_MS);
    },
    [processChunk],
  );

  const disconnect = useCallback(async () => {
    clearInterval(intervalRef.current);

    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;

    if (audioCtxRef.current?.state !== 'closed') {
      audioCtxRef.current?.close();
    }
    audioCtxRef.current = null;

    await processChunk();

    setState((s) => ({ ...s, isConnected: false }));
  }, [processChunk]);

  const clearCaptions = useCallback(() => {
    setState((s) => ({ ...s, captions: [] }));
  }, []);

  const addSignCaption = useCallback((text: string) => {
    const segment: CaptionSegment = {
      text,
      source: 'sign',
      timestamp: Date.now() / 1000,
      confidence: 1,
      isFinal: true,
    };
    setState((s) => ({ ...s, captions: [...s.captions, segment] }));
  }, []);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    clearCaptions,
    addSignCaption,
  };
}

export async function transcribeAudioFile(file: File): Promise<string> {
  const transcriber = await loadTranscriber();
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, 16000);
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  const pcm = audioBuffer.getChannelData(0);

  const result = await transcriber(pcm) as AutomaticSpeechRecognitionOutput;
  return result?.text?.trim() ?? '';
}
