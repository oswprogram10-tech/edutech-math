/**
 * E18 그래프 스튜디오의 설정·상태·Action 타입.
 *
 * `mode`로 나뉘는 판별 유니온이다(T156이 `pictograph`·`class-vote` 등을 더하기 쉽게).
 * 이 카드의 자료 값은 0 이상 100 이하 정수(개수)이고, 눈금 `scale`은 양의 정수다.
 * 수학 값은 정수(number)만 쓴다. 화면 좌표만 실수다.
 */

export const LOGICAL_WIDTH = 1000;
export const LOGICAL_HEIGHT = 700;

export const DATA_MAX = 100;

export type GraphMode = 'table-to-graph' | 'scale';

export type TableSource = 'given' | 'student' | 'hidden';
export type GraphSource = 'given' | 'student' | 'none';
export type GraphType = 'o-mark' | 'bar';
export type Orientation = 'vertical' | 'horizontal';
export type TooltipSetting = 'auto' | 'show' | 'hide';
export type GraphView = 'table' | 'graph';

/** 두 모드가 같이 쓰는 설정. 받기만 하고 무시하는 키는 마지막에 모았다. */
interface GraphConfigBase {
  /** 범주 이름 → 값. 범주 순서는 JSON 키 순서. */
  readonly data?: Readonly<Record<string, unknown>>;
  /** `data`가 없을 때 쓰는 범주 목록. */
  readonly categories?: readonly unknown[];
  /** 셀 자료 낱개. 각 값은 범주 이름. 있으면 자료 카드 줄을 보인다. */
  readonly rawItems?: readonly unknown[];
  readonly table?: TableSource;
  readonly graph?: GraphSource;
  readonly graphType?: GraphType;
  readonly orientation?: Orientation;
  readonly orientationFlip?: boolean;
  readonly scale?: number;
  readonly scaleOptions?: readonly unknown[];
  readonly axisMax?: number;
  readonly valueLabel?: string;
  readonly categoryAxisTitle?: string;
  readonly valueAxisTitle?: string;
  readonly title?: string;
  readonly tooltips?: TooltipSetting;
  readonly views?: readonly unknown[];
  // 명세 설정 별칭: 받기만 한다.
  readonly studentDraw?: boolean;
  readonly showTable?: string;
  readonly stackFrom?: unknown;
  // 콘텐츠 카드에서 정하므로 무시한다.
  readonly selfTiming?: unknown;
  readonly questionSet?: unknown;
  readonly dataset?: unknown;
}

export interface TableToGraphConfig extends GraphConfigBase {
  readonly mode?: 'table-to-graph';
}

export interface ScaleConfig extends GraphConfigBase {
  readonly mode?: 'scale';
}

export type GraphConfig = TableToGraphConfig | ScaleConfig;

/** 정규화한 설정. 상태에 복사해 두어 reduce가 config 없이 쓴다. */
export interface GraphSettings {
  readonly categories: readonly string[];
  /** 정규화한(0~100 정수) 자료. 없으면 null. */
  readonly data: Readonly<Record<string, number>> | null;
  readonly rawItems: readonly string[];
  readonly table: TableSource;
  readonly graph: GraphSource;
  readonly graphType: GraphType;
  readonly orientation: Orientation;
  readonly orientationFlip: boolean;
  readonly scale: number;
  readonly scaleOptions: readonly number[];
  readonly axisMax: number | null;
  readonly valueLabel: string;
  readonly categoryAxisTitle: string;
  readonly valueAxisTitle: string;
  readonly title: string;
  readonly tooltips: TooltipSetting;
  readonly showTable: boolean;
  readonly showGraph: boolean;
}

interface GraphStateBase {
  readonly settings: GraphSettings;
  /** 범주 → 표 값. 학생이 아직 안 넣었으면 null. */
  readonly table: Readonly<Record<string, number | null>>;
  /** 센 자료 카드 번호(정렬). */
  readonly tallied: readonly number[];
  /** ○ 그래프에서 채운 칸 번호(정렬). 0은 축에 붙은 칸. */
  readonly marks: Readonly<Record<string, readonly number[]>>;
  /** 막대 칸 수. */
  readonly bars: Readonly<Record<string, number>>;
  readonly scale: number;
  readonly orientation: Orientation;
}

export interface TableToGraphState extends GraphStateBase {
  readonly mode: 'table-to-graph';
}

export interface ScaleState extends GraphStateBase {
  readonly mode: 'scale';
}

export type GraphState = TableToGraphState | ScaleState;

export type GraphAction =
  | { readonly type: 'set-table'; readonly cat: string; readonly value: number | null }
  | { readonly type: 'toggle-tally'; readonly index: number }
  | { readonly type: 'toggle-mark'; readonly cat: string; readonly cell: number }
  | { readonly type: 'set-bar'; readonly cat: string; readonly cells: number }
  | { readonly type: 'set-scale'; readonly scale: number }
  | { readonly type: 'flip' }
  | { readonly type: 'reset-graph' };

export const DEFAULT_SCALE_OPTIONS: readonly number[] = [1, 2, 5, 10];
