/**
 * E03 log-zoom 모드의 단계·라벨 계산.
 *
 * `levels`는 단계별 최댓값이고 화면 범위는 언제나 `[0, levels[level]]`이다.
 * 눈금은 단계 최댓값의 1/100(작은 눈금), 1/10(큰 눈금)이다(카드 5번).
 */
import { Rational } from '../../core/math/rational';
import { formatNumber } from './rounding';
import { parseValue } from './ticks';
import type { LogZoomLabelStyle } from './types';

export const DEFAULT_LEVELS: readonly string[] = ['10', '100', '1000', '10000'];

/** 지수 표기("1e4")는 parse가 실패하므로 기본값으로 떨어진다. */
export function normalizeLevels(values: readonly (number | string)[] | undefined): Rational[] {
  const levels: Rational[] = [];
  for (const value of values ?? []) {
    const parsed = typeof value === 'number' ? parseValue(String(value)) : parseValue(value);
    if (!parsed || !parsed.isInteger() || parsed.isNegative() || parsed.isZero()) continue;
    if (parsed.n.toString().length > 16) continue;
    if (!levels.some((level) => level.equals(parsed))) levels.push(parsed);
    if (levels.length >= 12) break;
  }
  if (levels.length === 0) return DEFAULT_LEVELS.map((level) => Rational.parse(level));
  return levels;
}

/** 단계 최댓값/100(작은 눈금) 또는 /10(큰 눈금). */
export function levelTick(max: Rational, snap: 'minor' | 'major' | undefined): Rational {
  return snap === 'major' ? max.div(Rational.of(10)) : max.div(Rational.of(100));
}

/** 큰 눈금 간격 = 단계 최댓값 / 10. */
export function bigTickOf(max: Rational): Rational {
  return max.div(Rational.of(10));
}

/** 만·억·조 단위 이름. 30000 → "3만", 200000000 → "2억", 23400000 → "2340만". */
export function koreanLabel(value: Rational): string {
  if (!value.isInteger() || value.isNegative()) return formatNumber(value);
  const units: readonly { readonly size: bigint; readonly name: string }[] = [
    { size: 1_000_000_000_000n, name: '조' },
    { size: 100_000_000n, name: '억' },
    { size: 10_000n, name: '만' },
  ];
  let rest = value.n;
  if (rest === 0n) return '0';
  const parts: string[] = [];
  for (const unit of units) {
    if (rest < unit.size) continue;
    const count = rest / unit.size;
    rest %= unit.size;
    parts.push(`${count.toString()}${unit.name}`);
    if (rest === 0n) break;
  }
  if (rest > 0n) parts.push(rest.toString());
  return parts.join(' ');
}

export function logTickLabel(value: Rational, style: LogZoomLabelStyle | undefined): string {
  return style === 'korean' ? koreanLabel(value) : formatNumber(value);
}
