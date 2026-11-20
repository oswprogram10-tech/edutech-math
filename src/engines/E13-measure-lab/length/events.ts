/** E13 length의 공개 판정(순수 함수). 이벤트에는 재어서 나온 값(정답)을 싣지 않는다. */
import { Rational } from '../../../core/math';
import { rat } from '../rat';
import type { EnginePredicate, JsonValue, Observation } from '../../../core/engine-sdk';

function record(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (args === null || args === undefined || typeof args !== 'object' || Array.isArray(args)) {
    return null;
  }
  return args;
}

function countOf(observation: Observation, unit: unknown): number | null {
  if (unit === undefined) {
    const count = observation['count'];
    return typeof count === 'number' ? count : null;
  }
  if (typeof unit !== 'string') return null;
  const byUnit = observation['countByUnit'];
  if (byUnit === null || typeof byUnit !== 'object' || Array.isArray(byUnit)) return null;
  const value = byUnit[unit];
  return typeof value === 'number' ? value : 0;
}

export const lengthPredicates: Readonly<Record<string, EnginePredicate>> = {
  /** args `{ n, unit? }`: 놓은 조각 수(unit이 있으면 그 단위의 조각 수)가 n인가. */
  countIs: (observation, args) => {
    const rec = record(args);
    const n = rec?.['n'];
    if (typeof n !== 'number') return false;
    return countOf(observation, rec?.['unit']) === n;
  },
  /** 틈·겹침이 없고 0에서 시작해 물건 끝에 닿는다. */
  exact: (observation) => observation['exact'] === true,
  /** 조각이 있고 틈도 겹침도 없다(길이가 맞는지는 보지 않는다). */
  noGapOverlap: (observation) =>
    typeof observation['count'] === 'number' &&
    observation['count'] > 0 &&
    observation['gaps'] === 0 &&
    observation['overlaps'] === 0,
  /** T208: 합체가 한 번 이상 일어났다. */
  merged: (observation) => typeof observation['merges'] === 'number' && observation['merges'] >= 1,
  /** T208 args `{ m, cm }`: 틈·겹침 없이 물건 길이를 쟀고, 1m 줄자가 m개이고 남은 cm 조각 길이 합이 cm이다. */
  measuredAs: (observation, args) => {
    const rec = record(args);
    const m = rec?.['m'];
    const cm = rec?.['cm'];
    if (!Number.isInteger(m) || !Number.isInteger(cm)) return false;
    if (observation['exact'] !== true || observation['meters'] !== m) return false;
    const rest = rat(observation['restCm']);
    return rest !== null && rest.equals(Rational.of(cm as number));
  },
  rulerMade: (observation) => observation['rulerMade'] === true,
  labelsCorrect: (observation) => observation['labelsCorrect'] === true,
};
