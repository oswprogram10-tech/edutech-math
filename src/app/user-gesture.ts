import { useEffect, useState } from 'react';

/**
 * 아이패드 Safari는 사용자 동작 없이 시작한 음성을 막는다.
 * 앱 어디서든 첫 포인터·키보드 동작을 한 번 기록해 두고, 그 뒤부터 자동 읽기를 허용한다.
 */
let seen = false;
const subscribers = new Set<() => void>();

export function userGestureSeen(): boolean {
  return seen;
}

export function markUserGesture(): void {
  if (seen) return;
  seen = true;
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
