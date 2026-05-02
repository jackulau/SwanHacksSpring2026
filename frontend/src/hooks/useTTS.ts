import { useState, useRef, useCallback, useEffect } from 'react';

interface TTSState {
  isSpeaking: boolean;
  isPaused: boolean;
  voices: SpeechSynthesisVoice[];
}

export function useTTS() {
  const [state, setState] = useState<TTSState>({
    isSpeaking: false,
    isPaused: false,
    voices: [],
  });

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      setState((s) => ({ ...s, voices: speechSynthesis.getVoices() }));
    };
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const speak = useCallback((text: string, voice?: SpeechSynthesisVoice, rate = 1) => {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) utterance.voice = voice;
    utterance.rate = rate;

    utterance.onstart = () => setState((s) => ({ ...s, isSpeaking: true, isPaused: false }));
    utterance.onend = () => setState((s) => ({ ...s, isSpeaking: false, isPaused: false }));
    utterance.onpause = () => setState((s) => ({ ...s, isPaused: true }));
    utterance.onresume = () => setState((s) => ({ ...s, isPaused: false }));

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, []);

  const pause = useCallback(() => speechSynthesis.pause(), []);
  const resume = useCallback(() => speechSynthesis.resume(), []);
  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setState((s) => ({ ...s, isSpeaking: false, isPaused: false }));
  }, []);

  return { ...state, speak, pause, resume, stop };
}
