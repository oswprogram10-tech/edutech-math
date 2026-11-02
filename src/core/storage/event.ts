/**
 * 이벤트 기록 API.
 *
 * 화면 좌표(클릭 위치·궤적)는 개인정보·용량·분석 모두에서 쓸모가 없으므로
 * 타입과 런타임 양쪽에서 막는다. 엔진 Action의 논리 좌표 x·y는 허용한다.
 */
import { assertSerializable } from '../engine-sdk';
import type { JsonValue } from '../engine-sdk';
import { randomId } from './ids';
import type {
  EventSink,
  JsonObject,
  LearningEvent,
  LearningEventDraft,
  ScreenCoordinateKey,
} from './types';
import { SCREEN_COORDINATE_KEYS } from './types';

const FORBIDDEN_KEYS = new Set<string>(SCREEN_COORDINATE_KEYS);

export class UnsafeEventDataError extends Error {
  constructor(
    readonly key: ScreenCoordinateKey | string,
    readonly path: string,
  ) {
    super(`화면 좌표 키는 이벤트 데이터에 저장할 수 없습니다: ${path}`);
    this.name = 'UnsafeEventDataError';
  }
}

/**
 * data 전체를 재귀적으로 검사한다.
 * 중첩 객체·배열 안의 clientX, trail 같은 키도 거부한다.
 */
export function assertSafeEventData(data: JsonValue | undefined, path = 'data'): void {
  if (data === undefined) return;

  if (Array.isArray(data)) {
    data.forEach((value, index) => assertSafeEventData(value, `${path}[${index}]`));
    return;
  }

  if (data !== null && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (FORBIDDEN_KEYS.has(key)) {
        throw new UnsafeEventDataError(key, nextPath);
      }
      assertSafeEventData(value, nextPath);
    }
  }
}

export interface LogEventOptions {
  /** 테스트에서 시각을 고정할 때 쓴다. */
  readonly now?: number;
  /** 테스트에서 ID를 고정할 때 쓴다. */
  readonly id?: string;
}

/**
 * 이벤트 하나를 저장한다.
 * id는 crypto.randomUUID(), t는 epoch ms를 붙인다.
 */
export async function logEvent<D extends JsonObject = JsonObject>(
  sink: EventSink,
  draft: LearningEventDraft<D>,
  options: LogEventOptions = {},
): Promise<LearningEvent> {
  const data = draft.data as JsonValue | undefined;
  if (data !== undefined) {
    assertSerializable(data);
    assertSafeEventData(data);
  }

  const event: LearningEvent = {
    id: options.id ?? randomId(),
    t: options.now ?? Date.now(),
    learner: draft.learner,
    unit: draft.unit,
    task: draft.task,
    engine: draft.engine,
    verb: draft.verb,
    ...(data === undefined ? {} : { data: data as JsonObject }),
  };

  await sink.putEvent(event);
  return event;
}
