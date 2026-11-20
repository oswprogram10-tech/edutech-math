/**
 * E17 `sort` 모드의 설정·상태·Action 타입.
 *
 * 카드를 상자에 넣어 분류하고 상자별 개수를 센다. 기준 값·정답은 상태에 없다.
 * 판 크기는 `layout.ts`의 `sortBoardHeight`가 정한다.
 */
import type { SortDeckName } from '../decks';

export type BinId = 'bin1' | 'bin2' | 'bin3' | 'bin4';
export const ALL_BIN_IDS: readonly BinId[] = ['bin1', 'bin2', 'bin3', 'bin4'];

/** 단추: color·shape·holes·pretty / 사물: shapeFamily·color·size. */
export type Criterion = string;

export type BinLabelMode = 'criterion-values' | 'student-choice-icon' | 'none';
export type CountTableMode = 'student' | 'auto' | false;
export type RenderMode = 'color' | 'gray';

/** `pretty` 기준이 만드는 두 상자의 값 이름. */
export const PRETTY_VALUES: readonly string[] = ['pretty', 'plain'];
export const PRETTY: Criterion = 'pretty';

export interface SortConfig {
  readonly mode?: 'sort';
  readonly deck?: SortDeckName;
  readonly cards?: readonly string[];
  readonly criterionChoice?: readonly Criterion[];
  readonly bins?: number;
  readonly binLabels?: BinLabelMode;
  readonly conveyor?: boolean;
  readonly countTable?: CountTableMode;
  readonly prefill?: Readonly<Record<string, readonly string[]>>;
  readonly render?: RenderMode;
}

export interface SortSettings {
  readonly deck: SortDeckName;
  /** 컨베이어 순서이기도 하다. */
  readonly cards: readonly string[];
  readonly criterionChoice: readonly Criterion[] | null;
  /** 기준 고르기가 없을 때의 상자 수(1~4). 기준이 있으면 기준 값 개수가 상자 수다. */
  readonly bins: number;
  readonly binLabels: BinLabelMode;
  readonly conveyor: boolean;
  readonly countTable: CountTableMode;
  readonly prefill: Readonly<Record<string, readonly string[]>>;
  readonly render: RenderMode;
  /** 설정이 잘못되면 문구(학생 화면은 오류 안내만 보인다). */
  readonly error: string | null;
}

export interface SortState {
  readonly mode: 'sort';
  readonly settings: SortSettings;
  readonly criterion: Criterion | null;
  readonly criterionHistory: readonly Criterion[];
  /** 카드 → 상자(없으면 트레이·벨트). */
  readonly binOf: Readonly<Record<string, BinId | null>>;
  /** 학생이 상자에 붙인 이름 아이콘(`attribute:value`). */
  readonly icons: Readonly<Record<string, string | null>>;
  /** 학생이 센 개수(안 센 상자는 null). */
  readonly counts: Readonly<Record<string, number | null>>;
}

export type SortAction =
  | { readonly type: 'choose-criterion'; readonly criterion: Criterion }
  | { readonly type: 'change-criterion' }
  | { readonly type: 'move'; readonly card: string; readonly to: BinId | 'tray' }
  | { readonly type: 'label-bin'; readonly bin: BinId; readonly icon: string | null }
  | { readonly type: 'count'; readonly bin: BinId; readonly value: number }
  | { readonly type: 'reset' };

export const COUNT_MAX = 20;
