/**
 * E17 sort·predict가 쓰는 단추·사물 카드 묶음의 공통 타입.
 * 삼각형·사각형 데크(`../deck.ts`)와는 따로 둔다.
 */

export type SortDeckName = 'buttons-12' | 'classroom-objects-12';

export type AttrValue = string | number;

export interface SortCard {
  readonly id: string;
  /** 사물 카드의 이름(단추는 null). 화면 글·aria에만 쓴다. */
  readonly name: string | null;
  readonly attrs: Readonly<Record<string, AttrValue>>;
}

export interface DeckDefinition {
  readonly name: SortDeckName;
  readonly cards: readonly SortCard[];
  /** 분류 기준으로 쓸 수 있는 속성 이름(`pretty`는 따로 다룬다). */
  readonly attributes: readonly string[];
  /** 속성별 값 목록(화면에 나열하는 순서). */
  readonly values: Readonly<Record<string, readonly AttrValue[]>>;
}
