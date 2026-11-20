/** sort 기준·상자 이름 아이콘의 값 목록. 순수 함수만 둔다. */
import { attributeValues, deckAttributes } from '../decks';
import type { SortDeckName } from '../decks';
import { ALL_BIN_IDS, PRETTY, PRETTY_VALUES } from './types';
import type { BinId, Criterion } from './types';

/** 이 묶음에서 고를 수 있는 기준 이름(`pretty`는 단추 묶음만). */
export function allowedCriteria(deck: SortDeckName): readonly Criterion[] {
  const attributes = deckAttributes(deck);
  return deck === 'buttons-12' ? [...attributes, PRETTY] : attributes;
}

/** 기준을 고르면 생기는 상자들의 값(이름) 목록. */
export function criterionValues(deck: SortDeckName, criterion: Criterion): string[] {
  if (criterion === PRETTY) return [...PRETTY_VALUES];
  return attributeValues(deck, criterion);
}

export function binIdsFor(count: number): BinId[] {
  return ALL_BIN_IDS.slice(0, Math.max(0, Math.min(4, count)));
}

/** 상자 이름으로 붙일 수 있는 아이콘 값(`attribute:value`) 목록. */
export function iconChoices(deck: SortDeckName): string[] {
  const result: string[] = [];
  for (const attribute of deckAttributes(deck)) {
    if (deck === 'classroom-objects-12' && attribute !== 'shapeFamily') continue;
    for (const value of attributeValues(deck, attribute)) result.push(`${attribute}:${value}`);
  }
  return result;
}

export function parseIcon(
  icon: string,
): { readonly attribute: string; readonly value: string } | null {
  const index = icon.indexOf(':');
  if (index <= 0 || index === icon.length - 1) return null;
  return { attribute: icon.slice(0, index), value: icon.slice(index + 1) };
}
