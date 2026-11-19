/** E15 규칙·패턴의 설정·상태·Action 타입. 모드별 판별 유니온이다. */
import type { ChartRange, ChartView } from './chart';

export type PatternMode = 'sequence' | 'hundred-chart';

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

export type PatternConfig = SequenceConfig | ChartConfig;

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

export type PatternState = SequenceState | ChartState;

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

export type PatternAction = SequenceAction | ChartAction;

export function chartRangeOf(settings: ChartSettings): ChartRange {
  return { from: settings.from, count: settings.count };
}
