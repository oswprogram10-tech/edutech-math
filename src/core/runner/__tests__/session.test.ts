import { describe, expect, it } from 'vitest';
import {
  advanceSession,
  currentTaskId,
  failureCount,
  hasNextTask,
  isSessionComplete,
  sessionAfterEdit,
  sessionAfterSubmit,
  shownHintLevel,
  startSession,
} from '../session';

describe('RunnerSession', () => {
  it('과제를 순서대로 진행하고 마지막 통과를 완료로 본다', () => {
    let session = startSession(['t1', 't2']);
    expect(currentTaskId(session)).toBe('t1');
    expect(hasNextTask(session)).toBe(true);

    session = sessionAfterSubmit(session, 't1', true);
    expect(session.status).toBe('passed');
    session = advanceSession(session);
    expect(currentTaskId(session)).toBe('t2');
    expect(session.status).toBe('active');
    expect(hasNextTask(session)).toBe(false);

    session = sessionAfterSubmit(session, 't2', true);
    expect(isSessionComplete(session)).toBe(true);
  });

  it('틀리면 그 과제의 실패 횟수를 세고, 다시 조작하면 하는 중으로 돌아간다', () => {
    let session = startSession(['t1', 't2']);
    session = sessionAfterSubmit(session, 't1', false);
    expect(session.status).toBe('failed');
    expect(failureCount(session, 't1')).toBe(1);

    session = sessionAfterEdit(session);
    expect(session.status).toBe('active');

    session = sessionAfterSubmit(session, 't1', false);
    expect(failureCount(session, 't1')).toBe(2);

    // 다른 과제의 제출은 현재 과제에 영향을 주지 않는다.
    expect(sessionAfterSubmit(session, 't2', true)).toBe(session);
    expect(failureCount(session, 't2')).toBe(0);
  });

  it('과제별로 보여 준 가장 높은 힌트 단계를 남긴다', () => {
    let session = startSession(['t1', 't2']);
    expect(shownHintLevel(session, 't1')).toBe(0);

    session = sessionAfterSubmit(session, 't1', false, 1);
    expect(shownHintLevel(session, 't1')).toBe(1);

    session = sessionAfterEdit(session);
    session = sessionAfterSubmit(session, 't1', false, 2);
    expect(shownHintLevel(session, 't1')).toBe(2);

    // 낮은 단계가 다시 와도 최고 단계를 낮추지 않는다.
    session = sessionAfterEdit(session);
    session = sessionAfterSubmit(session, 't1', false, 1);
    expect(shownHintLevel(session, 't1')).toBe(2);

    session = sessionAfterEdit(session);
    session = sessionAfterSubmit(session, 't1', true, 3);
    expect(shownHintLevel(session, 't1')).toBe(3);
    expect(shownHintLevel(session, 't2')).toBe(0);
  });

  it('빈 과제 목록과 중복 ID는 거부한다', () => {
    expect(() => startSession([])).toThrow();
    expect(() => startSession(['t1', 't1'])).toThrow();
  });
});
