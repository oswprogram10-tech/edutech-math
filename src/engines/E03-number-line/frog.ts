/**
 * T080 integer 개구리 점프 도우미.
 *
 * 개구리 위치는 `start + jumps 합`으로만 계산한다. 상태에 도착 값을 따로 저장하지 않는다.
 * 수 값은 모두 `Rational`로 계산하고 상태·Observation에는 `toJSON()` 문자열로 둔다.
 */
import { Rational } from '../../core/math/rational';
import { configRational, clampRational } from './state-helpers';
import { parseValue } from './ticks';
import type { NumberLineConfig, NumberLineFrogState, NumberLineMode } from './types';

/** 설정의 점프 크기 목록을 정규 문자열로 바꾼다. 정수가 아니거나 0인 값은 버린다. */
export function normalizeJumpButtons(values: readonly (number | string)[] | undefined): string[] {
  const sizes: string[] = [];
  for (const raw of values ?? []) {
    const parsed = configRational(raw);
    if (!parsed || !parsed.isInteger() || parsed.isZero()) continue;
    const text = parsed.toJSON();
    if (!sizes.includes(text)) sizes.push(text);
  }
  return sizes;
}

/** integer 모드에서 `jumpButtons`가 있을 때만 개구리 상태를 만든다. */
export function createFrogState(
  config: NumberLineConfig,
  mode: NumberLineMode,
  min: Rational,
  max: Rational,
): NumberLineFrogState | null {
  if (mode !== 'integer' || config.jumpButtons === undefined) return null;
  const start = clampRational(configRational(config.jumpStart) ?? min, min, max);
  return {
    start: start.toJSON(),
    jumps: [],
    sizes: normalizeJumpButtons(config.jumpButtons),
  };
}

/** 개구리가 지금 있는 값. */
export function frogAt(frog: NumberLineFrogState): Rational {
  let value = parseValue(frog.start) ?? Rational.of(0);
  for (const jump of frog.jumps) {
    const size = parseValue(jump);
    if (size) value = value.add(size);
  }
  return value;
}

/** 누른 점프 크기의 합(도착 값이 아니라 크기 합). */
export function frogJumpTotal(frog: NumberLineFrogState): Rational {
  let total = Rational.of(0);
  for (const jump of frog.jumps) {
    const size = parseValue(jump);
    if (size) total = total.add(size);
  }
  return total;
}

export interface FrogStep {
  readonly from: string;
  readonly to: string;
  readonly size: string;
}

/** 점프를 차례로 풀어 from·to·size로 만든다. 화면·오버레이·이벤트가 함께 쓴다. */
export function frogSteps(frog: NumberLineFrogState): FrogStep[] {
  const steps: FrogStep[] = [];
  let from = parseValue(frog.start) ?? Rational.of(0);
  for (const jump of frog.jumps) {
    const size = parseValue(jump);
    if (!size) continue;
    const to = from.add(size);
    steps.push({ from: from.toJSON(), to: to.toJSON(), size: size.toJSON() });
    from = to;
  }
  return steps;
}
