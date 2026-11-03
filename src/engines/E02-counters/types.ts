/**
 * E02 셈돌·텐프레임 엔진의 설정·상태·Action 타입.
 *
 * 개수는 0 이상의 정수(number)다. 분수·소수가 없으므로 Rational을 쓰지 않는다.
 * 셈돌 좌표는 논리 좌표(1000×600) 정수만 상태에 둔다.
 */
import type { Point } from '../../core/engine-sdk';

export type CounterMode =
  | 'summon'
  | 'ten-frame'
  | 'part-whole'
  | 'flash'
  | 'rekenrek'
  | 'pairing'
  | 'share'
  | 'measure-out';

export type CounterColor = 'red' | 'blue';

export type CounterIcon =
  'apple' | 'fish' | 'bird' | 'balloon' | 'candy' | 'strawberry' | 'star' | 'child' | 'dot';

export const COUNTER_ICONS: readonly CounterIcon[] = [
  'apple',
  'fish',
  'bird',
  'balloon',
  'candy',
  'strawberry',
  'star',
  'dot',
];

export type SummonInput = 'multitouch' | 'tap' | 'buttons';

export type ShowNumeral = 'never' | 'always';

/** part-whole 본 화면의 가르기 나무 표시. 기본은 구조만(`structure`). */
export type PartWholeBond = 'none' | 'structure' | 'numbers';

export interface CounterScene {
  readonly icon: CounterIcon;
  readonly kind: 'join' | 'remove' | 'compare';
  readonly numbers: readonly [number, number];
}

export interface CountersConfig {
  /** 모드. 없으면 설정 키를 보고 고른다. */
  readonly mode?: CounterMode;

  // ── summon ────────────────────────────────────────────────
  readonly max?: number;
  readonly shelf?: boolean;
  readonly input?: readonly SummonInput[];
  readonly icon?: CounterIcon;
  readonly start?: number;
  readonly showNumeral?: ShowNumeral;

  // ── ten-frame ─────────────────────────────────────────────
  readonly frames?: 1 | 2;
  readonly prefill?: number;
  readonly left?: number;
  readonly right?: number;
  readonly fillColor?: CounterColor;
  readonly trayCount?: number;
  readonly swipeFill?: boolean;
  /** ten-frame: `never` / `after-move`. part-whole: `none` / `structure` / `numbers`. */
  readonly showBond?: 'never' | 'after-move' | 'none' | 'structure' | 'numbers';
  readonly removable?: boolean;

  // ── part-whole ────────────────────────────────────────────
  readonly total?: number;
  /** part-whole은 접시별 개수 배열, share는 접시 수(number). */
  readonly groups?: readonly number[] | number;
  readonly parts?: number;
  readonly gesture?: readonly ('pinch' | 'drag' | 'divider-button')[];
  readonly scene?: CounterScene;
  /** part-whole 변형. 기본은 접시(`plates`). */
  readonly variant?: 'plates' | 'bubble-pairs' | 'bridge';

  // ── flash ─────────────────────────────────────────────────
  readonly count?: number;
  readonly range?: readonly [number, number];
  readonly layout?: 'dice' | 'ten-frame' | 'fingers' | 'random';
  readonly displayMs?: number;
  readonly seed?: number;

  // ── rekenrek ──────────────────────────────────────────────
  readonly rows?: number;
  /** 10으로 고정한다(다른 값은 무시). */
  readonly perRow?: number;
  readonly colorBreak?: number;
  readonly skipBy?: readonly number[];

  // ── pairing ───────────────────────────────────────────────
  readonly predictFirst?: boolean;
  readonly labels?: readonly [string, string];

  // ── measure-out ───────────────────────────────────────────
  readonly groupSize?: number;
  readonly groupSizeChoices?: readonly number[];
  readonly showRemainder?: boolean;
  readonly sentenceTemplate?: string;

  // ── bubble-pairs ──────────────────────────────────────────
  readonly target?: number;
  readonly bubbles?: readonly number[];
  readonly pickUpTo?: 2 | 3;
  readonly showSumOnMiss?: boolean;
  /** bubble-pairs는 `numeral`/`dots`, bridge는 `cells`/`numeral`. */
  readonly face?: 'numeral' | 'dots' | 'cells';

