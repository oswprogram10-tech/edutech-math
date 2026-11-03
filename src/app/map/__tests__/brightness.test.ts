import { describe, expect, it } from 'vitest';
import type { LearningEvent, MasteryRecord } from '../../../core/storage';
import { brightnessByConcept, brightnessOf, sparkleConcepts } from '../brightness';

function record(
  learner: string,
  conceptId: string,
  p: number,
  passedTasks: readonly string[],
): MasteryRecord {
  return {
    id: `${learner}:${conceptId}`,
    learner,
    conceptId,
    p,
    passedTasks,
    updatedAt: 1,
  };
}

function backtracked(learner: string, to: string | undefined, outcome: string): LearningEvent {
  return {
    id: `e-${to ?? 'none'}-${outcome}`,
    learner,
    unit: 'g3s1u6',
    task: 'g3s1u6.A1.T1',
    engine: 'E05',
    verb: 'backtracked',
    t: 1,
    data: {
      from: 'g3s1u6.part-of-whole',
      ...(to === undefined ? {} : { to }),
      depth: 1,
      outcome,
    },
  };
}

describe('brightnessOf', () => {
  it('기록이 없으면 아직이다', () => {
    expect(brightnessOf(undefined)).toBe('missing');
  });

  it('확률이 높아도 서로 다른 과제 2개가 없으면 연습 중이다', () => {
    expect(brightnessOf({ p: 0.95, passedTasks: ['g3s1u6.A1.T1'] })).toBe('practicing');
  });

  it('서로 같은 과제를 여러 번 맞혀도 한 과제로 센다', () => {
    expect(brightnessOf({ p: 0.95, passedTasks: ['g3s1u6.A1.T1', 'g3s1u6.A1.T1'] })).toBe(
      'practicing',
    );
  });

  it('확률이 낮으면 과제 2개를 맞혀도 연습 중이다', () => {
    expect(brightnessOf({ p: 0.5, passedTasks: ['g3s1u6.A1.T1', 'g3s1u6.A1.T2'] })).toBe(
      'practicing',
    );
  });

  it('확률 0.8 이상이고 서로 다른 과제 2개면 숙달이다', () => {
    expect(brightnessOf({ p: 0.8, passedTasks: ['g3s1u6.A1.T1', 'g3s1u6.A1.T2'] })).toBe(
      'mastered',
    );
  });
});

describe('brightnessByConcept', () => {
  it('현재 학습자의 기록만 쓴다', () => {
    const map = brightnessByConcept(
      [
        record('7', 'g3s1u6.equal-parts', 0.9, ['g3s1u6.A1.T1', 'g3s1u6.A1.T2']),
        record('9', 'g3s1u6.unit-fraction', 0.9, ['g3s1u6.A2.T1', 'g3s1u6.A2.T2']),
      ],
      '7',
    );
    expect(map.get('g3s1u6.equal-parts')).toBe('mastered');
    expect(map.has('g3s1u6.unit-fraction')).toBe(false);
  });
});

describe('sparkleConcepts', () => {
  it('그 학습자의 backtracked·passed 이벤트의 to만 모은다', () => {
    const sparkles = sparkleConcepts(
      [
        backtracked('7', 'g3s1u6.unit-fraction', 'passed'),
        backtracked('7', 'g3s1u6.equal-parts', 'failed'),
        backtracked('9', 'g3s1u6.tenths-decimal', 'passed'),
        { ...backtracked('7', 'g3s1u6.part-of-whole', 'passed'), verb: 'failed' },
      ],
      '7',
    );
    expect([...sparkles]).toEqual(['g3s1u6.unit-fraction']);
  });

  it('to가 없거나 문자열이 아니면 넣지 않는다', () => {
    expect([...sparkleConcepts([backtracked('7', undefined, 'passed')], '7')]).toEqual([]);
  });
});
