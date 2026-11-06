import type { ComponentType } from 'react';

// ─────────────────────────────────────────────────────────────
// 공통 식별자
// docs/02-architecture.md §3의 계약을 코드로 옮긴 파일이다.
// 엔진은 이 타입만 보고 만들고, 러너·힌트 엔진은 Observation만 본다.
// ─────────────────────────────────────────────────────────────

/** 단원 ID. 예: "g5s1u4" (5학년 1학기 4단원) */
export type UnitId = string;

/** 엔진 ID. 예: "E05" */
export type EngineId = `E${string}`;

/** 구체물(C) · 반구체 그림(P) · 기호(A) */
export type CPA = 'C' | 'P' | 'A';

/** 조작 가능한 요소의 최소 터치 영역(px). 저학년 모드는 64. */
export type TargetSize = 48 | 64;

/**
 * Observation에 넣을 수 있는 값.
 * BigInt·함수·undefined·Map·순환 참조는 허용하지 않는다.
 * Rational은 `toJSON()` 문자열로 바꿔 넣는다(결정 2).
 */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { readonly [key: string]: JsonValue };

/** 엔진이 현재 상태에서 뽑아낸, 판정 가능한 수학적 사실. */
export type Observation = Readonly<Record<string, JsonValue>>;

/** 다른 엔진·러너에게 알리는 사건. `name`은 엔진의 `events` 목록 중 하나다. */
export interface EngineEvent {
  readonly name: string;
  readonly payload?: JsonValue;
}

/** GoalSpec `predicate`가 이름으로 찾는 엔진 판정 함수. */
export type EnginePredicate = (observation: Observation, args: JsonValue | undefined) => boolean;

// ─────────────────────────────────────────────────────────────
// 과제·목표·힌트
// ─────────────────────────────────────────────────────────────

/** 판정은 정답 문자열 비교가 아니라 Observation에 대한 조건식으로 한다. */
export type GoalSpec =
  | { kind: 'equals'; path: string; value: JsonValue }
  | { kind: 'equivalent-expr'; path: string; expr: string } // 수식 동치
  | { kind: 'predicate'; name: string; args?: JsonValue } // 엔진이 제공하는 이름 있는 판정
  | { kind: 'all'; of: GoalSpec[] }
  | { kind: 'any'; of: GoalSpec[] };

/** 힌트 ② 시각적 반례가 가리키는 오버레이. */
export interface HintShow {
  engine: EngineId;
  overlay: string;
  args?: JsonValue;
}

/** docs/05-learning-engine.md §4의 힌트 규칙. */
export interface HintRule {
  when: GoalSpec | { misconception: string };
  level: 1 | 2 | 3;
  /** ① 발문. 템플릿 변수: {a}, {b}, {student} */
  say?: string;
  /** ② 시각적 반례 (엔진이 제공하는 오버레이) */
  show?: HintShow;
  /** ③ 역추적할 개념 ID 또는 단원 ID */
  backtrack?: string;
}

/** 과제 = 엔진 설정 + 목표 + 판정 규칙 */
export interface Task {
  id: string;
  /** 학생에게 보이는 발문. TTS로 읽어 줄 수 있게 짧게 쓴다. */
  prompt: string;
  engine: EngineId;
  mode: string;
  cpa: CPA;
  /** 엔진별 설정 */
  config: unknown;
  goal: GoalSpec;
  hints: HintRule[];
  /** 지식 그래프 개념 ID */
  concepts: string[];
}

// ─────────────────────────────────────────────────────────────
// 엔진 계약
// ─────────────────────────────────────────────────────────────

/** 엔진 View 위에 겹쳐 그리는 힌트 ② 레이어. 정답을 직접 보여 주면 안 된다. */
export interface OverlayProps<Config, State> {
  config: Config;
  state: State;
  args?: unknown;
  scale?: number;
}

export type OverlayComponent<Config, State> = ComponentType<OverlayProps<Config, State>>;

/** 엔진 폴더의 index.ts가 default export 하는 계약. */
export interface EngineDefinition<Config, State, Action> {
  id: EngineId;
  /** 학생 화면에 보이는 이름. 예: "분수 모델" */
  name: string;
  /** 이 엔진이 지원하는 모드. 첫 값이 기본 모드다. */
  modes: string[];
  /**
   * 실행기 판에서의 크기 방식. 'fit'(기본): 남는 높이에 맞춰 줄어든다(SVG 교구).
   * 'content': 내용 높이보다 작아지지 않는다. 판이 커지면 페이지가 스크롤된다(세로셈·줄 풀이·키패드).
   */
  layout?: 'fit' | 'content';
  createInitialState(config: Config): State;
  /** 순수 함수. 모든 조작은 Action으로만 기록한다. */
  reduce(state: State, action: Action): State;
  View: ComponentType<EngineViewProps<Config, State, Action>>;
  /** 현재 상태에서 판정 가능한 수학적 사실을 뽑는다. */
  observe(state: State, config: Config): Observation;
  /** 다른 엔진·러너가 구독하는 이벤트 이름. */
  events: readonly string[];
  /** 이름 → 힌트 ② 레이어. HintRule.show.overlay가 이 이름을 가리킨다. */
  overlays?: Readonly<Record<string, OverlayComponent<Config, State>>>;
  /**
   * reduce 직후 러너가 호출한다. 순수 함수여야 한다.
   * 돌려준 `name`은 반드시 `events`에 있어야 한다(개발 모드에서 검사).
   */
  emit?(prev: State, next: State, action: Action): EngineEvent[];
  /**
   * 다른 엔진의 이벤트를 이 엔진의 Action으로 바꾼다.
   * null이면 무시한다. 러너만 호출하며 엔진끼리 직접 import하지 않는다.
   */
  receive?(state: State, event: EngineEvent, config: Config): Action | null;
  /** GoalSpec `predicate`가 이름으로 찾는 판정 함수. */
  predicates?: Readonly<Record<string, EnginePredicate>>;
}

/** 모든 엔진 View가 받는 props. */
export interface EngineViewProps<Config, State, Action> {
  config: Config;
  state: State;
  dispatch(action: Action): void;
  /** 같은 엔진이 C/P/A 단계에 따라 다르게 그린다. */
  cpa: CPA;
  /** 엔진 정의의 modes 중 하나. 기본값은 modes[0]. */
  mode: string;
  /** 교사 미러링·익명 비교 화면. 조작을 막는다. */
  readOnly?: boolean;
  /** 전자칠판 확대. 1이 원래 크기다. */
  scale?: number;
  /** 조작 요소의 최소 터치 영역. 저학년 모드는 64. */
  targetSize: TargetSize;
}

/**
 * 레지스트리가 타입을 지운 채로 들고 다니는 엔진 정의.
 * `never`를 쓰면 구체 타입을 가진 엔진 정의를 안전하게 담을 수 있다.
 */
export type LoadedEngine = EngineDefinition<never, never, never>;
