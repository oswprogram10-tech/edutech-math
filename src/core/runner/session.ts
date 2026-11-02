/** 과제 진행 상태(순수 함수). 실패 횟수는 T012 힌트 엔진이 읽는다. */
import type { RunnerSession } from './types';

export function startSession(taskIds: readonly string[]): RunnerSession {
  if (taskIds.length === 0) throw new Error('과제가 없는 콘텐츠는 실행할 수 없습니다.');
  if (new Set(taskIds).size !== taskIds.length) {
    throw new Error('과제 ID가 중복됩니다.');
  }
  return { taskIds: [...taskIds], index: 0, status: 'active', failures: {}, hintLevels: {} };
}

export function currentTaskId(session: RunnerSession): string | undefined {
  return session.taskIds[session.index];
}

export function hasNextTask(session: RunnerSession): boolean {
  return session.index < session.taskIds.length - 1;
}

export function isSessionComplete(session: RunnerSession): boolean {
  return session.status === 'passed' && !hasNextTask(session);
}

/**
 * 제출 결과를 반영한다. 틀리면 그 과제의 실패 횟수가 하나 늘어난다.
 * `hintLevel`은 이번 제출에서 보여 준 힌트 단계(0이면 없음)다.
 * 과제별 최고 단계는 통과한 뒤에도 남긴다(T013 숙달 계산).
 */
export function sessionAfterSubmit(
  session: RunnerSession,
  taskId: string,
  passed: boolean,
  hintLevel = 0,
): RunnerSession {
  if (taskId !== currentTaskId(session)) return session;
  const previousLevel = session.hintLevels[taskId] ?? 0;
  const nextLevel = Math.max(previousLevel, Math.min(Math.max(hintLevel, 0), 3));
  const withHint =
    nextLevel === previousLevel
      ? session
      : { ...session, hintLevels: { ...session.hintLevels, [taskId]: nextLevel } };

  if (passed) return { ...withHint, status: 'passed' };
  return {
    ...withHint,
    status: 'failed',
    failures: {
      ...session.failures,
      [taskId]: (session.failures[taskId] ?? 0) + 1,
    },
  };
}

/** 실패 뒤 다시 조작하면 '하는 중'으로 돌아간다. 실패 횟수는 남긴다. */
export function sessionAfterEdit(session: RunnerSession): RunnerSession {
  return session.status === 'failed' ? { ...session, status: 'active' } : session;
}

export function advanceSession(session: RunnerSession): RunnerSession {
  if (!hasNextTask(session)) return session;
  return { ...session, index: session.index + 1, status: 'active' };
}

export function failureCount(session: RunnerSession, taskId: string): number {
  return session.failures[taskId] ?? 0;
}

/** 그 과제에서 지금까지 보여 준 가장 높은 힌트 단계(0~3). */
export function shownHintLevel(session: RunnerSession, taskId: string): number {
  return session.hintLevels[taskId] ?? 0;
}
