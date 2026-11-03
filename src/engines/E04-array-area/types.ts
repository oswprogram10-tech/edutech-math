/**
 * E04 배열·넓이 모델의 설정·상태·Action 타입.
 *
 * 행·열·넓이는 정수(number)다. 분수·소수 넓이는 T045에서 `Rational`로 들어온다
 * (카드 결정 2) — 넓이 계산은 `area.ts`에 모아 둔다.
 * 좌표는 논리 좌표(1000×600) 정수만 상태에 둔다.
 */

export type ArrayMode = 'dot-array' | 'split' | 'area-model' | 'times-table';

export type ArrayIcon = 'dot' | 'tree' | 'candy' | 'strawberry';

export type SentenceMode = 'none' | 'dims';

export type FactHide = 'product' | 'rows' | 'cols' | null;

export type PartialDisplay = 'color' | 'dims' | 'none';

/** `rows`는 가로로 긋는 선(줄을 나눔), `cols`는 세로로 긋는 선(칸을 나눔). */
export type SplitOrientation = 'rows' | 'cols';

export type SideSplit = 'free' | 'place-value' | 'none';

export type GridDisplay = 'always' | 'C-only' | 'never';

export type TablePrefill = 'none' | 'rows-2-5';

/** 부분곱 색·무늬. E07은 이 값을 복사해 같은 순서를 쓴다(import 금지). */
export const PARTIAL_PALETTE = [
  { fill: '#dbe7ff', ink: '#1d4fa8', pattern: 'right' },
  { fill: '#e2f3e5', ink: '#215c2a', pattern: 'left' },
  { fill: '#fdeedd', ink: '#8a4b00', pattern: 'dots' },
  { fill: '#efe4fb', ink: '#3f2a7a', pattern: 'cross' },
] as const;

export interface Split {
  readonly orientation: SplitOrientation;
  readonly at: number;
}

export interface Arrangement {
  readonly rows: number;
  readonly cols: number;
}

export interface TableNumberCell {
  readonly r: number;
  readonly c: number;
  readonly value: number;
}

export interface SplitLine {
  readonly orientation: SplitOrientation;
  readonly at: number;
}

export interface ArrayAreaConfig {
  /** 없으면 설정 키를 보고 모드를 고른다. */
  readonly mode?: ArrayMode;

  // ── dot-array ─────────────────────────────────────────────
  readonly rows?: number;
  readonly cols?: number;
  readonly maxRows?: number;
  readonly maxCols?: number;
  readonly icon?: ArrayIcon;
  readonly rotate?: boolean;
  readonly showSentence?: SentenceMode;
  readonly factFamily?: boolean;
  readonly factHide?: FactHide;
  readonly showSplitLines?: boolean;

  // ── split ─────────────────────────────────────────────────
  readonly maxSplits?: number;
  readonly orientation?: SplitOrientation | 'either';
  /** 약한 자석 위치. 예: `[5]`. */
  readonly snapHints?: readonly number[];
  readonly showPartials?: PartialDisplay;
  readonly allowExtend?: boolean;

  // ── area-model ────────────────────────────────────────────
  readonly a?: number;
  readonly b?: number;
  readonly splitA?: SideSplit;
  readonly splitB?: SideSplit;
  readonly showGrid?: GridDisplay;

  // ── times-table ───────────────────────────────────────────
  readonly size?: readonly number[];
  readonly prefill?: TablePrefill | readonly TableNumberCell[];
  readonly symmetryReveal?: boolean;
  readonly colorSameValue?: boolean;
  readonly includeZero?: boolean;
}

/** reduce는 config를 받지 않으므로 필요한 설정을 복사해 둔다. */
export interface ArrayAreaSettings {
  readonly maxRows: number;
  readonly maxCols: number;
  readonly icon: ArrayIcon;
  readonly rotate: boolean;
  readonly showSentence: SentenceMode;
  readonly factFamily: boolean;
  readonly factHide: FactHide;
  readonly showSplitLines: boolean;

  readonly maxSplits: number;
  readonly orientation: SplitOrientation | 'either';
  readonly snapHints: readonly number[];
  readonly showPartials: PartialDisplay;
  readonly allowExtend: boolean;

  readonly a: number;
  readonly b: number;
  readonly splitA: SideSplit;
  readonly splitB: SideSplit;
  readonly showGrid: GridDisplay;

  readonly tableRows: number;
  readonly tableCols: number;
  readonly prefill: TablePrefill | readonly TableNumberCell[];
  readonly symmetryReveal: boolean;
  readonly colorSameValue: boolean;
  readonly includeZero: boolean;
}

export interface ArrayAreaState {
  readonly mode: ArrayMode;
  /** dot-array·split의 행·열. */
  readonly rows: number;
  readonly cols: number;
  /** dot-array에서 돌린 횟수. */
  readonly rotations: number;
  /** dot-array에서 기록한 배열(회전한 같은 배열도 하나로 센다). */
  readonly recorded: readonly Arrangement[];
  /** dot-array의 가로/세로 나누는 선(힌트용). */
  readonly splitLine: SplitLine | null;

  /** split의 분할선. */
  readonly splits: readonly Split[];
  readonly recordedSplits: readonly (readonly Split[])[];
  /** allowExtend: 배열 아래에 늘린(빼는) 줄 수. */
  readonly extendedRows: number;

  /** area-model 분할 위치(각 변 0과 끝 사이). */
  readonly areaSplitsA: readonly number[];
  readonly areaSplitsB: readonly number[];

  /** times-table: `"r,c"` → 학생이 쓴 값. */
  readonly cells: Readonly<Record<string, number>>;
  readonly painted: Readonly<Record<string, number>>;
  readonly selected: readonly string[];
  /** 대칭 반짝임 대상 칸. 값은 쓰지 않는다. */
  readonly flash: string | null;
  readonly folded: boolean;

  readonly settings: ArrayAreaSettings;
}

export type ArrayAreaAction =
  | { readonly type: 'resize'; readonly rows: number; readonly cols: number }
  | { readonly type: 'rotate' }
  | { readonly type: 'record-arrangement' }
  | { readonly type: 'set-split-line'; readonly orientation: SplitOrientation; readonly at: number }
  | { readonly type: 'place-split'; readonly orientation: SplitOrientation; readonly at: number }
  | { readonly type: 'remove-split'; readonly index: number }
  | { readonly type: 'extend'; readonly rows: number }
  | { readonly type: 'record-split' }
  | { readonly type: 'set-area-split'; readonly side: 'a' | 'b'; readonly at: number }
  | { readonly type: 'remove-area-split'; readonly side: 'a' | 'b'; readonly at: number }
  | {
      readonly type: 'set-cell';
      readonly r: number;
      readonly c: number;
      readonly value: number | null;
    }
  | { readonly type: 'select-cell'; readonly r: number; readonly c: number }
  | {
      readonly type: 'paint';
      readonly r: number;
      readonly c: number;
      readonly color: number | null;
    }
  | { readonly type: 'fold' };

export const LOGICAL_WIDTH = 1000;
export const LOGICAL_HEIGHT = 600;

/** 모눈을 그리는 최대 칸 수(카드 결정 5). */
export const GRID_LIMIT = 1200;

/** 분할선 최대 개수(T045 퍼즐 전까지). */
export const MAX_AREA_SPLITS = 3;
