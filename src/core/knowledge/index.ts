/** T013 지식 그래프·숙달·역추적 공개 API. */
export {
  buildKnowledgeGraph,
  conceptPrerequisites,
  conceptsOfUnit,
  isConceptId,
  isUnitId,
} from './graph';
export { KnowledgeGraphError } from './graph';
export type {
  ConceptInput,
  ConceptNode,
  ConceptsInput,
  KnowledgeGraph,
  UnitInput,
  UnitNode,
  UnitsInput,
} from './graph';

export { masteryParams } from './params';

export {
  distinctPassedTaskCount,
  initialProbability,
  initialProbabilityFor,
  isMastered,
  masteryAfterResult,
} from './mastery';
export type { MasteryLike } from './mastery';

export {
  boosterPlanFor,
  findBacktrackCandidate,
  findBacktrackCandidates,
  isMasteredConcept,
} from './backtrack';
export type { BacktrackCandidate, BacktrackSearch, BoosterPlan } from './backtrack';

export { loadKnowledgeGraph, resetKnowledgeGraph } from './data';
