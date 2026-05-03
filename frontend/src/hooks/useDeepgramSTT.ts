import { useState, useRef, useCallback, useEffect } from 'react';
import type { CaptionSegment } from '../lib/types';

interface DeepgramConfig {
  model?: string;
  language?: string;
  punctuate?: boolean;
  diarize?: boolean;
  interimResults?: boolean;
}

interface DeepgramState {
  isConnected: boolean;
  captions: CaptionSegment[];
  error: string | null;
}

const DEFAULT_CONFIG: DeepgramConfig = {
  model: 'nova-2',
  language: 'en',
  punctuate: true,
  diarize: true,
  interimResults: true,
};

export function useDeepgramSTT(config: DeepgramConfig = {}) {
  const [state, setState] = useState<DeepgramState>({
    isConnected: false,
    captions: [],
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const connect = useCallback(
    (stream: MediaStream) => {
      const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;
      if (!apiKey) {
        setState((s) => ({ ...s, error: 'VITE_DEEPGRAM_API_KEY not set' }));
        return;
      }

      const params = new URLSearchParams({
        model: mergedConfig.model!,
        language: mergedConfig.language!,
        smart_format: 'true',
        punctuate: String(mergedConfig.punctuate),
        diarize: String(mergedConfig.diarize),
        filler_words: 'false',
        utterances: 'true',
        interim_results: String(mergedConfig.interimResults),
        endpointing: '300',
      });

      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['token', apiKey]);

      ws.onopen = () => {
        setState((s) => ({ ...s, isConnected: true, error: null }));

        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm',
        });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };

        recorder.start(250);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'Results' && data.channel?.alternatives?.[0]) {
          const alt = data.channel.alternatives[0];
          if (!alt.transcript) return;

          const segment: CaptionSegment = {
            text: alt.transcript,
            source: 'audio',
            timestamp: data.start || Date.now() / 1000,
            confidence: alt.confidence || 0,
            isFinal: data.is_final ?? true,
            speaker: alt.words?.[0]?.speaker !== undefined
              ? `Speaker ${alt.words[0].speaker + 1}`
              : undefined,
          };

          setState((s) => {
            const captions = [...s.captions];
            if (!segment.isFinal && captions.length > 0 && !captions[captions.length - 1].isFinal) {
              captions[captions.length - 1] = segment;
            } else {
              captions.push(segment);
            }
            return { ...s, captions };
          });
        }
      };

      ws.onerror = () => {
        setState((s) => ({ ...s, error: 'Deepgram connection error' }));
      };

      ws.onclose = () => {
        setState((s) => ({ ...s, isConnected: false }));
      };

      wsRef.current = ws;
    },
    [mergedConfig.model, mergedConfig.language, mergedConfig.punctuate, mergedConfig.diarize, mergedConfig.interimResults],
  );

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimeoutRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

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
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    clearCaptions,
    addSignCaption,
  };
}
