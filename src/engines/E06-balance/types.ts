/**
 * E06 양팔저울 `equation` 모드의 설정·상태·Action·Observation 타입.
 * 수는 Rational 문자열로 저장한다(부동소수 금지). 이 카드는 0 이상의 정수만 받는다.
 * 설정에 □의 정답은 없다. 기울기·수평은 학생이 넣은 값과 양쪽 연산으로만 계산한다.
 */

export type BalanceTerm = { num: string | number; neg?: boolean } | { box: true };

export type BalanceLook = 'scale' | 'bars' | 'symbols';

export interface BalanceConfig {
  mode?: 'equation';
  left?: BalanceTerm[];
  right?: BalanceTerm[];
  /** 기본 true: □에 수 넣어 보기 */
  allowTryValue?: boolean;
  /** 기본 true: 양쪽에 같은 수 더하기·빼기 */
  allowBothSides?: boolean;
  /** 기본 false: 한쪽만 더하기·빼기(기울어짐을 보여 주는 실험) */
  allowOneSide?: boolean;
  /** 기본 false: 조작 전에 "수평일까?" 예/아니요 잠금 */
  predict?: boolean;
  /** 기본 'scale' (C 저울 / P 막대 두 줄 / A 식만) */
  look?: BalanceLook;
  /** 기본 true: 접시별 합 */
  showTotals?: boolean;
  /** 명세 호환용. 받기만 하고 무시한다. */
  tiltAnimation?: 'deterministic';
}

export interface BalanceSettings {
  readonly allowTryValue: boolean;
  readonly allowBothSides: boolean;
  readonly allowOneSide: boolean;
  readonly predict: boolean;
  readonly look: BalanceLook;
  readonly showTotals: boolean;
}

/** 한 접시: 항들을 합친 수(빼는 항은 음수로 합친다)와 □ 유무. */
export interface BalanceSide {
  readonly const: string;
  readonly hasBox: boolean;
}

export type BalanceOpKind = 'both-add' | 'both-remove' | 'one-add' | 'one-remove';
export type BalanceSideName = 'left' | 'right';

export interface BalanceOp {
  readonly kind: BalanceOpKind;
  readonly n: string;
  readonly side?: BalanceSideName;
}

export type BalancePrediction = 'yes' | 'no';

export interface BalanceState {
  readonly mode: 'equation';
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  readonly settings: BalanceSettings;
  readonly left: BalanceSide;
  readonly right: BalanceSide;
  /** 처음 상태(되돌리기용). */
  readonly initial: { readonly left: BalanceSide; readonly right: BalanceSide };
  /** 처음 설정에 쓰인 모든 수(빼는 항 포함, 절댓값)의 합. 수가 둘 이상일 때만 의미가 있다. */
  readonly initialSum: string | null;
  readonly tryValue: string | null;
  readonly tries: readonly string[];
  readonly ops: readonly BalanceOp[];
  readonly prediction: BalancePrediction | null;
}

export type BalanceAction =
  | { readonly type: 'try'; readonly value: string }
  | { readonly type: 'both'; readonly op: 'add' | 'remove'; readonly n: string }
  | {
      readonly type: 'one';
      readonly op: 'add' | 'remove';
      readonly side: BalanceSideName;
      readonly n: string;
    }
  | { readonly type: 'predict'; readonly value: BalancePrediction }
  | { readonly type: 'reset' };

export type BalanceTilt = 'left' | 'right' | 'level' | 'unknown';

export const LOGICAL_WIDTH = 1000;
export const LOGICAL_HEIGHT = 600;
/** 더하기·빼기·넣어 보기 수의 범위. */
export const MIN_AMOUNT = 1;
export const MAX_AMOUNT = 999;
export const CANVAS_SELECTOR = 'svg[data-testid="balance-canvas"]';