  // ── bridge ────────────────────────────────────────────────
  readonly gap?: number;
  readonly rods?: readonly number[];
  readonly maxRods?: number;
  readonly preset?: readonly number[];
  readonly presetLocked?: boolean;
  readonly tenMarker?: boolean;
  readonly noText?: boolean;
}

export interface SummonCounter {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly color: CounterColor;
}

export interface SummonState {
  readonly mode: 'summon';
  readonly counters: readonly SummonCounter[];
  /** 설정 `max`를 상태에도 둔다(reduce는 config를 받지 않는다). */
  readonly max: number;
  readonly nextId: number;
}

export interface FrameCounter {
  readonly id: string;
  readonly color: CounterColor;
  /** 놓인 프레임. 아직 상자에 있으면 null. */
  readonly frame: number | null;
  /** 프레임 안 칸(0~9). 상자에 있으면 null. */
  readonly cell: number | null;
  /** 상자 칸 번호. 미리 놓은 셈돌은 -1. */
  readonly tray: number;
}

export interface TenFrameState {
  readonly mode: 'ten-frame';
  readonly frames: number;
  readonly counters: readonly FrameCounter[];
  readonly swipeFill: boolean;
  readonly removable: boolean;
  readonly moves: number;
  readonly madeTenFirst: boolean;
  /** 빼기 순서. 처음 뺀 프레임이 가득 차 있었는지 기록한다. */
  readonly removals: readonly { readonly frame: number; readonly full: boolean }[];
  readonly bond: readonly [number, number, number] | null;
}

export interface PlateCounter {
  readonly id: string;
  readonly plate: number;
  readonly slot: number;
}

export interface PartWholeState {
  readonly mode: 'part-whole';
  readonly plates: number;
  readonly counters: readonly PlateCounter[];
  readonly recorded: readonly (readonly [number, number])[];
  readonly pairs: readonly (readonly [string, string])[];
  readonly nextId: number;
}

export type FlashPhase = 'ready' | 'showing' | 'hidden';

export interface FlashState {
  readonly mode: 'flash';
  readonly phase: FlashPhase;
  readonly chosen: number;
  readonly shown: number | null;
  readonly layout: 'dice' | 'ten-frame' | 'fingers' | 'random';
  readonly displayMs: number;
  readonly points: readonly Point[];
}

export interface RekenrekState {
  readonly mode: 'rekenrek';
  readonly rows: number;
  /** 줄마다 왼쪽으로 민 구슬 수. */
  readonly left: readonly number[];
  /** 밀기·되밀기 뒤마다의 전체 합. */
  readonly history: readonly number[];
  /** 처음 도달한 순서의 서로 다른 합. */
  readonly reached: readonly number[];
  readonly fullRowPushes: number;
  readonly moves: number;
}

export type PairingPhase = 'predict' | 'ready' | 'paired';

export interface PairingState {
  readonly mode: 'pairing';
  readonly count: number;
  readonly predictFirst: boolean;
  readonly phase: PairingPhase;
  /** labels 순서(0/1). 고르기 전에는 null. */
  readonly prediction: 0 | 1 | null;
}

export interface ShareState {
  readonly mode: 'share';
  readonly groups: number;
  readonly pile: number;
  readonly plates: readonly number[];
  readonly rounds: number;
}

export interface MeasureOutCounter {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** 봉지 번호. 아직 덜어 내지 않았으면 null. */
  readonly bag: number | null;
}

export interface MeasureOutAttempt {
  readonly count: number;
  readonly ok: boolean;
}

export interface MeasureOutState {
  readonly mode: 'measure-out';
  readonly groupSize: number | null;
  /** 학생이 고를 수 있는 묶음 크기(없으면 고정). */
  readonly choices: readonly number[];
  readonly counters: readonly MeasureOutCounter[];
  readonly bagCount: number;
  readonly lastAttempt: MeasureOutAttempt | null;
}

