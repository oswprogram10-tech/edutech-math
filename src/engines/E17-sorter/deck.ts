/**
 * E17 도형 카드 데크. T108 결정 3의 표를 그대로 고정한다.
 *
 * 순서가 카드 칸의 순서다. `prototype`은 교과서 대표 방향인지 콘텐츠가 정한 자료
 * 값이고(계산 아님), 오개념 감지에만 쓴다. 성질은 `properties.ts`가 좌표에서 계산한다.
 */
import type { CardId, DeckName } from './types';

export interface DeckCard {
  readonly id: CardId;
  readonly yScale2: 1 | 3;
  readonly points: readonly (readonly [number, number])[];
  readonly prototype: boolean;
}

const TRIANGLES: readonly DeckCard[] = [
  {
    id: 't01',
    yScale2: 1,
    points: [
      [0, 4],
      [4, 4],
      [2, 0],
    ],
    prototype: true,
  },
  {
    id: 't02',
    yScale2: 1,
    points: [
      [0, 0],
      [5, 0],
      [6, 2],
    ],
    prototype: true,
  },
  {
    id: 't03',
    yScale2: 1,
    points: [
      [0, 0],
      [3, 0],
      [0, 3],
    ],
    prototype: true,
  },
  {
    id: 't04',
    yScale2: 3,
    points: [
      [0, 0],
      [4, 0],
      [2, 2],
    ],
    prototype: true,
  },
  {
    id: 't05',
    yScale2: 1,
    points: [
      [0, 0],
      [2, 1],
      [0, 5],
    ],
    prototype: false,
  },
  {
    id: 't06',
    yScale2: 1,
    points: [
      [0, 2],
      [6, 2],
      [3, 0],
    ],
    prototype: true,
  },
  {
    id: 't07',
    yScale2: 1,
    points: [
      [0, 3],
      [4, 4],
      [2, 0],
    ],
    prototype: true,
  },
  {
    id: 't08',
    yScale2: 1,
    points: [
      [0, 0],
      [4, 0],
      [2, 2],
    ],
    prototype: false,
  },
  {
    id: 't09',
    yScale2: 3,
    points: [
      [0, 0],
      [3, 1],
      [0, 2],
    ],
    prototype: false,
  },
  {
    id: 't10',
    yScale2: 1,
    points: [
      [0, 3],
      [1, 0],
      [1, 6],
    ],
    prototype: false,
  },
  {
    id: 't11',
    yScale2: 1,
    points: [
      [0, 0],
      [4, 0],
      [0, 2],
    ],
    prototype: true,
  },
  {
    id: 't12',
    yScale2: 1,
    points: [
      [0, 0],
      [4, 2],
      [0, 4],
    ],
    prototype: false,
  },
];

const QUADRILATERALS: readonly DeckCard[] = [
  {
    id: 'q01',
    yScale2: 1,
    points: [
      [0, 0],
      [5, 0],
      [8, 4],
      [3, 4],
    ],
    prototype: false,
  },
  {
    id: 'q02',
    yScale2: 1,
    points: [
      [1, 0],
      [4, 0],
      [5, 3],
      [0, 3],
    ],
    prototype: true,
  },
  {
    id: 'q03',
    yScale2: 1,
    points: [
      [2, 0],
      [5, 2],
      [3, 5],
      [0, 3],
    ],
    prototype: false,
  },
  {
    id: 'q04',
    yScale2: 1,
    points: [
      [0, 0],
      [6, 1],
      [5, 4],
      [1, 5],
    ],
    prototype: true,
  },
  {
    id: 'q05',
    yScale2: 1,
    points: [
      [0, 0],
      [6, 0],
      [6, 3],
      [0, 3],
    ],
    prototype: true,
  },
  {
    id: 'q06',
    yScale2: 1,
    points: [
      [0, 1],
      [4, 0],
      [6, 3],
      [2, 4],
    ],
    prototype: false,
  },
  {
    id: 'q07',
    yScale2: 1,
    points: [
      [2, 0],
      [4, 3],
      [2, 7],
      [0, 3],
    ],
    prototype: true,
  },
  {
    id: 'q08',
    yScale2: 1,
    points: [
      [2, 0],
      [4, 2],
      [2, 4],
      [0, 2],
    ],
    prototype: false,
  },
  {
    id: 'q09',
    yScale2: 1,
    points: [
      [0, 0],
      [3, 0],
      [5, 4],
      [0, 4],
    ],
    prototype: true,
  },
  {
    id: 'q10',
    yScale2: 1,
    points: [
      [0, 0],
      [5, 1],
      [4, 4],
      [1, 3],
    ],
    prototype: true,
  },
  {
    id: 'q11',
    yScale2: 1,
    points: [
      [0, 3],
      [2, 0],
      [4, 3],
      [2, 6],
    ],
    prototype: true,
  },
  {
    id: 'q12',
    yScale2: 1,
    points: [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ],
    prototype: true,
  },
  {
    id: 'q13',
    yScale2: 1,
    points: [
      [0, 3],
      [3, 0],
      [6, 2],
      [2, 6],
    ],
    prototype: false,
  },
  {
    id: 'q14',
    yScale2: 1,
    points: [
      [0, 2],
      [2, 0],
      [5, 3],
      [3, 5],
    ],
    prototype: false,
  },
  {
    id: 'q15',
    yScale2: 1,
    points: [
      [2, 0],
      [7, 0],
      [5, 3],
      [0, 3],
    ],
    prototype: true,
  },
  {
    id: 'q16',
    yScale2: 1,
    points: [
      [1, 0],
      [6, 2],
      [4, 5],
      [0, 3],
    ],
    prototype: true,
  },
];

export const DECKS: Readonly<Record<DeckName, readonly DeckCard[]>> = {
  'triangles-12': TRIANGLES,
  'quadrilaterals-16': QUADRILATERALS,
};

export function deckCards(name: DeckName): readonly DeckCard[] {
  return DECKS[name];
}

export function deckIds(name: DeckName): CardId[] {
  return DECKS[name].map((card) => card.id);
}

export function cardById(name: DeckName, id: CardId): DeckCard | null {
  return DECKS[name].find((card) => card.id === id) ?? null;
}

/** 데크 순서 번호(1부터). 화면 `aria-label`이 이 번호만 쓴다. */
export function cardNumber(name: DeckName, id: CardId): number {
  return DECKS[name].findIndex((card) => card.id === id) + 1;
}

/** 카드 좌표의 화면 가로·세로 폭(격자 단위, y 배율 반영). */
export function cardExtent(card: DeckCard): { readonly width: number; readonly height: number } {
  const xs = card.points.map((point) => point[0]);
  const ys = card.points.map((point) => point[1] * Math.sqrt(card.yScale2));
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

/** 데크 전체에서 가장 큰 카드가 상자 안에 들어가는 화면 배율. */
export function deckUnit(
  cards: readonly DeckCard[],
  width: number,
  height: number,
  padding = 12,
): number {
  let widest = 1;
  let tallest = 1;
  for (const card of cards) {
    const extent = cardExtent(card);
    widest = Math.max(widest, extent.width);
    tallest = Math.max(tallest, extent.height);
  }
  return Math.max(0, Math.min((width - padding * 2) / widest, (height - padding * 2) / tallest));
}
