/**
 * E12 `shapes-sort` 결정적 연출 도우미(컴포넌트 아님).
 *
 * 물리 엔진을 쓰지 않는다. 연출은 시작 신호가 바뀔 때마다 0→1로 가는 진행도 하나로 그리고,
 * `prefers-reduced-motion`이면 연출 없이 끝 위치(진행도 1)로 바로 간다.
 */
import { useEffect, useState } from 'react';

/** 움직임을 줄이는 설정이거나 `matchMedia`가 없으면 true(연출 없이 끝 위치로 간다). */
export function prefersReducedMotion(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

interface Tick {
  readonly serial: number;
  readonly p: number;
}

/**
 * `trigger`(값이 바뀌었는지는 `!==`로 본다)가 바뀌고 `active`일 때마다 `durationMs` 동안 0→1로 간다.
 * 처음 그릴 때는 연출하지 않는다(진행도 1). 움직임을 줄이는 설정이면 늘 1이다.
 */
export function useScriptedProgress(
  trigger: unknown,
  active: boolean,
  durationMs: number,
): { readonly progress: number; readonly running: boolean } {
  const [seen, setSeen] = useState(trigger);
  const [serial, setSerial] = useState(0);
  const [tick, setTick] = useState<Tick>({ serial: 0, p: 1 });

  if (seen !== trigger) {
    setSeen(trigger);
    if (active && !prefersReducedMotion()) setSerial(serial + 1);
  }

  useEffect(() => {
    if (serial === 0) return undefined;
    const start = performance.now();
    let frame = 0;
    let timer = 0;
    let stopped = false;
    const step = () => {
      if (stopped) return;
      const p = Math.min(1, (performance.now() - start) / durationMs);
      setTick({ serial, p });
      if (p < 1) schedule();
    };
    const schedule = () => {
      if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(step);
      else timer = window.setTimeout(step, 16);
    };
    schedule();
    return () => {
      stopped = true;
      if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      if (timer) window.clearTimeout(timer);
    };
  }, [serial, durationMs]);

  const progress = serial === 0 ? 1 : tick.serial === serial ? tick.p : 0;
  return { progress, running: progress < 1 };
}

export function easeIn(u: number): number {
  return u * u;
}

export function easeOut(u: number): number {
  return 1 - (1 - u) * (1 - u);
}
