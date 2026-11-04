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
  | 'decimal-grid'
  | 'multiply'
  | 'divide-measure';

/** 넓이 곱셈의 두 쪽. `a`는 세로 칸, `b`는 가로 칸이다(T049 결정 3). */
export type MultiplySide = 'a' | 'b';

export type LayoutSide = 'vertical' | 'horizontal';

/**
 * `multiply`의 칸 방향. `overlay-slicer`의 `orientation`과 다른 키다.
 * 섞지 않는다(T049 결정 3).
 */
export interface MultiplyLayoutConfig {
  readonly a?: LayoutSide;
  readonly b?: LayoutSide;
}

/** partition의 변형. 모드는 `partition` 그대로 두고 이 값으로 구분한다. */
export type PartitionVariant = 'share' | 'divide-whole';

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

  // ── overlay-slicer / add-sub / multiply ────────────────────
  /** 분수 문자열. `multiply`는 정수 number도 받는다(T049 결정 2). */
  readonly a?: string | number;
  readonly b?: string | number;
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

  // ── multiply (T049) ────────────────────────────────────────
  /**
   * `multiply`: 칸 방향. 기본 `{ a: 'vertical', b: 'horizontal' }`.
   * `overlay-slicer`의 `orientation`과 다른 키다.
   */
  readonly layout?: MultiplyLayoutConfig;
  /** `multiply`: 처음부터 a·b대로 놓을지(`preset`) 학생이 놓을지(`student`). 기본 student. */
  readonly build?: 'student' | 'preset';
  /** `multiply`: "전체 칸 12 · 겹친 칸 6"을 쓸지. 기본 false(정답 노출 금지). */
  readonly showCounts?: boolean;
  /** `multiply`: 학생이 고를 수 있는 한 전체의 최대 칸 수. 기본 12. */
  readonly maxDenominator?: number;
  /** 받기만 하고 무시한다. 곱 그림은 늘 반투명 + 무늬다(T049 결정 3). */
  readonly blend?: string;

  // ── divide-measure / divide-whole (T049) ───────────────────
  /** `divide-measure`: 나뉨수. `"3/4"`, `"1 1/2"`, `4`를 받는다. */
  readonly dividend?: string | number;
  /** `divide-measure`: 나누는 수(자 길이). `divide-whole`: 2~6. */
  readonly divisor?: string | number;
  /** `divide-measure`: 부분 자를 자의 몇인지 세어 볼 수 있게만 한다. 기본 false. */
  readonly showRemainderFractionOfDivisor?: boolean;

  // ── partition variant=share (T049) ─────────────────────────
  /** `partition`의 변형. 있으면 `simplifyFrom`을 건너뛴다. */
  readonly variant?: PartitionVariant;
  /** `share`: 전체 수(1~6). */
  readonly wholes?: number;
  /** `share`: 접시 수(2~6). */
  readonly people?: number;
  /** `share`: 접시에 "1/4 조각 3개"처럼 조각 크기·개수만 쓸지. 기본 false. */
  readonly plateLabel?: boolean;
  /** `share`: 받기만 하고 무시한다. 넓이 같음 검사는 늘 켠다. */
  readonly equalPartsCheck?: boolean;

  // ── partition variant=divide-whole (T049) ──────────────────
  /** `divide-whole`: 나뉘수 ÷ divisor의 결과를 곱셈식으로 모핑해 보여 줄지. 기본 false. */
  readonly morphToMultiply?: boolean;
  /** `divide-whole`: 분자가 divisor의 배수일 때 묶어서 나누기 지름길을 보여 줄지. 기본 true. */
  readonly groupShortcut?: boolean;
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

/**
 * `multiply`: 두 분수 넓이의 겹침.
 * `aShaded`는 여러 전체에 걸쳐 센 칸 수라 `aParts`보다 클 수 있다.
 * `b`는 1 이하라 `bShaded ≤ bParts`다.
 */
export interface MultiplyState {
  readonly mode: 'multiply';
  /** 한 전체를 나눈 세로 칸 수. */
  readonly aParts: number;
  /** 여러 전체에 걸쳐 칠한 세로 칸 수. */
  readonly aShaded: number;
  readonly bParts: number;
  readonly bShaded: number;
  readonly layout: {
    readonly a: LayoutSide;
    readonly b: LayoutSide;
  };
  readonly maxDenominator: number;
  readonly counters: EventCounts;
}

