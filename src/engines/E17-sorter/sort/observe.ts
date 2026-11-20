/**
 * E17 sort의 관찰 결과. 판정·힌트는 이 값만 본다.
 * 정답 상자·정답 개수는 `valueCounts`(기준을 고른 뒤)와 `countsCorrect` 밖에 넣지 않는다.
 */
import type { Observation } from '../../../core/engine-sdk';
import { deckAttributes, deckDefinition, valueKey } from '../decks';
import type { SortCard } from '../decks';
import { criterionValues, parseIcon } from './criteria';
import { activeBins, allPlacedOf } from './reduce';
import { PRETTY } from './types';
import type { BinId, SortState } from './types';

export interface SortFacts {
  readonly bins: Readonly<Record<string, readonly string[]>>;
  readonly cards: ReadonlyMap<string, SortCard>;
  readonly binIds: readonly BinId[];
}

export function sortFacts(state: SortState): SortFacts {
  const definition = deckDefinition(state.settings.deck);
  const cards = new Map(definition.cards.map((card) => [card.id, card]));
  const binIds = activeBins(state);
  const bins: Record<string, string[]> = {};
  for (const bin of binIds) bins[bin] = [];
  for (const id of state.settings.cards) {
    const bin = state.binOf[id] ?? null;
    if (bin !== null) bins[bin]?.push(id);
  }
  return { bins, cards, binIds };
}

function valuesIn(
  ids: readonly string[],
  cards: ReadonlyMap<string, SortCard>,
  attribute: string,
): Set<string> {
  const values = new Set<string>();
  for (const id of ids) {
    const card = cards.get(id);
    const value = card ? valueKey(card, attribute) : null;
    if (value !== null) values.add(value);
  }
  return values;
}

function filledBins(facts: SortFacts): (readonly string[])[] {
  return facts.binIds.map((bin) => facts.bins[bin] ?? []).filter((ids) => ids.length > 0);
}

/** 비어 있지 않은 상자가 모두 그 속성으로 한 값만 가지는 속성들(`pretty` 제외). */
export function pureAttributes(state: SortState, facts: SortFacts): string[] {
  const filled = filledBins(facts);
  if (filled.length === 0) return [];
  return deckAttributes(state.settings.deck).filter((attribute) =>
    filled.every((ids) => valuesIn(ids, facts.cards, attribute).size === 1),
  );
}

/** pureBy이면서 상자 값이 서로 다른 속성들. */
export function distinctPureAttributes(state: SortState, facts: SortFacts): string[] {
  const filled = filledBins(facts);
  return pureAttributes(state, facts).filter((attribute) => {
    const seen = filled.map((ids) => [...valuesIn(ids, facts.cards, attribute)][0]);
    return new Set(seen).size === seen.length;
  });
}

function mismatchedCards(state: SortState, facts: SortFacts): string[] {
  const criterion = state.criterion;
  if (criterion === null || criterion === PRETTY) return [];
  const values = criterionValues(state.settings.deck, criterion);
  const result: string[] = [];
  facts.binIds.forEach((bin, index) => {
    const expected = values[index];
    for (const id of facts.bins[bin] ?? []) {
      const card = facts.cards.get(id);
      if (card && valueKey(card, criterion) !== expected) result.push(id);
    }
  });
  return result.sort();
}

/** 비어 있지 않은 모든 상자의 이름 아이콘이 그 속성이고 상자 카드의 값과 같은 속성들. */
function labelsMatch(state: SortState, facts: SortFacts): string[] {
  if (state.settings.binLabels !== 'student-choice-icon') return [];
  const filled = facts.binIds.filter((bin) => (facts.bins[bin] ?? []).length > 0);
  if (filled.length === 0) return [];
  return deckAttributes(state.settings.deck).filter((attribute) => {
    const seen: string[] = [];
    for (const bin of filled) {
      const icon = state.icons[bin] ?? null;
      const parsed = icon === null ? null : parseIcon(icon);
      if (parsed === null || parsed.attribute !== attribute) return false;
      const values = valuesIn(facts.bins[bin] ?? [], facts.cards, attribute);
      if (values.size !== 1 || !values.has(parsed.value)) return false;
      seen.push(parsed.value);
    }
    return new Set(seen).size === seen.length;
  });
}

