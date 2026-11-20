/**
 * E19 평균·가능성 실험실 여섯 모드(leveling·seesaw·outlier·words·spinner·simulate)의 설정·상태·Action 타입.
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

// ── 가능성 모드(words·spinner·simulate) ─────────────────────

export const OUTCOMES = ['red', 'blue', 'yellow', 'green'] as const;
export type Outcome = (typeof OUTCOMES)[number];

export type Device =
  | { readonly type: 'spinner'; readonly sectors: readonly { color: Outcome; size: number }[] }
  | { readonly type: 'bag'; readonly marbles: readonly { color: Outcome; count: number }[] };

export interface WordsConfig {
  mode: 'words';
  /** 말 카드·상황 카드 1~6장. 생략하면 샌드박스 기본 5장. */
  cards?: { id: string; text: string }[];
  /** 기본 'five': 0, 1/4, 1/2, 3/4, 1. */
  slots?: 'five' | 'three';
  /** 기본 'both'. */
  slotLabels?: 'words' | 'numbers' | 'both';
}

export interface SpinnerConfig {
  mode: 'spinner';
  /** 처음 장치. 생략하면 빨강1·파랑1 회전판. */
  device?: Device;
  /** 학생이 장치를 바꿀 수 있는가(기본 true). */
  editable?: boolean;
}

export interface SimulateConfig {
  mode: 'simulate';
  device?: Device;
  editable?: boolean;
  /** 비교 칸의 시행 횟수(1~4개, 각 1~10000). 기본 [10, 1000, 10000]. */
  batches?: number[];
  /** 장치 가능성 점선을 보일지(기본 true). */
  showExpected?: boolean;
}

export type ChanceConfig =
  LevelingConfig | SeesawConfig | OutlierConfig | WordsConfig | SpinnerConfig | SimulateConfig;

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

export interface WordsState {
  readonly mode: 'words';
  readonly error: string | null;
  readonly cards: readonly { readonly id: string; readonly text: string }[];
  /** 칸 위치(기약분수 문자열). 'five'는 0·1/4·1/2·3/4·1. */
  readonly slotValues: readonly string[];
  readonly slotLabels: 'words' | 'numbers' | 'both';
  /** 카드 id → 놓은 칸 위치(없으면 null). */
  readonly placements: Readonly<Record<string, string | null>>;
}

interface DeviceFields {
  readonly error: string | null;
  readonly device: Device;
  /** 처음 장치(reset이 되돌린다). */
  readonly initialDevice: Device;
  readonly editable: boolean;
  /** 장치를 바꾼 횟수. 시행 결과를 지워도 남는다. */
  readonly edits: number;
}

export type OutcomeCounts = Readonly<Record<Outcome, number>>;

export interface SpinnerState extends DeviceFields {
  readonly mode: 'spinner';
  readonly trials: number;
  readonly counts: OutcomeCounts;
  /** 최근 결과(오래된 것부터, 최대 10개). */
  readonly last: readonly Outcome[];
  /** 마지막 시행이 가리킨 자리(장치를 한 칸씩 펼친 목록의 번호). 없으면 null. */
  readonly lastPick: number | null;
}

export interface SimulateResult {
  readonly batch: number;
  readonly counts: OutcomeCounts;
}

export interface SimulateState extends DeviceFields {
  readonly mode: 'simulate';
  readonly batches: readonly number[];
  readonly showExpected: boolean;
  /** 돌린 칸만(batches 순서). */
  readonly results: readonly SimulateResult[];
  readonly runs: number;
}

export type ChanceState =
  LevelingState | SeesawState | OutlierState | WordsState | SpinnerState | SimulateState;

export type ChanceAction =
  | { readonly type: 'move'; readonly from: number; readonly to: number }
  | { readonly type: 'set-fulcrum'; readonly value: string }
  | { readonly type: 'set-value'; readonly value: number }
  | { readonly type: 'predict'; readonly value: string }
  | { readonly type: 'place'; readonly cardId: string; readonly slot: string }
  | { readonly type: 'unplace'; readonly cardId: string }
  | { readonly type: 'sector-add'; readonly color: Outcome }
  | { readonly type: 'sector-remove'; readonly index: number }
  | { readonly type: 'sector-color'; readonly index: number; readonly color: Outcome }
  | { readonly type: 'sector-size'; readonly index: number; readonly size: number }
  | { readonly type: 'marble-set'; readonly color: Outcome; readonly count: number }
  | { readonly type: 'spin'; readonly seed: number }
  | { readonly type: 'run'; readonly batch: number; readonly seed: number }
  | { readonly type: 'clear' }
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

export const MAX_SECTORS = 8;
export const MAX_SECTOR_SIZE = 4;
export const MAX_MARBLES_PER_COLOR = 10;
export const MAX_MARBLES = 20;
export const MAX_BATCHES = 4;
export const MAX_BATCH_SIZE = 10000;
export const MAX_WORD_CARDS = 6;
export const LAST_COUNT = 10;
