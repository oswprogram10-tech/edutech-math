/**
 * E07의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * `value-changed` payload는 E05·E03과 같은 모양 `{ value: "<Rational>" }`이다.
 */
import { Rational } from '../../core/math';
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { alignmentOf, computeGrid, readResult } from './grid';
import type { ColumnCalcAction, ColumnCalcState } from './types';

function recordOf(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function stringOf(value: JsonValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function valueEvent(state: ColumnCalcState): EngineEvent[] {
  const reading = readResult(state, computeGrid(state));
  if (!reading.complete || reading.value === null) return [];
  return [{ name: 'value-changed', payload: { value: reading.value } }];
}

export function emit(
  prev: ColumnCalcState,
  next: ColumnCalcState,
  action: ColumnCalcAction,
): EngineEvent[] {
  if (prev === next) return [];

  switch (action.type) {
    case 'enter': {
      if (action.digit === null) return [];
      const events: EngineEvent[] = [
        {
          name: 'cell-entered',
          payload: { row: action.row, column: action.column, digit: action.digit },
        },
      ];
      if (action.row === 'carry' || action.row === 'regroup') {
        events.push({
          name: 'carry-marked',
          payload: { column: action.column, kind: action.row, value: action.digit },
        });
      }
      return [...events, ...valueEvent(next)];
    }

    case 'toggle-cross':
    case 'toggle-ten': {
      const kind = action.type === 'toggle-cross' ? 'cross' : 'ten';
      const marked =
        action.type === 'toggle-cross'
          ? next.crosses.includes(action.column)
          : next.tens.includes(action.column);
      return [
        { name: 'carry-marked', payload: { column: action.column, kind, marked } },
        ...valueEvent(next),
      ];
    }

    case 'place': {
      const alignment = alignmentOf(next).alignment;
      if (alignment === null) return [];
      return [{ name: 'aligned', payload: { alignment } }, ...valueEvent(next)];
    }

    default:
      return valueEvent(next);
  }
}

function parseObservationValue(observation: Observation, key: string): Rational | null {
  const value = observation[key];
  if (typeof value !== 'string') return null;
  try {
    return Rational.parse(value);
  } catch {
    return null;
  }
}

/** args `{ value }`와 결과 값이 같은가. `"4.77"`과 `"477/100"`은 같다. */
export const resultIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = recordOf(args);
  if (!record) return false;
  const expectedText = stringOf(record['value']);
  if (expectedText === null) return false;
  let expected: Rational;
  try {
    expected = Rational.parse(expectedText);
  } catch {
    return false;
  }
  const actual = parseObservationValue(observation, 'result');
  return actual !== null && actual.equals(expected);
};

/** 소수점 열이 정확히 맞았는가. */
export const alignedByPoint: EnginePredicate = (observation: Observation): boolean =>
  observation['alignment'] === 'point';

/** 결과가 다 찼고, 자리 맞춤과 모든 칸이 바른가. */
export const noErrors: EnginePredicate = (observation: Observation): boolean => {
  const wrong = observation['wrongColumns'];
  return (
    observation['complete'] === true &&
    observation['aligned'] !== false &&
    Array.isArray(wrong) &&
    wrong.length === 0
  );
};

/** args `{ code }`가 오개념 목록에 있는가. */
export const hasMisconception: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = recordOf(args);
  if (!record) return false;
  const code = stringOf(record['code']);
  if (code === null) return false;
  const codes = observation['misconceptions'];
  return Array.isArray(codes) && codes.includes(code);
};

export const complete: EnginePredicate = (observation: Observation): boolean =>
  observation['complete'] === true;

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  resultIs,
  alignedByPoint,
  noErrors,
  hasMisconception,
  complete,
};
