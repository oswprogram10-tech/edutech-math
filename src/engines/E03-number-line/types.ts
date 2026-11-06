/**
 * E03 수직선의 설정·상태·Action 타입.
 *
 * 수의 값(위치·눈금·점프 크기)은 모두 `core/math`의 `Rational`로 계산하고,
 * 상태·Observation·Action에는 `toJSON()` 문자열(`"3/4"`, `"11/4"`)로 넣는다.
 * 화면 좌표만 number다(T011 구현 결정 2).
 */
export type NumberLineMode =
  'integer' | 'fraction' | 'decimal' | 'skip-count' | 'rounding' | 'log-zoom' | 'double';

/** 어림 방법. 반올림은 5 이상을 올린다(ticks.roundRational). */
export type RoundingMethod = 'up' | 'down' | 'half-up';
export type RoundingControls = 'buttons' | 'drag';
export type LogZoomLabelStyle = 'digits' | 'korean';
export type DoubleOpKind = 'divide' | 'multiply';
export type DoubleLabelStyle = 'expression' | 'values';

/** 콘텐츠가 직접 넣는 이정표. 데이터 파일을 읽지 않는다. */
export interface NumberLineLandmarkConfig {
  readonly value: number | string;
  readonly label: string;
}

export interface NumberLineDoubleSideConfig {
  readonly label?: string;
  readonly max?: number | string;
}

export interface NumberLineZoomConfig {
  /** 가장 굵은 눈금(기본 "1"). decimal에서만 쓴다. */
  readonly from?: string;
  /** 가장 잘게 자른 눈금(기본 "1/1000"). decimal에서만 쓴다. */
  readonly to?: string;
}

/**
 * T011 구현 결정 5의 설정 키를 모두 받는다.
 * `labels`·`character`는 W1 명세(g1s1)의 표시 힌트라 받아만 두고 판정에는 쓰지 않는다.
 */
export interface NumberLineConfig {
  readonly mode?: NumberLineMode;
  readonly min?: number | string;
  readonly max?: number | string;
  /** fraction에서 1을 몇 등분할지. 배열이면 눈금 줄을 여러 개 그린다. */
  readonly subdivisions?: number | readonly number[];
  /** 한 단위. integer의 눈금 크기, fraction의 분자 단위. 기본 "1". */
  readonly unit?: number | string;
  readonly zoom?: NumberLineZoomConfig;
  /** 끌어서 꽂는 카드 값 목록. 대분수 `"1 1/4"` 허용. log-zoom은 number도 받는다. */
  readonly cards?: readonly (number | string)[];
  readonly snap?: 'tick' | 'minor' | 'major';
  /** 두 값이 같은 점인지 세로 레이저로 보여 줄지(정답 표시 아님). */
  readonly laser?: boolean;
  readonly showJumps?: boolean;
  /** 표시 힌트. skip-count의 `all|partial|none`, double의 `expression|values`를 함께 받는다. */
  readonly labels?: 'all' | 'partial' | 'none' | 'expression' | 'values';
  readonly character?: string;

  // ── T080 integer 개구리 점프 ────────────────────────────────
  /** 고를 수 있는 점프 크기(부호 있는 정수). 있으면 개구리 기능이 켜진다. */
  readonly jumpButtons?: readonly (number | string)[];
  /** 개구리 처음 위치. 없으면 min. */
  readonly jumpStart?: number | string;

  // ── skip-count · log-zoom 뛰어 세기 ─────────────────────────
  /** skip-count 시작 값(기본 min). log-zoom 뛰어 세기 시작 값에도 쓴다. */
  readonly start?: number | string;
  /** 고를 수 있는 뛰기 크기. */
  readonly stepChoices?: readonly (number | string)[];
  /** 있으면 고르기 버튼 없이 이 크기로 고정한다. */
  readonly step?: number | string;
  /** 여러 줄: 줄마다 고정 step(g5s1u2). 있으면 stepChoices·step을 무시한다. */
  readonly steps?: readonly (number | string)[];
  /** 뛴 횟수를 화면에 쓸지(기본 false — 정답 노출 금지). */
  readonly showHopCount?: boolean;

