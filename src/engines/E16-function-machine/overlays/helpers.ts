/**
 * E16 오버레이 공용 도우미. 숨은 규칙·빈칸 정답을 쓰지 않는다.
 * 학생 식과 학생이 본 표(주어진 수·학생이 쓴 수)만 쓴다.
 */
import { Rational } from '../../../core/math';
import type { Relation } from '../../../core/math';
import { columnsOf, pairsOf, rationalOf, tryParse } from '../relation-check';
import type { Column } from '../relation-check';
import { tableLayout } from '../table-layout';
import type { TableLayout } from '../table-layout';
import type { FunctionState } from '../types';

export const RELATION_CANVAS = 'svg[data-testid="relation-canvas"]';

export function argsOf(args: unknown): Readonly<Record<string, unknown>> {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return {};
  return args as Readonly<Record<string, unknown>>;
}

export interface OverlayData {
  readonly columns: Column[];
  readonly layout: TableLayout;
  /** 마지막으로 시험한 식(읽힌 것만). */
  readonly rel: Relation | null;
}

export function overlayData(state: FunctionState): OverlayData {
  const columns = columnsOf(state);
  const layout = tableLayout(columns.length, state.settings.xLabel, state.settings.yLabel);
  const parsed = state.tested !== null && state.tested.ok ? tryParse(state.tested.text) : null;
  return { columns, layout, rel: parsed !== null && parsed.ok ? parsed.rel : null };
}

export interface NeighborPair {
  readonly from: number;
  readonly to: number;
  readonly dx: Rational;
  readonly dy: Rational;
}

function complete(column: Column): [Rational, Rational] | null {
  return pairsOf([column])[0] ?? null;
}

/**
 * 표에서 ○가 1씩 커지는 이웃 열 쌍. 없으면 ○ 차이가 가장 작은 이웃 쌍 하나(차이가 0이 아닌 것).
 * 표에 있는 수끼리의 차이만 쓴다.
 */
export function neighborPairs(columns: readonly Column[]): NeighborPair[] {
  const all: NeighborPair[] = [];
  for (let i = 0; i + 1 < columns.length; i += 1) {
    const a = complete(columns[i] as Column);
    const b = complete(columns[i + 1] as Column);
    if (a === null || b === null) continue;
    const dx = b[0].sub(a[0]);
    if (dx.isZero()) continue;
    all.push({ from: i, to: i + 1, dx, dy: b[1].sub(a[1]) });
  }
  const ones = all.filter((pair) => pair.dx.equals(Rational.of(1)));
  if (ones.length > 0) return ones;
  const smallest = [...all].sort((p, q) => p.dx.abs().compareTo(q.dx.abs()))[0];
  return smallest === undefined ? [] : [smallest];
}

/** "+3", "−2", "+1/2". */
export function signed(value: Rational): string {
  return value.isNegative() ? `−${value.abs().toString()}` : `+${value.toString()}`;
}

export { rationalOf };
