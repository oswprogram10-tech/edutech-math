/** E15 규칙·패턴의 설정·상태·Action 타입. 모드별 판별 유니온이다. */
import type { ChartRange, ChartView } from './chart';

export type PatternMode = 'sequence' | 'hundred-chart' | 'calc-pattern' | 'growth' | 'gears';

export type SequenceVariant = 'extend' | 'translate';
export type Look = 'color' | 'plain' | 'symbol';

export interface SequenceConfig {
  mode: 'sequence';
  variant?: SequenceVariant;
  items?: string[];
  given?: string[];
  blanks?: number;
  givenDisplay?: 'show' | 'sound-only';
  look?: Look;
  symbols?: Record<string, string>;
  mapping?: { sound?: 'pentatonic' | 'none'; motion?: boolean };
  notes?: Record<string, number>;
  source?: string[];
  repeat?: number;
  targetAlphabet?: string[];
}

export interface ChartConfig {
  mode: 'hundred-chart';
  range?: [number, number];
  hidden?: number[] | 'cross' | { random: number; seed?: number; within?: [number, number] };
  center?: number;
  view?: ChartView;
  focus?: number;
  select?: boolean;
  paint?: boolean;
  prepainted?: number[];
  revealOnAnswer?: boolean;
}

export type CalcPatternName = 'symmetric-sum-square' | 'repunit-square';
export type CalcLook = 'blocks' | 'picture' | 'none';

export interface CalcPatternConfig {
  mode: 'calc-pattern';
  pattern: CalcPatternName;
  /** 보여 줄 단계 수(기본 3), 1~8. */
  stepsShown?: number;
  /** 학생이 쌓고 식을 쓸 단계(기본 stepsShown + 1), 1~9. */
  workStep?: number;
  /** 블록 쌓기 칸(기본: symmetric은 true, repunit은 false). repunit에서 true면 무시한다. */
  build?: boolean;
  /** 식 쓰기 칸(기본 true). */
  expression?: boolean;
  /** 열 ↔ 식의 수 강조(기본 true, symmetric만). */
  linkHighlight?: boolean;
  /** CPA: 쌓기(C) / 그림만(P, 쌓기 꺼짐) / 식만(A, 블록 그림 없음). */
  look?: CalcLook;
}

export type GrowthShape = 'L' | 'stairs' | 'tower2';
export type GrowthLook = 'cubes' | 'flat' | 'none';

export interface GrowthConfig {
  mode: 'growth';
  /** 쌓기나무 모양(기본 'L'). */
  shape?: GrowthShape;
  /** 그림으로 보여 줄 단계(기본 3), 1~5. */
  stepsShown?: number;
  /** 늘어난 쌓기나무 강조(기본 true). */
  highlightIncrement?: boolean;
  /** 표 설정. false면 표 없음. */
  table?:
    | {
        /** 표 마지막 단계(기본 stepsShown + 2), stepsShown~8. */
        upTo?: number;
        /** 보여 준 단계의 개수 칸(기본 'given'). */
        counts?: 'given' | 'blank';
        /** 늘어난 수 줄(기본 'blank'). */
        increments?: 'blank' | 'off';
      }
    | false;
  /** CPA: 입체 그림(C) / 색칸 그림(P) / 그림 없음(A, 표만). */
  look?: GrowthLook;
}

/** calc-pattern 표 변형(덧셈표·곱셈표 돋보기 탐정). `table` 키가 있으면 표 변형이다. */
export interface CalcTableConfig {
  mode: 'calc-pattern';
  table: 'addition' | 'multiplication';
  /** 몸통 [행, 열](기본 [6, 6]), 각 2~9. */
  size?: [number, number];
  /** 머리 첫 수(기본 1), 0~9. 머리는 start, start+1, …. */
  start?: number;
  /** 가린 몸통 칸 [행, 열](0부터). 'most'(기본) = 첫 몸통 행·첫 몸통 열 말고 모두. */
  hidden?: 'most' | [number, number][];
  /** 돋보기 횟수 0~5(기본 0 = 돋보기 없음). */
  magnifierUses?: number;
  /** 규칙 화살표 그리기(기본 false). */
  drawArrows?: boolean;
}

