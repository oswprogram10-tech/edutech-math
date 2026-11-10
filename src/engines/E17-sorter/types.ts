/**
 * E17 분류기의 설정·상태·Action·Observation 타입.
 *
 * `mode`로 나뉘는 판별 유니온이고, `secret-rule` 안은 다시 `variant`로 나눈다.
 * W6가 `sort` 모드와 다른 `secret-rule` 변형을 더할 수 있게 유니온으로 둔다.
 *
 * 카드 좌표는 정수 격자 번호 `[i, j]`다(i는 오른쪽, j는 아래쪽). 수학 계산은
 * `core/math/geometry`의 y 배율 도우미로 하고, 화면 좌표만 number다.
 */
import type { JsonValue } from '../../core/engine-sdk';

export const LOGICAL_WIDTH = 1000;
export const LOGICAL_HEIGHT = 1000;

export type SorterMode = 'venn' | 'secret-rule' | 'hierarchy';

export type DeckName = 'triangles-12' | 'quadrilaterals-16';

export type CardId = string;

export type MarksSetting = 'auto' | 'show' | 'hide';

export type AngleCondition = 'acute' | 'right' | 'obtuse';

export type SideCondition = 'equilateral' | 'isosceles' | 'isosceles-only' | 'scalene';

/** `` `${row}|${col}` ``. 예: `"acute|equilateral"` */
export type CellKey = string;

export type QuestionId =
  | 'parallel-pairs>=1'
  | 'parallel-pairs==2'
  | 'all-sides-equal'
  | 'has-right-angle'
  | 'all-angles-right'
  | 'opposite-sides-equal';

export type ConstraintToggle =
  'one-parallel-pair' | 'two-parallel-pairs' | 'equal-sides' | 'right-angle';

export type QuadName =
  'quadrilateral' | 'trapezoid' | 'parallelogram' | 'rhombus' | 'rectangle' | 'square';

export type QuadNode = QuadName;

export type Role = 'guesser' | 'answerer';

export interface VennConfig {
  readonly mode?: 'venn';
  /** 다른 값은 `grid`로 본다. */
  readonly layout?: string;
  readonly deck?: 'triangles-12';
  /** `'auto-generate-12'`는 `deck: 'triangles-12'`와 같다. */
  readonly cards?: 'auto-generate-12';
  readonly rows?: readonly unknown[];
  readonly cols?: readonly unknown[];
  readonly cellFeedback?: 'on-check' | 'immediate' | 'none';
  readonly marks?: MarksSetting;
  /** 받기만 하고 무시한다(E09 연동은 실행기 두 판). */
  readonly allowCreate?: unknown;
}

export interface SecretRuleConfig {
  readonly mode?: 'secret-rule';
  readonly variant?: 'twenty-questions';
  readonly deck?: 'quadrilaterals-16';
  readonly questionBank?: readonly unknown[];
  readonly studentEliminates?: boolean;
  readonly roleSwap?: boolean;
  readonly startRole?: Role;
  readonly seed?: number;
  readonly marks?: MarksSetting;
}

export interface HierarchyConfig {
  readonly mode?: 'hierarchy';
  readonly family?: 'quadrilaterals';
  readonly constraintToggles?: readonly unknown[];
  readonly trapezoidDefinition?: 'inclusive' | 'exclusive';
  readonly treeBlanks?: boolean | readonly unknown[];
  readonly showPosition?: 'auto' | 'always' | 'never';
  readonly marks?: MarksSetting;
  /** 받기만 하고 무시한다(E09 drag-test는 실행기 두 판). */
  readonly dragTest?: unknown;
}

export type SorterConfig = VennConfig | SecretRuleConfig | HierarchyConfig;

// ── 정규화된 설정 ─────────────────────────────────────────────

export interface VennSettings {
  readonly rows: readonly AngleCondition[];
  readonly cols: readonly SideCondition[];
  readonly cellFeedback: 'on-check' | 'immediate' | 'none';
  readonly marks: MarksSetting;
}

export interface SecretSettings {
  readonly deck: 'quadrilaterals-16';
  readonly questionBank: readonly QuestionId[];
  readonly studentEliminates: boolean;
  readonly roleSwap: boolean;
  readonly startRole: Role;
  readonly seed: number;
  readonly marks: MarksSetting;
}

export interface HierarchySettings {
  readonly constraintToggles: readonly ConstraintToggle[];
  readonly trapezoidDefinition: 'inclusive' | 'exclusive';
  /** 빈칸으로 둘 노드(뿌리 quadrilateral은 넣지 않는다). */
  readonly treeBlanks: readonly QuadNode[];
  readonly showPosition: 'auto' | 'always' | 'never';
  readonly marks: MarksSetting;
}

