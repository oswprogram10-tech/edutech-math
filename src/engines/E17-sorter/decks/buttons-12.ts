/** 단추 12장. 속성: color(red·blue·yellow), shape(circle·square·triangle), holes(2·4). */
import type { DeckDefinition, SortCard } from './types';

type Row = readonly [string, 'red' | 'blue' | 'yellow', 'circle' | 'square' | 'triangle', 2 | 4];

const ROWS: readonly Row[] = [
  ['b01', 'red', 'circle', 2],
  ['b02', 'red', 'circle', 4],
  ['b03', 'red', 'square', 2],
  ['b04', 'red', 'triangle', 4],
  ['b05', 'red', 'square', 2],
  ['b06', 'blue', 'circle', 2],
  ['b07', 'blue', 'square', 4],
  ['b08', 'blue', 'triangle', 2],
  ['b09', 'blue', 'square', 4],
  ['b10', 'yellow', 'circle', 2],
  ['b11', 'yellow', 'triangle', 4],
  ['b12', 'yellow', 'square', 2],
];

const CARDS: readonly SortCard[] = ROWS.map(([id, color, shape, holes]) => ({
  id,
  name: null,
  attrs: { color, shape, holes },
}));

export const BUTTONS_12: DeckDefinition = {
  name: 'buttons-12',
  cards: CARDS,
  attributes: ['color', 'shape', 'holes'],
  values: {
    color: ['red', 'blue', 'yellow'],
    shape: ['circle', 'square', 'triangle'],
    holes: [2, 4],
  },
};