/** 맞물려 도는 톱니바퀴(g5s1u2.A2). 두 바퀴의 표시 톱니가 다시 만나는 때를 살핀다. */
export interface GearsConfig {
  mode: 'gears';
  /** 왼쪽 바퀴 톱니 수. 3~12, 기본 4. */
  teethA?: number;
  /** 오른쪽 바퀴 톱니 수. 3~12, 기본 6. */
  teethB?: number;
  /** 돌릴 수 있는 최대 칸. 12~120, 기본 60. */
  maxSteps?: number;
  /** true면 돌리기 전에 예측을 정해야 한다. */
  predict?: boolean;
  /** 바퀴 수 표시(기본 true). */
  showLaps?: boolean;
}

export type PatternConfig =
  SequenceConfig | ChartConfig | CalcPatternConfig | CalcTableConfig | GrowthConfig | GearsConfig;

/** 정규화한 sequence 설정(상태 안에 둔다. reduce가 config를 받지 않기 때문이다). */
export interface SequenceSettings {
  variant: SequenceVariant;
  /** 학생이 고르는 팔레트(extend는 items, translate는 targetAlphabet). */
  palette: string[];
  /** 위(주어진) 줄. extend는 given, translate는 source를 repeat번 이은 것. */
  given: string[];
  blanks: number;
  givenDisplay: 'show' | 'sound-only';
  look: Look;
  symbols: Record<string, string>;
  sound: 'pentatonic' | 'none';
  motion: boolean;
  notes: Record<string, number>;
  /** 동작 캐릭터가 토큰 → 자세를 찾을 때 쓰는 순서(items). */
  items: string[];
  source: string[];
  repeat: number;
}

export interface SequenceState {
  mode: 'sequence';
  settings: SequenceSettings;
  slots: (string | null)[];
  cursor: number;
  sent: boolean;
}

export interface ChartSettings {
  from: number;
  count: number;
  view: ChartView;
  focus: number;
  center: number;
  select: boolean;
  paint: boolean;
  prepainted: number[];
  seed: number;
}

export interface ChartState {
  mode: 'hundred-chart';
  settings: ChartSettings;
  hidden: number[];
  entries: Record<string, string>;
  selected: number | null;
  painted: number[];
  active: number | null;
}

/** 정규화한 calc-pattern 설정. `error`가 있으면 설정 오류 판을 그린다. */
export interface CalcSettings {
  pattern: CalcPatternName;
  stepsShown: number;
  workStep: number;
  /** 쌓기 칸을 실제로 그리는지(pattern·look·build를 합친 값). */
  build: boolean;
  expression: boolean;
  linkHighlight: boolean;
  look: CalcLook;
  error: string | null;
}

export interface CalcState {
  mode: 'calc-pattern';
  /** 피라미드에는 없다(없으면 피라미드). 표 변형 상태와 구분하는 자리만 비워 둔다. */
  variant?: undefined;
  settings: CalcSettings;
  /** 학생이 쌓은 열 높이. 길이 `2 × workStep + 1`, 처음엔 모두 0. */
  heights: number[];
  /** 키보드 커서. h는 1부터(아래 칸이 1). */
  cursor: { col: number; h: number };
  exprText: string;
  focus: 'build' | 'expr';
  /** 열 ↔ 식의 수 강조. 판정에는 쓰지 않는다. */
  link: { step: number; col: number } | null;
}

export type TableKind = 'addition' | 'multiplication';
export type TableTool = 'write' | 'magnifier' | 'arrow';
export type TableDir = 'right' | 'down' | 'down-right' | 'down-left';

/** 정규화한 표 변형 설정. `error`가 있으면 설정 오류 판을 그린다. */
export interface CalcTableSettings {
  table: TableKind;
  rows: number;
  cols: number;
  start: number;
  /** 가린 몸통 칸 키(`"r.c"`), 행·열 순서로 정렬. */
  hidden: string[];
  magnifierUses: number;
  drawArrows: boolean;
  error: string | null;
}

export interface TableArrow {
  from: string;
  dir: TableDir;
  /** 증가량(숫자 글자, 최대 3자리). */
  amount: string;
}

export interface TableDraftArrow {
  from: string;
  dir: TableDir | null;
  amount: string;
}

