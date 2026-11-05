/**
 * E07 소수 나눗셈의 격자 수 만들기(순수 함수).
 *
 * 격자의 나누어지는 수 `G = dividend × 10^scaleA`, 나누는 수
 * `g = divisor × 10^scaleB`를 **문자열 자리 옮기기**로 만든다. 값 계산은
 * `BigInt`·`Rational`로만 하고, 화면·상태에는 문자열 자리만 둔다.
 * 정답 몫·점 위치는 여기서 화면으로 내보내지 않는다.
 */
import { Rational } from '../../core/math';
import { parseNumber } from './grid';
import type { ParsedNumber } from './grid';
import type { ColumnCalcState } from './types';

const ZERO = 0n;
const TEN = 10n;

export interface ScaledNumber {
  /** 소수점을 뺀 숫자. 앞자리 0은 정수 자리를 하나 남기고 줄인다. */
  readonly digits: string;
  readonly intDigits: number;
  readonly fracDigits: number;
  /** 화면에 보일 소수 표기. 예: "2.4", "0.04", "168". */
  readonly text: string;
  readonly value: Rational;
}

export interface DivGridNumbers {
  readonly decimal: boolean;
  readonly a: ParsedNumber;
  readonly b: ParsedNumber;
  readonly scaleA: number;
  readonly scaleB: number;
  /** 격자 나누어지는 수. */
  readonly G: ScaledNumber;
  /** 격자 나누는 수. */
  readonly g: ScaledNumber;
  /** g가 자연수라서 격자를 열 수 있는가. */
  readonly gridOpen: boolean;
  /** G의 맨 윗열. */
  readonly top: number;
  /** 피제수의 소수 자리만 반영한 가장 낮은 열(붙인 0 제외). */
  readonly baseLow: number;
  /** 붙인 0의 개수. */
  readonly appended: number;
  /** 가장 낮은 열(붙인 0 포함). */
  readonly low: number;
  /** G × 10^(−low). 정수 계산용. */
  readonly I: bigint;
  /** I를 자리 그대로 쓴 문자열(앞자리 0 포함). */
  readonly IText: string;
}

function pow10(exponent: number): bigint {
  return TEN ** BigInt(exponent);
}

/** 소수점을 뺀 숫자열을 오른쪽으로 `shift`칸 옮긴 수. */
export function shiftScaled(parsed: ParsedNumber, shift: number): ScaledNumber {
  let digits = parsed.digits;
  let fracDigits = parsed.fracDigits - shift;
  if (fracDigits < 0) {
    digits += '0'.repeat(-fracDigits);
    fracDigits = 0;
  }
  // 정수 자리는 최소 한 칸 남긴다(0.04의 일의 자리 0).
  while (digits.length - fracDigits > 1 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  const intDigits = digits.length - fracDigits;
  const text =
    fracDigits === 0 ? digits : `${digits.slice(0, intDigits)}.${digits.slice(intDigits)}`;
  return {
    digits,
    intDigits,
    fracDigits,
    text,
    value:
      fracDigits === 0
        ? Rational.of(BigInt(digits))
        : Rational.of(BigInt(digits), pow10(fracDigits)),
  };
}

function integerScaled(parsed: ParsedNumber): ScaledNumber {
  return shiftScaled(parsed, parsed.fracDigits);
}

function appendedColumns(state: ColumnCalcState, baseLow: number): number[] {
  return state.aPads.filter((column) => column < baseLow);
}

/** 현재 상태의 격자 수·열 범위. decimal이 아니면 low = 0이다. */
const FALLBACK_A: ParsedNumber = { text: '6.24', digits: '624', intDigits: 1, fracDigits: 2 };
const FALLBACK_B: ParsedNumber = { text: '3', digits: '3', intDigits: 1, fracDigits: 0 };

export function divGridNumbers(state: ColumnCalcState): DivGridNumbers {
  const a = parseNumber(state.aText) ?? FALLBACK_A;
  const b = parseNumber(state.bText) ?? FALLBACK_B;
  if (!state.decimal) {
    const G = integerScaled(a);
    const g = integerScaled(b);
    const top = G.intDigits - 1;
    return {
      decimal: false,
      a,
      b,
      scaleA: 0,
      scaleB: 0,
      G,
      g,
      gridOpen: true,
      top,
      baseLow: 0,
      appended: 0,
      low: 0,
      I: BigInt(G.digits),
      IText: G.digits,
    };
  }

  const scaleA = state.scaleA;
  const scaleB = state.scaleB;
  const G = shiftScaled(a, scaleA);
  const g = shiftScaled(b, scaleB);
  const gridOpen = b.fracDigits <= scaleB;
  const top = G.intDigits - 1;
  const baseLow = 0 - G.fracDigits;
  const appended = appendedColumns(state, baseLow).length;
  const low = baseLow - appended;
  const IText = `${G.digits}${'0'.repeat(appended)}`;
  return {
    decimal: true,
    a,
    b,
    scaleA,
    scaleB,
    G,
    g,
    gridOpen,
    top,
    baseLow,
    appended,
    low,
    I: BigInt(IText),
    IText,
  };
}

/** 열 범위(낮은 열 → 높은 열). */
export function divColumns(state: ColumnCalcState): number[] {
  const numbers = divGridNumbers(state);
  const columns: number[] = [];
  for (let column = numbers.low; column <= numbers.top; column += 1) columns.push(column);
  return columns;
}

/** 격자에 놓인 수(피제수)의 그 열 숫자. 붙인 0은 "0". */
export function gridDividendDigit(numbers: DivGridNumbers, column: number): string {
  if (column > numbers.top) return '';
  if (column < numbers.baseLow) return '0';
  const index = numbers.G.intDigits - 1 - column;
  if (index < 0 || index >= numbers.G.digits.length) return '0';
  return numbers.G.digits.charAt(index);
}

/**
 * 몫을 처음 쓸 열. `I`의 앞자리부터 훑어 처음으로 g 이상이 되는 자리다.
 * 격자가 닫혀 있거나 어떤 앞자리도 g보다 작으면 null.
 */
export function firstQuotientColumn(state: ColumnCalcState): number | null {
  const numbers = divGridNumbers(state);
  if (!numbers.gridOpen) return null;
  const divisor = BigInt(numbers.g.digits);
  if (divisor <= ZERO) return null;
  let prefix = '';
  for (let index = 0; index < numbers.IText.length; index += 1) {
    prefix += numbers.IText.charAt(index);
    if (BigInt(prefix) >= divisor) return numbers.top - index;
  }
  return null;
}
