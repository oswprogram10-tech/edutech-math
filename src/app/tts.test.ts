import { describe, expect, it } from 'vitest';
import { pickKoreanVoice } from './tts';

function voice(lang: string, name: string): SpeechSynthesisVoice {
  return { lang, name } as SpeechSynthesisVoice;
}

describe('pickKoreanVoice', () => {
  it('한국어 음성 중 ko-KR을 먼저 고른다', () => {
    const chosen = pickKoreanVoice([
      voice('en-US', 'English'),
      voice('ko-KR', '한국어'),
      voice('ko-JP', '다른 한국어'),
    ]);
    expect(chosen?.name).toBe('한국어');
  });

  it('ko-KR이 없으면 첫 한국어 음성을 쓴다', () => {
    const chosen = pickKoreanVoice([voice('en-US', 'English'), voice('ko', '기본 한국어')]);
    expect(chosen?.name).toBe('기본 한국어');
  });

  it('한국어 음성이 없으면 null이다', () => {
    expect(pickKoreanVoice([voice('en-US', 'English')])).toBeNull();
    expect(pickKoreanVoice([])).toBeNull();
  });
});
