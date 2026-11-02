/** T005 활동 실행기의 공개 타입. */
import type { CPA, EngineId, JsonValue, Observation, Task, UnitId } from '../engine-sdk';
import type { ResponseSpec } from './response/types';

export type SubmitMode = 'auto' | 'button';

/** 여러 엔진을 같은 화면에 놓을 때의 한 칸. */
export interface TaskViewSpec {
  readonly slot: string;
  readonly engine: EngineId;
  readonly mode: string;
  readonly cpa: CPA;
  readonly config: JsonValue;
}

/** `from` 슬롯의 이벤트를 `to` 슬롯의 receive로 넘긴다. */
export interface TaskLinkSpec {
  readonly from: string;
  readonly event: string;
  readonly to: string;
}

/**
 * 콘텐츠의 과제 하나.
 * engine-sdk의 Task에 제출 방식과 여러 엔진 화면(views/links)을 더했다.
 * views 배열의 첫 슬롯이 판정 대상이다.
 */
export interface ContentTask extends Task {
  readonly submit: SubmitMode;
  readonly views?: readonly TaskViewSpec[];
  readonly links?: readonly TaskLinkSpec[];
  /** 실행기의 특별 슬롯 `response`에 그릴 응답 필드. 있으면 submit은 button이다. */
  readonly response?: ResponseSpec;
  /** false면 엔진 패널을 그리지 않는다. 엔진 상태는 판정·재생을 위해 그대로 만든다. */
  readonly showEngine?: boolean;
}

export interface ContentActivity {
  readonly id: string;
  readonly title: string;
  readonly tasks: readonly ContentTask[];
}

export interface UnitContent {
  readonly unit: UnitId;
  readonly title: string;
  readonly activities: readonly ContentActivity[];
}

/** 기록에 남는 Action 하나. `slot`은 단일 엔진이면 `main`이다. */
export interface SlotAction {
  readonly slot: string;
  readonly action: JsonValue;
}

export type SlotControl = 'undo' | 'redo';

export type TaskStatus = 'active' | 'passed' | 'failed';

/** 과제 진행 상태. 실패 횟수는 T012 힌트 엔진이 읽는다. */
export interface RunnerSession {
  readonly taskIds: readonly string[];
  readonly index: number;
  readonly status: TaskStatus;
  readonly failures: Readonly<Record<string, number>>;
}

/** 여러 슬롯을 재생한 결과. */
export interface SlotReplayResult {
  readonly states: Readonly<Record<string, unknown>>;
  readonly observations: Readonly<Record<string, Observation>>;
}
