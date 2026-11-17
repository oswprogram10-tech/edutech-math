import { describe, expect, it, vi } from 'vitest';
import type { JsonValue, Observation } from '../../../core/engine-sdk';
import { emit, EVENT_NAMES, predicates } from '../events';
import definition from '../index';
import { observe } from '../observe';
import { canAttach, canRemovePiece, remainingCounts } from '../prismnet/reduce';
import { createInitialState, reduce } from '../reduce';
import type { PrismNetConfig, PrismNetState, SolidAction } from '../types';

function make(config: Partial<PrismNetConfig> = {}): PrismNetState {
  return createInitialState({ mode: 'net-fold', target: 'prism', ...config });
}

function run(state: PrismNetState, actions: readonly SolidAction[]): PrismNetState {
  return actions.reduce<PrismNetState>((s, a) => reduce(s, a), state);
}

function pred(name: string, obs: Observation, args?: unknown): boolean {
  const fn = predicates[name];
  expect(fn, name).toBeDefined();
  return fn?.(obs, args as never) ?? false;
}

const pick = (pieceType: 'base' | 'rect' | null): SolidAction => ({
  type: 'select-piece-type',
  pieceType,
});
const attach = (parent: number | null, parentEdge: number): SolidAction => ({
  type: 'attach',
  parent,
  parentEdge,
});

/** 삼각기둥: 옆면 띠 3장 + 아래 밑면(옆면 0의 아래) + 위 밑면(옆면 2의 위). */
function buildTriPrism(config: Partial<PrismNetConfig> = {}): PrismNetState {
  return run(make(config), [
    pick('rect'),
    attach(null, 0),
    attach(0, 1),
    attach(1, 1),
    pick('base'),
    attach(0, 0),
    attach(2, 2),
  ]);
}

function nObs(state: PrismNetState): Record<string, JsonValue> {
  return observe(state) as Record<string, JsonValue>;
}

describe('E12 prism-net 설정', () => {
  it('기본값', () => {
    const s = make();
    expect(s.mode).toBe('prism-net');
    expect(s.settings.n).toBe(3);
    expect(s.settings.sideLen).toBe(2);
    expect(s.settings.height).toBe(3);
    expect(s.settings.total).toEqual({ base: 2, rect: 3 });
    expect(s.settings.editable).toBe(true);
    expect(s.settings.foldable).toBe(true);
    expect(s.settings.collisionHighlight).toBe(true);
    expect(s.pieces).toEqual([]);
    expect(s.selectedType).toBeNull();
    expect(s.folded).toBe(false);
  });

  it('범위를 자르고 baseSides를 따라 옆면 수가 정해진다', () => {
    expect(make({ baseSides: 9 }).settings.n).toBe(6);
    expect(make({ baseSides: 1 }).settings.n).toBe(3);
    expect(make({ baseSides: 5 }).settings.total).toEqual({ base: 2, rect: 5 });
    expect(make({ sideLen: 9 }).settings.sideLen).toBe(4);
    expect(make({ height: 99 }).settings.height).toBe(6);
  });

  it('sideLen과 height가 같으면 height를 하나 키우고 경고한다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = make({ sideLen: 3, height: 3 });
    expect(s.settings.height).toBe(4);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('pieces 배열 형식을 개수로 바꾼다', () => {
    const s = make({ pieces: ['triangle', 'triangle', 'rect', 'rect', 'rect', 'zzz'] });
    expect(s.settings.total).toEqual({ base: 2, rect: 3 });
    expect(make({ pieces: { base: 1, rect: 9 } }).settings.total).toEqual({ base: 1, rect: 8 });
    expect(make({ pieces: { base: 0, rect: 0 } }).settings.total).toEqual({ base: 0, rect: 0 });
  });

  it('given: 뿌리와 붙은 조각을 만들고 pieces에서 뺀다', () => {
    const s = make({
      given: [
        { type: 'rect', parent: null, locked: true },
        { type: 'rect', parent: 0, parentEdge: 1 },
      ],
    });
    expect(s.pieces).toHaveLength(2);
    expect(s.pieces[0]?.locked).toBe(true);
    expect(s.pieces[1]?.locked).toBe(false);
    expect(s.pieces[1]?.edge).toBe(3);
    expect(remainingCounts(s)).toEqual({ base: 2, rect: 1 });
  });

  it('given 오류: 그 항목부터 버리고 경고한다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const noParent = make({
      given: [
        { type: 'rect', parent: null },
        { type: 'rect', parent: 5, parentEdge: 1 },
        { type: 'rect', parent: 0, parentEdge: 3 },
      ],
    });
    expect(noParent.pieces).toHaveLength(1);
    const noEdge = make({
      given: [
        { type: 'rect', parent: null },
        { type: 'rect', parent: 0, parentEdge: 9 },
      ],
    });
    expect(noEdge.pieces).toHaveLength(1);
    const taken = make({
      given: [
        { type: 'rect', parent: null },
        { type: 'rect', parent: 0, parentEdge: 1 },
        { type: 'rect', parent: 0, parentEdge: 1 },
      ],
    });
    expect(taken.pieces).toHaveLength(2);
    const baseOnH = make({
      given: [
        { type: 'rect', parent: null },
        { type: 'base', parent: 0, parentEdge: 1 },
      ],
    });
    expect(baseOnH.pieces).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(4);
    warn.mockRestore();
  });
});

