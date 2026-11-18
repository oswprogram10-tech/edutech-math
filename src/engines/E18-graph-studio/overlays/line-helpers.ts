/**
 * line-graph 오버레이 공용 도우미. 화면에 보이는 점(주어진 자료 또는 학생·예측 점)만 쓴다.
 * 오버레이 글자는 값을 쓰지 않는다(`scale-count`의 첫 두 칸만 예외).
 */
import { useEffect, useState } from 'react';
import type { Rational } from '../../../core/math';
import { lineGeometry, shownValues, valueOf } from '../line';
import type { LineGeometry } from '../line';
import type { GraphState, LineGraphState, LineSettings } from '../types';

export interface LineScene {
  readonly state: LineGraphState;
  readonly line: LineSettings;
  readonly g: LineGeometry;
  /** 화면에 보이는 점 값(없으면 null). */
  readonly values: readonly (Rational | null)[];
}

/** line-graph 상태와 오버레이 svg의 논리 폭으로 그림 칸을 만든다. 다른 모드면 null. */
export function lineScene(state: GraphState, width: number): LineScene | null {
  if (state.mode !== 'line-graph' || state.settings.line === null) return null;
  const line = state.settings.line;
  return {
    state,
    line,
    g: lineGeometry(line, state.yFrom, width),
    values: shownValues(state).map((value) => valueOf(value)),
  };
}

/** 가로축 이름(문자열) 또는 인덱스(숫자)로 레인 번호를 찾는다. 없으면 null. */
export function laneIndexOf(line: LineSettings, ref: unknown): number | null {
  if (typeof ref === 'string') {
    const index = line.xs.indexOf(ref);
    return index < 0 ? null : index;
  }
  if (typeof ref === 'number' && Number.isInteger(ref) && ref >= 0 && ref < line.xs.length) {
    return ref;
  }
  return null;
}

export function argOf(args: unknown, key: string): unknown {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return undefined;
  return (args as Readonly<Record<string, unknown>>)[key];
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/** 동작 줄이기 설정이면 true. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(REDUCED_QUERY).matches === true,
  );
  useEffect(() => {
    const media = typeof window !== 'undefined' ? window.matchMedia?.(REDUCED_QUERY) : undefined;
    if (!media) return;
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return reduced;
}
