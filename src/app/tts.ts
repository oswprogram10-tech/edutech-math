/** 한국어 음성 선택 규칙. 화면과 분리해 테스트한다. */
export function pickKoreanVoice(
  voices: readonly SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  const korean = voices.filter((voice) => voice.lang.toLowerCase().startsWith('ko'));
  if (korean.length === 0) return null;
  return korean.find((voice) => /^ko[-_]kr$/i.test(voice.lang)) ?? korean[0] ?? null;
}

export function hasSpeechSupport(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis?.speak === 'function' &&
    typeof globalThis.SpeechSynthesisUtterance === 'function'
  );
}
