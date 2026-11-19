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

export type GraphMode =
  'table-to-graph' | 'scale' | 'pictograph' | 'class-vote' | 'line-graph' | 'band-circle';

export type TableSource = 'given' | 'student' | 'hidden';
export type GraphSource = 'given' | 'student' | 'none';
export type GraphType = 'o-mark' | 'bar';
export type Orientation = 'vertical' | 'horizontal';
export type TooltipSetting = 'auto' | 'show' | 'hide';
export type GraphView = 'table' | 'graph' | 'pictograph';
export type IconKind = 'apple' | 'person' | 'box' | 'star';
export type LegendChange = 'keep-icons' | 'recalculate';
export type BuildSource = 'student' | 'given';

/** 두 모드가 같이 쓰는 설정. 받기만 하고 무시하는 키는 마지막에 모았다. */
interface GraphConfigBase {
  /** 범주 이름 → 값. 범주 순서는 JSON 키 순서. */
  readonly data?: Readonly<Record<string, unknown>> | readonly unknown[];
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
  // T156: 그림그래프(pictograph)와 학급 투표(class-vote).
  readonly icon?: IconKind;
  readonly legend?: { readonly big?: unknown; readonly small?: unknown };
  readonly legendEditable?: boolean;
  readonly legendOptions?: readonly unknown[];
  readonly legendChange?: LegendChange;
  readonly build?: BuildSource;
  /** 명세 키. `legend.big`과 같고 둘 다 오면 `legend`가 이긴다. */
  readonly compressGroup?: number;
  readonly question?: string;
  readonly options?: readonly unknown[];
  readonly transport?: string;
  /** T161: 학생이 하나 고르는 자료 묶음. 있으면 `data`·축 제목·`valueLabel`은 고른 묶음 것을 쓴다. */
  readonly datasets?: readonly unknown[];
  /** T163: 꺾은선그래프(line-graph). 세로 값은 문자열(소수·분수)로 받는다. */
  readonly points?: readonly unknown[];
  readonly yStep?: unknown;
  readonly yMax?: unknown;
  readonly plotStep?: unknown;
  readonly yFrom?: unknown;
  readonly yFromOptions?: readonly unknown[];
  readonly connect?: LineConnect;
  readonly predict?: boolean;
  /** T166: 띠·원그래프(band-circle). */
  readonly percentEntry?: PercentEntry;
  /** 명세 키. `percentEntry: 'student'`와 같고 둘 다 오면 `percentEntry`가 이긴다. */
  readonly requirePercentEntry?: boolean;
  readonly band?: BandSource;
  readonly morph?: MorphSetting;
  readonly startAs?: 'band' | 'circle';
  readonly sliceLabels?: SliceLabels;
  readonly compare?: { readonly title?: unknown; readonly data?: unknown };
  /** compare가 있을 때 주 원그래프 위의 이름. 없으면 `title`. */
  readonly circleTitle?: string;
}

export interface TableToGraphConfig extends GraphConfigBase {
  readonly mode?: 'table-to-graph';
}

export interface ScaleConfig extends GraphConfigBase {
  readonly mode?: 'scale';
}

export interface PictographConfig extends GraphConfigBase {
  readonly mode?: 'pictograph';
}

export interface ClassVoteConfig extends GraphConfigBase {
  readonly mode?: 'class-vote';
}

export interface LineGraphConfig extends GraphConfigBase {
  readonly mode?: 'line-graph';
}

export interface BandCircleConfig extends GraphConfigBase {
  readonly mode?: 'band-circle';
}

export type GraphConfig =
  | TableToGraphConfig
  | ScaleConfig
  | PictographConfig
  | ClassVoteConfig
  | LineGraphConfig
  | BandCircleConfig;

export type PercentEntry = 'student' | 'given' | 'hidden';
export type BandSource = 'auto' | 'student' | 'given';
export type MorphSetting = 'drag' | 'button' | 'none';
export type SliceLabels = 'name' | 'name-percent';

export type LineConnect = 'auto' | 'student';
export type LinePhase = 'predict' | 'actual';

/**
 * 꺾은선그래프 설정(정규화). 세로 값은 모두 `Rational.toJSON()` 문자열이다.
 * 가로축 이름 `xs[i]`의 자료 값이 `values[i]`다.
 */
export interface LineSettings {
  readonly xs: readonly string[];
  readonly values: readonly string[];
  readonly yStep: string;
  readonly yMax: string;
  readonly plotStep: string;
  /** 처음 세로축 시작값. */
  readonly yFrom: string;
  /** 물결선 고르기 줄에 보일 시작값(정렬·중복 없음). 비면 줄이 없다. */
  readonly yFromOptions: readonly string[];
  readonly connect: LineConnect;
  readonly predict: boolean;
}

/** 전체 수가 다른 두 번째 원그래프(읽기 전용). */
export interface CompareSettings {
  readonly title: string;
  readonly categories: readonly string[];
  readonly data: Readonly<Record<string, number>>;
  readonly total: number;
}

/**
 * 띠·원그래프(band-circle) 설정(정규화).
 * `truePercents`는 개수 × 100 / 전체의 `Rational.toJSON()` 문자열이다.
 */
export interface BandCircleSettings {
  readonly percentEntry: PercentEntry;
  readonly band: BandSource;
  readonly morph: MorphSetting;
  readonly startAs: 'band' | 'circle';
  readonly sliceLabels: SliceLabels;
  /** 주 원그래프 위에 쓰는 이름(`circleTitle`, 없으면 `title`). */
  readonly circleTitle: string;
  readonly compare: CompareSettings | null;
  readonly total: number;
  readonly truePercents: Readonly<Record<string, string>>;
}

