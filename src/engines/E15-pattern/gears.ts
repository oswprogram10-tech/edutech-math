/**
 * E15 gears 모드의 순수 로직. 맞물려 도는 두 톱니바퀴의 표시 톱니가 다시 만나는 칸을 다룬다.
 *
 * 칸 수는 작은 정수라 number를 쓴다(격자 인덱스 예외, 수학 값 Rational 규칙의 대상이 아니다).
 * 최소공배수 값은 상태·Observation에 넣지 않는다. 판정(predicate)과 오개념 검사 안에서만 계산한다.
 */
import { gearsSettings } from './settings';
import type { GearsAction, GearsSettings, GearsState, PatternConfig } from './types';

export const PREDICT_MAX_DIGITS = 3;
export const PREDICT_MAX = 999;
export const MC_LCM_AS_PRODUCT = 'MC-LCM-AS-PRODUCT';

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

/** 두 양의 정수의 최소공배수. 판정 전용이라 화면·Observation에 쓰지 않는다. */
export function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

/** steps칸 돌렸을 때 두 표시 톱니가 맞닿는가(0칸 포함). */
export function isMeeting(settings: GearsSettings, steps: number): boolean {
  return steps % settings.teethA === 0 && steps % settings.teethB === 0;
}

/** 1~upTo칸 중 맞닿는 칸(오름차순). 학생이 지나간 칸을 셀 때만 쓴다. */
export function meetingsUpTo(settings: GearsSettings, upTo: number): number[] {
  const list: number[] = [];
  for (let step = 1; step <= upTo; step += 1) {
    if (isMeeting(settings, step)) list.push(step);
  }
  return list;
}

/** 한 바퀴 칸 수로 나눈 바퀴 수와 남은 칸. */
export function lapsOf(steps: number, teeth: number): { laps: number; rest: number } {
  return { laps: Math.floor(steps / teeth), rest: steps % teeth };
}

export function createGearsState(config: PatternConfig | undefined): GearsState {
  return {
    mode: 'gears',
    settings: gearsSettings(config),
    steps: 0,
    maxReached: 0,
    meetings: [],
    predictionDraft: '',
    prediction: null,
  };
}

/** 예측을 정해야 돌릴 수 있는 설정인데 아직 정하지 않았다. */
export function turnLocked(state: GearsState): boolean {
  return state.settings.predict && state.prediction === null;
}

function moveTo(state: GearsState, raw: number): GearsState {
  if (turnLocked(state) || typeof raw !== 'number' || !Number.isFinite(raw)) return state;
  const steps = Math.min(state.settings.maxSteps, Math.max(0, Math.trunc(raw)));
  if (steps === state.steps) return state;
  const maxReached = Math.max(state.maxReached, steps);
  const meetings =
    maxReached > state.maxReached
      ? [
          ...state.meetings,
          ...meetingsUpTo(state.settings, maxReached).filter((m) => m > state.maxReached),
        ]
      : state.meetings;
  return { ...state, steps, maxReached, meetings };
}

export function reduceGears(state: GearsState, action: GearsAction): GearsState {
  switch (action.type) {
    case 'turn': {
      if (action.by !== 1 && action.by !== -1) return state;
      return moveTo(state, state.steps + action.by);
    }
    case 'turn-to':
      return moveTo(state, action.steps);
    case 'reset': {
      if (state.steps === 0 && state.maxReached === 0 && state.meetings.length === 0) return state;
      return { ...state, steps: 0, maxReached: 0, meetings: [] };
    }
    case 'predict-type': {
      if (!state.settings.predict || state.prediction !== null) return state;
      if (typeof action.key !== 'string' || !/^[0-9]$/.test(action.key)) return state;
      if (state.predictionDraft.length >= PREDICT_MAX_DIGITS) return state;
      // 맨 앞의 0은 받지 않는다(1~999).
      if (state.predictionDraft === '' && action.key === '0') return state;
      return { ...state, predictionDraft: state.predictionDraft + action.key };
    }
    case 'predict-backspace': {
      if (!state.settings.predict || state.prediction !== null || state.predictionDraft === '') {
        return state;
      }
      return { ...state, predictionDraft: state.predictionDraft.slice(0, -1) };
    }
    case 'predict-lock': {
      if (!state.settings.predict || state.prediction !== null) return state;
      const value = Number(state.predictionDraft);
      if (state.predictionDraft === '' || !Number.isInteger(value)) return state;
      if (value < 1 || value > PREDICT_MAX) return state;
      return { ...state, prediction: String(value) };
    }
    default:
      return state;
  }
}

/** MC-LCM-AS-PRODUCT: 예측이 두 톱니 수의 곱인데 그것이 최소공배수가 아니다. */
export function gearsMisconceptions(state: GearsState): string[] {
  if (state.prediction === null) return [];
  const { teethA, teethB } = state.settings;
  const product = teethA * teethB;
  if (Number(state.prediction) === product && product !== lcm(teethA, teethB)) {
    return [MC_LCM_AS_PRODUCT];
  }
  return [];
}
