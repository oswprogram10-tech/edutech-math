/**
 * E03 rounding 상황 장면(T219)의 결과 계산. 순수 함수이고 수는 모두 Rational이다.
 *
 * 전체 버스·봉지 수는 어디에도 만들지 않는다(정답 노출 금지).
 * 마지막 묶음에 남은 수 `rest`(0 이상 묶음 크기 미만)만 다룬다.
 */
import { Rational } from '../../core/math/rational';
import { parseValue } from './ticks';
import type { NumberLineState, RoundingConsequence, RoundingScenario } from './types';

export interface RoundingScene {
  readonly scenario: 'bus-seats' | 'candy-bags';
  readonly consequence: RoundingConsequence;
  /** 한 묶음(버스 좌석·봉지)의 크기. 2~20. */
  readonly size: number;
  /** 마지막 묶음에 채운 수(앉은 학생·담은 사탕). all-seated·partial-bag·exact에서 쓴다. */
  readonly filled: number;
  /** 못 탄 학생·남은 사탕 수. left-behind·leftover에서 쓴다. */
  readonly left: number;
}

export function scenarioOf(state: NumberLineState): RoundingScenario | null {
  return state.rounding?.scenario ?? null;
}

function toSmallInt(value: Rational): number | null {
  if (!value.isInteger() || value.isNegative() || value.n > 1_000_000n) return null;
  return Number(value.n);
}

/** 마지막 묶음에 남는 수. 원래 수 % 묶음 크기. */
export function lastGroupRest(value: Rational, size: Rational): number | null {
  const v = toSmallInt(value);
  const s = toSmallInt(size);
  if (v === null || s === null || s === 0) return null;
  return v % s;
}

/**
 * 고른 어림 결과(marker)로 본 상황 결과. 장면이 없거나 아직 고르지 않았으면 null.
 * 어느 방법이 맞는지는 판단하지 않고 결과만 말한다.
 */
export function roundingScene(state: NumberLineState): RoundingScene | null {
  const rounding = state.rounding;
  const scenario = rounding?.scenario;
  if (!rounding || (scenario !== 'bus-seats' && scenario !== 'candy-bags')) return null;
  const item = rounding.items[0];
  const place = parseValue(state.unit)?.mul(Rational.of(10));
  const value = parseValue(item?.value);
  const marker = parseValue(item?.marker ?? undefined);
  if (!item || !place || !value || !marker) return null;
  const size = toSmallInt(place);
  const total = toSmallInt(value);
  const rounded = toSmallInt(marker);
  if (size === null || total === null || rounded === null) return null;
  const rest = total % size;
  if (rest === 0 && rounded === total) {
    return { scenario, consequence: 'exact', size, filled: size, left: 0 };
  }
  if (rounded >= total) {
    // 올림: 마지막 묶음이 덜 찼다(끌어서 더 크게 정한 경우는 빈 묶음까지 0으로 막는다).
    const filled = Math.min(Math.max(total - (rounded - size), 0), size);
    return {
      scenario,
      consequence: scenario === 'bus-seats' ? 'all-seated' : 'partial-bag',
      size,
      filled,
      left: 0,
    };
  }
  return {
    scenario,
    consequence: scenario === 'bus-seats' ? 'left-behind' : 'leftover',
    size,
    filled: 0,
    left: total - rounded,
  };
}

/** Observation의 `consequence`. 장면이 없는 설정·아직 안 고름이면 null. */
export function roundingConsequence(state: NumberLineState): RoundingConsequence | null {
  return roundingScene(state)?.consequence ?? null;
}

/**
 * 힌트 ② `left-behind`가 방법과 상관없이 보이는 단독 그림의 수.
 * 버스는 정류장에 남는 학생, 봉지는 덜 찬 봉지의 사탕. 나머지가 0이면 null.
 */
export function leftBehindRest(state: NumberLineState): {
  readonly scenario: 'bus-seats' | 'candy-bags';
  readonly size: number;
  readonly rest: number;
} | null {
  const rounding = state.rounding;
  const scenario = rounding?.scenario;
  if (!rounding || (scenario !== 'bus-seats' && scenario !== 'candy-bags')) return null;
  const place = parseValue(state.unit)?.mul(Rational.of(10));
  const value = parseValue(rounding.items[0]?.value);
  if (!place || !value) return null;
  const size = toSmallInt(place);
  const rest = lastGroupRest(value, place);
  if (size === null || rest === null || rest === 0) return null;
  return { scenario, size, rest };
}
