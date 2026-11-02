/**
 * E08 단계 풀이의 설정·상태·Action 타입.
 *
 * 줄은 토큰 배열로 둔다(JSON). 수 값 계산은 `src/core/math`의 `parse`·`evaluate`·
 * `Rational`로만 하고, 상태에는 문자열만 넣는다. 화면 좌표·터치 크기만 number다.
 */

export type StepMode = 'lines' | 'fraction-steps' | 'debug';

/** 자연수·소수·분수 틀·대분수 틀. 모든 숫자는 문자열 한 글자 이상이다. */
export type NumberToken =
  | { readonly kind: 'integer'; readonly value: string }
  | { readonly kind: 'decimal'; readonly value: string }
  | { readonly kind: 'fraction'; readonly num: string; readonly den: string }
  | {
      readonly kind: 'mixed';
      readonly whole: string;
      readonly num: string;
      readonly den: string;
    };

export type OperatorKind = 'add' | 'sub' | 'mul' | 'div';

export type Token =
  | NumberToken
  | { readonly kind: 'op'; readonly op: OperatorKind }
  | { readonly kind: 'lparen' }
  | { readonly kind: 'rparen' }
  | { readonly kind: 'box' };

/** 토큰 안에서 지금 고른 칸. */
export type TokenField = 'value' | 'whole' | 'num' | 'den';

export interface TokenCursor {
  readonly lineId: string;
  /** 토큰 위치. `tokens.length`면 줄 끝을 뜻한다. */
  readonly token: number;
  readonly field: TokenField;
}

export interface StepLine {
  readonly id: string;
  readonly tokens: readonly Token[];
  readonly label: string | null;
  /** 처음 줄은 고정이라 고치거나 지울 수 없다. */
  readonly fixed: boolean;
}

export interface DebugSampleConfig {
  readonly lines: readonly string[];
}

export interface StepSolverConfig {
  readonly mode?: StepMode;
  /** 첫 줄. `problem`과 같은 뜻이다. */
  readonly start?: string;
  readonly problem?: string;
  /** 보이는 키패드 키 이름. 예: `["digits", "fraction", "+", "-"]` */
  readonly keypad?: readonly string[];
  readonly checkEachLine?: boolean;
  readonly stepLabels?: readonly string[];
  readonly allowFreeOrder?: boolean;
  readonly diagnose?: boolean;
  readonly debugSamples?: readonly DebugSampleConfig[];
  /** debug에서 보여 줄 풀이 번호(0부터). */
  readonly sample?: number;
}

export interface StepSolverState {
  readonly mode: StepMode;
  /** lines·fraction-steps의 학생 줄. debug에서는 고친 줄 하나만 둔다. */
  readonly lines: readonly StepLine[];
  /** debug에서 읽기 전용으로 보여 주는 친구 풀이. 다른 모드에서는 빈 배열. */
  readonly samples: readonly StepLine[];
  readonly cursor: TokenCursor | null;
  readonly nextLineId: number;
  /** debug에서 학생이 고른 친구 풀이 줄(0부터). */
  readonly selectedLine: number | null;
  readonly checkEachLine: boolean;
  readonly diagnose: boolean;
  readonly stepLabels: readonly string[];
  readonly allowFreeOrder: boolean;
}

export type StepSolverAction =
  | {
      readonly type: 'select-token';
      readonly lineId: string;
      readonly token: number;
      readonly field: TokenField;
    }
  | { readonly type: 'enter-digit'; readonly digit: string }
  | { readonly type: 'decimal-point' }
  | { readonly type: 'insert-token'; readonly token: Token }
  | { readonly type: 'backspace' }
  | { readonly type: 'move-field'; readonly delta: 1 | -1 }
  | { readonly type: 'move-token'; readonly delta: 1 | -1 }
  | { readonly type: 'add-line' }
  | { readonly type: 'remove-line'; readonly lineId: string }
  | { readonly type: 'select-line'; readonly line: number }
  | {
      readonly type: 'set-label';
      readonly lineId: string;
      readonly label: string | null;
    };

/** students see this order in the sandbox mode picker. */
export const STEP_MODES: readonly StepMode[] = ['lines', 'fraction-steps', 'debug'];