describe('E12 prism-net reduce', () => {
  it('select-piece-type: 남은 수가 있을 때만, null이면 풂', () => {
    let s = make({ pieces: { base: 0, rect: 3 } });
    s = run(s, [pick('base')]);
    expect(s.selectedType).toBeNull();
    s = run(s, [pick('rect')]);
    expect(s.selectedType).toBe('rect');
    s = run(s, [pick(null)]);
    expect(s.selectedType).toBeNull();
  });

  it('attach: 뿌리는 조각이 없을 때만, 종류가 골라져 있어야 한다', () => {
    const s0 = make();
    expect(run(s0, [attach(null, 0)])).toBe(s0);
    const s1 = run(s0, [pick('rect'), attach(null, 0)]);
    expect(s1.pieces).toHaveLength(1);
    expect(s1.pieces[0]).toMatchObject({ id: 0, type: 'rect', parent: null, edge: 0 });
    expect(run(s1, [attach(null, 0)])).toBe(s1);
  });

  it('attach: 길이가 맞는 변에만 붙고 엔진이 맞댄 변을 정한다', () => {
    let s = run(make(), [pick('rect'), attach(null, 0), attach(0, 1), attach(0, 2)]);
    // 오른쪽(h) 변에는 왼쪽 변(3), 위(s) 변에는 아래 변(0)으로 맞댄다.
    expect(s.pieces[1]).toMatchObject({ parent: 0, parentEdge: 1, edge: 3 });
    expect(s.pieces[2]).toMatchObject({ parent: 0, parentEdge: 2, edge: 0 });
    // 같은 변에 또 붙이기는 무시
    const same = run(s, [attach(0, 1)]);
    expect(same).toBe(s);
    // 밑면은 s 변에만
    s = run(make(), [pick('rect'), attach(null, 0), pick('base')]);
    expect(canAttach(s, 0, 1)).toBe(false);
    expect(run(s, [attach(0, 1)])).toBe(s);
    expect(canAttach(s, 0, 0)).toBe(true);
    expect(run(s, [attach(0, 0)]).pieces[1]).toMatchObject({ type: 'base', edge: 0 });
  });

  it('attach: 남은 수가 0이면 무시하고 다 쓰면 고른 종류를 푼다', () => {
    let s = run(make({ pieces: { base: 0, rect: 2 } }), [pick('rect'), attach(null, 0)]);
    expect(s.selectedType).toBe('rect');
    s = run(s, [attach(0, 1)]);
    expect(s.selectedType).toBeNull();
    expect(remainingCounts(s)).toEqual({ base: 0, rect: 0 });
    expect(run(s, [pick('rect'), attach(1, 1)])).toBe(s);
  });

  it('attach: 없는 부모·변·정수 아님은 무시', () => {
    const s = run(make(), [pick('rect'), attach(null, 0)]);
    expect(run(s, [attach(7, 1)])).toBe(s);
    expect(run(s, [attach(0, 9)])).toBe(s);
    expect(run(s, [attach(0, -1)])).toBe(s);
    expect(run(s, [attach(0, 1.5)])).toBe(s);
    expect(run(s, [attach(0.5, 1)])).toBe(s);
  });

  it('editable:false나 접혀 있으면 붙이기·빼기를 무시한다', () => {
    const fixed = make({ editable: false });
    expect(run(fixed, [pick('rect'), attach(null, 0)])).toBe(fixed);
    const tri = buildTriPrism();
    const folded = run(tri, [{ type: 'toggle-fold' }]);
    expect(folded.folded).toBe(true);
    expect(run(folded, [pick('rect')])).toBe(folded);
    expect(canAttach(folded, 0, 2)).toBe(false);
  });

  it('remove-piece: 잠기지 않은 잎만 빼고 펼친다', () => {
    const s = run(make({ given: [{ type: 'rect', parent: null, locked: true }] }), [
      pick('rect'),
      attach(0, 1),
      attach(1, 1),
    ]);
    expect(s.pieces).toHaveLength(3);
    expect(canRemovePiece(s, 0)).toBe(false);
    expect(canRemovePiece(s, 1)).toBe(false);
    expect(canRemovePiece(s, 2)).toBe(true);
    expect(run(s, [{ type: 'remove-piece', id: 1 }])).toBe(s);
    expect(run(s, [{ type: 'remove-piece', id: 0 }])).toBe(s);
    const folded = run(s, [{ type: 'toggle-fold' }, { type: 'remove-piece', id: 2 }]);
    expect(folded.pieces).toHaveLength(2);
    expect(folded.folded).toBe(false);
  });

  it('clear: 잠기지 않은 조각을 모두 빼고 펼친다', () => {
    const s = run(make({ given: [{ type: 'rect', parent: null, locked: true }] }), [
      pick('rect'),
      attach(0, 1),
      { type: 'toggle-fold' },
      { type: 'clear' },
    ]);
    expect(s.pieces).toHaveLength(1);
    expect(s.folded).toBe(false);
    const empty = make();
    expect(run(empty, [{ type: 'clear' }])).toBe(empty);
  });

  it('toggle-fold: 조각이 있고 foldable일 때만, 접을 때 foldCount+1', () => {
    const empty = make();
    expect(run(empty, [{ type: 'toggle-fold' }])).toBe(empty);
    const nofold = run(make({ foldable: false }), [pick('rect'), attach(null, 0)]);
    expect(run(nofold, [{ type: 'toggle-fold' }])).toBe(nofold);
    let s = run(make(), [pick('rect'), attach(null, 0), { type: 'toggle-fold' }]);
    expect(s.folded).toBe(true);
    expect(s.foldCount).toBe(1);
    s = run(s, [{ type: 'toggle-fold' }, { type: 'toggle-fold' }]);
    expect(s.foldCount).toBe(2);
  });

  it('붙이거나 빼면 folded=false이고, 다른 모드의 Action은 무시한다', () => {
    const s = run(make(), [pick('rect'), attach(null, 0)]);
    expect(run(s, [{ type: 'place-face', x: 1, y: 1 }])).toBe(s);
    expect(run(s, [{ type: 'add', x: 1, y: 1 }])).toBe(s);
  });

  it('JSON으로 왕복해도 같다', () => {
    const tri = buildTriPrism({ showLengths: true });
    const back = JSON.parse(JSON.stringify(tri)) as PrismNetState;
    expect(back).toEqual(tri);
    expect(nObs(back)).toEqual(nObs(tri));
    expect(reduce(back, { type: 'toggle-fold' }).folded).toBe(true);
  });
});

