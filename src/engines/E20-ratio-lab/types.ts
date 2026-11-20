/**
 * E20 비·비율 실험실 `mix`·`resize`·`rate`·`percent` 모드의 설정·상태·Action 타입.
 * 양(컵의 블록·사진의 칸)은 0 이상의 정수 개수로 저장한다. 비의 값·동치는 core Rational로 계산한다.
 * 설정에 목표 값(예: 시럽 2)은 없다. 판정은 콘텐츠 goal이 Observation으로 한다.
 */

export type MixLook = 'blocks' | 'strip' | 'ratio';
export type ResizeLook = 'picture' | 'table';
export type Ingredient = 'milk' | 'syrup';

export interface Amounts {
  readonly milk: number;
  readonly syrup: number;
}

export interface FixedCupConfig extends Amounts {
  readonly id: string;
  readonly label: string;
}

export interface MixConfig {
  mode?: 'mix';
  /** 기준 컵(고정). 생략하면 4:1, null이면 기준 컵 없음. */
  reference?: Amounts | null;
  /** 비교용 고정 컵(0~3개). */
  fixedCups?: FixedCupConfig[];
  /** 학생 컵 시작값. 생략하면 {milk:0,syrup:0,maxEach:30}, null이면 학생 컵 없음. */
  make?: { milk?: number; syrup?: number; maxEach?: number } | null;
  /** ×k 단추. 기본 [2, 3]. */
  scaleFactors?: number[];
  /** 기본 'blocks' (C 블록 컵 / P 띠 그림 / A 글만). */
  look?: MixLook;
  /** 기본 true: 진하기 띠. */
  showStrip?: boolean;
  /**
   * 띠의 오른쪽 끝 진하기(0 초과 1 이하). 생략하면 기준·고정 컵의 가장 진한 값 × 1.5를 0.1 단위로
   * 올림해 0.2~1로 자른다(설정만으로 정한다. 학생 컵 값으로 움직이지 않는다).
   */
  stripMax?: number;
}

export interface ResizeConfig {
  mode: 'resize';
  /** 처음 크기(칸). 생략하면 4×3. */
  base?: { w: number; h: number };
  /** 기본 2: "둘 다 +n" 단추. */
  addStep?: number;
  /** 기본 [2, 3]. */
  scaleFactors?: number[];
  /** 기본 24: 한 변 최대 칸. */
  max?: number;
  /** 기본 true: "처음 모양과 같아요/달라요" 글. */
  showVerdict?: boolean;
  /** 기본 'picture' (C 사진 / P 표). */
  look?: ResizeLook;
}

export interface RacerConfig {
  readonly id?: string;
  readonly name: string;
  readonly distance: number | null;
  readonly time: number | null;
  /** 생략하면 처음 값이 null인 칸만 편집할 수 있다. true면 둘 다, false면 둘 다 잠근다. */
  readonly editable?: boolean;
}

export type RateLook = 'race' | 'table';
export type PercentLayout = 'strip' | 'grid';

export interface RateConfig {
  mode: 'rate';
  /** 2명. 생략하면 토끼 120m·20초, 거북 200m·40초(샌드박스 기본, 이때 predictFirst도 기본 true). */
  racers?: RacerConfig[];
  /** 기본 false(racers를 생략한 기본 장면은 true). */
  predictFirst?: boolean;
  /** 기본 400 (m) */
  maxDistance?: number;
  /** 기본 120 (초) */
  maxTime?: number;
  /** 기본 'race' (C 경주 트랙 / P 표) */
  look?: RateLook;
}

export interface PercentConfig {
  mode: 'percent';
  /** 기본 'grid' (10×10 판 / 1×100 띠) */
  layout?: PercentLayout;
  /** 미리 칠한 칸 수(0~100), 기본 0 */
  shaded?: number;
  /** 기본 true */
  editable?: boolean;
  /** 기본 true: "칠한 칸 n / 100" */
  showCount?: boolean;
}

export type RatioConfig = MixConfig | ResizeConfig | RateConfig | PercentConfig;

export interface MixSettings {
  readonly look: MixLook;
  readonly showStrip: boolean;
  /** 띠의 오른쪽 끝 진하기(0 초과 1 이하). */
  readonly stripMax: number;
  readonly scaleFactors: readonly number[];
  readonly maxEach: number;
  /** 학생 컵이 있는가(make가 null이면 false). */
  readonly hasCup: boolean;
}

