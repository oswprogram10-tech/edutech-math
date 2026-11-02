/**
 * E03 수직선의 설정·상태·Action 타입.
 *
 * 수의 값(위치·눈금·점프 크기)은 모두 `core/math`의 `Rational`로 계산하고,
 * 상태·Observation·Action에는 `toJSON()` 문자열(`"3/4"`, `"11/4"`)로 넣는다.
 * 화면 좌표만 number다(T011 구현 결정 2).
 */
export type NumberLineMode = 'integer' | 'fraction' | 'decimal';

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
  readonly min?: string;
  readonly max?: string;
  /** fraction에서 1을 몇 등분할지. 배열이면 눈금 줄을 여러 개 그린다. */
  readonly subdivisions?: number | readonly number[];
  /** 한 단위. integer의 눈금 크기, fraction의 분자 단위. 기본 "1". */
  readonly unit?: string;
  readonly zoom?: NumberLineZoomConfig;
  /** 끌어서 꽂는 카드 값 목록. 대분수 `"1 1/4"` 허용. */
  readonly cards?: readonly string[];
  readonly snap?: 'tick';
  /** 두 값이 같은 점인지 세로 레이저로 보여 줄지(정답 표시 아님). */
  readonly laser?: boolean;
  readonly showJumps?: boolean;
  readonly labels?: 'all' | 'partial' | 'none';
  readonly character?: string;
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
  | { readonly type: 'set-linked'; readonly value: string };

export const LOGICAL_WIDTH = 1000;
export const LOGICAL_HEIGHT = 600;

/** 수직선이 그려지는 가로 범위(논리 좌표). */
export const LINE_LEFT = 100;
export const LINE_RIGHT = 900;