describe('E12 prism-net 관찰·predicate', () => {
  it('삼각기둥을 만들면 valid이고 관찰이 맞다', () => {
    const tri = buildTriPrism();
    const obs = nObs(tri);
    expect(obs['mode']).toBe('prism-net');
    expect(obs['n']).toBe(3);
    expect(obs['pieceCount']).toEqual({ base: 2, rect: 3 });
    expect(obs['remaining']).toEqual({ base: 0, rect: 0 });
    expect(obs['folded']).toBe(false);
    expect(obs['evaluation']).toEqual({
      valid: true,
      missing: 0,
      duplicates: 0,
      mismatch: 0,
      paperOverlap: 0,
      bothBasesSameEnd: false,
    });
    expect(pred('prismNetValid', obs)).toBe(true);
    expect(pred('prismNetFoldedValid', obs)).toBe(false);
    const folded = nObs(reduce(tri, { type: 'toggle-fold' }));
    expect(pred('prismNetFoldedValid', folded)).toBe(true);
    expect(folded['foldCount']).toBe(1);
  });

  it('밑면 둘을 위에만 붙이면 bothBasesSameEnd이다', () => {
    const s = run(make(), [
      pick('rect'),
      attach(null, 0),
      attach(0, 1),
      attach(1, 1),
      pick('base'),
      attach(0, 2),
      attach(2, 2),
    ]);
    const obs = nObs(s);
    expect(pred('prismNetBothBasesSameEnd', obs)).toBe(true);
    expect(pred('prismNetValid', obs)).toBe(false);
    expect(pred('prismNetHasProblem', obs, { kind: 'duplicate' })).toBe(true);
    expect(pred('prismNetHasProblem', obs, { kind: 'missing' })).toBe(true);
    expect(pred('prismNetHasProblem', obs, { kind: 'mismatch' })).toBe(false);
  });

  it('prismNetPieceCountIs', () => {
    const obs = nObs(buildTriPrism());
    expect(pred('prismNetPieceCountIs', obs, { base: 2, rect: 3 })).toBe(true);
    expect(pred('prismNetPieceCountIs', obs, { rect: 3 })).toBe(true);
    expect(pred('prismNetPieceCountIs', obs, { base: 1 })).toBe(false);
    expect(pred('prismNetPieceCountIs', obs, {})).toBe(false);
    expect(pred('prismNetPieceCountIs', obs, { base: 'x' })).toBe(false);
    expect(pred('prismNetPieceCountIs', obs, null)).toBe(false);
  });

  it('prismNetHasProblem: 나머지 종류와 잘못된 인자', () => {
    const mismatch = nObs(run(make(), [pick('rect'), attach(null, 0), attach(0, 2)]));
    expect(pred('prismNetHasProblem', mismatch, { kind: 'mismatch' })).toBe(true);
    const overlap = nObs(
      run(make({ baseSides: 6, pieces: { base: 2, rect: 8 } }), [
        pick('base'),
        attach(null, 0),
        pick('rect'),
        ...[0, 1, 2, 3, 4, 5].map((k) => attach(0, k)),
        attach(1, 1),
      ]),
    );
    expect(pred('prismNetHasProblem', overlap, { kind: 'overlap' })).toBe(true);
    expect(pred('prismNetHasProblem', overlap, { kind: 'zzz' })).toBe(false);
    expect(pred('prismNetHasProblem', overlap, {})).toBe(false);
    expect(pred('prismNetHasProblem', overlap, undefined)).toBe(false);
  });

  it('다른 모드 관찰에서는 false이고 prism-net 관찰에서 다른 모드 predicate도 false', () => {
    const names = ['prismNetValid', 'prismNetFoldedValid', 'prismNetBothBasesSameEnd'] as const;
    const others: Observation[] = [
      observe(createInitialState({ mode: 'net-fold' })),
      observe(createInitialState({ mode: 'cubes' })),
      observe(createInitialState({ mode: 'xray' })),
      observe(createInitialState({ mode: 'prism-pyramid' })),
    ];
    for (const obs of others) {
      for (const name of names) expect(pred(name, obs)).toBe(false);
      expect(pred('prismNetPieceCountIs', obs, { base: 0 })).toBe(false);
      expect(pred('prismNetHasProblem', obs, { kind: 'missing' })).toBe(false);
    }
    const mine = nObs(buildTriPrism());
    expect(pred('netValid', mine)).toBe(false);
    expect(pred('netFaceCountIs', mine, { n: 5 })).toBe(false);
    expect(pred('countIs', mine, { n: 5 })).toBe(false);
  });

  it('카드 판정이 관찰에 들어 있다', () => {
    const s = make({
      netCards: [
        {
          id: 'a',
          label: '가',
          root: 'rect',
          steps: [
            { parent: 0, parentEdge: 1, type: 'rect' },
            { parent: 1, parentEdge: 1, type: 'rect' },
            { parent: 0, parentEdge: 0, type: 'base' },
            { parent: 2, parentEdge: 2, type: 'base' },
          ],
        },
        {
          id: 'b',
          label: '나',
          root: 'rect',
          steps: [
            { parent: 0, parentEdge: 1, type: 'rect' },
            { parent: 1, parentEdge: 1, type: 'rect' },
            { parent: 0, parentEdge: 2, type: 'base' },
            { parent: 2, parentEdge: 2, type: 'base' },
          ],
        },
        { id: 'c', label: '다', root: 'rect', steps: [{ parent: 9, parentEdge: 0, type: 'rect' }] },
      ],
    });
    expect(nObs(s)['cards']).toEqual([
      { id: 'a', valid: true },
      { id: 'b', valid: false },
      { id: 'c', valid: false },
    ]);
  });
});

