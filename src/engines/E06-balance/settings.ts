/**
 * E06 설정 정규화. 설정이 어긋나면 throw하지 않고 `error`를 켠다(화면이 오류 문구를 보인다).
 * 수는 0 이상의 정수(문자열 또는 안전한 정수 number)만 받는다. 소수·분수·음수 `num`은 오류다.
 */
import { Rational } from '../../core/math';
import type { BalanceConfig, BalanceLook, BalanceSettings, BalanceSide } from './types';

export interface ParsedSide {
  readonly side: BalanceSide;
  /** 이 접시에 쓰인 수의 절댓값 목록. */
  readonly numbers: readonly Rational[];
}

function warn(message: string): void {
  if (import.meta.env?.DEV) console.warn(`[E06] ${message}`);
}

/** 0 이상의 정수 표기(문자열 `^\d+$` 또는 안전한 정수 number)만 Rational로 바꾼다. */
export function nonNegativeInteger(value: unknown): Rational | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? Rational.of(value) : null;
  }
  if (typeof value === 'string' && /^\d{1,15}$/.test(value)) return Rational.parse(value);
  return null;
}

export function parseSide(terms: unknown): ParsedSide | null {
  if (!Array.isArray(terms)) return null;
  let total = Rational.of(0);
  let boxes = 0;
  const numbers: Rational[] = [];
  for (const term of terms as unknown[]) {
    if (term === null || typeof term !== 'object') return null;
    const record = term as { box?: unknown; num?: unknown; neg?: unknown };
    if (record.box === true) {
      boxes += 1;
      continue;
    }
    const value = nonNegativeInteger(record.num);
    if (value === null) return null;
    numbers.push(value);
    total = record.neg === true ? total.sub(value) : total.add(value);
  }
  if (boxes > 1) return null;
  return { side: { const: total.toString(), hasBox: boxes === 1 }, numbers };
}

export interface NormalizedConfig {
  readonly error: string | null;
  readonly settings: BalanceSettings;
  readonly left: BalanceSide;
  readonly right: BalanceSide;
  readonly initialSum: string | null;
}

const EMPTY_SIDE: BalanceSide = { const: '0', hasBox: false };

function lookOf(value: unknown): BalanceLook {
  return value === 'bars' || value === 'symbols' ? value : 'scale';
}

export function settingsOf(config: BalanceConfig | undefined): BalanceSettings {
  return {
    allowTryValue: config?.allowTryValue !== false,
    allowBothSides: config?.allowBothSides !== false,
    allowOneSide: config?.allowOneSide === true,
    predict: config?.predict === true,
    look: lookOf(config?.look),
    showTotals: config?.showTotals !== false,
  };
}

export function normalizeConfig(config: BalanceConfig | undefined): NormalizedConfig {
  const settings = settingsOf(config);
  const fail = (code: string, message: string): NormalizedConfig => {
    warn(message);
    return { error: code, settings, left: EMPTY_SIDE, right: EMPTY_SIDE, initialSum: null };
  };
  // 샌드박스 기본: 25 + □ = 43. 한쪽만 쓰면 오류다.
  const useDefault = config?.left === undefined && config?.right === undefined;
  const left = parseSide(useDefault ? [{ num: 25 }, { box: true }] : config?.left);
  const right = parseSide(useDefault ? [{ num: 43 }] : config?.right);
  if (left === null || right === null) {
    return fail(
      'terms',
      '항은 0 이상의 정수 `num`이거나 `{box:true}`여야 합니다(□는 전체에 0~1개).',
    );
  }
  if (left.side.hasBox && right.side.hasBox) {
    return fail('boxes', '□는 전체에 0개 또는 1개여야 합니다.');
  }
  const numbers = [...left.numbers, ...right.numbers];
  const initialSum =
    numbers.length >= 2 ? numbers.reduce((a, b) => a.add(b), Rational.of(0)).toString() : null;
  return { error: null, settings, left: left.side, right: right.side, initialSum };
}
