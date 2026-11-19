/**
 * E08 단계 풀이의 설정·상태·Action 타입.
 *
 * 줄은 토큰 배열로 둔다(JSON). 수 값 계산은 `src/core/math`의 `parse`·`evaluate`·
 * `Rational`로만 하고, 상태에는 문자열만 넣는다. 화면 좌표·터치 크기만 number다.
 */

export type StepMode = 'lines' | 'fraction-steps' | 'debug' | 'order-tree';

/** 줄 편집 기반 세 모드. order-tree는 상태 모양이 달라 따로 둔다. */
export type LinesMode = Exclude<StepMode, 'order-tree'>;

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
  readonly mode?: LinesMode;
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

/** order-tree 설정. 식은 자연수와 + − × ÷, 괄호만 쓴다(□·분수·소수·비는 설정 오류). */
export interface OrderTreeConfig {
  readonly mode: 'order-tree';
  readonly expr?: string;
  /** 트리 그림을 보일지(기본 true). */
  readonly showTree?: boolean;
}

export type AnyStepSolverConfig = StepSolverConfig | OrderTreeConfig;

export interface StepSolverState {
  readonly mode: LinesMode;
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

/** order-tree에서 한 번 계산한 기록. 값은 Rational 문자열이다. */
export interface OrderTreeReduction {
  readonly opIndex: number;
  readonly op: string;
  readonly left: string;
  readonly right: string;
  readonly result: string;
}

export interface OrderTreeWrongTap {
  readonly opIndex: number;
  readonly code: string | null;
}

/**
 * order-tree 상태. 현재 식(AST)은 Rational(BigInt)을 담아 JSON이 되지 않으므로,
 * 처음 식과 계산 기록으로 다시 만든다.
 */
export interface OrderTreeState {
  readonly mode: 'order-tree';
  readonly settings: { readonly expr: string; readonly showTree: boolean };
  readonly reductions: readonly OrderTreeReduction[];
  readonly wrongTaps: readonly OrderTreeWrongTap[];
  readonly shake: { readonly opIndex: number; readonly seq: number } | null;
}

/** 모드와 상관없이 E08이 다루는 모든 상태. */
export type AnyStepSolverState = StepSolverState | OrderTreeState;

export type OrderTreeAction =
  | { readonly type: 'tap'; readonly opIndex: number }
  | { readonly type: 'undo' }
  | { readonly type: 'reset' };

export type LinesAction =
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

export type StepSolverAction = LinesAction | OrderTreeAction;

/** students see this order in the sandbox mode picker. */
export const STEP_MODES: readonly StepMode[] = ['lines', 'fraction-steps', 'debug', 'order-tree'];
