/**
 * 역추적과 부스터 고르기(docs/05-learning-engine.md §3).
 *
 * 시작 개념에서 선수 방향으로 BFS를 돌려 p < 0.6인 가장 얕은 개념을 고른다.
 * 같은 깊이면 p가 낮은 것, 그것도 같으면 개념 ID 순서다.
 */
import type { MasteryRecord } from '../storage/types';
import type { ContentActivity, ContentTask, UnitContent } from '../runner/types';
import { conceptPrerequisites, conceptsOfUnit, isConceptId, isUnitId } from './graph';
import type { KnowledgeGraph } from './graph';
import { initialProbabilityFor, isMastered } from './mastery';
import { masteryParams } from './params';

export interface BacktrackSearch {
  /** 현재 과제의 개념. target이 없을 때 BFS 시작점이 된다. */
  readonly taskConcepts: readonly string[];
  /** T012 ③ 요청의 대상(개념 ID 또는 단원 ID). */
  readonly target?: string;
  /** 이 깊이 미만은 건너뛴다. 부스터가 실패해 한 단계 더 거슬러 올라갈 때 쓴다. */
  readonly minDepth?: number;
}

export interface BacktrackCandidate {
  readonly conceptId: string;
  readonly depth: number;
  /** 0~1 숙달 확률. */
  readonly p: number;
}

function probabilityOf(
  graph: KnowledgeGraph,
  records: ReadonlyMap<string, MasteryRecord>,
  conceptId: string,
): number {
  const record = records.get(conceptId);
  if (record) return record.p;
  return initialProbabilityFor(graph, records, conceptId);
}

/**
 * 후보를 깊이 → 확률 → ID 순으로 돌려준다.
 * target이 있으면 그 개념(또는 단원의 개념들)도 깊이 0 후보에 넣는다.
 * target이 없으면 현재 과제의 개념은 후보에서 빼고, 그 선수부터 본다.
 */
export function findBacktrackCandidates(
  graph: KnowledgeGraph,
  records: ReadonlyMap<string, MasteryRecord>,
  search: BacktrackSearch,
): BacktrackCandidate[] {
  const minDepth = Math.max(0, search.minDepth ?? 0);
  if (minDepth > masteryParams.maxBacktrackDepth) return [];

  let roots: readonly string[];
  const includeRoots = search.target !== undefined;
  if (search.target !== undefined) {
    if (isConceptId(graph, search.target)) {
      roots = [search.target];
    } else if (isUnitId(graph, search.target)) {
      roots = conceptsOfUnit(graph, search.target);
    } else {
      return [];
    }
  } else {
    roots = search.taskConcepts;
  }

  const depthOf = new Map<string, number>();
  const queue: string[] = [];
  for (const root of roots) {
    if (!graph.concepts.has(root) || depthOf.has(root)) continue;
    depthOf.set(root, 0);
    queue.push(root);
  }

  const candidates: BacktrackCandidate[] = [];
  for (let index = 0; index < queue.length; index += 1) {
    const conceptId = queue[index];
    if (conceptId === undefined) continue;
    const depth = depthOf.get(conceptId) ?? 0;

    if (depth > masteryParams.maxBacktrackDepth) continue;
    if (depth >= minDepth && (depth > 0 || includeRoots)) {
      const p = probabilityOf(graph, records, conceptId);
      if (p < masteryParams.backtrackP) {
        candidates.push({ conceptId, depth, p });
      }
    }

    if (depth === masteryParams.maxBacktrackDepth) continue;
    for (const prerequisite of conceptPrerequisites(graph, conceptId)) {
      if (depthOf.has(prerequisite)) continue;
      depthOf.set(prerequisite, depth + 1);
      queue.push(prerequisite);
    }
  }

  return candidates.sort(
    (a, b) => a.depth - b.depth || a.p - b.p || a.conceptId.localeCompare(b.conceptId),
  );
}

/** 후보 하나만 필요할 때. */
export function findBacktrackCandidate(
  graph: KnowledgeGraph,
  records: ReadonlyMap<string, MasteryRecord>,
  search: BacktrackSearch,
): BacktrackCandidate | undefined {
  return findBacktrackCandidates(graph, records, search)[0];
}

/** 부스터로 열 활동과 과제. 활동 제목만 학생 화면에 보여 준다. */
export interface BoosterPlan {
  readonly conceptId: string;
  readonly unitId: string;
  readonly activity: ContentActivity;
  readonly tasks: readonly ContentTask[];
}

/**
 * 그 개념을 `concepts`에 가진 첫 과제부터 같은 활동의 과제를 최대 3개 고른다.
 * 콘텐츠에 그 개념을 가진 과제가 없으면 undefined(다음 후보 개념으로 넘어간다).
 */
export function boosterPlanFor(conceptId: string, content: UnitContent): BoosterPlan | undefined {
  for (const activity of content.activities) {
    const start = activity.tasks.findIndex((task) => task.concepts.includes(conceptId));
    if (start < 0) continue;
    const tasks = activity.tasks.slice(start, start + masteryParams.boosterTaskCount);
    if (tasks.length === 0) continue;
    return {
      conceptId,
      unitId: content.unit,
      activity,
      tasks,
    };
  }
  return undefined;
}

/** 후보 개념이 이미 숙달인지(부스터 후보에서 거르는 데 쓴다). */
export function isMasteredConcept(
  records: ReadonlyMap<string, MasteryRecord>,
  conceptId: string,
): boolean {
  return isMastered(records.get(conceptId));
}
