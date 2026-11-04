/**
 * E07의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * `value-changed` payload는 E05·E03과 같은 모양 `{ value: "<Rational>" }`이다.
 * T046은 `estimate-locked`·`signal-changed`를 더하고 `cell-entered`에 줄 index를 붙였다.
 */
import { Rational } from '../../core/math';
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { estimateSignal } from './estimate';
import { alignmentOf, computeGrid, readResult } from './grid';
import type { ColumnCalcAction, ColumnCalcState } from './types';

function recordOf(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function stringOf(value: JsonValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function numberOf(value: JsonValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function valueEvent(state: ColumnCalcState): EngineEvent[] {
  const reading = readResult(state, computeGrid(state));
  if (!reading.complete || reading.value === null) return [];
  return [{ name: 'value-changed', payload: { value: reading.value } }];
}

function signalEvent(prev: ColumnCalcState, next: ColumnCalcState): EngineEvent[] {
  if (prev.mode !== 'estimate' || next.mode !== 'estimate') return [];
  const before = estimateSignal(prev);
  const after = estimateSignal(next);
  if (before === after) return [];
  return [{ name: 'signal-changed', payload: { signal: after } }];
}

export function emit(
  prev: ColumnCalcState,
  next: ColumnCalcState,
  action: ColumnCalcAction,
): EngineEvent[] {
  if (prev === next) return [];

  const events: EngineEvent[] = [];
  switch (action.type) {
    case 'enter': {
      if (action.digit === null) break;
      events.push({
        name: 'cell-entered',
        payload:
          action.index === undefined
            ? { row: action.row, column: action.column, digit: action.digit }
            : {
                row: action.row,
                column: action.column,
                digit: action.digit,
                index: action.index,
              },
      });
      if (action.row === 'carry' || action.row === 'regroup') {
        events.push({
          name: 'carry-marked',
          payload: { column: action.column, kind: action.row, value: action.digit },
        });
      }
      break;
    }

    case 'toggle-cross':
    case 'toggle-ten': {
      const kind = action.type === 'toggle-cross' ? 'cross' : 'ten';
      const marked =
        action.type === 'toggle-cross'
          ? next.crosses.includes(action.column)
          : next.tens.includes(action.column);
      events.push({ name: 'carry-marked', payload: { column: action.column, kind, marked } });
      break;
    }

    case 'place': {
      const alignment = alignmentOf(next).alignment;
      if (alignment !== null) {
        events.push({ name: 'aligned', payload: { alignment } });
      }
      break;
    }

    case 'lock-estimate': {
      if (next.phase === 'calc' && prev.phase === 'estimate') {
        events.push({ name: 'estimate-locked', payload: { estimate: next.estimate } });
      }
      break;
    }

    default:
      break;
  }

  return [...events, ...valueEvent(next), ...signalEvent(prev, next)];
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

/** args `{ values }`: 부분곱 줄 값 목록이 같은가(빈 줄은 null). */
export const partialsAre: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = recordOf(args);
  if (!record) return false;
  const expected = record['values'];
  const actual = observation['partials'];
  if (!Array.isArray(expected) || !Array.isArray(actual)) return false;
  if (expected.length !== actual.length) return false;
  return expected.every((value, index) => {
    const current = actual[index];
    if (value === null || current === null) return value === current;
    if (typeof value === 'number') return current === String(value);
    return typeof value === 'string' && current === value;
  });
};

/** args `{ value }`: 신호등 값. */
export const signalIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = recordOf(args);
  return record !== null && observation['signal'] === record['value'];
};

/** args `{ value }`: 학생이 쓴 어림값. */
export const estimateIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = recordOf(args);
  if (!record) return false;
  const expected = record['value'];
  const actual = observation['estimate'];
  if (typeof actual !== 'string') return false;
  if (typeof expected === 'number') return actual === String(expected);
  if (typeof expected !== 'string') return false;
  if (/^\d+$/.test(actual) && /^\d+$/.test(expected)) {
    return BigInt(actual) === BigInt(expected);
  }
  return actual === expected;
};

/** args `{ row, index?, column }`: 학생이 표시한 틀린 칸. */
export const flaggedCell: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = recordOf(args);
  if (!record) return false;
  const row = stringOf(record['row']);
  const column = numberOf(record['column']);
  const index = record['index'] === undefined ? undefined : numberOf(record['index']);
  const cells = observation['flaggedCells'];
  if (row === null || column === null || !Array.isArray(cells)) return false;
  return cells.some((cell) => {
    if (cell === null || typeof cell !== 'object' || Array.isArray(cell)) return false;
    return (
      cell['row'] === row &&
      cell['column'] === column &&
      (index === undefined ? cell['index'] === undefined : cell['index'] === index)
    );
  });
};

/** args `{ kind, column }`: E01 연결로 강조한 칸. */
export const linkMarked: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = recordOf(args);
  if (!record) return false;
  const kind = stringOf(record['kind']);
  const column = numberOf(record['column']);
  if (kind === null || column === null) return false;
  const highlights = observation['linkHighlights'];
  return Array.isArray(highlights) && highlights.includes(`${kind}:${column}`);
};

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  resultIs,
  alignedByPoint,
  noErrors,
  hasMisconception,
  complete,
  partialsAre,
  signalIs,
  estimateIs,
  flaggedCell,
  linkMarked,
};
