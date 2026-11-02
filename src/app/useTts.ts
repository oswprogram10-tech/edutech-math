import { useCallback, useEffect, useRef, useState } from 'react';
import { hasSpeechSupport, pickKoreanVoice } from './tts';

export interface UseTtsResult {
  readonly available: boolean;
  readonly speak: (text: string) => void;
  readonly cancel: () => void;
}

/**
 * speechSynthesis 한국어 음성.
 *
 * 음성 목록은 `voiceschanged` 뒤에 채워질 수 있으므로 기다렸다가 다시 찾는다.
 * 한국어 음성이 없거나 API가 없으면 available=false가 되고 화면은 버튼을 숨긴다.
 */
export function useTts(): UseTtsResult {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!hasSpeechSupport()) return;
    const synth = window.speechSynthesis;

    const update = () => {
      const next = pickKoreanVoice(synth.getVoices());
      voiceRef.current = next;
      setVoice(next);
    };

    update();
    synth.addEventListener?.('voiceschanged', update);
    return () => {
      synth.removeEventListener?.('voiceschanged', update);
      synth.cancel();
      voiceRef.current = null;
    };
  }, []);

  const cancel = useCallback(() => {
    if (!hasSpeechSupport()) return;
    window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback((text: string) => {
    if (!text || !hasSpeechSupport() || !voiceRef.current) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voiceRef.current.lang;
    utterance.voice = voiceRef.current;
    utterance.rate = 0.95;
    synth.speak(utterance);
  }, []);

  return { available: voice !== null, speak, cancel };
}
