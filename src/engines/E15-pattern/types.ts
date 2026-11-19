/** E15 규칙·패턴의 설정·상태·Action 타입. 모드별 판별 유니온이다. */
import type { ChartRange, ChartView } from './chart';

export type PatternMode = 'sequence' | 'hundred-chart' | 'calc-pattern' | 'growth';

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

export type PatternConfig = SequenceConfig | ChartConfig | CalcPatternConfig | GrowthConfig;

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

export type PatternState = SequenceState | ChartState | CalcState | GrowthState;

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

export type PatternAction = SequenceAction | ChartAction | CalcAction | GrowthAction;

export function chartRangeOf(settings: ChartSettings): ChartRange {
  return { from: settings.from, count: settings.count };
}
