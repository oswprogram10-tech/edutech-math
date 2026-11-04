/**
 * 오개념 감지 함수가 함께 쓰는 입력 타입과 도우미(순수 함수).
 *
 * W1(`diagnose.ts`)과 W2(`diagnose-w2.ts`)가 이 파일에서만 가져다 쓴다.
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
