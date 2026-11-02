/**
 * 숙달 확률 갱신(docs/05-learning-engine.md §2).
 *
 * p는 0~1 확률이라 number다(수학 값이 아니다). 학생 화면에는 숫자를 보여 주지 않는다.
 * 이 파일은 순수 계산만 하고 저장은 실행기가 맡는다.
 */
import type { MasteryRecord } from '../storage/types';
import { conceptPrerequisites } from './graph';
import type { KnowledgeGraph } from './graph';
import { masteryParams } from './params';

/** 저장 기록과 테스트용 최소 모양을 함께 받기 위한 타입. */
export interface MasteryLike {
  readonly p: number;
  readonly passedTasks?: readonly string[];
}

export function initialProbability(prerequisitesMastered: boolean): number {
  return prerequisitesMastered ? masteryParams.initialPWithPrerequisites : masteryParams.initialP;
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function distinctPassedTaskCount(record: MasteryLike | undefined): number {
  return new Set(record?.passedTasks ?? []).size;
}

/** 숙달 = p ≥ 0.8 이고 서로 다른 과제 2개 이상에서 정답. */
export function isMastered(record: MasteryLike | undefined): boolean {
  return (
    record !== undefined &&
    record.p >= masteryParams.masteredP &&
    distinctPassedTaskCount(record) >= masteryParams.masteredTaskCount
  );
}

/**
 * 과제 결과 하나를 반영한다.
 * 정답이면 `taskId`를 정답 과제 목록에 더하고(중복 없음), 오답이면 p만 곱한다.
 */
export function masteryAfterResult(
  previous: MasteryLike | undefined,
  passed: boolean,
  hintLevel: number,
  taskId: string,
  initialP: number = masteryParams.initialP,
): { readonly p: number; readonly passedTasks: readonly string[] } {
  const currentP = clampProbability(previous?.p ?? initialP);
  const passedTasks = new Set(previous?.passedTasks ?? []);

  if (!passed) {
    return {
      p: clampProbability(currentP * masteryParams.failFactor),
      passedTasks: [...passedTasks],
    };
  }

  passedTasks.add(taskId);
  const gain =
    hintLevel <= 0
      ? masteryParams.passGainNoHint
      : hintLevel === 1
        ? masteryParams.passGainHint1
        : masteryParams.passGainHint2Plus;
  return {
    p: clampProbability(currentP + (1 - currentP) * gain),
    passedTasks: [...passedTasks],
  };
}

/**
 * 기록이 없을 때 쓸 초깃값. 바로 앞 선수 개념이 모두 숙달이면 0.5, 아니면 0.3.
 * `records`는 한 학습자의 개념 ID → 숙달 기록이다.
 */
export function initialProbabilityFor(
  graph: KnowledgeGraph,
  records: ReadonlyMap<string, MasteryRecord>,
  conceptId: string,
): number {
  const prerequisites = conceptPrerequisites(graph, conceptId);
  if (prerequisites.length === 0) return initialProbability(false);
  return initialProbability(prerequisites.every((id) => isMastered(records.get(id))));
}
