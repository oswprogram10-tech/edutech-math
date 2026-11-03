/**
 * E01 수 모형(자릿값 블록) 엔진의 설정·상태·Action 타입.
 *
 * 블록 값은 `1 | 10 | 100 | 1000`(number), 나타내는 수는 0~9999 정수다.
 * T043의 `decimal` 모드가 들어오면 값 계산을 `value.ts`의 `valueOf` 안에서만
 * `Rational`로 바꿀 수 있도록 계산을 한 곳에 모은다(카드 결정 2).
 *
 * 좌표는 논리 좌표(1000×600) 정수만 상태에 둔다. 화면 픽셀은 저장하지 않는다.
 */

export type BaseTenMode = 'count' | 'regroup' | 'add-sub' | 'place-chart' | 'free';

export type BlockValue = 1 | 10 | 100 | 1000;

export const BLOCK_VALUES: readonly BlockValue[] = [1, 10, 100, 1000];

/** add-sub에서 블록이 놓이는 자리. `a`·`b`는 처음 수, `sum`은 모으기, `take`는 빼기 접시. */
export type Zone = 'a' | 'b' | 'sum' | 'take';

export type ChartFill = 'student' | 'auto';

export type SubtractionConstraint = 'none' | 'no-negative-take';

export type BaseTenRender = 'auto' | 'isometric' | 'flat';

/** 1학년 "사탕" 과제용. 1 블록 앞면에만 그린다. */
export type BaseTenIcon = 'candy' | 'star';

export interface StartSpec {
  readonly ones?: number;
  readonly tens?: number;
  readonly hundreds?: number;
  readonly thousands?: number;
  /** 낱개(1)를 seed로 정한 위치에 흩어 놓는다. */
  readonly scattered?: boolean;
  readonly seed?: number;
}

/** 자릿값 표의 열 이름. 높은 자리부터 적는다(카드 결정 8). */
export type ChartName = 'thousands' | 'hundreds' | 'tens' | 'ones';

export const CHART_NAME_COLUMN: Readonly<Record<ChartName, number>> = {
  thousands: 3,
  hundreds: 2,
  tens: 1,
  ones: 0,
};

export const DEFAULT_CHART_LABELS: Readonly<Record<ChartName, string>> = {
  thousands: '천',
  hundreds: '백',
  tens: '십',
  ones: '일',
};

export interface BaseTenConfig {
  /** 없으면 설정 키를 보고 모드를 고른다(샌드박스는 항상 넘긴다). */
  readonly mode?: BaseTenMode;

  /** 블록 상자에 넣을 값. 기본 `[1, 10, 100]`. */
  readonly allowedBlocks?: readonly BlockValue[];
  /** 이 수를 넘게 만드는 `add`는 무시한다. 기본 9999. */
  readonly maxValue?: number;
  /** 처음 놓아 둘 블록. */
  readonly start?: StartSpec;
  /** 자릿값 칸에 자석처럼 붙인다. add-sub 기본 true, 나머지 기본 false. */
  readonly snapColumns?: boolean;
  /** 올가미 묶기 사용. 기본 true. false여도 "10개 묶기" 버튼은 늘 있다. */
  readonly lasso?: boolean;

  /** 자릿값 표의 열(높은 자리부터). */
  readonly chart?: readonly ChartName[];
  /** `student`: 학생이 숫자를 쓴다. `auto`: 블록 개수를 그대로 보여 준다. 기본 student. */
  readonly chartFill?: ChartFill;
  /** 열 이름 문구 덮어쓰기. 1학년은 `{ tens: "10개씩 묶음", ones: "낱개" }`. */
  readonly chartLabels?: Readonly<Partial<Record<ChartName, string>>>;

  // ── place-chart ───────────────────────────────────────────
  /** 열의 자릿값 지수(높은 자리부터). 예: `[2, 1, 0]`. */
  readonly columns?: readonly number[];
  /** 블록 ↔ 칸 숫자 양방향 연동. 기본 true. */
  readonly bidirectional?: boolean;
  /** 학생이 칸에 끌어 놓을 숫자 카드. */
  readonly digits?: readonly number[];

