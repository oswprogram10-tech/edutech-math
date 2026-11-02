import { describe, expect, it } from 'vitest';
import {
  buildKnowledgeGraph,
  conceptPrerequisites,
  conceptsOfUnit,
  isConceptId,
  isUnitId,
} from '../graph';
import type { ConceptInput, ConceptsInput, UnitInput, UnitsInput } from '../graph';
import { loadKnowledgeGraph } from '../data';

function conceptsOf(items: readonly ConceptInput[]): ConceptsInput {
  return { concepts: items };
}

function unitsOf(items: readonly UnitInput[]): UnitsInput {
  return { units: items };
}

const baseConcept = (
  id: string,
  unit: string,
  extra: Partial<ConceptInput> = {},
): ConceptInput => ({
  id,
  unit,
  label: id,
  ...extra,
});

describe('buildKnowledgeGraph', () => {
  it('단원 ID 선수를 그 단원의 개념 전체로 펼친다', () => {
    const graph = buildKnowledgeGraph(
      conceptsOf([
        baseConcept('u0.a', 'u0'),
        baseConcept('u0.b', 'u0'),
        baseConcept('u1.c', 'u1', { prerequisites: ['u0'] }),
      ]),
      unitsOf([{ id: 'u0' }, { id: 'u1', prerequisites: ['u0'] }]),
    );

    expect(conceptPrerequisites(graph, 'u1.c')).toEqual(['u0.a', 'u0.b']);
    expect(conceptsOfUnit(graph, 'u0')).toEqual(['u0.a', 'u0.b']);
    expect(graph.units.get('u1')?.prerequisites).toEqual(['u0']);
    expect(graph.conceptOrder).toEqual(['u0.a', 'u0.b', 'u1.c']);
  });

  it('개념 ID 선수는 그대로 두고 중복만 지운다', () => {
    const graph = buildKnowledgeGraph(
      conceptsOf([
        baseConcept('u.a', 'u'),
        baseConcept('u.b', 'u'),
        baseConcept('u.c', 'u', { prerequisites: ['u.a', 'u.a', 'u.b'] }),
      ]),
      unitsOf([{ id: 'u' }]),
    );

    expect(conceptPrerequisites(graph, 'u.c')).toEqual(['u.a', 'u.b']);
    expect(isConceptId(graph, 'u.a')).toBe(true);
    expect(isUnitId(graph, 'u')).toBe(true);
    expect(isConceptId(graph, 'u')).toBe(false);
    expect(isUnitId(graph, 'u.a')).toBe(false);
  });

  it('없는 ID는 조용히 넘기지 않고 오류를 낸다', () => {
    expect(() =>
      buildKnowledgeGraph(
        conceptsOf([baseConcept('u.a', 'u', { prerequisites: ['nope'] })]),
        unitsOf([{ id: 'u' }]),
      ),
    ).toThrow(/선수가 없습니다/);

    expect(() =>
      buildKnowledgeGraph(conceptsOf([baseConcept('u.a', 'missing')]), unitsOf([{ id: 'u' }])),
    ).toThrow(/단원이 없습니다/);

    expect(() =>
      buildKnowledgeGraph(
        conceptsOf([baseConcept('u.a', 'u')]),
        unitsOf([{ id: 'u', prerequisites: ['missing'] }]),
      ),
    ).toThrow(/선수 단원이 없습니다/);
  });

  it('중복 ID와 빈 이름을 거부한다', () => {
    expect(() =>
      buildKnowledgeGraph(
        conceptsOf([baseConcept('u.a', 'u'), baseConcept('u.a', 'u')]),
        unitsOf([{ id: 'u' }]),
      ),
    ).toThrow(/개념 ID 중복/);

    expect(() =>
      buildKnowledgeGraph(
        conceptsOf([baseConcept('u.a', 'u')]),
        unitsOf([{ id: 'u' }, { id: 'u' }]),
      ),
    ).toThrow(/단원 ID 중복/);

    expect(() =>
      buildKnowledgeGraph(
        conceptsOf([baseConcept('u.a', 'u', { label: '' })]),
        unitsOf([{ id: 'u' }]),
      ),
    ).toThrow(/개념 이름이 비어 있습니다/);
  });

  it('개념 순환과 단원 순환을 찾아낸다', () => {
    expect(() =>
      buildKnowledgeGraph(
        conceptsOf([
          baseConcept('u.a', 'u', { prerequisites: ['u.b'] }),
          baseConcept('u.b', 'u', { prerequisites: ['u.a'] }),
        ]),
        unitsOf([{ id: 'u' }]),
      ),
    ).toThrow(/개념 순환/);

    expect(() =>
      buildKnowledgeGraph(
        conceptsOf([baseConcept('u.a', 'u')]),
        unitsOf([
          { id: 'u', prerequisites: ['v'] },
          { id: 'v', prerequisites: ['u'] },
        ]),
      ),
    ).toThrow(/단원 순환/);
  });

  it('같은 단원을 선수로 걸면 자기 자신이 펼쳐져 순환이 된다', () => {
    expect(() =>
      buildKnowledgeGraph(
        conceptsOf([baseConcept('u.a', 'u', { prerequisites: ['u'] }), baseConcept('u.b', 'u')]),
        unitsOf([{ id: 'u' }]),
      ),
    ).toThrow(/개념 순환/);
  });

  it('지금 data/concepts.json·data/units.json이 DAG로 통과한다', async () => {
    const graph = await loadKnowledgeGraph();

    expect(graph.units.size).toBe(71);
    expect(graph.concepts.size).toBe(279);
    expect(graph.conceptOrder).toHaveLength(279);

    for (const node of graph.concepts.values()) {
      for (const prerequisite of node.prerequisites) {
        expect(graph.concepts.has(prerequisite)).toBe(true);
      }
    }

    expect(conceptPrerequisites(graph, 'g3s2u4.improper-mixed')).toContain('g3s1u6.unit-fraction');
    expect(conceptPrerequisites(graph, 'g5s1u4.common-denominator')).toEqual(
      expect.arrayContaining(['g5s1u4.multiply-same', 'g5s1u2.common-multiple-lcm']),
    );
  });
});
