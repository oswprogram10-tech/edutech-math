/**
 * E20 rate 경주 재생(화면 상태, reducer 상태가 아니다). `run`이 들어올 때마다(runs 증가) 3초 동안
 * 진행도를 0에서 1000(천분율)까지 올린다. 위치는 진행도의 순수 함수라 같은 진행도면 언제나 같은 자리다.
 * `prefers-reduced-motion`이거나 requestAnimationFrame이 없으면 바로 끝 장면이다.
 * 경주 뒤 값을 바꾸거나 처음으로 돌리면(valuesKey가 달라지면) 시작 장면으로 돌아간다.
 */
import { useEffect, useRef, useState } from 'react';
import { RACE_STEPS } from './layout';

export const RACE_MS = 3000;

export interface Playback {
  /** 0~RACE_STEPS. 경주를 본 값 그대로일 때만 0보다 크다. */
  readonly step: number;
  readonly playing: boolean;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function canAnimate(): boolean {
  return !prefersReducedMotion() && typeof requestAnimationFrame === 'function';
}

export function useRacePlayback(runs: number, valuesKey: string): Playback {
  const [step, setStep] = useState(runs > 0 ? RACE_STEPS : 0);
  const [playedKey, setPlayedKey] = useState<string | null>(runs > 0 ? valuesKey : null);
  const [seenRuns, setSeenRuns] = useState(runs);
  const mountedRuns = useRef(runs);

  // 새 경주가 시작되면 렌더 중에 시작 장면(또는 끝 장면)을 정한다.
  if (runs !== seenRuns) {
    setSeenRuns(runs);
    setPlayedKey(runs > 0 ? valuesKey : null);
    setStep(runs > 0 && !canAnimate() ? RACE_STEPS : 0);
  }

  useEffect(() => {
    if (runs === 0 || runs === mountedRuns.current || !canAnimate()) return undefined;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const fraction = Math.min(1, Math.max(0, (now - startedAt) / RACE_MS));
      setStep(Math.round(fraction * RACE_STEPS));
      if (fraction < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [runs]);

  const shown = playedKey === valuesKey ? step : 0;
  return { step: shown, playing: playedKey === valuesKey && step < RACE_STEPS };
}
