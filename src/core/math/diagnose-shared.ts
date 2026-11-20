/**
 * 오개념 감지 함수가 함께 쓰는 입력 타입과 도우미(순수 함수).
 *
 * W1(`diagnose.ts`)과 W2·W3·W5(`diagnose-w*.ts`)가 이 파일에서만 가져다 쓴다.
 * 두 파일이 서로를 import하지 않게 하려고 따로 두었다.
 * `diagnose.ts`는 기존 import 경로를 위해 이 이름들을 다시 export한다.
 */
import { Rational } from './rational';

export interface DiagnoseInput {
  /** `path`로 찾은 관찰 값. 수·부등호 기호는 문자열이다. 없으면 null. */
  readonly value: string | null;
  /** 수 입력 필드의 학생 표기(`4/12`, `1 2/9`, `0.40`). 없으면 null. */
  readonly raw: string | null;
  /** 콘텐츠의 `diagnose[].args`. */
  readonly args: unknown;
}

export type DiagnoseDetector = (input: DiagnoseInput) => boolean;

export function recordOf(args: unknown): Readonly<Record<string, unknown>> | null {
  return typeof args === 'object' && args !== null && !Array.isArray(args)
    ? (args as Readonly<Record<string, unknown>>)
    : null;
}

export function textOf(args: unknown, key: string): string | null {
  const record = recordOf(args);
  const value = record?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function rationalOf(args: unknown, key: string): Rational | null {
  const text = textOf(args, key);
  if (text === null) return null;
  try {
    return Rational.parse(text);
  } catch {
    return null;
  }
}

export function integerOf(args: unknown, key: string): bigint | null {
  const text = textOf(args, key);
  if (text === null || !/^-?\d+$/.test(text)) return null;
  return BigInt(text);
}

export function studentValue(input: DiagnoseInput): Rational | null {
  if (input.value === null) return null;
  try {
    return Rational.parse(input.value);
  } catch {
    return null;
  }
}

/** `args.trap`(문자열 또는 문자열 배열)을 읽는다. 비었거나 형식이 다르면 null. */
export function trapsOf(input: DiagnoseInput): string[] | null {
  const record = recordOf(input.args);
  if (record === null) return null;
  const value = record.trap;
  if (typeof value === 'string' && value.length > 0) return [value];
  if (!Array.isArray(value) || value.length === 0) return null;
  const traps: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0) return null;
    traps.push(item);
  }
  return traps;
}

/**
 * 고르기 응답 감지. `args.trap`은 오개념 선택지 id(문자열 또는 문자열 배열)다.
 * `args.expected`가 있으면 그 선택지는 정답이므로 감지하지 않는다.
 */
export const trapChoice: DiagnoseDetector = (input) => {
  if (input.value === null) return false;
  const traps = trapsOf(input);
  if (traps === null) return false;
  const expected = recordOf(input.args)?.expected;
  if (typeof expected === 'string' && input.value === expected) return false;
  return traps.includes(input.value);
};

/**
 * 수 함정: 오답 값을 콘텐츠 작성자가 계산해 args `trap`(문자열 또는 배열)으로
 * 넘긴다. v가 trap 중 하나와 같고 expected와 다르면 감지한다.
 */
export const trapValue: DiagnoseDetector = (input) => {
  const traps = trapsOf(input);
  const student = studentValue(input);
  if (traps === null || student === null) return false;
  const expected = rationalOf(input.args, 'expected');
  if (expected !== null && student.equals(expected)) return false;
  for (const trap of traps) {
    let parsed: Rational;
    try {
      parsed = Rational.parse(trap);
    } catch {
      return false;
    }
    if (student.equals(parsed)) return true;
  }
  return false;
};