export interface Bubble {
  readonly id: string;
  readonly value: number;
  readonly popped: boolean;
}

export interface BubblePairsState {
  readonly mode: 'part-whole';
  readonly variant: 'bubble-pairs';
  readonly target: number;
  readonly pickUpTo: 2 | 3;
  readonly bubbles: readonly Bubble[];
  readonly selected: readonly string[];
  readonly lastMiss: { readonly ids: readonly string[]; readonly sum: number } | null;
  readonly pops: readonly (readonly number[])[];
  readonly streak: number;
  readonly bestStreak: number;
  readonly misses: number;
}

export interface BridgeState {
  readonly mode: 'part-whole';
  readonly variant: 'bridge';
  readonly gap: number;
  readonly rods: readonly number[];
  readonly maxRods: number;
  readonly presetCount: number;
  readonly presetLocked: boolean;
  readonly placed: readonly number[];
  readonly recorded: readonly (readonly number[])[];
}

export type CountersState =
  | SummonState
  | TenFrameState
  | PartWholeState
  | FlashState
  | RekenrekState
  | PairingState
  | ShareState
  | MeasureOutState
  | BubblePairsState
  | BridgeState;

export type CountersAction =
  // summon
  | { readonly type: 'summon'; readonly count: number }
  | { readonly type: 'remove'; readonly id: string }
  | { readonly type: 'move'; readonly id: string; readonly x: number; readonly y: number }
  // ten-frame
  | { readonly type: 'place'; readonly id: string; readonly frame: number; readonly cell: number }
  | { readonly type: 'take-out'; readonly id: string }
  | { readonly type: 'swipe-fill'; readonly from: number; readonly to: number }
  // part-whole
  | { readonly type: 'move-to-plate'; readonly id: string; readonly plate: number }
  | { readonly type: 'merge'; readonly from: number; readonly to: number }
  | { readonly type: 'set-split'; readonly plate: number; readonly left: number }
  | { readonly type: 'record-split' }
  | { readonly type: 'pair'; readonly a: string; readonly b: string }
  // flash
  | { readonly type: 'show' }
  | { readonly type: 'hide' }
  // rekenrek
  | { readonly type: 'push'; readonly row: number; readonly count: number }
  | { readonly type: 'pull'; readonly row: number; readonly count: number }
  // pairing
  | { readonly type: 'predict'; readonly choice: 0 | 1 }
  | { readonly type: 'make-pairs' }
  | { readonly type: 'reset-pairs' }
  // share
  | { readonly type: 'deal'; readonly plate: number }
  | { readonly type: 'take-back'; readonly plate: number }
  | { readonly type: 'deal-round' }
  // measure-out
  | { readonly type: 'choose-size'; readonly size: number }
  | { readonly type: 'bag'; readonly ids: readonly string[] }
  | { readonly type: 'bag-next' }
  | { readonly type: 'unbag'; readonly bag: number }
  // bubble-pairs
  | { readonly type: 'pick'; readonly id: string }
  | { readonly type: 'unpick'; readonly id: string }
  // bridge
  | { readonly type: 'place-rod'; readonly length: number }
  | { readonly type: 'remove-rod'; readonly index: number }
  | { readonly type: 'record-bridge' };

export const LOGICAL_WIDTH = 1000;
export const LOGICAL_HEIGHT = 600;

/** 텐프레임 한 칸의 논리 크기. */
export const FRAME_CELL = 64;
export const FRAME_GAP = 4;
export const FRAME_COLS = 5;
export const FRAME_ROWS = 2;
export const FRAME_WIDTH = FRAME_COLS * (FRAME_CELL + FRAME_GAP) - FRAME_GAP;
export const FRAME_HEIGHT = FRAME_ROWS * (FRAME_CELL + FRAME_GAP) - FRAME_GAP;

export const TRASH_RECT = { x: 830, y: 20, width: 150, height: 60 };

/** 같은 가르기를 두 번 쌓지 않기 위해 정렬한 쌍으로 비교한다. */
export function splitKey(a: number, b: number): string {
  return a <= b ? `${a},${b}` : `${b},${a}`;
}
