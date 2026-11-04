/**
 * E03의 Observation.
 * 판정·힌트는 이 값만 본다. 모든 수 값은 Rational의 정규 문자열이다.
 */
import { Rational } from '../../core/math/rational';
import type { JsonValue, Observation } from '../../core/engine-sdk';
import { parseValue } from './ticks';
import { rowsOf } from './reduce';
import type { NumberLineState } from './types';

interface PointView {
  readonly value: string;
  readonly label?: string;
}

function sortedPoints(state: NumberLineState): PointView[] {
  const sorted = [...state.points].sort((a, b) => {
    const left = parseValue(a.value) ?? Rational.of(0);
    const right = parseValue(b.value) ?? Rational.of(0);
    return left.compareTo(right);
  });
  return sorted.map((point) => {
    const view: { value: string; label?: string } = { value: point.value };
    if (point.label !== undefined) view.label = point.label;
    return view;
  });
}

interface SameGroup {
  readonly value: string;
  readonly sources: string[];
}

function samePointGroups(state: NumberLineState): SameGroup[] {
  const groups = new Map<string, string[]>();
  const add = (value: string, source: string) => {
    const parsed = parseValue(value);
    if (!parsed) return;
    const key = parsed.toJSON();
    const list = groups.get(key) ?? [];
    list.push(source);
    groups.set(key, list);
  };
  for (const point of state.points) add(point.value, `point:${point.id}`);
  for (const card of state.cards) {
    const placed = state.cardValues[card];
    if (placed) add(placed, `card:${card}`);
  }
  const result: SameGroup[] = [];
  for (const [value, sources] of groups) {
    if (sources.length > 1) result.push({ value, sources });
  }
  return result;
}

function cardsCorrect(state: NumberLineState): boolean {
  if (state.cards.length === 0) return false;
  return state.cards.every((card) => {
    const placed = state.cardValues[card];
    if (!placed) return false;
    const expected = parseValue(card);
    const actual = parseValue(placed);
    return expected !== null && actual !== null && expected.equals(actual);
  });
}

function jumpTotal(state: NumberLineState): string {
  let total = Rational.of(0);
  for (const jump of state.jumps) {
    const from = parseValue(jump.from);
    const to = parseValue(jump.to);
    if (!from || !to) continue;
    total = total.add(to.sub(from));
  }
  return total.toJSON();
}

function cardsRecord(state: NumberLineState): Record<string, string | null> {
  const record: Record<string, string | null> = {};
  for (const card of state.cards) record[card] = state.cardValues[card] ?? null;
  return record;
}

function countsRecord(state: NumberLineState): Record<string, number> {
  return {
    pointPlaced: state.counts.pointPlaced,
    pointMoved: state.counts.pointMoved,
    jumped: state.counts.jumped,
    cardPlaced: state.counts.cardPlaced,
    zoomed: state.counts.zoomed,
    valueChanged: state.counts.valueChanged,
  };
}

/** skip-count·log-zoom 뛰어 세기. 없으면 모두 null. */
function skipObservation(state: NumberLineState): {
  readonly rows: JsonValue[] | null;
  readonly step: string | null;
  readonly hopCount: number | null;
  readonly landing: string | null;
} {
  const skip = state.skip;
  if (!skip) return { rows: null, step: null, hopCount: null, landing: null };
  const rows: JsonValue[] = skip.rows.map((row) => {
    const landing = row.hops[row.hops.length - 1] ?? skip.start;
    return {
      step: row.step,
      hops: [...row.hops],
      hopCount: row.hops.length,
      landing,
    };
  });
  const first = skip.rows[0];
  const landing = first ? (first.hops[first.hops.length - 1] ?? skip.start) : null;
  return {
    rows,
    step: first?.step ?? null,
    hopCount: first ? first.hops.length : null,
    landing,
  };
}

function roundingObservation(state: NumberLineState): JsonValue[] | null {
  if (!state.rounding) return null;
  return state.rounding.items.map((item) => ({
    value: item.value,
    marker: item.marker,
    method: item.method,
  }));
}

function doubleObservation(state: NumberLineState): {
  readonly pairs: JsonValue[] | null;
  readonly ops: string[] | null;
} {
  const line = state.double;
  if (!line) return { pairs: null, ops: null };
  const pairs: JsonValue[] = line.pairs.map((pair) => ({
    top: pair.top,
    bottom: pair.bottom,
  }));
  const ops: string[] = [];
  for (const pair of line.pairs) {
    if (pair.op) ops.push(`${pair.op.kind}:${pair.op.factor}`);
  }
  return { pairs, ops };
}

export function observe(state: NumberLineState): Observation {
  const rows = rowsOf(state);
  const tick = rows[0]?.step.toJSON() ?? '1';
  const groups = samePointGroups(state);
  const cards = state.cards;
  const cardsState = cardsRecord(state);
  const pointViews = sortedPoints(state);
  const pointsJson: JsonValue[] = pointViews.map((point) => {
    if (point.label !== undefined) {
      const view: { readonly [key: string]: JsonValue } = {
        value: point.value,
        label: point.label,
      };
      return view;
    }
    const view: { readonly [key: string]: JsonValue } = { value: point.value };
    return view;
  });
  const jumps = state.jumps.map((jump) => {
    const from = parseValue(jump.from) ?? Rational.of(0);
    const to = parseValue(jump.to) ?? Rational.of(0);
    return { from: jump.from, to: jump.to, size: to.sub(from).toJSON() };
  });
  const counts = countsRecord(state);

  const rowViews: JsonValue[] = rows.map((row) => ({
    subdivisions: row.subdivisions,
    tick: row.step.toJSON(),
  }));

  const sameGroups: JsonValue[] = groups.map((group) => ({
    value: group.value,
    sources: [...group.sources],
  }));

  const skip = skipObservation(state);
  const rounding = roundingObservation(state);
  const double = doubleObservation(state);

  return {
    mode: state.mode,
    min: state.min,
    max: state.max,
    unit: state.unit,
    tick,
    rows: rowViews,
    zoomLevel: state.zoomLevel,
    zoomMin: state.zoomMin,
    zoomMax: state.zoomMax,
    viewMin: state.viewMin,
    viewMax: state.viewMax,
    points: pointsJson,
    pointValues: pointViews.map((point) => point.value),
    cards: cardsState,
    cardCount: cards.length,
    cardsCorrect: cardsCorrect(state),
    jumps,
    jumpTotal: jumpTotal(state),
    samePointGroups: sameGroups,
    hasSamePoint: sameGroups.length > 0,
    cursor: state.cursor,
    cardCursor: state.cardCursor,
    selectedPointId: state.selectedPointId,
    selectedCard: state.selectedCard,
    linkedValue: state.linkedValue,
    lastValue: state.lastValue,
    counts,
    pointPlaced: counts['pointPlaced'] ?? 0,
    pointMoved: counts['pointMoved'] ?? 0,
    jumped: counts['jumped'] ?? 0,
    cardPlaced: counts['cardPlaced'] ?? 0,
    zoomed: counts['zoomed'] ?? 0,
    valueChanged: counts['valueChanged'] ?? 0,
    // T048 새 모드. 해당 없으면 null이다.
    skipRows: skip.rows,
    step: skip.step,
    hopCount: skip.hopCount,
    landing: skip.landing,
    rounding,
    level: state.logZoom ? state.logZoom.level : null,
    levelMax: state.logZoom ? state.max : null,
    levels: state.logZoom ? [...state.logZoom.levels] : null,
    pairs: double.pairs,
    doubleOps: double.ops,
  };
}
