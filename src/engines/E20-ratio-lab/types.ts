/**
 * E20 비·비율 실험실 `mix`·`resize` 모드의 설정·상태·Action 타입.
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

export type RatioConfig = MixConfig | ResizeConfig;

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

export type RatioState = MixState | ResizeState;

export type RatioAction =
  | { readonly type: 'add'; readonly ingredient: Ingredient; readonly n: number }
  | { readonly type: 'remove'; readonly ingredient: Ingredient; readonly n: number }
  | { readonly type: 'scale'; readonly k: number }
  | { readonly type: 'step'; readonly dim: 'w' | 'h'; readonly delta: 1 | -1 }
  | { readonly type: 'add-both'; readonly n: number }
  | { readonly type: 'save' }
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
