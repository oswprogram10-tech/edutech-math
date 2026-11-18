/**
 * E18 오버레이 공용 도우미. 학생이 그린 것과 이미 주어진 표 값만 쓴다.
 * 학생이 아직 구하지 않은 값(그릴 그래프의 정답 높이, 읽어야 할 값)은 계산하지 않는다.
 */
import { frameOf, isTouchOMark } from '../layout';
import type { Frame } from '../layout';
import { axisCells, splitValue } from '../reduce';
import type { GraphState, PictographRow } from '../types';

export const CANVAS_SELECTOR = 'svg[data-testid="graph-canvas"]';

export function argCat(args: unknown): string | null {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return null;
  const value = (args as Readonly<Record<string, unknown>>)['cat'];
  return typeof value === 'string' ? value : null;
}

export function overlayFrame(state: GraphState): Frame {
  return frameOf(
    state.orientation,
    state.settings.categories.length,
    axisCells(state.settings, state.scale),
    isTouchOMark(state.settings),
  );
}

/** 대상 범주와 그 번호. `args.cat`가 있으면 그것, 없으면 `fallback`. 못 찾으면 null. */
export function targetCategory(
  state: GraphState,
  args: unknown,
  fallback: string | undefined,
): { readonly cat: string; readonly index: number } | null {
  const requested = argCat(args);
  const cat = requested ?? fallback;
  if (cat === undefined) return null;
  const index = state.settings.categories.indexOf(cat);
  return index < 0 ? null : { cat, index };
}

/** 그림그래프 오버레이가 그리는 행과 범례. `pictograph`는 학생이 놓은 행, 그 밖(`table-to-graph`)은 자료로 가른 행. */
export function pictoRowsOf(state: GraphState): {
  readonly rows: Readonly<Record<string, PictographRow>>;
  readonly legendBig: number;
} {
  if (state.mode === 'pictograph') return { rows: state.rows, legendBig: state.legendBig };
  const legendBig = state.settings.legendBig;
  return {
    legendBig,
    rows: Object.fromEntries(
      state.settings.categories.map((cat) => [
        cat,
        splitValue(state.settings.data?.[cat] ?? 0, legendBig),
      ]),
    ),
  };
}

export function argCats(args: unknown): string[] {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return [];
  const value = (args as Readonly<Record<string, unknown>>)['cats'];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