  // ── add-sub ───────────────────────────────────────────────
  readonly op?: 'add' | 'sub';
  readonly a?: number;
  readonly b?: number;
  /** false면 add-sub에서 상위 블록 풀기를 막는다. 기본 true. */
  readonly regroupAllowed?: boolean;
  /** `no-negative-take`: 빼기 접시에 b의 그 자리 숫자보다 많이 놓지 못한다. */
  readonly constraint?: SubtractionConstraint;

  // ── 그림 ──────────────────────────────────────────────────
  /** `auto`는 C=입체, P=평면, A=표만. */
  readonly render?: BaseTenRender;
  readonly icon?: BaseTenIcon;

  /** 값이 100이 된 적이 있는지 Observation에 담을지. */
  readonly allowHundredReveal?: boolean;
}

/** reduce는 config를 받지 않으므로 설정 중 상태 계산에 필요한 값만 복사해 둔다. */
export interface BaseTenSettings {
  readonly allowedBlocks: readonly BlockValue[];
  readonly maxValue: number;
  readonly snapColumns: boolean;
  readonly lasso: boolean;
  readonly chartFill: ChartFill;
  readonly chartColumns: readonly number[];
  readonly bidirectional: boolean;
  readonly op: 'add' | 'sub';
  readonly a: number;
  readonly b: number;
  readonly constraint: SubtractionConstraint;
  readonly regroupAllowed: boolean;
  readonly digits: readonly number[];
  readonly render: BaseTenRender;
  readonly icon: BaseTenIcon | null;
}

export interface BaseTenBlock {
  readonly id: string;
  readonly value: BlockValue;
  readonly x: number;
  readonly y: number;
  readonly zone?: Zone;
}

export interface BaseTenLogEntry {
  readonly kind: 'group' | 'break';
  readonly from: BlockValue;
}

/** 올가미가 실패했을 때 학생이 감싼 개수. 목표 값이 아니다. */
export interface BaseTenAttempt {
  readonly count: number;
  /** 값이 섞였으면 null. */
  readonly value: BlockValue | null;
  readonly ok: boolean;
}

export interface BaseTenState {
  readonly mode: BaseTenMode;
  readonly blocks: readonly BaseTenBlock[];
  /** 학생이 쓴 자릿값 표 숫자. 높은 자리부터. 표가 없으면 null. */
  readonly chart: readonly (string | null)[] | null;
  /** place-chart 숫자 카드 index → 놓인 열(자릿값 지수), 아직 안 놓았으면 -1. */
  readonly digitPlacements: readonly number[];
  /** 묶기·풀기 순서. 판정용이다. */
  readonly log: readonly BaseTenLogEntry[];
  readonly lastAttempt: BaseTenAttempt | null;
  readonly reachedHundred: boolean;
  readonly nextId: number;
  readonly settings: BaseTenSettings;
}

export type BaseTenAction =
  | { readonly type: 'add'; readonly value: BlockValue; readonly x: number; readonly y: number }
  | { readonly type: 'move'; readonly id: string; readonly x: number; readonly y: number }
  | { readonly type: 'remove'; readonly id: string }
  | { readonly type: 'lasso-group'; readonly ids: readonly string[] }
  /** "10개 묶기" 버튼. value를 생략하면 같은 값 10개가 있는 가장 작은 값부터 묶는다. */
  | { readonly type: 'group-tens'; readonly value?: BlockValue }
  | { readonly type: 'break'; readonly id: string }
  | { readonly type: 'set-digit'; readonly column: number; readonly digit: number | null }
  | { readonly type: 'place-digit'; readonly index: number; readonly column: number };

export const LOGICAL_WIDTH = 1000;
export const LOGICAL_HEIGHT = 600;

/** 같은 값 블록이 이보다 많으면 묶음 그림으로 간단히 그린다(성능). */
export const BUNDLE_THRESHOLD = 20;
