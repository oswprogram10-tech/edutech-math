/**
 * E19 평균·가능성 실험실 `leveling`·`seesaw`·`outlier` 모드의 설정·상태·Action 타입.
 * 자료 값은 0 이상의 정수 number, 평균·받침점·예측은 core Rational(상태에는 기약분수 문자열)로 다룬다.
 * 설정에 평균(정답)은 없다. 판정은 콘텐츠 goal이 Observation으로 한다.
 */

export interface BaseChanceConfig {
  /** 자료(2~8개). 생략하면 샌드박스 기본 `[7,4,9,3,7]`. */
  data?: number[];
  /** 자료 이름표(예: "줄넘기(번)"). 이름은 콘텐츠가 사람 이름을 넣지 않는다. */
  label?: string;
  /** 자료마다 이름. 생략하면 "1번"…. */
  names?: string[];
}

export interface LevelingConfig extends BaseChanceConfig {
  mode?: 'leveling';
  /** 기둥 최대 높이. 기본 max(data) + 2. */
  maxHeight?: number;
}

export interface SeesawConfig extends BaseChanceConfig {
  mode: 'seesaw';
  /** 수직선 범위. 기본 자료 최소−1 ~ 최대+1. */
  min?: number;
  max?: number;
  /** 받침점 간격(문자열 Rational). 기본 "1". */
  step?: string;
}

export interface OutlierConfig extends BaseChanceConfig {
  mode: 'outlier';
  /** 끌 수 있는 점의 자리. 자료를 생략한 샌드박스는 4. */
  dragIndex?: number;
  min?: number;
  max?: number;
  /** true면 예측하기 전에는 끌기·평균선이 잠긴다. 자료를 생략한 샌드박스는 true. */
  predict?: boolean;
}

export type ChanceConfig = LevelingConfig | SeesawConfig | OutlierConfig;

interface BaseState {
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  readonly label: string;
  readonly names: readonly string[];
  /** 처음 자료(바뀌지 않는다). */
  readonly data: readonly number[];
}

export interface LevelingState extends BaseState {
  readonly mode: 'leveling';
  readonly maxHeight: number;
  /** 기둥별 지금 높이. */
  readonly heights: readonly number[];
  /** 받아들여진 옮기기 횟수. */
  readonly moves: number;
}

export interface SeesawState extends BaseState {
  readonly mode: 'seesaw';
  readonly min: number;
  readonly max: number;
  /** step 문자열(기약분수). */
  readonly step: string;
  /** 받침점 위치(기약분수 문자열). */
  readonly fulcrum: string;
  readonly moves: number;
}

export interface OutlierState extends BaseState {
  readonly mode: 'outlier';
  readonly min: number;
  readonly max: number;
  readonly dragIndex: number;
  readonly requirePrediction: boolean;
  readonly values: readonly number[];
  readonly dragged: boolean;
  /** 잠근 예측(기약분수 문자열). 아직이면 null. */
  readonly prediction: string | null;
}

export type ChanceState = LevelingState | SeesawState | OutlierState;

export type ChanceAction =
  | { readonly type: 'move'; readonly from: number; readonly to: number }
  | { readonly type: 'set-fulcrum'; readonly value: string }
  | { readonly type: 'set-value'; readonly value: number }
  | { readonly type: 'predict'; readonly value: string }
  | { readonly type: 'reset' };

export const LOGICAL_WIDTH = 1000;
export const LOGICAL_HEIGHT = 600;
export const CANVAS_SELECTOR = 'svg[data-testid="chance-canvas"]';

export const DEFAULT_DATA: readonly number[] = [7, 4, 9, 3, 7];
export const DEFAULT_DRAG_INDEX = 4;
export const MIN_COUNT = 2;
export const MAX_COUNT = 8;
export const MAX_VALUE = 100;
export const MAX_LEVEL_HEIGHT = 30;
export const MAX_AXIS = 200;
