/** 단추·사물 카드 묶음 조회와 속성 값 도우미. 순수 함수만 둔다. */
import { BUTTONS_12 } from './buttons-12';
import { CLASSROOM_OBJECTS_12 } from './classroom-objects-12';
import type { AttrValue, DeckDefinition, SortCard, SortDeckName } from './types';

export type { AttrValue, DeckDefinition, SortCard, SortDeckName } from './types';
export { BUTTONS_12, CLASSROOM_OBJECTS_12 };

const DECKS: Readonly<Record<SortDeckName, DeckDefinition>> = {
  'buttons-12': BUTTONS_12,
  'classroom-objects-12': CLASSROOM_OBJECTS_12,
};

export const SORT_DECK_NAMES: readonly SortDeckName[] = ['buttons-12', 'classroom-objects-12'];

export function isSortDeckName(value: unknown): value is SortDeckName {
  return typeof value === 'string' && (SORT_DECK_NAMES as readonly string[]).includes(value);
}

export function deckDefinition(name: SortDeckName): DeckDefinition {
  return DECKS[name];
}

export function sortCardById(deck: SortDeckName, id: string): SortCard | null {
  return DECKS[deck].cards.find((card) => card.id === id) ?? null;
}

/** 카드의 속성 값을 문자열로 쓴다(구멍 수 2 → "2"). 없으면 null. */
export function valueKey(card: SortCard, attribute: string): string | null {
  const value = card.attrs[attribute];
  return value === undefined ? null : String(value);
}

/** 이 묶음에서 분류 기준(속성)으로 쓸 수 있는 속성 이름. */
export function deckAttributes(deck: SortDeckName): readonly string[] {
  return DECKS[deck].attributes;
}

/** 속성 값 목록을 문자열로. 없는 속성이면 빈 배열. */
export function attributeValues(deck: SortDeckName, attribute: string): string[] {
  return (DECKS[deck].values[attribute] ?? []).map((value: AttrValue) => String(value));
}

/** 묶음 안의 카드 중 `attribute` 값이 `value`인 장수(문자열 비교). */
export function countWithValue(
  cards: readonly SortCard[],
  attribute: string,
  value: string,
): number {
  return cards.filter((card) => valueKey(card, attribute) === value).length;
}
