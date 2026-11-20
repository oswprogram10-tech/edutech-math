/**
 * E20 Observation(순수 함수). 비의 값은 core Rational로 계산해 기약분수 문자열로 내보낸다.
 * 정답(목표 값)은 엔진이 모른다. 학생이 만든 값과 설정으로 준 기준·비교 컵만 읽는다.
 */
import type { JsonValue, Observation } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
import { MC_RATIO_ADDITIVE } from './strings.ko';
import type { Amounts, MixState, RatioConfig, RatioState, ResizeState, Size } from './types';

/** 시럽 ÷ 우유. 우유가 0이면 null. */
export function ratioValue(amounts: Amounts): Rational | null {
  return amounts.milk === 0 ? null : Rational.of(amounts.syrup, amounts.milk);
}

/** 진하기 띠 위치 = 시럽 ÷ (우유 + 시럽), 0~1. 빈 컵이면 null. */
export function stripPosition(amounts: Amounts): Rational | null {
  const total = amounts.milk + amounts.syrup;
  return total === 0 ? null : Rational.of(amounts.syrup, total);
}

/** 띠 범위 기본값: 기준·고정 컵의 가장 진한 값 × 1.5를 0.1 단위로 올림, 0.2~1. 컵이 없으면 0.5. */
export function defaultStripMax(cups: readonly Amounts[]): number {
  let best: Rational | null = null;
  for (const cup of cups) {
    const pos = stripPosition(cup);
    if (pos !== null && (best === null || pos.compareTo(best) > 0)) best = pos;
  }
  if (best === null) return 0.5;
  const tenths = Number((best.n * 15n + best.d - 1n) / best.d);
  return Math.min(10, Math.max(2, tenths)) / 10;
}

function text(value: Rational | null): string | null {
  return value === null ? null : value.toString();
}

function sameValue(a: Rational | null, b: Rational | null): boolean {
  return a !== null && b !== null && a.equals(b);
}

/** 학생 컵이 기준 컵에 d씩 더한 것이고 비가 달라졌는가. */
export function isAdditiveMix(reference: Amounts | null, cup: Amounts): boolean {
  if (reference === null) return false;
  const d = cup.milk - reference.milk;
  if (d < 1 || cup.syrup - reference.syrup !== d) return false;
  return !sameValue(ratioValue(cup), ratioValue(reference));
}

/** 같은 d를 가로·세로에 더했는데 모양이 달라졌는가. */
export function isAdditiveSize(base: Size, size: Size): boolean {
  const d = size.w - base.w;
  if (d < 1 || size.h - base.h !== d) return false;
  return !sameShape(base, size);
}

export function sameShape(a: Size, b: Size): boolean {
  return Rational.of(a.w, a.h).equals(Rational.of(b.w, b.h));
}

export interface MixReading {
  readonly cup: { milk: number; syrup: number; value: string | null };
  readonly referenceValue: string | null;
  readonly sameAsReference: boolean;
  readonly darkestFixedId: string | null;
}

export function readMix(state: MixState): MixReading {
  const cupValue = ratioValue(state.cup);
  const referenceValue = state.reference === null ? null : ratioValue(state.reference);
  let darkestFixedId: string | null = null;
  if (state.fixedCups.length >= 2) {
    let best: { id: string; pos: Rational } | null = null;
    let tie = false;
    for (const cup of state.fixedCups) {
      const pos = stripPosition(cup);
      if (pos === null) continue;
      if (best === null || pos.compareTo(best.pos) > 0) {
        best = { id: cup.id, pos };
        tie = false;
      } else if (pos.compareTo(best.pos) === 0) {
        tie = true;
      }
    }
    darkestFixedId = best !== null && !tie ? best.id : null;
  }
  return {
    cup: { milk: state.cup.milk, syrup: state.cup.syrup, value: text(cupValue) },
    referenceValue: text(referenceValue),
    sameAsReference: sameValue(cupValue, referenceValue),
    darkestFixedId,
  };
}

function observeMix(state: MixState): Observation {
  const reading = readMix(state);
  const misconceptions: string[] = isAdditiveMix(state.reference, state.cup)
    ? [MC_RATIO_ADDITIVE]
    : [];
  return {
    mode: 'mix',
    cup: reading.cup,
    referenceValue: reading.referenceValue,
    sameAsReference: reading.sameAsReference,
    fixed: state.fixedCups.map((c) => ({
      id: c.id,
      milk: c.milk,
      syrup: c.syrup,
      value: text(ratioValue(c)),
    })),
    darkestFixedId: reading.darkestFixedId,
    addOps: state.addOps,
    scaleOps: state.scaleOps,
    misconceptions,
  };
}

export function readResize(state: ResizeState) {
  const saved = state.saved.map((s) => ({
    w: s.w,
    h: s.h,
    equivalent: sameShape(s, state.base),
  }));
  const savedEquivalentCount = saved.filter(
    (s) => s.equivalent && !(s.w === state.base.w && s.h === state.base.h),
  ).length;
  return {
    saved,
    savedEquivalentCount,
    distorted: !sameShape(state.size, state.base),
  };
}

function observeResize(state: ResizeState): Observation {
  const reading = readResize(state);
  const misconceptions: string[] = state.saved.some((s) => isAdditiveSize(state.base, s))
    ? [MC_RATIO_ADDITIVE]
    : [];
  return {
    mode: 'resize',
    size: { w: state.size.w, h: state.size.h },
    base: { w: state.base.w, h: state.base.h },
    sizeValue: Rational.of(state.size.w, state.size.h).toString(),
    baseValue: Rational.of(state.base.w, state.base.h).toString(),
    distorted: reading.distorted,
    saved: reading.saved as unknown as JsonValue,
    savedEquivalentCount: reading.savedEquivalentCount,
    addOps: state.addOps,
    scaleOps: state.scaleOps,
    misconceptions,
  };
}

export function observe(state: RatioState, config: RatioConfig): Observation {
  void config;
  return state.mode === 'mix' ? observeMix(state) : observeResize(state);
}
