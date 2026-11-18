/**
 * 화면에 보이는 말기 정도. 끄는 동안(`override`)은 손가락을 따라가고, 놓거나 단추를 누르면
 * 목표(`target`)까지 280ms 동안 움직인다. 동작 줄이기 설정이면 바로 목표로 간다.
 * 상태(`curl`)는 늘 목표값이고, 이 값은 화면 애니메이션에만 쓴다.
 *
 * 끄는 값은 상태에 넣지 않고 곧바로 돌려준다(`override ?? animated`). 놓는 순간의 화면 값에서 애니메이션을
 * 시작하려고, 마지막으로 그린 값을 `lastShown`에 적어 둔다.
 */
import { useLayoutEffect, useRef, useState } from 'react';

const DURATION_MS = 280;

export function useShownCurl(target: number, override: number | null, reduced: boolean): number {
  const [animated, setAnimated] = useState(target);
  const shown = override ?? animated;
  const lastShown = useRef(shown);

  // 순서가 중요하다: 이 효과가 먼저 `lastShown`(직전에 그린 값)을 읽고, 아래 효과가 그 값을 새로 적는다.
  useLayoutEffect(() => {
    if (override !== null) return;
    const from = lastShown.current;
    if (from === target || reduced || typeof requestAnimationFrame !== 'function') {
      setAnimated(target);
      return;
    }
    setAnimated(from);
    const startedAt = performance.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, Math.max(0, (performance.now() - startedAt) / DURATION_MS));
      const eased = t * t * (3 - 2 * t);
      setAnimated(t >= 1 ? target : from + (target - from) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, override, reduced]);

  useLayoutEffect(() => {
    lastShown.current = shown;
  });

  return shown;
}
