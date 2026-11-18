/**
 * E18 오버레이 공용 도우미. 학생이 그린 것과 이미 주어진 표 값만 쓴다.
 * 학생이 아직 구하지 않은 값(그릴 그래프의 정답 높이, 읽어야 할 값)은 계산하지 않는다.
 */
import { frameOf } from '../layout';
import type { Frame } from '../layout';
import { axisCells } from '../reduce';
import type { GraphState } from '../types';

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
