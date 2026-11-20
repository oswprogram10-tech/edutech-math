/** E17 단추·사물 카드 묶음 데이터(T217): 개수와 속성 값을 고정한다. */
import { describe, expect, it } from 'vitest';
import {
  BUTTONS_12,
  CLASSROOM_OBJECTS_12,
  attributeValues,
  countWithValue,
  deckAttributes,
  deckDefinition,
  sortCardById,
  valueKey,
} from '../decks';

describe('buttons-12', () => {
  const cards = BUTTONS_12.cards;

  it('12장이고 id가 b01~b12다', () => {
    expect(cards).toHaveLength(12);
    expect(cards.map((card) => card.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `b${String(index + 1).padStart(2, '0')}`),
    );
    expect(cards.every((card) => card.name === null)).toBe(true);
  });

  it('색 빨강 5·파랑 4·노랑 3', () => {
    expect(countWithValue(cards, 'color', 'red')).toBe(5);
    expect(countWithValue(cards, 'color', 'blue')).toBe(4);
    expect(countWithValue(cards, 'color', 'yellow')).toBe(3);
  });

  it('모양 동그라미 4·네모 5·세모 3', () => {
    expect(countWithValue(cards, 'shape', 'circle')).toBe(4);
    expect(countWithValue(cards, 'shape', 'square')).toBe(5);
    expect(countWithValue(cards, 'shape', 'triangle')).toBe(3);
  });

  it('구멍 2개 7·4개 5', () => {
    expect(countWithValue(cards, 'holes', '2')).toBe(7);
    expect(countWithValue(cards, 'holes', '4')).toBe(5);
  });

  it('표의 몇 장을 그대로 담는다', () => {
    expect(sortCardById('buttons-12', 'b04')?.attrs).toEqual({
      color: 'red',
      shape: 'triangle',
      holes: 4,
    });
    expect(sortCardById('buttons-12', 'b12')?.attrs).toEqual({
      color: 'yellow',
      shape: 'square',
      holes: 2,
    });
  });

  it('속성 이름과 값 목록', () => {
    expect(deckAttributes('buttons-12')).toEqual(['color', 'shape', 'holes']);
    expect(attributeValues('buttons-12', 'holes')).toEqual(['2', '4']);
    expect(attributeValues('buttons-12', 'nothing')).toEqual([]);
  });
});

describe('classroom-objects-12', () => {
  const cards = CLASSROOM_OBJECTS_12.cards;

  it('12개이고 이름이 모두 있다', () => {
    expect(cards).toHaveLength(12);
    expect(cards.every((card) => typeof card.name === 'string' && card.name.length > 0)).toBe(true);
  });

  it('모양 계열 상자 4·둥근기둥 4·공 4', () => {
    expect(countWithValue(cards, 'shapeFamily', 'box')).toBe(4);
    expect(countWithValue(cards, 'shapeFamily', 'cylinder')).toBe(4);
    expect(countWithValue(cards, 'shapeFamily', 'sphere')).toBe(4);
  });

  it('색·크기 개수', () => {
    expect(countWithValue(cards, 'color', 'red')).toBe(6);
    expect(countWithValue(cards, 'color', 'blue')).toBe(4);
    expect(countWithValue(cards, 'color', 'yellow')).toBe(2);
    expect(countWithValue(cards, 'size', 'small')).toBe(5);
    expect(countWithValue(cards, 'size', 'mid')).toBe(5);
    expect(countWithValue(cards, 'size', 'big')).toBe(2);
  });

  it('눕힌 사물은 캔(눕힘) 하나뿐이고, 분류 기준 목록에 orientation이 없다', () => {
    const lying = cards.filter((card) => card.attrs['orientation'] === 'lying');
    expect(lying.map((card) => card.id)).toEqual(['o-can-side']);
    expect(deckAttributes('classroom-objects-12')).toEqual(['shapeFamily', 'color', 'size']);
  });

  it('캔 둘은 모양 계열·색·크기가 같고 방향만 다르다', () => {
    const up = sortCardById('classroom-objects-12', 'o-can-up');
    const side = sortCardById('classroom-objects-12', 'o-can-side');
    expect(up?.attrs['shapeFamily']).toBe(side?.attrs['shapeFamily']);
    expect(up?.attrs['color']).toBe(side?.attrs['color']);
    expect(up?.attrs['size']).toBe(side?.attrs['size']);
    expect(up?.attrs['orientation']).not.toBe(side?.attrs['orientation']);
  });
});

describe('묶음 조회', () => {
  it('이름으로 찾고 없는 id는 null', () => {
    expect(deckDefinition('buttons-12')).toBe(BUTTONS_12);
    expect(sortCardById('buttons-12', 'zz')).toBeNull();
    const card = sortCardById('buttons-12', 'b01');
    expect(card && valueKey(card, 'holes')).toBe('2');
    expect(card && valueKey(card, 'size')).toBeNull();
  });
});
