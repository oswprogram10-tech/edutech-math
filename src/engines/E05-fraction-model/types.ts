/**
 * E05 분수 모델의 설정·상태·Action 타입.
 *
 * 수의 값(분수·색칠 비율·합·차)은 모두 `core/math`의 `Rational`로 계산하고,
 * 상태·Observation에는 `toJSON()` 문자열(`"3/4"`)로 넣는다.
 *
 * 예외: 자유 절단 조각의 넓이는 화면 기하(논리 좌표)라서 number로 계산하고
 * `areaTolerance`(기본 0.02)로 "넓이가 같은지"를 판정한다. 등분으로 판정된 뒤의
 * 분수값은 `k/n` Rational로 기록한다. 이 예외는 T010 구현 결정 2에 따른다.
 */
import type { Point } from '../../core/engine-sdk';

export type FractionMode =
  | 'partition'
  | 'shade'
  | 'compare'
  | 'overlay-slicer'
  | 'discrete'
  | 'mixed'
  | 'add-sub'
  | 'decimal-grid';

export type FractionShape = 'rect' | 'square' | 'bar' | 'circle' | 'triangle' | 'polygon';

export type CutTool = 'line' | 'radial' | 'free-line';

export type FractionOp = '+' | '-' | 'add' | 'sub';

/**
 * 화면에 수치 문구를 어디까지 보여 줄지.
 * 기본 `'none'`은 정답 노출 금지(AGENTS 절대 규칙 3)에 따라 수치를 숨긴다.
 * `'raw'`는 약분 전 표기만, `'raw-and-reduced'`는 약분·변환된 값까지 보여 준다.
 */
export type ShowValue = 'none' | 'raw' | 'raw-and-reduced';

export interface ShadeWholeConfig {
  /** 막대·직사각형·정사각형·원. */
  readonly shape?: FractionShape;
  /** 전체를 몇 등분해 보여 줄지. */
  readonly partsX?: number;
  /** 처음부터 색칠되어 있는 칸 인덱스(0부터). 정답이 아니라 출발 상태다. */
  readonly shaded?: readonly number[];
}

export interface CompareBarConfig {
  /** 막대를 몇 등분할지. */
  readonly parts: number;
  /** 색칠된 칸 인덱스. */
  readonly shaded?: readonly number[];
  /** 화면에 붙일 이름표(선택). */
  readonly label?: string;
}

export interface OverlayOrientation {
  readonly a?: 'horizontal' | 'vertical';
  readonly b?: 'horizontal' | 'vertical';
}

/** `presetCuts`의 칼선 하나. 논리 좌표(1000×600) 두 점. */
export interface PresetCutConfig {
  readonly points: readonly [Point, Point];
  /** 기본은 직선 칼선. 원에서는 `'radial'`을 쓴다. */
  readonly tool?: 'line' | 'radial';
}

/**
 * 단원 명세의 E05 설정 키를 모두 받는다(T010 구현 결정 4).
 * `numberLine`·`linkedNumberLine`·`then`처럼 다른 엔진·다음 단계 설정은 받지 않는다.
 */
export interface FractionModelConfig {
  /** 모드. 없으면 설정 키를 보고 추론한다. */
  readonly mode?: FractionMode;
  /**
   * 화면 수치 문구 표시 수준. 기본 `'none'`(숨김).
   * Observation·판정 값은 이 설정과 무관하게 그대로 낸다.
   */
  readonly showValue?: ShowValue;

  // ── partition ──────────────────────────────────────────────
  readonly shape?: FractionShape;
  readonly targetParts?: number;
  readonly cutTool?: CutTool;
  readonly equalityCheck?: 'area';
  /** 조각 넓이가 같은지 볼 상대 허용 오차. 기본 0.02(2%). */
  readonly areaTolerance?: number;
  /** 미리 n등분된 막대를 보여 준다. */
  readonly fixedParts?: number;
  /**
   * 미리 그려 둘 칼선 목록. 있으면 `fixedParts` 자동 칼선 대신 쓴다.
   * 읽기 전용 그림(선택지)과 과제 시작 상태에 모두 쓸 수 있다.
   */
  readonly presetCuts?: readonly PresetCutConfig[];
  readonly label?: string;
  /** 약분 탐정용: "18/24"처럼 색칠된 분수를 미리 보여 준다. */
  readonly fraction?: string;
  /** 약분 탐정용 묶음 후보. */
  readonly groupChoices?: readonly number[];
  readonly showGcdShortcut?: boolean;
  /** polygon 모양의 꼭짓점 목록(논리 좌표). */
  readonly polygonPoints?: readonly Point[];

  // ── shade ──────────────────────────────────────────────────
  readonly whole?: ShadeWholeConfig;
  /** 과제의 목표 분수. 엔진은 화면에 정답으로 표시하지 않는다. */
  readonly target?: string;
  /** 더 잘게 자르기 배율 목록(예: [2, 3]). */
  readonly refine?: readonly number[];
  /** 더 굵게 묶기를 허용할지. */
  readonly coarsen?: boolean;

