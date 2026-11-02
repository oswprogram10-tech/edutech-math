import { useEffect, useState } from 'react';

/**
 * 아이패드 Safari는 사용자 동작 없이 시작한 음성을 막는다.
 * 앱 어디서든 첫 포인터·키보드 동작을 한 번 기록해 두고, 그 뒤부터 자동 읽기를 허용한다.
 *
 * 첫 동작 처리 함수 안에서(이벤트 핸들러와 같은 동기 흐름에서) 볼륨 0의 빈 발화를
 * 한 번 재생해 Safari의 음성 잠금을 푼다. 이 발화를 나중에(비동기로) 보내면 잠금이
 * 풀리지 않으므로 반드시 사용자 동작 안에서 실행해야 한다. 두 번 이상 보내면
 * 불필요한 무음 발화가 대기열에 쌓이므로 `speechUnlocked`로 한 번만 실행한다.
 */
let seen = false;
let speechUnlocked = false;
const subscribers = new Set<() => void>();

function unlockSpeechSynthesis(): void {
  if (speechUnlocked) return;
  speechUnlocked = true;

  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (typeof synth?.speak !== 'function') return;
  if (typeof globalThis.SpeechSynthesisUtterance !== 'function') return;

  try {
    const utterance = new SpeechSynthesisUtterance(' ');
    utterance.volume = 0;
    synth.speak(utterance);
  } catch (reason) {
    // 음성 잠금 해제는 보조 기능이므로 실패해도 앱 조작을 막지 않는다.
    console.warn('[app] 음성 잠금을 풀지 못했습니다.', reason);
  }
}

export function userGestureSeen(): boolean {
  return seen;
}

export function markUserGesture(): void {
  if (seen) return;
  seen = true;
  // 이 함수는 pointerdown/keydown 리스너 안에서 동기적으로 호출된다.
  unlockSpeechSynthesis();
  for (const notify of subscribers) notify();
}

function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  return () => subscribers.delete(notify);
}

export function installUserGestureTracking(): () => void {
  const onGesture = () => markUserGesture();
  window.addEventListener('pointerdown', onGesture, { passive: true });
  window.addEventListener('keydown', onGesture);
  return () => {
    window.removeEventListener('pointerdown', onGesture);
    window.removeEventListener('keydown', onGesture);
  };
}

export function useUserGesture(): boolean {
  const [value, setValue] = useState(userGestureSeen);

  useEffect(() => {
    if (value) return;
    return subscribe(() => setValue(true));
  }, [value]);

  return value;
}
