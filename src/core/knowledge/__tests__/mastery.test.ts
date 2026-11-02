import { describe, expect, it } from 'vitest';
import type { MasteryRecord } from '../../storage/types';
import { buildKnowledgeGraph } from '../graph';
import {
  distinctPassedTaskCount,
  initialProbability,
  initialProbabilityFor,
  isMastered,
  masteryAfterResult,
} from '../mastery';
import { masteryParams } from '../params';

function record(conceptId: string, p: number, passedTasks?: readonly string[]): MasteryRecord {
  return {
    id: `0:${conceptId}`,
    learner: '0',
    conceptId,
    p,
    ...(passedTasks === undefined ? {} : { passedTasks }),
    updatedAt: 1,
  };
}

describe('masteryAfterResult', () => {
  it('초깃값은 선수 숙달 여부에 따라 0.3 또는 0.5', () => {
    expect(initialProbability(false)).toBe(0.3);
    expect(initialProbability(true)).toBe(0.5);
    expect(masteryParams.initialP).toBe(0.3);
    expect(masteryParams.initialPWithPrerequisites).toBe(0.5);
  });

  it('정답은 힌트 단계별로 p ← p + (1 − p) × k', () => {
    const noHint = masteryAfterResult(undefined, true, 0, 't1');
    expect(noHint.p).toBeCloseTo(0.3 + 0.7 * 0.35, 10);
    expect(noHint.passedTasks).toEqual(['t1']);

    const hint1 = masteryAfterResult(undefined, true, 1, 't1');
    expect(hint1.p).toBeCloseTo(0.3 + 0.7 * 0.2, 10);

    const hint2 = masteryAfterResult(undefined, true, 2, 't1');
    expect(hint2.p).toBeCloseTo(0.3 + 0.7 * 0.05, 10);

    const hint3 = masteryAfterResult(undefined, true, 3, 't1');
    expect(hint3.p).toBeCloseTo(hint2.p, 10);
  });

  it('오답은 p ← p × 0.75 이고 정답 과제 목록은 남긴다', () => {
    const next = masteryAfterResult(record('c1', 0.6, ['t1']), false, 0, 't2');

    expect(next.p).toBeCloseTo(0.45, 10);
    expect(next.passedTasks).toEqual(['t1']);
  });

  it('같은 과제를 다시 맞혀도 서로 다른 과제 수는 늘지 않는다', () => {
    const next = masteryAfterResult(record('c1', 0.5, ['t1']), true, 0, 't1');

    expect(next.p).toBeCloseTo(0.5 + 0.5 * 0.35, 10);
    expect(next.passedTasks).toEqual(['t1']);
    expect(distinctPassedTaskCount(next)).toBe(1);
  });

  it('p는 0~1을 벗어나지 않는다', () => {
    expect(masteryAfterResult(record('c1', 1), true, 0, 't1').p).toBe(1);
    expect(masteryAfterResult(record('c1', 0.9), false, 0, 't1').p).toBeCloseTo(0.675, 10);
    expect(masteryAfterResult(record('c1', Number.NaN), false, 0, 't1').p).toBe(0);
  });
});

describe('isMastered', () => {
  it('p ≥ 0.8 이고 서로 다른 과제 2개 이상일 때만 숙달이다', () => {
    expect(isMastered(record('c1', 0.8, ['t1', 't2']))).toBe(true);
    expect(isMastered(record('c1', 0.8, ['t1']))).toBe(false);
    expect(isMastered(record('c1', 0.7999, ['t1', 't2']))).toBe(false);
    expect(isMastered(record('c1', 0.9, ['t1', 't1']))).toBe(false);
    expect(isMastered(undefined)).toBe(false);
  });

  it('passedTasks가 없는 예전 기록은 과제 수 0으로 센다', () => {
    expect(distinctPassedTaskCount(record('c1', 0.9))).toBe(0);
    expect(isMastered(record('c1', 0.9))).toBe(false);
  });
});

describe('initialProbabilityFor', () => {
  const graph = buildKnowledgeGraph(
    {
      concepts: [
        { id: 'u.a', unit: 'u', label: 'A' },
        { id: 'u.b', unit: 'u', label: 'B', prerequisites: ['u.a'] },
        { id: 'u.c', unit: 'u', label: 'C', prerequisites: ['u.a', 'u.b'] },
      ],
    },
    { units: [{ id: 'u' }] },
  );

  it('선수가 없으면 0.3', () => {
    expect(initialProbabilityFor(graph, new Map(), 'u.a')).toBe(0.3);
  });

  it('선수 개념이 모두 숙달이면 0.5', () => {
    const records = new Map<string, MasteryRecord>([
      ['u.a', record('u.a', 0.85, ['t1', 't2'])],
      ['u.b', record('u.b', 0.9, ['t1', 't2'])],
    ]);

    expect(initialProbabilityFor(graph, records, 'u.c')).toBe(0.5);
  });

  it('선수 하나라도 미숙달이면 0.3', () => {
    const records = new Map<string, MasteryRecord>([
      ['u.a', record('u.a', 0.85, ['t1', 't2'])],
      ['u.b', record('u.b', 0.9, ['t1'])],
    ]);

    expect(initialProbabilityFor(graph, records, 'u.c')).toBe(0.3);
  });

  it('기록이 없는 개념은 0.3으로 본다', () => {
    const records = new Map<string, MasteryRecord>([['u.a', record('u.a', 0.85, ['t1', 't2'])]]);

    expect(initialProbabilityFor(graph, records, 'u.c')).toBe(0.3);
  });
});
