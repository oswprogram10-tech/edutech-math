/**
 * T049 `partition` variant=share: 전체를 똑같이 나누어 접시에 나르기.
 *
 * - 전체마다 기존 칼선(`Cut`)을 쓴다. 끌기 없는 대안은 "똑같이 n조각"(`cut-equal`)이다.
 * - 조각은 한 접시에만 놓인다(조각마다 `plate`가 하나뿐이다).
 * - 접시 값은 조각 크기의 합이다. 화면에는 받은 조각 그림만 두고
 *   `plateLabel`이 true일 때만 "1/4 조각 3개"처럼 크기·개수만 쓴다(정답 노출 금지).
 */
import { Rational } from '../../core/math';
import { clamp } from '../../core/engine-sdk';
import { piecesAreEqual } from './geometry';
import { autoPresetCuts, samePoint } from './geometry';
import { outlineFor } from './geometry';
import { piecesOf } from './pieces';
import { DEFAULT_TOLERANCE, EMPTY_COUNTS, bumpCounts } from './types';
import type {
  Cut,
  FractionModelAction,
  FractionModelConfig,
  FractionShape,
  SharePiece,
  ShareState,
  ShareWhole,
} from './types';

const MAX_WHOLES = 6;
const MIN_PEOPLE = 2;
const MAX_PEOPLE = 6;
const MAX_EQUAL_PARTS = 12;

function pieceCountOf(
  shape: FractionShape,
  outline: ShareState['outline'],
  cuts: readonly Cut[],
): number {
  return Math.max(1, piecesOf({ shape, outline, cuts }).length);
}

/** 칼선이 바뀌면 조각 목록을 다시 만든다. 접시 배치는 앞에서부터 그대로 둔다. */
function rebuildWhole(
  whole: ShareWhole,
  cuts: readonly Cut[],
  shape: FractionShape,
  outline: ShareState['outline'],
): ShareWhole {
  const count = pieceCountOf(shape, outline, cuts);
  const pieces: SharePiece[] = Array.from({ length: count }, (_, index) => {
    const previous = whole.pieces[index];
    const plate = previous?.plate ?? null;
    return { plate };
  });
  return { cuts, pieces };
}

export function createShare(config: FractionModelConfig): ShareState {
  const shape: FractionShape = config.shape ?? 'circle';
  const outline = outlineFor(shape, config.polygonPoints);
  const wholes = clamp(Math.trunc(config.wholes ?? 1), 1, MAX_WHOLES);
  const people = clamp(Math.trunc(config.people ?? 4), MIN_PEOPLE, MAX_PEOPLE);
  return {
    mode: 'partition',
    variant: 'share',
    shape,
    outline,
    wholes: Array.from({ length: wholes }, () => ({
      cuts: [],
      pieces: [{ plate: null }],
    })),
    people,
    selected: null,
    tolerance:
      config.areaTolerance !== undefined && config.areaTolerance > 0
        ? config.areaTolerance
        : DEFAULT_TOLERANCE,
    counters: EMPTY_COUNTS,
  };
}

function validWhole(state: ShareState, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < state.wholes.length;
}

function validPiece(whole: ShareWhole | undefined, index: number): boolean {
  return (
    whole !== undefined && Number.isInteger(index) && index >= 0 && index < whole.pieces.length
  );
}

function clampSelection(state: ShareState, wholes: readonly ShareWhole[]): ShareState['selected'] {
  const selected = state.selected;
  if (selected === null) return null;
  const whole = wholes[selected.whole];
  return validPiece(whole, selected.piece) ? selected : null;
}

function replaceWhole(
  wholes: readonly ShareWhole[],
  index: number,
  next: ShareWhole,
): ShareWhole[] {
  return wholes.map((whole, candidate) => (candidate === index ? next : whole));
}

