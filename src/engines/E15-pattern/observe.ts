/**
 * E15 Observation. 판정 전용 값(`expected`, `entriesCorrect`)은 여기에만 둔다.
 * View는 이 값을 읽지 않는다.
 */
import type { JsonValue, Observation } from '../../core/engine-sdk';
import {
  MC_RECURSIVE_ONLY,
  isPyramid,
  isRecursiveBuild,
  isRecursiveExpression,
  readExpression,
  totalOf,
  trimHeights,
} from './calc';
import { entryValue, rowColCells } from './chart';
import { allBlanksCorrect, blankKeys, growthMisconceptions } from './growth';
import {
  continuation,
  coreOf,
  patternMisconceptions,
  restoredFrom,
  restoredMatches,
  translatePairs,
} from './pattern';
import type { CalcState, ChartState, GrowthState, PatternState, SequenceState } from './types';
import { chartRangeOf } from './types';

function sequenceObservation(state: SequenceState): Observation {
  const { settings, slots } = state;
  const given = settings.given;
  const filled = slots.filter((slot) => slot !== null).length;
  const complete = filled === slots.length;
  const sequence: JsonValue = [...given, ...slots];

  if (settings.variant === 'translate') {
    const result = translatePairs(given, slots);
    const restored = restoredFrom(given, slots);
    return {
      mode: 'sequence',
      variant: 'translate',
      given,
      slots,
      filled,
      complete,
      sequence,
      expected: null,
      continuesGiven: false,
      core: complete ? coreOf(slots as string[]) : null,
      misconceptions: result.conflict ? ['MC-PATTERN-TRANSLATE'] : [],
      pairs: result.pairs.map(([from, to]) => [from, to]),
      consistent: result.consistent,
      sent: state.sent,
      restored,
      restoredMatches: restoredMatches(given, slots),
    };
  }

  const expected = continuation(given, slots.length);
  const same =
    complete &&
    expected !== null &&
    expected.length === slots.length &&
    expected.every((token, index) => token === slots[index]);
  let core: string[] | null = null;
  if (complete) {
    core = coreOf(given.length > 0 ? [...given, ...(slots as string[])] : (slots as string[]));
  }
  return {
    mode: 'sequence',
    variant: 'extend',
    given,
    slots,
    filled,
    complete,
    sequence,
    expected,
    continuesGiven: same,
    core,
    misconceptions: patternMisconceptions(given, slots).sort(),
  };
}

function chartObservation(state: ChartState): Observation {
  const range = chartRangeOf(state.settings);
  const entries: Record<string, JsonValue> = {};
  for (const cell of state.hidden) {
    entries[String(cell)] = entryValue(state.entries[String(cell)]);
  }
  const values = state.hidden.map((cell) => entryValue(state.entries[String(cell)]));
  const rowCol = rowColCells(range, state.hidden, state.entries);
  return {
    mode: 'hundred-chart',
    hidden: state.hidden,
    entries,
    entriesComplete: state.hidden.length > 0 && values.every((value) => value !== null),
    entriesCorrect:
      state.hidden.length > 0 && state.hidden.every((cell, index) => values[index] === cell),
    selected: state.selected,
    painted: state.painted,
    misconceptions: rowCol.length > 0 ? ['MC-CHART-ROW-COL'] : [],
    misconceptionCells: rowCol,
  };
}

function calcObservation(state: CalcState): Observation {
  const { settings } = state;
  const heights = trimHeights(state.heights);
  const reading = readExpression(state.exprText);
  const misconceptions: string[] = [];
  if (settings.error === null) {
    if (
      isRecursiveBuild(state.heights, settings.workStep) ||
      isRecursiveExpression(reading, settings.pattern, settings.workStep)
    ) {
      misconceptions.push(MC_RECURSIVE_ONLY);
    }
  }
  return {
    mode: 'calc-pattern',
    pattern: settings.pattern,
    workStep: settings.workStep,
    heights,
    builtTotal: totalOf(heights),
    builtIsPyramid: isPyramid(state.heights, settings.workStep),
    exprText: state.exprText,
    exprValid: reading.valid,
    exprHolds: reading.holds,
    exprLeft: reading.left,
    exprRight: reading.right,
    exprAddends: reading.addends,
    exprFactors: reading.factors,
    misconceptions,
  };
}

/**
 * growth Observation. 단계별 정답 개수·늘어난 수는 넣지 않는다(판정은 predicate가 growth.ts로 계산).
 * `blanksCorrect`는 맞고 틀림만 알린다.
 */
function growthObservation(state: GrowthState): Observation {
  const { settings } = state;
  const blanks = blankKeys(settings);
  return {
    mode: 'growth',
    shape: settings.shape,
    stepsShown: settings.stepsShown,
    upTo: settings.table === null ? settings.stepsShown : settings.table.upTo,
    entries: { ...state.cells },
    blanks,
    blanksCorrect: allBlanksCorrect(settings.shape, blanks, state.cells),
    misconceptions: growthMisconceptions(settings, state.cells),
  };
}

export function observe(state: PatternState): Observation {
  if (state.mode === 'growth') return growthObservation(state);
  if (state.mode === 'calc-pattern') return calcObservation(state);
  return state.mode === 'sequence' ? sequenceObservation(state) : chartObservation(state);
}
