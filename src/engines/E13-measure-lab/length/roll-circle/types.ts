/**
 * E13 `length`의 `variant:'roll-circle'`(굴렁쇠 굴리기·지름 막대·기록표) 설정·상태·Action 타입.
 * 지름은 정수 cm 문자열이고 측정 원주·비는 Rational을 소수 글로 쓴 문자열이다(부동소수 없음).
 */

export interface RollConfig {
  mode?: 'length';
  variant: 'roll-circle';
  /** 정수 cm 문자열 1~10, 1~6개, 중복 없음. */
  diameters?: string[];
  unit?: 'cm';
  /** 기록표 "원주 ÷ 지름" 칸의 반올림 자리. 기본 '0.01'. */
  precision?: '0.01' | '0.001';
  /** 기본 true. */
  diameterStickTool?: boolean;
  /** 기본 true. */
  log?: boolean;
}

export interface RollLogRow {
  readonly d: string;
  readonly c: string;
  readonly ratio: string;
}

export interface RollState {
  readonly mode: 'length';
  readonly variant: 'roll-circle';
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  readonly diameters: readonly string[];
  readonly precision: '0.01' | '0.001';
  readonly diameterStickTool: boolean;
  readonly logEnabled: boolean;
  /** 지금 고른 지름(정수 cm 문자열). */
  readonly diameter: string;
  readonly rolled: boolean;
  /** 굴린 뒤의 측정 원주(0.1cm). 굴리기 전에는 null. */
  readonly measuredCm: string | null;
  readonly sticks: number;
  readonly log: readonly RollLogRow[];
  readonly moves: number;
}

export type RollAction =
  | { readonly type: 'choose'; readonly d: string }
  | { readonly type: 'roll' }
  | { readonly type: 'stick'; readonly delta: 1 | -1 }
  | { readonly type: 'record' }
  | { readonly type: 'reset' };

export const ROLL_CANVAS_SELECTOR = 'svg[data-testid="roll-canvas"]';
/** 지름 막대는 최대 4개, 기록표는 최대 6줄. */
export const MAX_STICKS = 4;
export const MAX_LOG = 6;