/**
 * `divide-measure`: 나누는 수 막대(자)로 나뉨수를 재기.
 * `partial`은 부분 자가 자의 몇인지(`"1/8"`), 아직 없으면 null이다.
 */
export interface DivideMeasureState {
  readonly mode: 'divide-measure';
  readonly dividend: string;
  readonly divisor: string;
  /** 온전히 놓은 자 수. */
  readonly rulersLaid: number;
  readonly partial: string | null;
  readonly showRemainderFractionOfDivisor: boolean;
  readonly counters: EventCounts;
}

/** 접시에 놓였는지. `null`이면 아직 전체 위에 있다. */
export interface SharePiece {
  readonly plate: number | null;
}

/** 전체 하나. `pieces.length`가 지금 조각 수다. */
export interface ShareWhole {
  readonly cuts: readonly Cut[];
  readonly pieces: readonly SharePiece[];
}

/** `partition` variant=share. mode는 'partition' 그대로다. */
export interface ShareState {
  readonly mode: 'partition';
  readonly variant: 'share';
  readonly shape: FractionShape;
  readonly outline: readonly Point[];
  readonly wholes: readonly ShareWhole[];
  readonly people: number;
  /** 고른 조각. 아직 고르지 않았으면 null. */
  readonly selected: { readonly whole: number; readonly piece: number } | null;
  readonly tolerance: number;
  readonly counters: EventCounts;
}

/** `partition` variant=divide-whole: ÷자연수 → ×1/n. */
export interface DivideWholeState {
  readonly mode: 'partition';
  readonly variant: 'divide-whole';
  readonly shape: FractionShape;
  readonly dividend: string;
  readonly dividendParts: number;
  readonly dividendShaded: number;
  readonly divisor: number;
  /** "÷ n" 카드를 눌러 가로 칸 슬라이더를 열었는지. */
  readonly rowsOpen: boolean;
  /** 가로 칸 수(1~divisor). */
  readonly rows: number;
  readonly keptRow: number | null;
  /** "묶어서 나누기"를 눌렀는지. */
  readonly bundleOpen: boolean;
  readonly keptBundle: number | null;
  readonly morphToMultiply: boolean;
  readonly groupShortcut: boolean;
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
  | DecimalGridState
  | MultiplyState
  | DivideMeasureState
  | ShareState
  | DivideWholeState;

/** `partition` 합집합에서 share 상태를 골라 낸다. */
export function isShareState(state: FractionModelState): state is ShareState {
  return state.mode === 'partition' && 'variant' in state && state.variant === 'share';
}

/** `partition` 합집합에서 divide-whole 상태를 골라 낸다. */
export function isDivideWholeState(state: FractionModelState): state is DivideWholeState {
  return state.mode === 'partition' && 'variant' in state && state.variant === 'divide-whole';
}

export type FractionModelAction =
  // partition
  | {
      readonly type: 'cut';
      readonly tool: 'line' | 'radial';
      readonly points: readonly [Point, Point];
      /** `share`에서 어느 전체를 자르는지. 없으면 0번 전체. */
      readonly whole?: number;
    }
  | { readonly type: 'clear-cuts'; readonly whole?: number }
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
  | { readonly type: 'clear-cells' }
  // multiply (E04 fraction-area와 같은 이름)
  | { readonly type: 'set-parts'; readonly side: MultiplySide; readonly parts: number }
  | { readonly type: 'set-shaded'; readonly side: MultiplySide; readonly count: number }
  // divide-measure
  | { readonly type: 'lay-ruler' }
  | { readonly type: 'lift-ruler' }
  | { readonly type: 'clear-rulers' }
  // partition variant=share
  | { readonly type: 'cut-equal'; readonly whole: number; readonly parts: number }
  | { readonly type: 'select-piece'; readonly whole: number; readonly piece: number }
  | {
      readonly type: 'deal-piece';
      readonly whole: number;
      readonly piece: number;
      readonly plate: number;
    }
  | { readonly type: 'return-piece'; readonly whole: number; readonly piece: number }
  // partition variant=divide-whole
  | { readonly type: 'open-rows' }
  | { readonly type: 'set-rows'; readonly rows: number }
  | { readonly type: 'keep-row'; readonly row: number }
  | { readonly type: 'bundle' }
  | { readonly type: 'keep-bundle'; readonly index: number };

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
