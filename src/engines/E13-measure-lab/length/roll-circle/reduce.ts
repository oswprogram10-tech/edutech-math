/**
 * E13 roll-circle 상태 전이. 순수 함수이고 상태는 JSON 직렬화가 가능하다.
 * 조건이 안 맞는 Action(굴린 뒤 다시 굴리기, 굴리기 전 막대·기록, 같은 지름 기록, 막대 0 미만·4 초과)은
 * 상태 그대로를 돌려준다.
 */
import { rat } from '../../rat';
import { formatFixed, measuredCircumference, ratioOf } from './pi';
import { normalizeRoll, precisionDigits } from './settings';
import { MAX_LOG, MAX_STICKS } from './types';
import type { RollAction, RollConfig, RollLogRow, RollState } from './types';

export function createRollState(config: RollConfig): RollState {
  return normalizeRoll(config);
}

export type RollReject =
  | 'ok'
  | 'error'
  | 'bad-diameter'
  | 'already-rolled'
  | 'not-rolled'
  | 'no-stick-tool'
  | 'stick-max'
  | 'stick-min'
  | 'no-log'
  | 'logged'
  | 'log-full'
  | 'nothing'
  | 'same';

/** 이 Action이 왜 거절되는가('ok'면 받는다). 화면 안내 글과 reduce가 같은 판정을 쓴다. */
export function rejectReason(state: RollState, action: RollAction): RollReject {
  if (state.error !== null) return 'error';
  switch (action.type) {
    case 'choose':
      if (!state.diameters.includes(action.d)) return 'bad-diameter';
      if (action.d === state.diameter && !state.rolled && state.sticks === 0) return 'same';
      return 'ok';
    case 'roll':
      return state.rolled ? 'already-rolled' : 'ok';
    case 'stick':
      if (!state.diameterStickTool) return 'no-stick-tool';
      if (!state.rolled) return 'not-rolled';
      if (action.delta === 1) return state.sticks >= MAX_STICKS ? 'stick-max' : 'ok';
      return state.sticks <= 0 ? 'stick-min' : 'ok';
    case 'record':
      if (!state.logEnabled) return 'no-log';
      if (!state.rolled) return 'not-rolled';
      if (state.log.some((row) => row.d === state.diameter)) return 'logged';
      return state.log.length >= MAX_LOG ? 'log-full' : 'ok';
    case 'reset':
      return state.rolled || state.sticks > 0 ? 'ok' : 'nothing';
    default:
      return 'same';
  }
}

/** 지금 지름·측정 원주로 기록표 한 줄을 만든다(굴리지 않았으면 null). */
export function rowOf(state: RollState): RollLogRow | null {
  const d = rat(state.diameter);
  const c = state.measuredCm === null ? null : rat(state.measuredCm);
  if (d === null || c === null) return null;
  const digits = precisionDigits(state);
  return {
    d: state.diameter,
    c: formatFixed(c, 1),
    ratio: formatFixed(ratioOf(c, d, digits), digits),
  };
}

export function reduceRoll(state: RollState, action: RollAction): RollState {
  if (rejectReason(state, action) !== 'ok') return state;
  const moved = { moves: state.moves + 1 };
  switch (action.type) {
    case 'choose':
      return {
        ...state,
        diameter: action.d,
        rolled: false,
        measuredCm: null,
        sticks: 0,
        ...moved,
      };
    case 'roll': {
      const d = rat(state.diameter);
      if (d === null) return state;
      return {
        ...state,
        rolled: true,
        measuredCm: formatFixed(measuredCircumference(d), 1),
        ...moved,
      };
    }
    case 'stick':
      return { ...state, sticks: state.sticks + action.delta, ...moved };
    case 'record': {
      const row = rowOf(state);
      if (row === null) return state;
      return { ...state, log: [...state.log, row], ...moved };
    }
    case 'reset':
      return { ...state, rolled: false, measuredCm: null, sticks: 0, ...moved };
    default:
      return state;
  }
}
