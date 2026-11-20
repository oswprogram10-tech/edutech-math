/**
 * E14 `time-calc`(시·분·초 블록 60묶기·풀기)의 설정·상태·Action 타입.
 * 값은 모두 0 이상의 정수다. 두 단위(`units`)로 나눈 한 줄이고, 큰 단위 블록 하나는 작은 단위 60개다.
 * 시각(하루 분)이 아니라 걸린 시간을 다룬다.
 */

export interface TimeParts {
  readonly h?: number;
  readonly m?: number;
  readonly s?: number;
}

export interface TimeCalcConfig {
  readonly mode?: 'time-calc';
  readonly op?: 'add' | 'sub';
  readonly a?: TimeParts;
  readonly b?: TimeParts;
  /** `['h','m']`(시·분) 또는 `['m','s']`(분·초). */
  readonly units?: readonly string[];
}

export interface BigSmall {
  /** 큰 단위(시 또는 분) 개수. */
  readonly big: number;
  /** 작은 단위(분 또는 초) 개수. */
  readonly small: number;
}

export type UnitPair = 'hm' | 'ms';

export interface TimeCalcState {
  readonly mode: 'time-calc';
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  readonly op: 'add' | 'sub';
  readonly units: UnitPair;
  /** sub에서 뺄 시간. add에서는 더한 두 번째 시간이다. */
  readonly b: BigSmall;
  /** sub에서 "뺄 시간" 표에 쓰는 글. add에서는 빈 글. */
  readonly bText: string;
  /** 처음 상태(reset이 되돌아가는 자리). */
  readonly initial: BigSmall;
  /** 지금 큰 단위·작은 단위 개수. */
  readonly big: number;
  readonly small: number;
  /** 어느 상태에서든 큰 단위 블록이 이 수를 넘지 않는다(판 높이를 한 번에 정하려고 든다). */
  readonly maxBig: number;
  readonly bundles: number;
  readonly unbundles: number;
  readonly tookAway: boolean;
  readonly moves: number;
}

export type TimeCalcAction =
  | { readonly type: 'bundle' }
  | { readonly type: 'unbundle' }
  | { readonly type: 'take-away' }
  | { readonly type: 'reset' };

export const TIMECALC_CANVAS_SELECTOR = 'svg[data-testid="timecalc-canvas"]';
