/**
 * E03 수직선의 순수 reduce.
 *
 * 모든 조작은 Action으로만 기록하고, 상태는 JSON 직렬화 가능해야 한다.
 * 수 값은 `Rational`로 계산한 뒤 `toJSON()` 문자열로 저장한다.
 */
import { Rational } from '../../core/math/rational';
import {
  buildRows,
  centeredView,
  lastIndex,
  nearestVisibleTick,
  parseValue,
  rowForY,
  tickAt,
  viewWidth,
  zoomRange,
} from './ticks';
import type { TickRow } from './ticks';
import { bumpCounts, EMPTY_COUNTS, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type {
  NumberLineAction,
  NumberLineConfig,
  NumberLineMode,
  NumberLinePoint,
  NumberLineState,
} from './types';

const ONE = Rational.of(1);
const DEFAULT_MAX: Record<NumberLineMode, string> = {
  integer: '9',
  fraction: '1',
  decimal: '1',
};

function modeOf(config: NumberLineConfig): NumberLineMode {
  return config.mode === 'fraction' || config.mode === 'decimal' ? config.mode : 'integer';
}

function normalizeSubdivisions(
  mode: NumberLineMode,
  value: number | readonly number[] | undefined,
): number[] {
  if (mode !== 'fraction') return [1];
  const list = typeof value === 'number' ? [value] : value;
  const source = list ?? [4];
  const parts = source.filter((part) => Number.isInteger(part) && part > 0 && part <= 100);
  if (parts.length === 0) return [4];
  return [...new Set(parts)];
}

function normalizeCards(value: readonly string[] | undefined): string[] {
  const cards: string[] = [];
  for (const raw of value ?? []) {
    const text = raw.trim();
    if (text.length === 0 || parseValue(text) === null) continue;
    if (!cards.includes(text)) cards.push(text);
  }
  return cards;
}

export function rowsOf(state: NumberLineState): TickRow[] {
  return buildRows({
    mode: state.mode,
    unit: state.unit,
    subdivisions: state.subdivisions,
    zoomLevel: state.zoomLevel,
  });
}

export function createInitialState(config: NumberLineConfig): NumberLineState {
  const mode = modeOf(config);
  const unit = parseValue(config.unit) ?? ONE;
  const safeUnit = unit.isZero() || unit.isNegative() ? ONE : unit;
  const min = parseValue(config.min) ?? Rational.of(0);
  let max = parseValue(config.max) ?? parseValue(DEFAULT_MAX[mode]) ?? Rational.of(1);
  if (max.compareTo(min) <= 0) max = min.add(safeUnit);

  const subdivisions = normalizeSubdivisions(mode, config.subdivisions);
  // 줌으로 보기 범위를 좁히는 것은 decimal에서만 한다(정수·분수는 눈금이 굵어
  // 범위를 좁히면 눈금 하나만 남는다). 요구 4·7의 E2E도 decimal만 본다.
  const range =
    mode === 'decimal'
      ? zoomRange(safeUnit, config.zoom?.from, config.zoom?.to)
      : { min: 0, max: 0 };
  const cards = normalizeCards(config.cards);
  const cardValues: Record<string, string | null> = {};
  for (const card of cards) cardValues[card] = null;

  const minText = min.toJSON();
  const initialWidth = viewWidth(max.sub(min), range.min);
  const initialView = centeredView(min, max, initialWidth, min);
  return {
    mode,
    min: minText,
    max: max.toJSON(),
    unit: safeUnit.toJSON(),
    subdivisions,
    zoomLevel: range.min,
    zoomMin: range.min,
    zoomMax: range.max,
    viewMin: initialView.min.toJSON(),
    viewMax: initialView.max.toJSON(),
    points: [],
    jumps: [],
    selectedPointId: null,
    selectedCard: null,
    cursor: minText,
    cardCursor: null,
    cards,
    cardValues,
    linkedValue: null,
    lastValue: null,
    nextPointId: 1,
    counts: EMPTY_COUNTS,
  };
}

/** 보기 범위 안에서 그려진 눈금에 맞춘 값. 범위 밖 값은 가장 가까운 경계 눈금이 된다. */
export function snapValue(state: NumberLineState, text: string): Rational | null {
  const value = parseValue(text);
  if (!value) return null;
  const originMin = parseValue(state.min) ?? Rational.of(0);
  const max = parseValue(state.max) ?? originMin.add(ONE);
  const viewMin = parseValue(state.viewMin) ?? originMin;
  const viewMax = parseValue(state.viewMax) ?? max;
  const rows = rowsOf(state);
  let best: Rational | null = null;
  let bestDistance: Rational | null = null;
  for (const row of rows) {
    const tick = nearestVisibleTick(row, originMin, viewMin, viewMax, value);
    if (!tick) continue;
    const distance = tick.value.sub(value).abs();
    if (best === null || bestDistance === null || distance.compareTo(bestDistance) < 0) {
      best = tick.value;
      bestDistance = distance;
    }
  }
  return best ?? viewMin;
}

/** 화면 y에 가장 가까운 줄의 보이는 눈금으로 맞춘 값. View가 줄을 고를 때 쓴다. */
export function snapValueNearY(state: NumberLineState, text: string, y: number): string | null {
  const value = parseValue(text);
  if (!value) return null;
  const originMin = parseValue(state.min) ?? Rational.of(0);
  const max = parseValue(state.max) ?? originMin.add(ONE);
  const viewMin = parseValue(state.viewMin) ?? originMin;
  const viewMax = parseValue(state.viewMax) ?? max;
  const rows = rowsOf(state);
  const row = rows[rowForY(y, rows)] ?? rows[0];
  if (!row) return viewMin.toJSON();
  const tick = nearestVisibleTick(row, originMin, viewMin, viewMax, value);
  return (tick?.value ?? viewMin).toJSON();
}

/** 지금 보이는 범위의 폭. */
export function viewSpanOf(state: NumberLineState): Rational {
  const originMin = parseValue(state.min) ?? Rational.of(0);
  const max = parseValue(state.max) ?? originMin.add(ONE);
  const viewMin = parseValue(state.viewMin) ?? originMin;
  const viewMax = parseValue(state.viewMax) ?? max;
  return viewMax.sub(viewMin);
}

function replacePoint(
  points: readonly NumberLinePoint[],
  id: string,
  value: string,
): NumberLinePoint[] {
  return points.map((point) => (point.id === id ? { ...point, value } : point));
}

export function reduce(state: NumberLineState, action: NumberLineAction): NumberLineState {
  switch (action.type) {
    case 'place-point': {
      const value = snapValue(state, action.value);
      if (!value) return state;
      const id = `p${state.nextPointId}`;
      const point: NumberLinePoint = { id, value: value.toJSON() };
      return {
        ...state,
        points: [...state.points, point],
        selectedPointId: id,
        lastValue: point.value,
        nextPointId: state.nextPointId + 1,
        counts: bumpCounts(bumpCounts(state.counts, 'pointPlaced'), 'valueChanged'),
      };
    }

    case 'move-point': {
      const existing = state.points.find((point) => point.id === action.id);
      if (!existing) return state;
      const value = snapValue(state, action.value);
      if (!value) return state;
      const text = value.toJSON();
      if (text === existing.value) {
        return state.selectedPointId === action.id
          ? state
          : { ...state, selectedPointId: action.id };
      }
      return {
        ...state,
        points: replacePoint(state.points, action.id, text),
        selectedPointId: action.id,
        lastValue: text,
        counts: bumpCounts(bumpCounts(state.counts, 'pointMoved'), 'valueChanged'),
      };
    }

    case 'remove-point': {
      if (!state.points.some((point) => point.id === action.id)) return state;
      return {
        ...state,
        points: state.points.filter((point) => point.id !== action.id),
        selectedPointId: state.selectedPointId === action.id ? null : state.selectedPointId,
      };
    }

    case 'select-point': {
      if (action.id !== null && !state.points.some((point) => point.id === action.id)) {
        return state;
      }
      if (state.selectedPointId === action.id) return state;
      return { ...state, selectedPointId: action.id };
    }

    case 'add-jump': {
      const from = snapValue(state, action.from);
      const to = snapValue(state, action.to);
      if (!from || !to || from.equals(to)) return state;
      return {
        ...state,
        jumps: [...state.jumps, { from: from.toJSON(), to: to.toJSON() }],
        counts: bumpCounts(state.counts, 'jumped'),
      };
    }

    case 'clear-jumps': {
      if (state.jumps.length === 0) return state;
      return { ...state, jumps: [] };
    }

    case 'select-card': {
      if (action.card !== null && !state.cards.includes(action.card)) return state;
      if (state.selectedCard === action.card) return state;
      if (action.card === null) {
        return { ...state, selectedCard: null, cardCursor: null };
      }
      const placed = state.cardValues[action.card] ?? state.cursor;
      const snapped = snapValue(state, placed);
      return {
        ...state,
        selectedCard: action.card,
        cardCursor: snapped ? snapped.toJSON() : state.cursor,
      };
    }

    case 'set-cursor': {
      const value = snapValue(state, action.value);
      if (!value) return state;
      const text = value.toJSON();
      if (state.cursor === text) return state;
      return { ...state, cursor: text };
    }

    case 'set-card-cursor': {
      if (state.selectedCard === null) return state;
      const value = snapValue(state, action.value);
      if (!value) return state;
      const text = value.toJSON();
      if (state.cardCursor === text) return state;
      return { ...state, cardCursor: text };
    }

    case 'place-card': {
      if (!state.cards.includes(action.card)) return state;
      const value = snapValue(state, action.value);
      if (!value) return state;
      const cardValue = parseValue(action.card);
      if (!cardValue) return state;
      const placed = value.toJSON();
      return {
        ...state,
        cardValues: { ...state.cardValues, [action.card]: placed },
        selectedCard: null,
        cardCursor: null,
        // 카드가 나타내는 수는 꽂힌 위치가 아니라 카드 자체의 값이다.
        lastValue: cardValue.toJSON(),
        counts: bumpCounts(bumpCounts(state.counts, 'cardPlaced'), 'valueChanged'),
      };
    }

    case 'zoom': {
      const level = Math.trunc(action.level);
      if (!Number.isFinite(level)) return state;
      const clamped = Math.min(Math.max(level, state.zoomMin), state.zoomMax);
      if (clamped === state.zoomLevel) return state;
      const originMin = parseValue(state.min) ?? Rational.of(0);
      const max = parseValue(state.max) ?? originMin.add(ONE);
      const center = parseValue(action.center) ?? parseValue(state.cursor) ?? originMin;
      const width = viewWidth(max.sub(originMin), clamped);
      const window = centeredView(originMin, max, width, center);
      const next = {
        ...state,
        zoomLevel: clamped,
        viewMin: window.min.toJSON(),
        viewMax: window.max.toJSON(),
      };
      const cursor = snapValue(next, state.cursor);
      const cardCursor = state.cardCursor === null ? null : snapValue(next, state.cardCursor);
      return {
        ...next,
        cursor: cursor ? cursor.toJSON() : state.cursor,
        cardCursor: cardCursor ? cardCursor.toJSON() : state.cardCursor,
        counts: bumpCounts(state.counts, 'zoomed'),
      };
    }

    case 'pan': {
      const delta = parseValue(action.delta);
      if (!delta || delta.isZero()) return state;
      const originMin = parseValue(state.min) ?? Rational.of(0);
      const max = parseValue(state.max) ?? originMin.add(ONE);
      const currentMin = parseValue(state.viewMin) ?? originMin;
      const currentMax = parseValue(state.viewMax) ?? max;
      const span = currentMax.sub(currentMin);
      if (span.isZero() || span.compareTo(max.sub(originMin)) >= 0) return state;
      let low = currentMin.add(delta);
      let high = currentMax.add(delta);
      if (low.compareTo(originMin) < 0) {
        low = originMin;
        high = originMin.add(span);
      }
      if (high.compareTo(max) > 0) {
        high = max;
        low = max.sub(span);
      }
      if (low.equals(currentMin) && high.equals(currentMax)) return state;
      const next = { ...state, viewMin: low.toJSON(), viewMax: high.toJSON() };
      const cursor = snapValue(next, state.cursor);
      const cardCursor = state.cardCursor === null ? null : snapValue(next, state.cardCursor);
      return {
        ...next,
        cursor: cursor ? cursor.toJSON() : state.cursor,
        cardCursor: cardCursor ? cardCursor.toJSON() : state.cardCursor,
      };
    }

    case 'set-linked': {
      const value = parseValue(action.value);
      if (!value) return state;
      const text = value.toJSON();
      if (state.linkedValue === text) return state;
      return { ...state, linkedValue: text };
    }
  }
}

/** 관찰·테스트에서 쓰는 마지막 눈금 인덱스. */
export function lastTickIndex(state: NumberLineState): number {
  const min = parseValue(state.min) ?? Rational.of(0);
  const max = parseValue(state.max) ?? min.add(ONE);
  const row = rowsOf(state)[0];
  if (!row) return 0;
  return lastIndex(min, max, row.step);
}

export function tickValueAt(state: NumberLineState, index: number): string {
  const min = parseValue(state.min) ?? Rational.of(0);
  const row = rowsOf(state)[0];
  if (!row) return min.toJSON();
  return tickAt(min, row.step, index).toJSON();
}

export const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