function misconceptionsOf(state: SortState, facts: SortFacts): string[] {
  const found = new Set<string>();
  const attributes = deckAttributes(state.settings.deck);
  const placedCount = facts.binIds.reduce((sum, bin) => sum + (facts.bins[bin]?.length ?? 0), 0);
  const multi = filledBins(facts).filter((ids) => ids.length >= 2);

  if (placedCount >= 4) {
    for (const ids of multi) {
      if (attributes.every((attribute) => valuesIn(ids, facts.cards, attribute).size > 1)) {
        found.add('MC-SORT-INCONSISTENT');
      }
    }
  }

  if (state.settings.deck === 'classroom-objects-12') {
    for (const ids of multi) {
      const mixedShape = valuesIn(ids, facts.cards, 'shapeFamily').size > 1;
      const sameColor = valuesIn(ids, facts.cards, 'color').size === 1;
      const sameSize = valuesIn(ids, facts.cards, 'size').size === 1;
      if (mixedShape && (sameColor || sameSize)) found.add('MC-SHAPE-BY-COLOR-SIZE');
    }
    const placed = facts.binIds.flatMap((bin) =>
      (facts.bins[bin] ?? []).map((id) => ({ id, bin })),
    );
    for (const first of placed) {
      for (const second of placed) {
        if (first.bin === second.bin) continue;
        const a = facts.cards.get(first.id);
        const b = facts.cards.get(second.id);
        if (!a || !b) continue;
        if (
          a.attrs['shapeFamily'] === b.attrs['shapeFamily'] &&
          a.attrs['orientation'] !== b.attrs['orientation']
        ) {
          found.add('MC-SHAPE-ORIENTATION');
        }
      }
    }
  }

  if (state.settings.countTable === 'student') {
    for (const bin of facts.binIds) {
      const typed = state.counts[bin] ?? null;
      if (typed !== null && Math.abs(typed - (facts.bins[bin]?.length ?? 0)) === 1) {
        found.add('MC-COUNT-ONE-TO-ONE');
      }
    }
  }
  return [...found].sort();
}

export function sortObservation(state: SortState): Observation {
  const facts = sortFacts(state);
  const cardIds = state.settings.cards;
  const allPlaced = allPlacedOf(state);
  const tray = cardIds.filter((id) => (state.binOf[id] ?? null) === null);

  const binLabels: Record<string, string | null> = {};
  const counts: Record<string, number | null> = {};
  facts.binIds.forEach((bin, index) => {
    if (state.settings.binLabels === 'criterion-values' && state.criterion !== null) {
      const values = criterionValues(state.settings.deck, state.criterion);
      binLabels[bin] = values[index] ?? null;
    } else if (state.settings.binLabels === 'student-choice-icon') {
      binLabels[bin] = state.icons[bin] ?? null;
    } else {
      binLabels[bin] = null;
    }
    if (state.settings.countTable === 'student') {
      counts[bin] = state.counts[bin] ?? null;
    } else if (state.settings.countTable === 'auto' && allPlaced) {
      counts[bin] = facts.bins[bin]?.length ?? 0;
    } else {
      counts[bin] = null;
    }
  });

  const countsCorrect =
    state.settings.countTable === 'student' &&
    allPlaced &&
    facts.binIds.length > 0 &&
    facts.binIds.every((bin) => (state.counts[bin] ?? null) === (facts.bins[bin]?.length ?? 0));

  const prefilled = Object.values(state.settings.prefill).flat();
  const removed = prefilled.filter((id) => (state.binOf[id] ?? null) === null).sort();

  const valueCounts: Record<string, number> = {};
  const criterion = state.criterion;
  if (criterion !== null && criterion !== PRETTY) {
    for (const value of criterionValues(state.settings.deck, criterion)) {
      valueCounts[value] = cardIds.filter((id) => {
        const card = facts.cards.get(id);
        return card !== undefined && valueKey(card, criterion) === value;
      }).length;
    }
  }

  return {
    mode: 'sort',
    deck: state.settings.deck,
    criterion: state.criterion,
    criterionHistory: [...state.criterionHistory],
    bins: Object.fromEntries(facts.binIds.map((bin) => [bin, [...(facts.bins[bin] ?? [])]])),
    binOf: Object.fromEntries(cardIds.map((id) => [id, state.binOf[id] ?? null])),
    tray,
    allPlaced,
    binLabels,
    pureBy: pureAttributes(state, facts),
    pureDistinctBy: distinctPureAttributes(state, facts),
    labelsMatchBy: labelsMatch(state, facts),
    mismatched: mismatchedCards(state, facts),
    counts,
    countsCorrect,
    removed,
    valueCounts,
    misconceptions: misconceptionsOf(state, facts),
  };
}