export interface FixedCup extends Amounts {
  readonly id: string;
  readonly label: string;
}

export interface MixState {
  readonly mode: 'mix';
  /** null이 아니면 설정 오류. 화면은 오류 문구만 보인다. */
  readonly error: string | null;
  readonly settings: MixSettings;
  readonly reference: Amounts | null;
  readonly fixedCups: readonly FixedCup[];
  readonly cup: Amounts;
  readonly initialCup: Amounts;
  /** 넣기·빼기 조작 횟수(받아들여진 것만). */
  readonly addOps: number;
  readonly scaleOps: number;
}

export interface Size {
  readonly w: number;
  readonly h: number;
}

export interface ResizeSettings {
  readonly addStep: number;
  readonly scaleFactors: readonly number[];
  readonly max: number;
  readonly showVerdict: boolean;
  readonly look: ResizeLook;
}

export interface ResizeState {
  readonly mode: 'resize';
  readonly error: string | null;
  readonly settings: ResizeSettings;
  readonly base: Size;
  readonly size: Size;
  readonly saved: readonly Size[];
  /** 둘 다 +n 조작 횟수. */
  readonly addOps: number;
  readonly scaleOps: number;
}

export interface RacerState {
  readonly id: string;
  readonly name: string;
  readonly distance: number | null;
  readonly time: number | null;
  readonly editDistance: boolean;
  readonly editTime: boolean;
}

export interface RateSettings {
  readonly predictFirst: boolean;
  readonly maxDistance: number;
  readonly maxTime: number;
  readonly look: RateLook;
}

export interface RateState {
  readonly mode: 'rate';
  readonly error: string | null;
  readonly settings: RateSettings;
  readonly racers: readonly RacerState[];
  readonly initialRacers: readonly RacerState[];
  /** 학생 예측(racerId | 'same'). 한 번 정하면 잠긴다. */
  readonly prediction: string | null;
  /** 예측을 받은 순간에 거리(시간)만 보고 판단했는지(MC-RATE-DISTANCE-ONLY). 기록이라 남는다. */
  readonly distanceOnly: boolean;
  /** 경주를 시작한 횟수. 재생 화면은 reducer 상태가 아니다. */
  readonly runs: number;
}

export interface PercentSettings {
  readonly layout: PercentLayout;
  readonly editable: boolean;
  readonly showCount: boolean;
}

export interface PercentState {
  readonly mode: 'percent';
  readonly error: string | null;
  readonly settings: PercentSettings;
  /** 칠한 칸 번호(0~99, 오름차순). */
  readonly cells: readonly number[];
  readonly initialCells: readonly number[];
}

export type RatioState = MixState | ResizeState | RateState | PercentState;

export type RatioAction =
  | { readonly type: 'add'; readonly ingredient: Ingredient; readonly n: number }
  | { readonly type: 'remove'; readonly ingredient: Ingredient; readonly n: number }
  | { readonly type: 'scale'; readonly k: number }
  | { readonly type: 'step'; readonly dim: 'w' | 'h'; readonly delta: 1 | -1 }
  | { readonly type: 'add-both'; readonly n: number }
  | { readonly type: 'save' }
  | {
      readonly type: 'set';
      readonly racerId: string;
      readonly field: 'distance' | 'time';
      readonly value: number;
    }
  | { readonly type: 'predict'; readonly value: string }
  | { readonly type: 'run' }
  | { readonly type: 'toggle'; readonly index: number }
  | { readonly type: 'fill-to'; readonly count: number }
  | { readonly type: 'clear' }
  | { readonly type: 'reset' };

export const LOGICAL_WIDTH = 1000;
export const LOGICAL_HEIGHT = 600;
export const CANVAS_SELECTOR = 'svg[data-testid="ratio-canvas"]';

export const DEFAULT_REFERENCE: Amounts = { milk: 4, syrup: 1 };
export const DEFAULT_MAX_EACH = 30;
export const DEFAULT_BASE: Size = { w: 4, h: 3 };
export const DEFAULT_MAX_SIZE = 24;
export const MAX_FIXED_CUPS = 3;
export const MAX_EACH_LIMIT = 99;
export const MAX_SAVED = 8;
export const DEFAULT_MAX_DISTANCE = 400;
export const DEFAULT_MAX_TIME = 120;
export const PERCENT_CELLS = 100;
export const SAME_PREDICTION = 'same';