export function reduceShare(state: ShareState, action: FractionModelAction): ShareState {
  switch (action.type) {
    case 'cut': {
      const index = action.whole ?? 0;
      const whole = state.wholes[index];
      if (!validWhole(state, index) || !whole) return state;
      if (action.points.length !== 2) return state;
      if (samePoint(action.points[0], action.points[1])) return state;
      const cut: Cut = {
        id: `share-${index}-${whole.cuts.length + 1}`,
        tool: action.tool,
        points: action.points,
      };
      const next = rebuildWhole(whole, [...whole.cuts, cut], state.shape, state.outline);
      const wholes = replaceWhole(state.wholes, index, next);
      return {
        ...state,
        wholes,
        selected: clampSelection(state, wholes),
        counters: bumpCounts(state.counters, 'partitioned'),
      };
    }
    case 'cut-equal': {
      const index = action.whole;
      const whole = state.wholes[index];
      if (!validWhole(state, index) || !whole) return state;
      const parts = clamp(Math.trunc(action.parts), 2, MAX_EQUAL_PARTS);
      const cuts = autoPresetCuts(state.shape, state.outline, parts);
      const next = rebuildWhole(whole, cuts, state.shape, state.outline);
      const wholes = replaceWhole(state.wholes, index, next);
      return {
        ...state,
        wholes,
        selected: clampSelection(state, wholes),
        counters: bumpCounts(state.counters, 'partitioned'),
      };
    }
    case 'clear-cuts': {
      const index = action.whole ?? 0;
      const whole = state.wholes[index];
      if (!validWhole(state, index) || !whole) return state;
      const next = rebuildWhole(whole, [], state.shape, state.outline);
      const wholes = replaceWhole(state.wholes, index, next);
      return { ...state, wholes, selected: clampSelection(state, wholes) };
    }
    case 'select-piece': {
      const whole = state.wholes[action.whole];
      if (!validWhole(state, action.whole) || !validPiece(whole, action.piece)) return state;
      if (
        state.selected !== null &&
        state.selected.whole === action.whole &&
        state.selected.piece === action.piece
      ) {
        return { ...state, selected: null };
      }
      return { ...state, selected: { whole: action.whole, piece: action.piece } };
    }
    case 'deal-piece': {
      const whole = state.wholes[action.whole];
      if (!validWhole(state, action.whole) || whole === undefined) return state;
      if (!validPiece(whole, action.piece)) return state;
      if (!Number.isInteger(action.plate) || action.plate < 0 || action.plate >= state.people) {
        return state;
      }
      if (whole.pieces[action.piece]?.plate === action.plate) return state;
      const pieces = whole.pieces.map((piece, index) =>
        index === action.piece ? { plate: action.plate } : piece,
      );
      return {
        ...state,
        wholes: replaceWhole(state.wholes, action.whole, { ...whole, pieces }),
        selected: null,
        counters: bumpCounts(bumpCounts(state.counters, 'shaded'), 'valueChanged'),
      };
    }
    case 'return-piece': {
      const whole = state.wholes[action.whole];
      if (!validWhole(state, action.whole) || whole === undefined) return state;
      if (!validPiece(whole, action.piece)) return state;
      const piece = whole.pieces[action.piece];
      if (piece === undefined || piece.plate === null) {
        return state;
      }
      const pieces = whole.pieces.map((piece, index) =>
        index === action.piece ? { plate: null } : piece,
      );
      return {
        ...state,
        wholes: replaceWhole(state.wholes, action.whole, { ...whole, pieces }),
        counters: bumpCounts(state.counters, 'valueChanged'),
      };
    }
    default:
      return state;
  }
}

export interface ShareSummary {
  /** 접시마다 모인 값(접시 수만큼). */
  readonly plateValues: readonly Rational[];
  /** 모든 조각이 접시에 놓였는지. */
  readonly allDealt: boolean;
  /** 다 나누었고 접시 값이 모두 같은지. 시작 상태에서 참이 되지 않게 `allDealt`를 함께 본다. */
  readonly platesEqual: boolean;
  readonly piecesPerWhole: readonly number[];
  /** 모든 전체가 2조각 이상이고 넓이가 같은지. */
  readonly equal: boolean;
}

export function shareSummary(state: ShareState): ShareSummary {
  const plateValues = Array.from({ length: state.people }, () => Rational.of(0));
  const piecesPerWhole: number[] = [];
  let allDealt = true;
  let equal = true;

  state.wholes.forEach((whole) => {
    const pieces = piecesOf({ shape: state.shape, outline: state.outline, cuts: whole.cuts });
    const count = Math.max(1, pieces.length);
    piecesPerWhole.push(count);
    if (count < 2 || !piecesAreEqual(pieces, state.tolerance)) equal = false;
    whole.pieces.forEach((piece, index) => {
      if (index >= count) return;
      if (piece.plate === null) {
        allDealt = false;
        return;
      }
      const current = plateValues[piece.plate];
      if (current === undefined) return;
      plateValues[piece.plate] = current.add(Rational.of(1, count));
    });
  });

  const first = plateValues[0] ?? Rational.of(0);
  const platesEqual =
    allDealt && plateValues.length > 0 && plateValues.every((value) => value.equals(first));

  return { plateValues, allDealt, platesEqual, piecesPerWhole, equal };
}