  // ── compare ────────────────────────────────────────────────
  readonly bars?: readonly CompareBarConfig[];
  readonly align?: 'left' | 'right';

  // ── overlay-slicer / add-sub ───────────────────────────────
  readonly a?: string;
  readonly b?: string;
  readonly orientation?: OverlayOrientation;
  readonly challenge?: 'compare' | 'common-grid';

  // ── discrete ───────────────────────────────────────────────
  readonly items?: number;
  readonly itemIcon?: 'candy' | 'dot' | 'star';
  readonly groupSizeOptions?: readonly number[];
  readonly grouping?: 'dial-or-lasso' | 'dial';
  readonly showFractionOf?: boolean;

  // ── mixed / add-sub ────────────────────────────────────────
  readonly direction?: 'improper-to-mixed' | 'mixed-to-improper';
  readonly value?: string;
  readonly wholeShape?: FractionShape;
  readonly op?: FractionOp;
  readonly breakWhole?: boolean;
  readonly commonGrid?: number;
  readonly fuseWhole?: boolean;
  readonly allowBreakWhole?: boolean;
  readonly strategyChoice?: readonly ('separate' | 'improper')[];
  readonly requireCommonGrid?: boolean;

  // ── decimal-grid ───────────────────────────────────────────
  /** 한 변의 칸 수. 기본 10(10×10). */
  readonly size?: number;
  /** 표시할 층 수(0.1층·0.01층). 기본 2. */
  readonly layers?: number;
  /**
   * 층 버튼에 쓸 이름. 없으면 기본 `0.1 층`·`0.01 층`을 쓴다.
   * 두 소수를 겹쳐 보는 과제처럼 층마다 다른 수를 칠할 때만 지정한다.
   */
  readonly layerLabels?: readonly string[];
  readonly overlayAlpha?: number;
}

/** 이벤트 횟수. `eventAtLeast` 판정이 이 값을 본다. */
export interface EventCounts {
  readonly partitioned: number;
  readonly shaded: number;
  readonly valueChanged: number;
  readonly fused: number;
  readonly brokeWhole: number;
  readonly overlaid: number;
  readonly refined: number;
  readonly coarsened: number;
}

export const EMPTY_COUNTS: EventCounts = {
  partitioned: 0,
  shaded: 0,
  valueChanged: 0,
  fused: 0,
  brokeWhole: 0,
  overlaid: 0,
  refined: 0,
  coarsened: 0,
};

export function bumpCounts(counts: EventCounts, key: keyof EventCounts): EventCounts {
  return { ...counts, [key]: counts[key] + 1 };
}

export interface Cut {
  readonly id: string;
  readonly tool: 'line' | 'radial';
  readonly points: readonly [Point, Point];
}

export interface SimplifyState {
  readonly numerator: number;
  readonly denominator: number;
  /** 학생이 고른 묶음 크기. 아직 고르지 않았으면 null. */
  readonly groupSize: number | null;
}

export interface PartitionState {
  readonly mode: 'partition';
  readonly shape: FractionShape;
  readonly outline: readonly Point[];
  readonly cuts: readonly Cut[];
  /** 색칠된 조각 인덱스. */
  readonly shaded: readonly number[];
  readonly nextCutId: number;
  readonly fixedParts: number | null;
  /** `fixedParts`·`presetCuts`로 미리 나뉜 도형인지. 참이면 자르기 도구를 쓰지 않는다. */
  readonly preset: boolean;
  readonly simplify: SimplifyState | null;
  readonly tolerance: number;
  readonly counters: EventCounts;
}

export interface ShadeState {
  readonly mode: 'shade';
  readonly shape: FractionShape;
  readonly parts: number;
  readonly shaded: readonly number[];
  readonly counters: EventCounts;
}

export interface CompareBar {
  readonly parts: number;
  readonly shaded: readonly number[];
  readonly label?: string;
}

export interface CompareState {
  readonly mode: 'compare';
  readonly bars: readonly CompareBar[];
  readonly align: 'left' | 'right';
  readonly selectedBar: number | null;
  readonly counters: EventCounts;
}

export interface OverlayState {
  readonly mode: 'overlay-slicer';
  /** 기약 분수 문자열. 예: "1/2" */
  readonly a: string;
  readonly b: string;
  readonly shape: FractionShape;
  readonly orientation: {
    readonly a: 'horizontal' | 'vertical';
    readonly b: 'horizontal' | 'vertical';
  };
  readonly overlaid: boolean;
  /** 겹친 뒤의 공통 격자 칸 수. 아직 겹치지 않았으면 null. */
  readonly grid: number | null;
  readonly counters: EventCounts;
}

export interface DiscreteState {
  readonly mode: 'discrete';
  readonly items: number;
  readonly groupSize: number;
  readonly selectedGroups: readonly number[];
  readonly icon: string;
  readonly showFractionOf: boolean;
  readonly counters: EventCounts;
}

