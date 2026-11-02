// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installUserGestureTracking, userGestureSeen } from './user-gesture';

class FakeUtterance {
  readonly text: string;
  volume = 1;
  lang = '';
  rate = 1;

  constructor(text: string) {
    this.text = text;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('아이패드 음성 잠금 해제', () => {
  it('첫 사용자 동작에서 볼륨 0의 빈 발화를 동기적으로 한 번만 보낸다', () => {
    const speak = vi.fn();
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('speechSynthesis', {
      speak,
      cancel: vi.fn(),
      getVoices: () => [],
    });

    const cleanup = installUserGestureTracking();
    window.dispatchEvent(new Event('pointerdown'));

    // dispatchEvent가 끝나기 전에(같은 이벤트 핸들러 안에서) 호출되어야 한다.
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0]?.[0] as FakeUtterance | undefined;
    expect(utterance?.text).toBe(' ');
    expect(utterance?.volume).toBe(0);
    expect(userGestureSeen()).toBe(true);

    // 두 번째 동작(키보드)에서는 다시 열지 않는다.
    window.dispatchEvent(new Event('keydown'));
    expect(speak).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