/** 정규화한 자료 묶음. 빠진 글은 설정 맨 위 키로 채운다. */
export interface DatasetOption {
  readonly id: string;
  readonly title: string;
  readonly categories: readonly string[];
  readonly data: Readonly<Record<string, number>>;
  readonly valueLabel: string;
  readonly categoryAxisTitle: string;
  readonly valueAxisTitle: string;
  readonly source: string;
}

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
  /** 그림그래프를 그리는가: `pictograph` 모드이거나 `table-to-graph`의 `views`에 'pictograph'가 있다. */
  readonly showPictograph: boolean;
  readonly icon: IconKind;
  /** 큰 그림 하나가 나타내는 수(≥2). 작은 그림은 늘 1이다. */
  readonly legendBig: number;
  readonly legendEditable: boolean;
  readonly legendOptions: readonly number[];
  readonly legendChange: LegendChange;
  readonly build: BuildSource;
  readonly question: string;
  /** 고를 수 있는 자료 묶음(T161). 없으면 빈 배열. */
  readonly datasets: readonly DatasetOption[];
  /** 지금 고른 묶음의 출처 글. 안 골랐거나 없으면 빈 문자열. */
  readonly source: string;
  /** line-graph 모드의 설정. 다른 모드는 null. */
  readonly line: LineSettings | null;
  /** band-circle 모드의 설정. 다른 모드는 null. */
  readonly bandCircle: BandCircleSettings | null;
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
  /** 고른 자료 묶음 id. 묶음이 없거나 아직 안 골랐으면 null. */
  readonly datasetId: string | null;
}

export interface TableToGraphState extends GraphStateBase {
  readonly mode: 'table-to-graph';
}

export interface ScaleState extends GraphStateBase {
  readonly mode: 'scale';
}

export interface PictographRow {
  readonly big: number;
  readonly small: number;
}

export interface PictographState extends GraphStateBase {
  readonly mode: 'pictograph';
  /** 행(범주)마다 놓인 큰·작은 그림 수. */
  readonly rows: Readonly<Record<string, PictographRow>>;
  readonly legendBig: number;
  /** 묶은 횟수, 펼친 횟수(누적). */
  readonly compressions: number;
  readonly expansions: number;
}

export interface ClassVoteState extends GraphStateBase {
  readonly mode: 'class-vote';
  /** 누른 순서대로 선택지. */
  readonly votes: readonly string[];
}

export interface LineGraphState extends GraphStateBase {
  readonly mode: 'line-graph';
  /** 가로축 이름 → 학생이 찍은 점의 값(`Rational` 문자열). 없으면 null. */
  readonly points: Readonly<Record<string, string | null>>;
  /** 이은 선분: 가로축 인덱스 쌍(작은 쪽이 앞). */
  readonly segments: readonly (readonly [number, number])[];
  /** 지금 세로축 시작값. */
  readonly yFrom: string;
  readonly phase: LinePhase;
  /** 예측 점. */
  readonly prediction: Readonly<Record<string, string | null>>;
}

export interface BandCircleState extends GraphStateBase {
  readonly mode: 'band-circle';
  /** 범주 → 학생(또는 주어진) 백분율(0~100 정수). 아직 안 썼으면 null. */
  readonly percents: Readonly<Record<string, number | null>>;
  /** 범주 → 학생이 정한 띠 칸 수(0~100 정수). `band: 'student'`일 때만 쓴다. */
  readonly bandCells: Readonly<Record<string, number | null>>;
  /** 말기 정도 0(곧은 띠)~100(원그래프). 화면 애니메이션 값이라 정수다. */
  readonly curl: number;
}

export type GraphState =
  | TableToGraphState
  | ScaleState
  | PictographState
  | ClassVoteState
  | LineGraphState
  | BandCircleState;

export type GraphAction =
  | { readonly type: 'set-table'; readonly cat: string; readonly value: number | null }
  | { readonly type: 'toggle-tally'; readonly index: number }
  | { readonly type: 'toggle-mark'; readonly cat: string; readonly cell: number }
  | { readonly type: 'set-bar'; readonly cat: string; readonly cells: number }
  | { readonly type: 'set-scale'; readonly scale: number }
  | { readonly type: 'flip' }
  | { readonly type: 'reset-graph' }
  | { readonly type: 'add-small'; readonly cat: string }
  | { readonly type: 'remove-small'; readonly cat: string }
  | { readonly type: 'remove-big'; readonly cat: string }
  | { readonly type: 'compress'; readonly cat: string }
  | { readonly type: 'expand'; readonly cat: string }
  | { readonly type: 'set-legend'; readonly big: number }
  | { readonly type: 'reset-rows' }
  | { readonly type: 'vote'; readonly option: string }
  | { readonly type: 'undo-vote' }
  | { readonly type: 'reset-votes' }
  | { readonly type: 'pick-dataset'; readonly id: string }
  | { readonly type: 'set-point'; readonly x: string; readonly y: string }
  | { readonly type: 'clear-point'; readonly x: string }
  | { readonly type: 'connect'; readonly a: number; readonly b: number }
  | { readonly type: 'disconnect'; readonly a: number; readonly b: number }
  | { readonly type: 'set-y-from'; readonly value: string }
  | { readonly type: 'finish-predict' }
  | { readonly type: 'set-percent'; readonly cat: string; readonly value: number | null }
  | { readonly type: 'set-band'; readonly cat: string; readonly cells: number }
  | { readonly type: 'set-curl'; readonly value: number };

export const DEFAULT_SCALE_OPTIONS: readonly number[] = [1, 2, 5, 10];

export const DEFAULT_LEGEND_OPTIONS: readonly number[] = [10, 5];
export const DEFAULT_LEGEND_BIG = 10;
export const DEFAULT_VOTE_AXIS_MAX = 10;