export type MixedKind = 'convert' | 'problem';

export interface MixedState {
  readonly mode: 'mixed';
  readonly kind: MixedKind;
  readonly shape: FractionShape;
  /** convert: 조각의 분모. problem: a의 분모. */
  readonly denominator: number;
  /** convert: 융합된 자연수 개수. problem: a의 자연수 부분. */
  readonly wholes: number;
  /** convert: 남은 조각 수. problem: a의 진분수 분자. */
  readonly pieces: number;
  /** 한 막대를 조각으로 풀 수 있는지(받아내림 의미화). */
  readonly allowBreakWhole: boolean;
  // problem 전용
  readonly a: string | null;
  readonly b: string | null;
  readonly op: '+' | '-' | null;
  readonly commonGrid: number | null;
  readonly combined: boolean;
  readonly result: string | null;
  /** problem: 자연수 막대 하나를 조각으로 풀었는지. */
  readonly borrowed: boolean;
  /** problem: 막대 하나를 푼 뒤의 자연수 부분(예: 3 1/6 → 2). 아직 안 풀었으면 null. */
  readonly naturalPart: number | null;
  /** problem: 푼 뒤 commonGrid 단위 조각 수(예: 14). */
  readonly pieceCount: number | null;
  /** problem: 푼 조각 한 칸의 분모(commonGrid, 예: 12). */
  readonly pieceDenominator: number | null;
  readonly counters: EventCounts;
}

export interface AddSubState {
  readonly mode: 'add-sub';
  readonly op: '+' | '-';
  readonly a: string;
  readonly b: string;
  readonly shape: FractionShape;
  readonly commonGrid: number | null;
  readonly combined: boolean;
  readonly result: string | null;
  readonly strategy: 'separate' | 'improper' | null;
  /** 자연수 1을 조각으로 풀어 받아내림할 수 있는지. */
  readonly allowBreakWhole: boolean;
  /** 합치기 전에 공통 격자를 먼저 만들어야 하는지. */
  readonly requireCommonGrid: boolean;
  /** 학생이 자연수 1을 풀었는지(받아내림 기록). */
  readonly borrowed: boolean;
  readonly counters: EventCounts;
}

export interface DecimalGridState {
  readonly mode: 'decimal-grid';
  readonly size: number;
  readonly layers: number;
  readonly shaded: readonly number[];
  /** 지금 색칠하는 층. 0=0.1층, 1=0.01층. */
  readonly layer: number;
  readonly overlayAlpha: number;
  readonly counters: EventCounts;
}

export type FractionModelState =
  | PartitionState
  | ShadeState
  | CompareState
  | OverlayState
  | DiscreteState
  | MixedState
  | AddSubState
  | DecimalGridState;

export type FractionModelAction =
  // partition
  | {
      readonly type: 'cut';
      readonly tool: 'line' | 'radial';
      readonly points: readonly [Point, Point];
    }
  | { readonly type: 'clear-cuts' }
  | { readonly type: 'shade-piece'; readonly index: number }
  // shade (set-group-size는 discrete와 공유한다)
  | { readonly type: 'toggle-part'; readonly index: number }
  | { readonly type: 'refine'; readonly factor: 2 | 3 }
  | { readonly type: 'coarsen'; readonly factor: number }
  | { readonly type: 'set-shade-value'; readonly value: string }
  // compare
  | { readonly type: 'select-bar'; readonly index: number }
  | { readonly type: 'toggle-bar-part'; readonly bar: number; readonly index: number }
  | { readonly type: 'set-bar-value'; readonly bar: number; readonly value: string }
  | { readonly type: 'set-align'; readonly align: 'left' | 'right' }
  // overlay-slicer / add-sub
  | { readonly type: 'overlay' }
  | { readonly type: 'set-grid'; readonly size: number }
  // discrete / partition simplify
  | { readonly type: 'set-group-size'; readonly size: number }
  | { readonly type: 'toggle-group'; readonly index: number }
  // mixed / add-sub
  | { readonly type: 'fuse' }
  | { readonly type: 'break-whole' }
  | { readonly type: 'combine' }
  | { readonly type: 'set-strategy'; readonly strategy: 'separate' | 'improper' }
  // decimal-grid
  | { readonly type: 'toggle-cell'; readonly index: number }
  | { readonly type: 'shade-row'; readonly row: number }
  | { readonly type: 'set-layer'; readonly layer: number }
  | { readonly type: 'clear-cells' };

export const LOGICAL_WIDTH = 1000;
export const LOGICAL_HEIGHT = 600;
export const DEFAULT_TOLERANCE = 0.02;
export const CIRCLE_CENTER: Point = { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 };
export const CIRCLE_RADIUS = 210;

/** 색칠 비율의 약분 전/후 표기. */
export interface FractionDisplay {
  readonly raw: string;
  readonly reduced: string;
}
