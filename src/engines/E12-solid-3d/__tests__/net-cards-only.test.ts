import { describe, expect, it } from 'vitest';
import { isNetCardsOnly } from '../net/cards-only';
import { createInitialState } from '../reduce';
import type { NetFoldConfig, NetFoldState } from '../types';

const CARDS = [
  { id: 'ga', label: '가', faces: [{ at: [0, 0] as const, w: 1, h: 1 }] },
  { id: 'na', label: '나', faces: [{ at: [0, 0] as const, w: 1, h: 1 }] },
];

const BASE: NetFoldConfig = {
  mode: 'net-fold',
  target: 'cube',
  grid: [3, 3],
  editable: false,
  foldable: false,
  netCards: CARDS,
};

function make(over: Partial<NetFoldConfig> = {}): NetFoldState {
  return createInitialState({ ...BASE, ...over }) as NetFoldState;
}

describe('isNetCardsOnly', () => {
  it('여섯 조건이 모두 참이면 참', () => {
    expect(isNetCardsOnly(make())).toBe(true);
  });
  it('카드가 없으면 거짓', () => {
    expect(isNetCardsOnly(make({ netCards: [] }))).toBe(false);
  });
  it('editable이면 거짓', () => {
    expect(isNetCardsOnly(make({ editable: true }))).toBe(false);
  });
  it('foldable이면 거짓', () => {
    expect(isNetCardsOnly(make({ foldable: true }))).toBe(false);
  });
  it('predict가 있으면 거짓', () => {
    expect(isNetCardsOnly(make({ predict: { of: 'top' } as never }))).toBe(false);
  });
  it('netLog이면 거짓', () => {
    expect(isNetCardsOnly(make({ netLog: true }))).toBe(false);
  });
  it('처음부터 놓인 면(locked)이 있으면 거짓', () => {
    const s = make({ given: [{ at: [1, 1], w: 1, h: 1, locked: true }] });
    expect(s.faces.some((f) => f.locked)).toBe(true);
    expect(isNetCardsOnly(s)).toBe(false);
  });
});

describe('isNetCardsOnly 추가 경계', () => {
  it('locked가 아닌 given 면이 있어도 거짓(모눈에 보이는 면)', () => {
    expect(isNetCardsOnly(make({ given: [{ at: [1, 1], w: 1, h: 1 }] }))).toBe(false);
  });
});