export interface CalcTableState {
  mode: 'calc-pattern';
  variant: 'table';
  settings: CalcTableSettings;
  /** 학생이 쓴 수. 키는 가린 칸 `"r.c"`. */
  entries: Record<string, string>;
  /** 돋보기로 연 칸 키. */
  revealed: string[];
  /** 고른 칸. */
  active: string | null;
  tool: TableTool;
  arrows: TableArrow[];
  draftArrow: TableDraftArrow | null;
}

/** 정규화한 growth 설정. */
export interface GrowthSettings {
  shape: GrowthShape;
  stepsShown: number;
  highlightIncrement: boolean;
  /** 표가 없으면 null. */
  table: { upTo: number; counts: 'given' | 'blank'; increments: 'blank' | 'off' } | null;
  look: GrowthLook;
}

export interface GrowthState {
  mode: 'growth';
  settings: GrowthSettings;
  /** 키는 `"<단계>.count"`·`"<단계>.inc"`. 값은 숫자 글자(최대 3자리). */
  cells: Record<string, string>;
  active: string | null;
}

export interface GearsSettings {
  teethA: number;
  teethB: number;
  maxSteps: number;
  predict: boolean;
  showLaps: boolean;
}

export interface GearsState {
  mode: 'gears';
  settings: GearsSettings;
  /** 돌린 톱니 칸 수(0 이상 정수). */
  steps: number;
  /** 지금까지 가 본 가장 먼 칸. */
  maxReached: number;
  /** 지나간 맞닿은 칸 수(오름차순, 0 제외). 되돌려도 지우지 않는다. */
  meetings: number[];
  /** 쓰고 있는 예측(숫자 글자, 최대 3자리). */
  predictionDraft: string;
  /** 정한 예측. 정하면 바꿀 수 없다. */
  prediction: string | null;
}

export type PatternState =
  SequenceState | ChartState | CalcState | CalcTableState | GrowthState | GearsState;

export type SequenceAction =
  | { type: 'place'; slot: number; token: string }
  | { type: 'clear-slot'; slot: number }
  | { type: 'move-cursor'; slot: number }
  | { type: 'clear-all' }
  | { type: 'send' }
  /** 재생은 상태가 아니다. 이 Action은 상태를 바꾸지 않고 `pattern-played` 이벤트만 낸다. */
  | { type: 'play' };

export type ChartAction =
  | { type: 'activate'; cell: number }
  | { type: 'deactivate' }
  | { type: 'type-digit'; digit: string }
  | { type: 'backspace' }
  | { type: 'clear-entry' }
  | { type: 'select-cell'; cell: number }
  | { type: 'toggle-paint'; cell: number };

export type CalcAction =
  | { type: 'tap-cell'; col: number; h: number }
  | { type: 'clear-build' }
  | { type: 'move-cursor'; dx: number; dy: number }
  | { type: 'toggle-at-cursor' }
  | { type: 'type'; key: string }
  | { type: 'backspace' }
  | { type: 'clear-expr' }
  | { type: 'set-focus'; focus: 'build' | 'expr' }
  /** `step: null`이면 강조를 거둔다. */
  | { type: 'link'; step: number; col: number }
  | { type: 'link'; step: null; col?: null };

export type GrowthDir = 'left' | 'right' | 'up' | 'down';

export type GrowthAction =
  | { type: 'activate'; cell: string }
  | { type: 'type'; key: string }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'move'; dir: GrowthDir };

export type CalcTableAction =
  | { type: 'set-tool'; tool: TableTool }
  | { type: 'activate'; cell: string }
  | { type: 'type'; key: string }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'move'; dir: GrowthDir }
  | { type: 'peek'; cell: string }
  | { type: 'arrow-start'; cell: string }
  | { type: 'arrow-dir'; dir: TableDir }
  | { type: 'arrow-type'; key: string }
  | { type: 'arrow-backspace' }
  | { type: 'arrow-commit' }
  | { type: 'arrow-remove'; index: number };

export type GearsAction =
  | { type: 'turn'; by: 1 | -1 }
  | { type: 'turn-to'; steps: number }
  | { type: 'reset' }
  | { type: 'predict-type'; key: string }
  | { type: 'predict-backspace' }
  | { type: 'predict-lock' };

export type PatternAction =
  SequenceAction | ChartAction | CalcAction | CalcTableAction | GrowthAction | GearsAction;

export function chartRangeOf(settings: ChartSettings): ChartRange {
  return { from: settings.from, count: settings.count };
}
