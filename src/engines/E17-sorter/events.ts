/**
 * E17의 공개 이벤트·판정. 둘 다 순수 함수다.
 *
 * 이벤트: `card-placed`, `question-asked`, `secret-found`, `swap-answered`,
 * `shape-changed`, `tree-complete`.
 */
import type { EngineEvent, EnginePredicate, JsonValue, Observation } from '../../core/engine-sdk';
import { blanksCorrect, hierarchyProps, quadNode } from './properties';
import type { ConstraintToggle, SorterAction, SorterState } from './types';

export const EVENT_NAMES = [
  'card-placed',
  'question-asked',
  'secret-found',
  'swap-answered',
  'shape-changed',
  'tree-complete',
] as const;

function recordOf(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function stringArg(args: Readonly<Record<string, JsonValue>>, key: string): string | null {
  const value = args[key];
  return typeof value === 'string' ? value : null;
}

function numberArg(args: Readonly<Record<string, JsonValue>>, key: string): number | null {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringList(value: JsonValue | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const set = new Set(left);
  return right.every((item) => set.has(item));
}

function observationStrings(observation: Observation, key: string): string[] {
  return stringList(observation[key]);
}

/** 오버레이·View가 쓰는 현재 모양 이름. */
function nodeOf(state: SorterState): string | null {
  if (state.mode !== 'hierarchy') return null;
  return quadNode(hierarchyProps(state.toggles).props, state.settings.trapezoidDefinition);
}

export function emit(prev: SorterState, next: SorterState, action: SorterAction): EngineEvent[] {
  if (prev === next) return [];
  const events: EngineEvent[] = [];

  if (prev.mode === 'venn' && next.mode === 'venn' && action.type === 'place') {
    const cell = next.placements[action.card];
    if (cell !== null && cell !== undefined) {
      events.push({ name: 'card-placed', payload: { card: action.card, cell } });
    }
  }

  if (prev.mode === 'secret-rule' && next.mode === 'secret-rule') {
    if (action.type === 'ask' && next.asked.length > prev.asked.length) {
      const asked = next.asked[next.asked.length - 1];
      if (asked) events.push({ name: 'question-asked', payload: { question: asked.question } });
    }
    if (!prev.solved && next.solved) {
      events.push({ name: 'secret-found', payload: { questionCount: next.asked.length } });
    }
    if (action.type === 'swap-answer' && next.swap.log.length > prev.swap.log.length) {
      const entry = next.swap.log[next.swap.log.length - 1];
      if (entry) {
        events.push({ name: 'swap-answered', payload: { correct: entry.answer === entry.truth } });
      }
    }
  }

  if (prev.mode === 'hierarchy' && next.mode === 'hierarchy') {
    const before = nodeOf(prev);
    const after = nodeOf(next);
    if (after !== null && before !== after) {
      events.push({ name: 'shape-changed', payload: { node: after } });
    }
    if (
      !blanksCorrect(prev.blanks, prev.settings.treeBlanks) &&
      blanksCorrect(next.blanks, next.settings.treeBlanks)
    ) {
      events.push({ name: 'tree-complete' });
    }
  }

  return events;
}

export const predicates: Readonly<Record<string, EnginePredicate>> = {
  allCardsCorrect: (observation) =>
    observation['allCorrect'] === true && observation['allPlaced'] === true,

  impossibleMarkedAre: (observation, args) => {
    const expected = stringList(recordOf(args)['cells']);
    return sameSet(observationStrings(observation, 'impossibleMarked'), expected);
  },

  cardInCell: (observation, args) => {
    const record = recordOf(args);
    const card = stringArg(record, 'card');
    const cell = stringArg(record, 'cell');
    if (card === null || cell === null) return false;
    return placementsOf(observation)[card] === cell;
  },

  solvedConsistently: (observation) =>
    observation['solved'] === true &&
    observationStrings(observation, 'wrongEliminations').length === 0,

  solvedWithin: (observation, args) => {
    const max = numberArg(recordOf(args), 'max');
    const count = observation['questionCount'];
    return (
      observation['solved'] === true && max !== null && typeof count === 'number' && count <= max
    );
  },

  askedSetIs: (observation, args) => {
    const expected = stringList(recordOf(args)['questions']);
    return sameSet(observationStrings(observation, 'askedQuestions'), expected);
  },

  swapNoErrors: (observation) =>
    observation['swapDone'] === true && observation['swapErrors'] === 0,

  togglesAre: (observation, args) => {
    const expected = stringList(recordOf(args)['toggles']) as ConstraintToggle[];
    return sameSet(observationStrings(observation, 'toggles'), expected);
  },

  currentNodeIs: (observation, args) => {
    const node = stringArg(recordOf(args), 'node');
    return node !== null && observation['currentNode'] === node;
  },

  shapeIs: (observation, args) => {
    const name = stringArg(recordOf(args), 'name');
    return name !== null && observationStrings(observation, 'names').includes(name);
  },

  treeComplete: (observation) => observation['blanksCorrect'] === true,

  hasMisconception: (observation, args) => {
    const code = stringArg(recordOf(args), 'code');
    return code !== null && observationStrings(observation, 'misconceptions').includes(code);
  },
};

function placementsOf(observation: Observation): Readonly<Record<string, JsonValue>> {
  const value = observation['placements'];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}
