/**
 * 과제 이벤트 기록.
 *
 * 저장 실패가 수업 화면을 멈추면 안 되므로 모든 기록은 실패해도 던지지 않고
 * onError·console.warn으로만 알린다.
 */
import { logEvent } from '../storage';
import type { EngineId, UnitId } from '../engine-sdk';
import type { LearningEvent, LearnerId, LearningVerb, EventSink, JsonObject } from '../storage';
import { toJsonValue } from './json';
import type { SlotControl } from './types';

export interface TaskRecorderOptions {
  /** 없으면 기록을 건너뛴다(저장소를 못 연 경우). */
  readonly sink?: EventSink;
  readonly learner: LearnerId;
  readonly unit: UnitId;
  readonly task: string;
  readonly engine: EngineId;
  readonly onError?: (error: unknown) => void;
}

/**
 * 같은 밀리초에 여러 기록이 생겨도 저장 순서가 뒤섞이지 않게 t를 단조 증가시킨다.
 * T004 저장소는 t→id 순으로 정렬하므로, 재생이 Action 순서를 지키려면 필요하다.
 */
let lastEventTime = 0;

function nextEventTime(): number {
  lastEventTime = Math.max(Date.now(), lastEventTime + 1);
  return lastEventTime;
}

export class TaskRecorder {
  constructor(private readonly options: TaskRecorderOptions) {}

  private async record(verb: LearningVerb, data?: JsonObject): Promise<LearningEvent | undefined> {
    const sink = this.options.sink;
    if (!sink) return undefined;
    try {
      return await logEvent(
        sink,
        {
          learner: this.options.learner,
          unit: this.options.unit,
          task: this.options.task,
          engine: this.options.engine,
          verb,
          ...(data === undefined ? {} : { data }),
        },
        { now: nextEventTime() },
      );
    } catch (error) {
      this.options.onError?.(error);
      console.warn('[runner] 학습 기록을 저장하지 못했습니다.', error);
      return undefined;
    }
  }

  started(): Promise<LearningEvent | undefined> {
    return this.record('started');
  }

  /**
   * `group`은 사용자 Action 하나와 그 연결로 생긴 Action들을 묶는 이름이다.
   * 재생할 때 같은 group은 되돌리기 한 단위로 취급한다.
   */
  acted(slot: string, action: unknown, group?: string): Promise<LearningEvent | undefined> {
    return this.record('acted', {
      slot,
      action: toJsonValue(action),
      ...(group === undefined ? {} : { group }),
    });
  }

  /** 되돌리기·다시하기는 모든 슬롯을 함께 움직이므로 슬롯을 남기지 않는다. */
  control(control: SlotControl): Promise<LearningEvent | undefined> {
    return this.record('acted', { control });
  }

  submitted(): Promise<LearningEvent | undefined> {
    return this.record('submitted');
  }

  passed(): Promise<LearningEvent | undefined> {
    return this.record('passed');
  }

  failed(): Promise<LearningEvent | undefined> {
    return this.record('failed');
  }

  /** 힌트를 보여 줬을 때. `rule`은 hints 배열 위치 또는 "default". */
  hinted(
    level: number,
    rule: number | 'default',
    misconceptions: readonly string[],
  ): Promise<LearningEvent | undefined> {
    return this.record('hinted', { level, rule, misconceptions: [...misconceptions] });
  }

  /** ③ 역추적 요청. 대상이 없으면 빈 data로 남긴다. */
  backtracked(target: string | undefined): Promise<LearningEvent | undefined> {
    return this.record('backtracked', target === undefined ? {} : { target });
  }
}
