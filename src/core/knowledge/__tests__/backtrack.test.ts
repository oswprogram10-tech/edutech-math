import { describe, expect, it } from 'vitest';
import type { ContentTask, UnitContent } from '../../runner/types';
import type { MasteryRecord } from '../../storage/types';
import {
  boosterPlanFor,
  findBacktrackCandidate,
  findBacktrackCandidates,
  isMasteredConcept,
} from '../backtrack';
import type { KnowledgeGraph } from '../graph';
import { buildKnowledgeGraph } from '../graph';
import { loadKnowledgeGraph } from '../data';
import { g3s1u6Content } from './fixtures/content';

function record(
  conceptId: string,
  p: number,
  passedTasks: readonly string[] = ['t1', 't2'],
): MasteryRecord {
  return {
    id: `0:${conceptId}`,
    learner: '0',
    conceptId,
    p,
    passedTasks,
    updatedAt: 1,
  };
}

/**
 * u.a ← u.b ← u.c ← u.d ← u.e 이고 u.f도 u.a의 선수다.
 * 깊이 제한·동률 정렬을 확인하기에 충분한 작은 그래프.
 */
const graph: KnowledgeGraph = buildKnowledgeGraph(
  {
    concepts: [
      { id: 'u.a', unit: 'u', label: 'A' },
      { id: 'u.b', unit: 'u', label: 'B', prerequisites: ['u.a'] },
      { id: 'u.c', unit: 'u', label: 'C', prerequisites: ['u.b'] },
      { id: 'u.d', unit: 'u', label: 'D', prerequisites: ['u.c'] },
      { id: 'u.e', unit: 'u', label: 'E', prerequisites: ['u.d'] },
      { id: 'u.f', unit: 'u', label: 'F', prerequisites: ['u.a'] },
    ],
  },
  { units: [{ id: 'u' }] },
);

function ids(candidates: readonly { conceptId: string }[]): string[] {
  return candidates.map((candidate) => candidate.conceptId);
}