  // ── rounding ───────────────────────────────────────────────
  /** 어림할 값 목록(1~3개). */
  readonly values?: readonly (number | string)[];
  /** 값이 하나일 때. */
  readonly value?: number | string;
  /** 어림할 자리 단위(10, 100, 1, 0.1 …). */
  readonly place?: number | string;
  readonly methods?: readonly RoundingMethod[];
  readonly controls?: RoundingControls;
  /** 받기만 하고 무시한다(문장은 콘텐츠·응답 위젯 몫). */
  readonly scenarios?: unknown;
  readonly showConsequence?: boolean;

  // ── log-zoom ───────────────────────────────────────────────
  /** 단계별 최댓값. 정수 문자열 16자리까지. */
  readonly levels?: readonly (number | string)[];
  readonly startLevel?: number;
  readonly labelStyle?: LogZoomLabelStyle;
  readonly landmarks?: readonly NumberLineLandmarkConfig[];

  // ── double ─────────────────────────────────────────────────
  readonly top?: NumberLineDoubleSideConfig;
  readonly bottom?: NumberLineDoubleSideConfig;
  /** [위, 아래] 대응 쌍. */
  readonly anchors?: readonly (readonly [number | string, number | string])[];
  readonly divisors?: readonly (number | string)[];
  readonly multipliers?: readonly (number | string)[];
  /** 받기만 하고 무시한다. */
  readonly ops?: readonly string[];
  readonly goal?: string;
}

export interface NumberLineCounts {
  readonly pointPlaced: number;
  readonly pointMoved: number;
  readonly jumped: number;
  readonly cardPlaced: number;
  readonly zoomed: number;
  readonly valueChanged: number;
}

export const EMPTY_COUNTS: NumberLineCounts = {
  pointPlaced: 0,
  pointMoved: 0,
  jumped: 0,
  cardPlaced: 0,
  zoomed: 0,
  valueChanged: 0,
};

export function bumpCounts(
  counts: NumberLineCounts,
  key: keyof NumberLineCounts,
): NumberLineCounts {
  return { ...counts, [key]: counts[key] + 1 };
}

/** 학생이 찍은 점. `label`은 학생이 붙인 이름표(선택). */
export interface NumberLinePoint {
  readonly id: string;
  readonly value: string;
  readonly label?: string;
}

export interface NumberLineJump {
  readonly from: string;
  readonly to: string;
}

/** skip-count 한 줄. `hops`는 뛴 뒤 도착 값들이다. */
export interface SkipRowState {
  readonly step: string | null;
  readonly hops: readonly string[];
}

export interface SkipCountState {
  readonly start: string;
  readonly rows: readonly SkipRowState[];
}

export interface RoundingItemState {
  readonly value: string;
  readonly marker: string | null;
  readonly method: RoundingMethod | null;
}

export interface RoundingState {
  readonly items: readonly RoundingItemState[];
  readonly selected: number;
}

export interface LogZoomState {
  readonly level: number;
  /** 단계별 최댓값. Observation이 config 없이도 읽을 수 있게 상태에 둔다. */
  readonly levels: readonly string[];
}

export interface DoubleOpState {
  readonly kind: DoubleOpKind;
  readonly factor: number;
}

export interface DoublePairState {
  readonly top: string;
  readonly bottom: string;
  /** 이 쌍을 만든 쌍의 index. anchor는 null. */
  readonly from: number | null;
  readonly op: DoubleOpState | null;
}

export interface DoubleLineState {
  readonly pairs: readonly DoublePairState[];
  readonly selected: number;
  /** 위 수직선의 설정 최댓값(화면 구간 확장의 기준). */
  readonly topMax: string;
}

/**
 * T080 개구리 점프 상태.
 * `start`·`jumps`는 Rational의 정규 문자열이다. 개구리 위치는 저장하지 않고
 * `start + jumps 합`으로 다시 계산한다(정답을 상태에 따로 두지 않는다).
 */
export interface NumberLineFrogState {
  readonly start: string;
  readonly jumps: readonly string[];
  /**
   * 설정의 점프 크기 목록. reduce가 목록 밖 크기를 무시하려면 상태에 있어야 한다.
   * (reduce는 config를 받지 않는다.)
   */
  readonly sizes: readonly string[];
}

