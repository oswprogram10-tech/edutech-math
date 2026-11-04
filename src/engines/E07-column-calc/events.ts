/**
 * E07의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * `value-changed` payload는 E05·E03과 같은 모양 `{ value: "<Rational>" }`이다.
 * T046은 `estimate-locked`·`signal-changed`를 더하고 `cell-entered`에 줄 index를 붙였다.
 */
import { Rational } from '../../core/math';
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { estimateSignal } from './estimate';
import { computeDivPlan, divAlarm, divComplete, estimateOver } from './grid-div';
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
  if (state.op === 'div') {
    const plan = computeDivPlan(state);
    if (!divComplete(state, plan) || plan.reading.quotientText === null) return [];
    return [{ name: 'value-changed', payload: { value: plan.reading.quotientText } }];
  }
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

    case 'try-estimate': {
      const plan = computeDivPlan(next);
      events.push({
        name: 'estimate-tried',
        payload: {
          column: action.column,
          k: action.k,
          over: estimateOver(next, plan.reading, action.column, action.k),
        },
      });
      break;
    }

    case 'rewind': {
      if (next.rewound && !prev.rewound) {
        events.push({ name: 'rewind-requested', payload: {} });
      }
      break;
    }

    default:
      break;
  }

  if (prev.op === 'div' && next.op === 'div') {
    const before = divAlarm(prev, computeDivPlan(prev), prev.alarmEnabled);
    const after = divAlarm(next, computeDivPlan(next), next.alarmEnabled);
    if (before !== after) {
      events.push({ name: 'alarm-changed', payload: { on: after } });
    }
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

/** args `{ value }`: 학생이 쓴 몫(정수). */
export const quotientIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = recordOf(args);
  if (!record) return false;
  const expected = record['value'];
  const actual = observation['quotient'];
  if (typeof actual !== 'string' || !/^\d+$/.test(actual)) return false;
  if (typeof expected === 'number') {
    return Number.isInteger(expected) && BigInt(actual) === BigInt(expected);
  }
  if (typeof expected === 'string' && /^\d+$/.test(expected.trim())) {
    return BigInt(actual) === BigInt(expected.trim());
  }
  return false;
};

/** args `{ value }`: 마지막 단계 뺄셈 줄 값(나머지). */
export const remainderIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = recordOf(args);
  if (!record) return false;
  const expected = record['value'];
  const actual = observation['remainder'];
  if (typeof actual !== 'string' || !/^\d+$/.test(actual)) return false;
  if (typeof expected === 'number') {
    return Number.isInteger(expected) && BigInt(actual) === BigInt(expected);
  }
  if (typeof expected === 'string' && /^\d+$/.test(expected.trim())) {
    return BigInt(actual) === BigInt(expected.trim());
  }
  return false;
};

/** args `{ value: boolean }`: 나머지 경고등. */
export const alarmIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = recordOf(args);
  return (
    record !== null &&
    typeof record['value'] === 'boolean' &&
    observation['alarm'] === record['value']
  );
};

/** 같은 열에서 선을 넘는 후보를 고른 뒤 더 작은 후보를 골랐는가. */
export const estimateRevised: EnginePredicate = (observation: Observation): boolean =>
  observation['estimateRevised'] === true;

/** args `{ column, digit }`: 몫 칸 하나의 숫자. */
export const quotientCellIs: EnginePredicate = (
  observation: Observation,
  args: JsonValue | undefined,
): boolean => {
  const record = recordOf(args);
  if (!record) return false;
  const column = numberOf(record['column']);
  const digit = stringOf(record['digit']);
  const dividend = observation['dividend'];
  const raw = observation['quotientRaw'];
  if (
    column === null ||
    digit === null ||
    typeof dividend !== 'string' ||
    typeof raw !== 'string'
  ) {
    return false;
  }
  const index = dividend.length - 1 - column;
  if (index < 0 || index >= raw.length) return false;
  return raw.charAt(index) === digit;
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
  quotientIs,
  remainderIs,
  alarmIs,
  estimateRevised,
  quotientCellIs,
};