// ── 상태 ──────────────────────────────────────────────────────

export interface VennState {
  readonly mode: 'venn';
  readonly deck: 'triangles-12';
  readonly settings: VennSettings;
  readonly placements: Readonly<Record<CardId, CellKey | null>>;
  readonly impossible: readonly CellKey[];
  readonly checked: Readonly<Record<CardId, CellKey>>;
  readonly checks: number;
  readonly lastPlaced: CardId | null;
}

export interface AskedQuestion {
  readonly question: QuestionId;
  readonly answer: boolean;
}

export interface SwapEntry {
  readonly question: QuestionId;
  readonly answer: boolean;
  readonly truth: boolean;
}

export interface SwapState {
  readonly secret: CardId | null;
  readonly candidates: readonly CardId[];
  readonly log: readonly SwapEntry[];
  readonly pending: QuestionId | null;
  readonly done: boolean;
}

export interface SecretRuleState {
  readonly mode: 'secret-rule';
  readonly variant: 'twenty-questions';
  readonly deck: 'quadrilaterals-16';
  readonly settings: SecretSettings;
  readonly role: Role;
  readonly round: number;
  readonly secret: CardId;
  readonly asked: readonly AskedQuestion[];
  readonly eliminated: readonly CardId[];
  readonly guesses: readonly CardId[];
  readonly solved: boolean;
  readonly swap: SwapState;
}

export interface HierarchyState {
  readonly mode: 'hierarchy';
  readonly settings: HierarchySettings;
  readonly toggles: readonly ConstraintToggle[];
  readonly blanks: Readonly<Partial<Record<QuadNode, QuadName | null>>>;
}

export type SorterState = VennState | SecretRuleState | HierarchyState;

// ── Action ────────────────────────────────────────────────────

export type SorterAction =
  | { readonly type: 'place'; readonly card: CardId; readonly cell: CellKey | null }
  | { readonly type: 'toggle-impossible'; readonly cell: CellKey }
  | { readonly type: 'check' }
  | { readonly type: 'ask'; readonly question: QuestionId }
  | { readonly type: 'eliminate'; readonly card: CardId }
  | { readonly type: 'restore'; readonly card: CardId }
  | { readonly type: 'guess'; readonly card: CardId }
  | { readonly type: 'new-round' }
  | { readonly type: 'switch-role'; readonly role: Role }
  | { readonly type: 'swap-pick'; readonly card: CardId }
  | { readonly type: 'swap-answer'; readonly answer: boolean }
  | { readonly type: 'swap-reset' }
  | { readonly type: 'toggle'; readonly toggle: ConstraintToggle }
  | { readonly type: 'fill-blank'; readonly node: QuadNode; readonly name: QuadName | null };

export type SorterObservationValue = JsonValue;

/** 칸 조건과 카드 성질이 맞는지(화면·Observation 공용). */
export interface PropsCard {
  readonly id: CardId;
  readonly prototype: boolean;
}

export const ALL_ANGLE_CONDITIONS: readonly AngleCondition[] = ['acute', 'right', 'obtuse'];
export const ALL_SIDE_CONDITIONS: readonly SideCondition[] = [
  'equilateral',
  'isosceles',
  'isosceles-only',
  'scalene',
];
export const ALL_QUESTIONS: readonly QuestionId[] = [
  'parallel-pairs>=1',
  'parallel-pairs==2',
  'all-sides-equal',
  'has-right-angle',
  'all-angles-right',
  'opposite-sides-equal',
];
export const ALL_TOGGLES: readonly ConstraintToggle[] = [
  'one-parallel-pair',
  'two-parallel-pairs',
  'equal-sides',
  'right-angle',
];
export const ALL_QUAD_NAMES: readonly QuadName[] = [
  'quadrilateral',
  'trapezoid',
  'parallelogram',
  'rhombus',
  'rectangle',
  'square',
];
/** 트리 빈칸 기본값: 뿌리 quadrilateral을 뺀 다섯 칸. */
export const DEFAULT_BLANK_NODES: readonly QuadNode[] = [
  'trapezoid',
  'parallelogram',
  'rhombus',
  'rectangle',
  'square',
];
/** 이름 카드 순서(고정). */
export const NAME_CARD_ORDER: readonly QuadName[] = [
  'rectangle',
  'trapezoid',
  'square',
  'rhombus',
  'parallelogram',
];
