/**
 * E01의 관찰 결과.
 *
 * 판정·힌트는 이 값만 본다. 화면 좌표나 블록 목록은 내보내지 않는다.
 * whole은 정수 number, decimal은 소수 문자열(Rational.toDecimalString)로 쓴다.
 */
import { Rational } from '../../core/math';
import type { Observation } from '../../core/engine-sdk';
import type { BaseTenConfig, BaseTenState, BigNumberState } from './types';
import {
  chartValueOf,
  countsOf,
  countsOfBlocks,
  isCanonicalCounts,
  isCanonicalDecimalCounts,
  isDecimal,
  jsonValueOf,
  rationalOfShape,
  takenValueOf,
} from './value';
import type { PlaceCounts } from './value';

function countsJson(counts: PlaceCounts, decimal: boolean): Readonly<Record<string, number>> {
  if (decimal) {
    return {
      ones: counts.hundreds,
      tenths: counts.tens,
      hundredths: counts.ones,
    };
  }
  return {
    thousands: counts.thousands,
    hundreds: counts.hundreds,
    tens: counts.tens,
    ones: counts.ones,
  };
}

function expectedCuts(length: number): number[] {
  const cuts: number[] = [];
  for (let position = 4; position < length; position += 4) cuts.push(position);
  return cuts;
}

function cutsCorrectOf(value: string, cuts: readonly number[]): boolean {
  const expected = expectedCuts(value.length);
  return cuts.length === expected.length && expected.every((cut) => cuts.includes(cut));
}

function builtOf(big: BigNumberState): { readonly value: string | null; readonly gap: boolean } {
  const first = big.built.findIndex((digit) => digit !== null);
  if (first < 0) return { value: null, gap: true };
  const tail = big.built.slice(first);
  if (tail.some((digit) => digit === null)) return { value: null, gap: true };
  return { value: tail.join(''), gap: false };
}

function bigObservation(state: BaseTenState, big: BigNumberState): Observation {
  const built = builtOf(big);
  return {
    mode: state.mode,
    digits: big.value,
    cuts: [...big.cuts],
    cutsCorrect: cutsCorrectOf(big.value, big.cuts),
    expanded: big.expanded,
    selectedPlace: big.selected,
    built: built.value,
    builtHasGap: built.gap,
  };
}

function divideObservation(state: BaseTenState): Observation {
  const plates = state.divide?.plates ?? 1;
  const decimal = isDecimal(state.settings);
  const plateValues: (number | string)[] = [];
  const plateCounts: Readonly<Record<string, number>>[] = [];
  const plateRationals: Rational[] = [];
  for (let plate = 0; plate < plates; plate += 1) {
    const blocks = state.blocks.filter((block) => block.plate === plate);
    const counts = countsOfBlocks(blocks);
    let total = Rational.of(0);
    for (const block of blocks) {
      total = total.add(rationalOfShape(block.value, state.settings.interpretation));
    }
    plateRationals.push(total);
    plateValues.push(decimal ? total.toDecimalString() : Number(total.n));
    plateCounts.push(countsJson(counts, decimal));
  }
  const first = plateRationals[0] ?? Rational.of(0);
  const equal = plateRationals.every((value) => value.compareTo(first) === 0);
  const pile = state.blocks.filter((block) => block.plate === undefined);
  const pileCounts = countsOfBlocks(pile);
  let pileTotal = Rational.of(0);
  for (const block of pile) {
    pileTotal = pileTotal.add(rationalOfShape(block.value, state.settings.interpretation));
  }

  return {
    mode: state.mode,
    value: jsonValueOf(state),
    plateValues,
    plateCounts,
    equal,
    pileValue: decimal ? pileTotal.toDecimalString() : Number(pileTotal.n),
    pileCounts: countsJson(pileCounts, decimal),
    breaks: state.log.filter((entry) => entry.kind === 'break').length,
    log: state.log.map((entry) => ({
      kind: entry.kind,
      ...(entry.from === undefined ? {} : { from: entry.from }),
    })),
    rewound: state.divide?.rewound ?? false,
  };
}

export function observe(state: BaseTenState, config: BaseTenConfig): Observation {
  if (state.mode === 'big-number' && state.bigNumber) {
    return bigObservation(state, state.bigNumber);
  }
  if (state.mode === 'divide') {
    return divideObservation(state);
  }

  const decimal = isDecimal(state.settings);
  const counts = countsOf(state);
  const log = state.log.map((entry) => ({
    kind: entry.kind,
    ...(entry.from === undefined ? {} : { from: entry.from }),
  }));

  return {
    mode: state.mode,
    value: jsonValueOf(state),
    counts: countsJson(counts, decimal),
    canonical: decimal ? isCanonicalDecimalCounts(counts) : isCanonicalCounts(counts),
    groups: state.log.filter((entry) => entry.kind === 'group').length,
    breaks: state.log.filter((entry) => entry.kind === 'break').length,
    log,
    lastAttempt: state.lastAttempt
      ? {
          count: state.lastAttempt.count,
          value: state.lastAttempt.value,
          ok: state.lastAttempt.ok,
        }
      : null,
    chartDigits: state.settings.chartFill === 'auto' ? null : state.chart ? [...state.chart] : null,
    chartValue: chartValueOf(state),
    taken: takenValueOf(state),
    reachedHundred: config.allowHundredReveal === true ? state.reachedHundred : null,
  };
}