export interface NumberLineState {
  readonly mode: NumberLineMode;
  readonly min: string;
  readonly max: string;
  readonly unit: string;
  readonly subdivisions: readonly number[];
  /** decimal 눈금 단계. 0=1, 1=1/10, 2=1/100, 3=1/1000. */
  readonly zoomLevel: number;
  readonly zoomMin: number;
  readonly zoomMax: number;
  /** 지금 화면에 보이는 수 범위(전체 min·max의 부분 창). */
  readonly viewMin: string;
  readonly viewMax: string;
  readonly points: readonly NumberLinePoint[];
  readonly jumps: readonly NumberLineJump[];
  readonly selectedPointId: string | null;
  readonly selectedCard: string | null;
  /** 키보드 Enter로 점을 찍을 위치. */
  readonly cursor: string;
  /** 선택한 카드를 놓을 위치. 선택한 카드가 없으면 null. */
  readonly cardCursor: string | null;
  readonly cards: readonly string[];
  /** 카드 값 → 꽂힌 위치의 값(아직 안 꽂았으면 null). */
  readonly cardValues: Readonly<Record<string, string | null>>;
  /** 다른 엔진에서 받은 연결 점. 학생이 찍은 점으로 세지 않는다. */
  readonly linkedValue: string | null;
  /** 가장 최근에 학생이 나타낸 수. value-changed의 근거. */
  readonly lastValue: string | null;
  readonly nextPointId: number;
  readonly counts: NumberLineCounts;
  /** 새 모드의 상태. 다른 모드에서는 null이다. */
  readonly skip: SkipCountState | null;
  readonly rounding: RoundingState | null;
  readonly logZoom: LogZoomState | null;
  readonly double: DoubleLineState | null;
  /** T080 integer 개구리. 다른 모드·설정 없음이면 null. */
  readonly frog: NumberLineFrogState | null;
}

export type NumberLineAction =
  | { readonly type: 'place-point'; readonly value: string }
  | { readonly type: 'move-point'; readonly id: string; readonly value: string }
  | { readonly type: 'remove-point'; readonly id: string }
  | { readonly type: 'select-point'; readonly id: string | null }
  | { readonly type: 'add-jump'; readonly from: string; readonly to: string }
  | { readonly type: 'clear-jumps' }
  | { readonly type: 'select-card'; readonly card: string | null }
  | { readonly type: 'set-cursor'; readonly value: string }
  | { readonly type: 'set-card-cursor'; readonly value: string }
  | { readonly type: 'place-card'; readonly card: string; readonly value: string }
  | { readonly type: 'zoom'; readonly level: number; readonly center: string }
  | { readonly type: 'pan'; readonly delta: string }
  | { readonly type: 'set-linked'; readonly value: string }
  // skip-count · log-zoom 뛰어 세기
  | { readonly type: 'choose-step'; readonly row: number; readonly step: string }
  | { readonly type: 'hop'; readonly row: number }
  | { readonly type: 'unhop'; readonly row: number }
  | { readonly type: 'clear-hops'; readonly row: number }
  // rounding
  | { readonly type: 'round'; readonly item: number; readonly method: RoundingMethod }
  | { readonly type: 'move-marker'; readonly item: number; readonly value: string }
  | { readonly type: 'select-item'; readonly item: number }
  | { readonly type: 'clear-marker'; readonly item: number }
  // log-zoom
  | { readonly type: 'log-zoom'; readonly level: number }
  // double
  | { readonly type: 'select-pair'; readonly index: number }
  | { readonly type: 'scale-pair'; readonly kind: DoubleOpKind; readonly factor: number }
  | { readonly type: 'remove-pair' }
  // T080 integer 개구리 점프
  | { readonly type: 'frog-jump'; readonly size: string }
  | { readonly type: 'frog-undo' }
  | { readonly type: 'frog-reset' };

export const LOGICAL_WIDTH = 1000;
export const LOGICAL_HEIGHT = 600;

/** 수직선이 그려지는 가로 범위(논리 좌표). */
export const LINE_LEFT = 100;
export const LINE_RIGHT = 900;
