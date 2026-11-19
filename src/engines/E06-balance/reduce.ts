/**
 * E06 equation 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 거절된 Action(잠금·범위 밖·빼기 불가)은 상태 그대로(같은 객체)를 돌려준다.
 */
import { Rational } from '../../core/math';
import { normalizeConfig } from './settings';
import { MAX_AMOUNT, MIN_AMOUNT } from './types';
import type {
  BalanceAction,
  BalanceConfig,
  BalanceOp,
  BalanceSide,
  BalanceSideName,
  BalanceState,
} from './types';

export function createInitialState(config: BalanceConfig): BalanceState {
  const normalized = normalizeConfig(config);
  return {
    mode: 'equation',
    error: normalized.error,
    settings: normalized.settings,
    left: normalized.left,
    right: normalized.right,
    initial: { left: normalized.left, right: normalized.right },
    initialSum: normalized.initialSum,
    tryValue: null,
    tries: [],
    ops: [],
    prediction: null,
  };
}

/** 더하기·빼기 수: 1~999 정수 문자열. 아니면 null. */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^\d{1,3}$/.test(raw)) return null;
  const value = Number(raw);
  return value >= MIN_AMOUNT && value <= MAX_AMOUNT ? value : null;
}

/** 넣어 볼 수: 0~999 정수 문자열. 아니면 null. */
export function parseTryValue(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^\d{1,3}$/.test(raw)) return null;
  return Number(raw);
}

export function hasBox(state: BalanceState): boolean {
  return state.left.hasBox || state.right.hasBox;
}

/** 예측을 요구하는 과제에서 예측 전에는 조작을 막는다. */
export function isLocked(state: BalanceState): boolean {
  return state.settings.predict && state.prediction === null;
}

function constOf(side: BalanceSide): Rational {
  return Rational.parse(side.const);
}

/** 이 접시에서 n을 뺄 수 있는가(접시의 수가 n 이상이어야 한다). */
export function canRemove(side: BalanceSide, n: number): boolean {
  return constOf(side).compareTo(Rational.of(n)) >= 0;
}

export function canRemoveBoth(state: BalanceState, n: number): boolean {
  return canRemove(state.left, n) && canRemove(state.right, n);
}

function shift(side: BalanceSide, n: number, sign: 1 | -1): BalanceSide {
  const delta = Rational.of(n * sign);
  return { const: constOf(side).add(delta).toString(), hasBox: side.hasBox };
}

function sameSide(a: BalanceSide, b: BalanceSide): boolean {
  return a.const === b.const && a.hasBox === b.hasBox;
}

function withOp(state: BalanceState, patch: Partial<BalanceState>, op: BalanceOp): BalanceState {
  return { ...state, ...patch, ops: [...state.ops, op] };
}

function oneSide(
  state: BalanceState,
  action: { readonly op: 'add' | 'remove'; readonly side: BalanceSideName; readonly n: string },
): BalanceState {
  if (!state.settings.allowOneSide) return state;
  if (action.side !== 'left' && action.side !== 'right') return state;
  const n = parseAmount(action.n);
  if (n === null) return state;
  const target = state[action.side];
  if (action.op === 'remove' && !canRemove(target, n)) return state;
  const next = shift(target, n, action.op === 'add' ? 1 : -1);
  return withOp(
    state,
    { [action.side]: next },
    { kind: action.op === 'add' ? 'one-add' : 'one-remove', n: String(n), side: action.side },
  );
}

export function reduce(state: BalanceState, action: BalanceAction): BalanceState {
  if (state.error !== null) return state;
  switch (action.type) {
    case 'try': {
      if (!state.settings.allowTryValue || !hasBox(state) || isLocked(state)) return state;
      const value = parseTryValue(action.value);
      if (value === null) return state;
      const text = String(value);
      return { ...state, tryValue: text, tries: [...state.tries, text] };
    }
    case 'both': {
      if (!state.settings.allowBothSides || isLocked(state)) return state;
      const n = parseAmount(action.n);
      if (n === null) return state;
      if (action.op === 'remove' && !canRemoveBoth(state, n)) return state;
      const sign = action.op === 'add' ? 1 : -1;
      return withOp(
        state,
        { left: shift(state.left, n, sign), right: shift(state.right, n, sign) },
        { kind: action.op === 'add' ? 'both-add' : 'both-remove', n: String(n) },
      );
    }
    case 'one':
      return isLocked(state) ? state : oneSide(state, action);
    case 'predict': {
      if (!state.settings.predict || state.prediction !== null) return state;
      if (action.value !== 'yes' && action.value !== 'no') return state;
      return { ...state, prediction: action.value };
    }
    case 'reset': {
      if (
        sameSide(state.left, state.initial.left) &&
        sameSide(state.right, state.initial.right) &&
        state.tryValue === null
      ) {
        return state;
      }
      // tries·ops·prediction은 기록이라 지우지 않는다.
      return { ...state, left: state.initial.left, right: state.initial.right, tryValue: null };
    }
  }
}
