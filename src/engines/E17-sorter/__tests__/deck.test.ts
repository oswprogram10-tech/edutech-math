/**
 * E17 데크 표(tasks/T108.md 결정 3)와 성질 계산을 카드마다 고정한다.
 * 괄호 값은 화면·Observation에 쓰지 않고 테스트 기대값으로만 쓴다.
 */
import { describe, expect, it } from 'vitest';
import { gp, isSimplePolygon } from '../../../core/math';
import { DECKS, deckCards, deckIds } from '../deck';
import { quadNames, quadProps, signature, triangleProps } from '../properties';
import { ALL_QUESTIONS } from '../types';

describe('E17 triangles-12', () => {
  const expected: Readonly<Record<string, readonly [string, string]>> = {
    t01: ['acute', 'isosceles-only'],
    t02: ['obtuse', 'scalene'],
    t03: ['right', 'isosceles-only'],
    t04: ['acute', 'equilateral'],
    t05: ['right', 'scalene'],
    t06: ['obtuse', 'isosceles-only'],
    t07: ['acute', 'scalene'],
    t08: ['right', 'isosceles-only'],
    t09: ['acute', 'equilateral'],
    t10: ['obtuse', 'isosceles-only'],
    t11: ['right', 'scalene'],
    t12: ['acute', 'isosceles-only'],
  };

  it('카드마다 (각, 변)이 표와 같다', () => {
    for (const card of deckCards('triangles-12')) {
      const props = triangleProps(card);
      expect([props.angles, props.sides], card.id).toEqual(expected[card.id]);
    }
  });

  it('12장 모두 단순 다각형이고 id가 겹치지 않는다', () => {
    const cards = deckCards('triangles-12');
    expect(cards).toHaveLength(12);
    expect(new Set(deckIds('triangles-12')).size).toBe(12);
    for (const card of cards) {
      expect(isSimplePolygon(card.points.map(([x, y]) => gp(x, y))), card.id).toBe(true);
    }
  });

  it('가능한 7개 칸에 카드가 한 장 이상 있다', () => {
    const cells = new Set(
      deckCards('triangles-12').map((card) => {
        const props = triangleProps(card);
        return `${props.angles}|${props.sides}`;
      }),
    );
    expect([...cells].sort()).toEqual([
      'acute|equilateral',
      'acute|isosceles-only',
      'acute|scalene',
      'obtuse|isosceles-only',
      'obtuse|scalene',
      'right|isosceles-only',
      'right|scalene',
    ]);
  });
});

describe('E17 quadrilaterals-16', () => {
  const expected: Readonly<Record<string, readonly [0 | 1 | 2, string]>> = {
    q01: [2, 'rhombus'],
    q02: [1, 'trapezoid'],
    q03: [2, 'square'],
    q04: [0, 'quadrilateral'],
    q05: [2, 'rectangle'],
    q06: [2, 'parallelogram'],
    q07: [0, 'quadrilateral'],
    q08: [2, 'square'],
    q09: [1, 'trapezoid'],
    q10: [0, 'quadrilateral'],
    q11: [2, 'rhombus'],
    q12: [2, 'square'],
    q13: [1, 'trapezoid'],
    q14: [2, 'rectangle'],
    q15: [2, 'parallelogram'],
    q16: [0, 'quadrilateral'],
  };

  it('카드마다 (평행 쌍, 가장 좁은 이름)이 표와 같다', () => {
    for (const card of deckCards('quadrilaterals-16')) {
      const props = quadProps(card);
      const names = quadNames(props, 'inclusive');
      expect([props.parallelPairs, names[names.length - 1]], card.id).toEqual(expected[card.id]);
    }
  });

  it('16장 모두 단순 다각형이고 id가 겹치지 않는다', () => {
    const cards = deckCards('quadrilaterals-16');
    expect(cards).toHaveLength(16);
    expect(new Set(deckIds('quadrilaterals-16')).size).toBe(16);
    for (const card of cards) {
      expect(isSimplePolygon(card.points.map(([x, y]) => gp(x, y))), card.id).toBe(true);
    }
  });

  it('서명 표: q12는 모두 참, q07·q04·q16은 모두 거짓', () => {
    const byId = new Map(deckCards('quadrilaterals-16').map((card) => [card.id, card]));
    const all = (id: string) => {
      const card = byId.get(id);
      expect(card).toBeDefined();
      return card ? signature(card, ALL_QUESTIONS) : [];
    };
    expect(all('q12')).toEqual([true, true, true, true, true, true]);
    expect(all('q07')).toEqual([false, false, false, false, false, false]);
    expect(all('q04')).toEqual([false, false, false, false, false, false]);
    expect(all('q16')).toEqual([false, false, false, false, false, false]);
  });

  it('마름모 q01과 q11은 여섯 질문으로 구별되지 않는다', () => {
    const byId = new Map(deckCards('quadrilaterals-16').map((card) => [card.id, card]));
    const first = byId.get('q01');
    const second = byId.get('q11');
    expect(first && second).toBeTruthy();
    if (!first || !second) return;
    expect(signature(first, ALL_QUESTIONS)).toEqual(signature(second, ALL_QUESTIONS));
  });

  it('데크 이름 목록이 계약과 같다', () => {
    expect(Object.keys(DECKS).sort()).toEqual(['quadrilaterals-16', 'triangles-12']);
  });
});