describe('E12 prism-net 이벤트', () => {
  it('이벤트 이름이 등록돼 있다', () => {
    for (const name of [
      'piece-attached',
      'piece-removed',
      'prism-net-folded',
      'prism-net-unfolded',
    ]) {
      expect(EVENT_NAMES).toContain(name);
      expect(definition.events).toContain(name);
    }
    expect(definition.overlays).toHaveProperty('prism-net-clash');
    expect(definition.modes).not.toContain('prism-net');
  });

  it('붙이기·빼기·접기·펼치기', () => {
    const s0 = make();
    const s1 = reduce(reduce(s0, pick('rect')), attach(null, 0));
    const s1b = reduce(s0, pick('rect'));
    expect(emit(s1b, s1)).toEqual([{ name: 'piece-attached', payload: { type: 'rect' } }]);
    const s2 = reduce(s1, { type: 'toggle-fold' });
    expect(emit(s1, s2)).toEqual([{ name: 'prism-net-folded', payload: { valid: false } }]);
    const s3 = reduce(s2, { type: 'toggle-fold' });
    expect(emit(s2, s3)).toEqual([{ name: 'prism-net-unfolded', payload: {} }]);
    const s4 = reduce(s1, { type: 'remove-piece', id: 0 });
    expect(emit(s1, s4)).toEqual([{ name: 'piece-removed', payload: {} }]);
    expect(emit(s1, s1)).toEqual([]);

    const tri = buildTriPrism();
    const folded = reduce(tri, { type: 'toggle-fold' });
    expect(emit(tri, folded)).toEqual([{ name: 'prism-net-folded', payload: { valid: true } }]);
  });
});