describe('findBacktrackCandidates', () => {
  it('target이 있으면 그 개념도 깊이 0 후보에 넣는다', () => {
    const candidates = findBacktrackCandidates(graph, new Map(), {
      taskConcepts: ['u.c'],
      target: 'u.c',
    });

    expect(ids(candidates)).toEqual(['u.c', 'u.b', 'u.a']);
    expect(candidates.map((candidate) => candidate.depth)).toEqual([0, 1, 2]);
  });

  it('target이 없으면 현재 과제의 개념은 빼고 선수부터 본다', () => {
    const candidates = findBacktrackCandidates(graph, new Map(), {
      taskConcepts: ['u.c'],
    });

    expect(ids(candidates)).toEqual(['u.b', 'u.a']);
    expect(findBacktrackCandidate(graph, new Map(), { taskConcepts: ['u.c'] })?.conceptId).toBe(
      'u.b',
    );
  });

  it('최대 깊이 3까지만 내려간다', () => {
    const fromD = findBacktrackCandidates(graph, new Map(), {
      taskConcepts: ['u.d'],
      target: 'u.d',
    });
    expect(ids(fromD)).toEqual(['u.d', 'u.c', 'u.b', 'u.a']);

    const fromE = findBacktrackCandidates(graph, new Map(), {
      taskConcepts: ['u.e'],
      target: 'u.e',
    });
    expect(ids(fromE)).toEqual(['u.e', 'u.d', 'u.c', 'u.b']);
  });

  it('minDepth보다 얕은 후보는 건너뛴다', () => {
    const depth1 = findBacktrackCandidates(graph, new Map(), {
      taskConcepts: ['u.c'],
      minDepth: 1,
    });
    expect(ids(depth1)).toEqual(['u.b', 'u.a']);

    const depth2 = findBacktrackCandidates(graph, new Map(), {
      taskConcepts: ['u.c'],
      minDepth: 2,
    });
    expect(ids(depth2)).toEqual(['u.a']);

    expect(
      findBacktrackCandidates(graph, new Map(), { taskConcepts: ['u.c'], minDepth: 4 }),
    ).toEqual([]);
  });

  it('같은 깊이면 p가 낮은 것, 그것도 같으면 개념 ID 순서다', () => {
    const records = new Map<string, MasteryRecord>([
      ['u.b', record('u.b', 0.1)],
      ['u.c', record('u.c', 0.2)],
    ]);

    const candidates = findBacktrackCandidates(graph, records, {
      taskConcepts: ['u.f'],
      target: 'u',
    });

    // 단원 target은 깊이 0에 그 단원의 개념 전부를 넣는다. p가 낮은 u.b가 먼저다.
    expect(candidates[0]?.conceptId).toBe('u.b');
    expect(candidates[0]?.p).toBeCloseTo(0.1, 10);
    expect(ids(candidates.filter((candidate) => candidate.depth === 0))).toEqual([
      'u.b',
      'u.c',
      'u.a',
      'u.d',
      'u.e',
      'u.f',
    ]);
  });

  it('p가 0.6 이상인 개념은 후보에서 뺀다', () => {
    const records = new Map<string, MasteryRecord>([
      ['u.a', record('u.a', 0.6)],
      ['u.b', record('u.b', 0.9)],
      ['u.c', record('u.c', 0.2)],
    ]);

    const candidates = findBacktrackCandidates(graph, records, {
      taskConcepts: ['u.c'],
      target: 'u.c',
    });

    expect(ids(candidates)).toEqual(['u.c']);
  });

  it('후보가 없거나 모르는 target이면 빈 배열', () => {
    const allMastered = new Map<string, MasteryRecord>(
      [...graph.concepts.keys()].map((id) => [id, record(id, 0.9)]),
    );

    expect(
      findBacktrackCandidates(graph, allMastered, { taskConcepts: ['u.c'], target: 'u' }),
    ).toEqual([]);
    expect(
      findBacktrackCandidates(graph, new Map(), { taskConcepts: ['u.c'], target: 'nope' }),
    ).toEqual([]);
  });

  it('isMasteredConcept는 p와 서로 다른 과제 수를 함께 본다', () => {
    const records = new Map<string, MasteryRecord>([
      ['u.a', record('u.a', 0.85)],
      ['u.b', record('u.b', 0.85, ['t1'])],
    ]);

    expect(isMasteredConcept(records, 'u.a')).toBe(true);
    expect(isMasteredConcept(records, 'u.b')).toBe(false);
    expect(isMasteredConcept(records, 'u.c')).toBe(false);
  });

  it('실데이터에서 g4s2u1.unit-fraction-count → g3s1u6.unit-fraction 경로가 깊이 2다', async () => {
    const real = await loadKnowledgeGraph();

    const withTarget = findBacktrackCandidates(real, new Map(), {
      taskConcepts: ['g5s1u4.common-denominator'],
      target: 'g4s2u1.unit-fraction-count',
    });
    expect(withTarget[0]).toMatchObject({ conceptId: 'g4s2u1.unit-fraction-count', depth: 0 });

    const deeper = findBacktrackCandidates(real, new Map(), {
      taskConcepts: ['g5s1u4.common-denominator'],
      target: 'g4s2u1.unit-fraction-count',
      minDepth: 2,
    });
    expect(deeper[0]).toMatchObject({ conceptId: 'g3s1u6.unit-fraction', depth: 2 });
    expect(boosterPlanFor('g3s1u6.unit-fraction', g3s1u6Content)).toBeDefined();
  });
});

function task(id: string, concepts: readonly string[]): ContentTask {
  return {
    id,
    prompt: id,
    engine: 'E00',
    mode: 'free',
    cpa: 'A',
    config: {},
    goal: { kind: 'equals', path: 'response.ans.value', value: '0' },
    hints: [],
    concepts: [...concepts],
    submit: 'button',
  };
}

describe('boosterPlanFor', () => {
  it('그 개념을 가진 첫 과제부터 같은 활동의 과제 3개를 고른다', () => {
    const content: UnitContent = {
      unit: 'u',
      title: 'U',
      activities: [
        {
          id: 'u.A1',
          title: 'A1',
          tasks: [
            task('u.A1.T0', ['other']),
            task('u.A1.T1', ['target']),
            task('u.A1.T2', ['target']),
            task('u.A1.T3', ['target']),
            task('u.A1.T4', ['target']),
          ],
        },
      ],
    };

    const plan = boosterPlanFor('target', content);

    expect(plan?.conceptId).toBe('target');
    expect(plan?.unitId).toBe('u');
    expect(plan?.activity.id).toBe('u.A1');
    expect(plan?.tasks.map((item) => item.id)).toEqual(['u.A1.T1', 'u.A1.T2', 'u.A1.T3']);
  });

  it('개념을 가진 과제가 없으면 undefined다', () => {
    expect(boosterPlanFor('nope', g3s1u6Content)).toBeUndefined();
  });

  it('부스터 콘텐츠는 학년·단원 ID가 아니라 활동 제목만 쓴다', () => {
    const plan = boosterPlanFor('g3s1u6.unit-fraction', g3s1u6Content);

    expect(plan?.activity.title).toBe('단위분수 알아보기');
    expect(plan?.tasks).toHaveLength(3);
  });
});
