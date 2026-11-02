/**
 * 지식 그래프(docs/05-learning-engine.md §1).
 *
 * `data/concepts.json`과 `data/units.json`을 받아 개념 노드와 선수 관계를 만든다.
 * 개념의 선수에 단원 ID가 오면 그 단원의 개념 전체로 펼친다.
 * 없는 ID와 순환은 데이터 오류이므로 조용히 넘기지 않고 던진다.
 */
export interface ConceptInput {
  readonly id: string;
  readonly unit: string;
  readonly label: string;
  readonly prerequisites?: readonly string[];
}

export interface UnitInput {
  readonly id: string;
  readonly prerequisites?: readonly string[];
}

export interface ConceptsInput {
  readonly concepts: readonly ConceptInput[];
}

export interface UnitsInput {
  readonly units: readonly UnitInput[];
}

/** 펼친 뒤의 개념 노드. `prerequisites`는 모두 개념 ID다. */
export interface ConceptNode {
  readonly id: string;
  readonly unit: string;
  readonly label: string;
  readonly prerequisites: readonly string[];
}

export interface UnitNode {
  readonly id: string;
  readonly prerequisites: readonly string[];
  readonly concepts: readonly string[];
}

export interface KnowledgeGraph {
  readonly concepts: ReadonlyMap<string, ConceptNode>;
  readonly units: ReadonlyMap<string, UnitNode>;
  /** concepts.json의 원래 순서. 같은 깊이·확률의 후보를 안정적으로 정렬할 때 쓴다. */
  readonly conceptOrder: readonly string[];
}

export class KnowledgeGraphError extends Error {
  readonly code = 'KNOWLEDGE_GRAPH';

  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeGraphError';
  }
}

function fail(message: string): never {
  throw new KnowledgeGraphError(message);
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function assertAcyclic(edges: ReadonlyMap<string, readonly string[]>, label: string): void {
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];

  const visit = (node: string): void => {
    const current = state.get(node);
    if (current === 2) return;
    if (current === 1) {
      fail(`${label} 순환: ${[...stack, node].join(' → ')}`);
    }
    state.set(node, 1);
    stack.push(node);
    for (const next of edges.get(node) ?? []) visit(next);
    stack.pop();
    state.set(node, 2);
  };

  for (const node of edges.keys()) visit(node);
}

/**
 * 그래프를 만든다. 입력은 JSON을 그대로 넘겨도 되도록 최소 모양만 확인한다.
 * 같은 단원의 개념을 단원 선수로 걸면 자기 자신도 펼쳐지므로 순환으로 잡힌다.
 */
export function buildKnowledgeGraph(
  conceptsInput: ConceptsInput,
  unitsInput: UnitsInput,
): KnowledgeGraph {
  const rawUnits = new Map<string, UnitInput>();
  for (const unit of unitsInput.units) {
    if (unit.id.length === 0) fail('단원 ID가 비어 있습니다.');
    if (rawUnits.has(unit.id)) fail(`단원 ID 중복: ${unit.id}`);
    rawUnits.set(unit.id, unit);
  }

  const rawConcepts = new Map<string, ConceptInput>();
  const conceptOrder: string[] = [];
  for (const concept of conceptsInput.concepts) {
    if (concept.id.length === 0) fail('개념 ID가 비어 있습니다.');
    if (rawConcepts.has(concept.id)) fail(`개념 ID 중복: ${concept.id}`);
    if (concept.label.length === 0) fail(`개념 이름이 비어 있습니다: ${concept.id}`);
    if (!rawUnits.has(concept.unit)) {
      fail(`개념 ${concept.id}의 단원이 없습니다: ${concept.unit}`);
    }
    rawConcepts.set(concept.id, concept);
    conceptOrder.push(concept.id);
  }

  const unitConcepts = new Map<string, string[]>();
  for (const unitId of rawUnits.keys()) unitConcepts.set(unitId, []);
  for (const concept of conceptsInput.concepts) {
    unitConcepts.get(concept.unit)?.push(concept.id);
  }

  const unitPrerequisites = new Map<string, readonly string[]>();
  for (const unit of unitsInput.units) {
    const prerequisites = uniqueStrings(unit.prerequisites ?? []);
    for (const prerequisite of prerequisites) {
      if (!rawUnits.has(prerequisite)) {
        fail(`단원 ${unit.id}의 선수 단원이 없습니다: ${prerequisite}`);
      }
    }
    unitPrerequisites.set(unit.id, prerequisites);
  }

  // 개념의 선수에 단원 ID가 오면 그 단원의 개념 전체로 펼친다.
  const conceptPrerequisites = new Map<string, readonly string[]>();
  for (const concept of conceptsInput.concepts) {
    const expanded: string[] = [];
    for (const prerequisite of uniqueStrings(concept.prerequisites ?? [])) {
      if (rawConcepts.has(prerequisite)) {
        if (prerequisite !== concept.id) expanded.push(prerequisite);
        continue;
      }
      const inUnit = unitConcepts.get(prerequisite);
      if (!inUnit) {
        fail(`개념 ${concept.id}의 선수가 없습니다: ${prerequisite}`);
      }
      expanded.push(...inUnit);
    }
    conceptPrerequisites.set(concept.id, uniqueStrings(expanded));
  }

  assertAcyclic(unitPrerequisites, '단원');
  assertAcyclic(conceptPrerequisites, '개념');

  const concepts = new Map<string, ConceptNode>();
  for (const concept of conceptsInput.concepts) {
    concepts.set(concept.id, {
      id: concept.id,
      unit: concept.unit,
      label: concept.label,
      prerequisites: conceptPrerequisites.get(concept.id) ?? [],
    });
  }

  const units = new Map<string, UnitNode>();
  for (const unit of unitsInput.units) {
    units.set(unit.id, {
      id: unit.id,
      prerequisites: unitPrerequisites.get(unit.id) ?? [],
      concepts: unitConcepts.get(unit.id) ?? [],
    });
  }

  return { concepts, units, conceptOrder };
}

export function isConceptId(graph: KnowledgeGraph, id: string): boolean {
  return graph.concepts.has(id);
}

export function isUnitId(graph: KnowledgeGraph, id: string): boolean {
  return graph.units.has(id);
}

export function conceptPrerequisites(graph: KnowledgeGraph, conceptId: string): readonly string[] {
  return graph.concepts.get(conceptId)?.prerequisites ?? [];
}

export function conceptsOfUnit(graph: KnowledgeGraph, unitId: string): readonly string[] {
  return graph.units.get(unitId)?.concepts ?? [];
}
