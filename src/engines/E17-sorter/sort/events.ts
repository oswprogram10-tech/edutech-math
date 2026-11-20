/** E17 sort의 공개 이벤트·판정. 둘 다 순수 함수다. */
import type {
  EngineEvent,
  EnginePredicate,
  JsonValue,
  Observation,
} from '../../../core/engine-sdk';
import { allPlacedOf } from './reduce';
import type { SortAction, SortState } from './types';

export const SORT_EVENT_NAMES = ['card-placed', 'criterion-chosen', 'all-placed'] as const;

export function sortEmit(prev: SortState, next: SortState, action: SortAction): EngineEvent[] {
  const events: EngineEvent[] = [];
  if (action.type === 'move') {
    const bin = next.binOf[action.card] ?? null;
    if (bin !== null && bin !== (prev.binOf[action.card] ?? null)) {
      events.push({ name: 'card-placed', payload: { card: action.card, bin } });
    }
  }
  if (action.type === 'choose-criterion' && next.criterion !== null && prev.criterion === null) {
    events.push({ name: 'criterion-chosen', payload: { criterion: next.criterion } });
  }
  if (!allPlacedOf(prev) && allPlacedOf(next)) events.push({ name: 'all-placed' });
  return events;
}

function recordOf(value: JsonValue | undefined): Readonly<Record<string, JsonValue>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function stringArg(args: JsonValue | undefined, key: string): string | null {
  const value = recordOf(args)[key];
  return typeof value === 'string' ? value : null;
}

function list(observation: Observation, key: string): string[] {
  const value = observation[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const set = new Set(left);
  return right.every((item) => set.has(item));
}

function binOfCard(observation: Observation, card: string | null): string | null {
  if (card === null) return null;
  const value = recordOf(observation['binOf'])[card];
  return typeof value === 'string' ? value : null;
}

export const sortPredicates: Readonly<Record<string, EnginePredicate>> = {
  allPlaced: (observation) => observation['allPlaced'] === true,

  criterionIs: (observation, args) => {
    const criterion = stringArg(args, 'c');
    return criterion !== null && observation['criterion'] === criterion;
  },

  pureBy: (observation, args) => {
    const attribute = stringArg(args, 'attribute');
    return attribute !== null && list(observation, 'pureDistinctBy').includes(attribute);
  },

  noMismatch: (observation) => {
    if (observation['criterion'] === null || observation['criterion'] === undefined) return false;
    const placed = Object.values(recordOf(observation['bins'])).reduce(
      (sum: number, ids) => sum + (Array.isArray(ids) ? ids.length : 0),
      0,
    );
    return placed > 0 && list(observation, 'mismatched').length === 0;
  },

  countsCorrect: (observation) => observation['countsCorrect'] === true,

  labelsMatchBy: (observation, args) => {
    const attribute = stringArg(args, 'attribute');
    return attribute !== null && list(observation, 'labelsMatchBy').includes(attribute);
  },

  sameBin: (observation, args) => {
    const first = binOfCard(observation, stringArg(args, 'a'));
    const second = binOfCard(observation, stringArg(args, 'b'));
    return first !== null && first === second;
  },

  removedOnly: (observation, args) => {
    const cards = recordOf(args)['cards'];
    const expected = Array.isArray(cards)
      ? cards.filter((item): item is string => typeof item === 'string')
      : [];
    return sameSet(list(observation, 'removed'), expected);
  },

  criterionChanged: (observation) => {
    const history = list(observation, 'criterionHistory');
    return new Set(history).size >= 2;
  },
};
