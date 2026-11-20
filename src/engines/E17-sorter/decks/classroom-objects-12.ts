/**
 * 교실 사물 12개. 속성: shapeFamily(box·cylinder·sphere), color, size(small·mid·big),
 * orientation(standing·lying). 그림은 `sort/art.tsx`의 직접 그린 SVG다.
 * `orientation`은 그림과 MC-SHAPE-ORIENTATION 감지에만 쓴다(기준 목록에는 없다).
 */
import type { DeckDefinition, SortCard } from './types';

type Row = readonly [
  string,
  string,
  'box' | 'cylinder' | 'sphere',
  'red' | 'blue' | 'yellow',
  'small' | 'mid' | 'big',
  'standing' | 'lying',
];

const ROWS: readonly Row[] = [
  ['o-eraser', '지우개', 'box', 'red', 'small', 'standing'],
  ['o-milk', '우유갑', 'box', 'red', 'mid', 'standing'],
  ['o-tissue', '휴지 상자', 'box', 'blue', 'big', 'standing'],
  ['o-dice', '주사위', 'box', 'yellow', 'small', 'standing'],
  ['o-glue', '풀', 'cylinder', 'red', 'small', 'standing'],
  ['o-roll', '휴지심', 'cylinder', 'red', 'mid', 'standing'],
  ['o-can-up', '캔(세움)', 'cylinder', 'blue', 'mid', 'standing'],
  ['o-can-side', '캔(눕힘)', 'cylinder', 'blue', 'mid', 'lying'],
  ['o-ball', '공', 'sphere', 'red', 'big', 'standing'],
  ['o-marble', '구슬', 'sphere', 'blue', 'small', 'standing'],
  ['o-orange', '귤', 'sphere', 'yellow', 'mid', 'standing'],
  ['o-bead', '구슬 장식', 'sphere', 'red', 'small', 'standing'],
];

const CARDS: readonly SortCard[] = ROWS.map(
  ([id, name, shapeFamily, color, size, orientation]) => ({
    id,
    name,
    attrs: { shapeFamily, color, size, orientation },
  }),
);

export const CLASSROOM_OBJECTS_12: DeckDefinition = {
  name: 'classroom-objects-12',
  cards: CARDS,
  attributes: ['shapeFamily', 'color', 'size'],
  values: {
    shapeFamily: ['box', 'cylinder', 'sphere'],
    color: ['red', 'blue', 'yellow'],
    size: ['small', 'mid', 'big'],
  },
};
