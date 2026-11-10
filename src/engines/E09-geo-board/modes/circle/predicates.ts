/** circle 모드의 판정(T102). Observation만 본다. 정답 값은 화면에 쓰지 않는다. */
import type { EnginePredicate, JsonValue, Observation } from '../../../../core/engine-sdk';
import { Rational } from '../../../../core/math';

function argsRecord(args: JsonValue | undefined): Readonly<Record<string, JsonValue>> {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return {};
  return args;
}

function numberArg(args: Readonly<Record<string, JsonValue>>, key: string): number | null {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function halfArg(value: JsonValue | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value * 2);
}

function halfText(half: number): string {
  return Rational.of(half, 2).toString();
}

function recordOf(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function circleRecords(observation: Observation): Readonly<Record<string, JsonValue>>[] {
  const value = observation['circles'];
  if (!Array.isArray(value)) return [];
  const result: Readonly<Record<string, JsonValue>>[] = [];
  for (const item of value) {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) result.push(item);
  }
  return result;
}

export const circlePredicates: Readonly<Record<string, EnginePredicate>> = {
  coverageAtLeast: (observation, args) => {
    const record = argsRecord(args);
    const percent = numberArg(record, 'percent');
    if (percent === null) return false;
    const coverage = recordOf(observation['coverage']);
    if (!coverage) return false;
    const explicit = numberArg(record, 'ropeLength');
    const ropeLength = explicit ?? numberArg(observation, 'ropeLength');
    if (ropeLength === null) return false;
    const value = coverage[String(Math.round(ropeLength))];
    return typeof value === 'number' && value >= percent;
  },

  distinctRadii: (observation, args) => {
    const count = numberArg(argsRecord(args), 'count');
    if (count === null) return false;
    const value = observation['distinctRadii'];
    return typeof value === 'number' && value >= count;
  },

  measuredRadii: (observation, args) => {
    const count = numberArg(argsRecord(args), 'count');
    if (count === null) return false;
    const value = observation['measuredCount'];
    return typeof value === 'number' && value >= count;
  },

  chordThroughCenter: (observation) => {
    const chord = recordOf(observation['chord']);
    return chord !== null && chord['throughCenter'] === true;
  },

  hasCircle: (observation, args) => {
    const record = argsRecord(args);
    const radius = halfArg(record['radius']);
    if (radius === null) return false;
    const center = record['center'];
    let cx: number | null = null;
    let cy: number | null = null;
    if (Array.isArray(center)) {
      cx = halfArg(center[0]);
      cy = halfArg(center[1]);
      if (cx === null || cy === null) return false;
    }
    const radiusText = halfText(radius);
    const centerXText = cx === null ? null : halfText(cx);
    const centerYText = cy === null ? null : halfText(cy);
    return circleRecords(observation).some((circle) => {
      if (circle['radius'] !== radiusText) return false;
      if (centerXText === null || centerYText === null) return true;
      const observed = circle['center'];
      return Array.isArray(observed) && observed[0] === centerXText && observed[1] === centerYText;
    });
  },

  patternMatched: (observation, args) => {
    const total = observation['patternTotal'];
    const matched = observation['patternMatched'];
    if (typeof total !== 'number' || !Array.isArray(matched)) return false;
    const count = numberArg(argsRecord(args), 'count');
    if (count === null) return total > 0 && matched.length === total;
    return matched.length >= count;
  },
};

/** `halfString`은 화면·판정이 같은 0.5 단위 표기를 쓰게 하려고 다시 내보낸다. */
export { halfString } from './observe';
