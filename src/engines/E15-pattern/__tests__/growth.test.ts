/** E15 growth 순수 계산·reduce·판정·오개념 테스트. */
import { describe, expect, it } from 'vitest';
import engine from '../index';
import {
  blankKeys,
  expectedValue,
  incrementOf,
  moveBlank,
  newCubes,
  stageCount,
  stageCubes,
} from '../growth';
import { growthLayout } from '../growth-layout';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import { growthSettings } from '../settings';
import type { GrowthConfig, GrowthShape, GrowthState, PatternAction } from '../types';

const SHAPES: readonly GrowthShape[] = ['L', 'stairs', 'tower2'];

function start(config: Partial<GrowthConfig> = {}): GrowthState {
  const state = createInitialState({ mode: 'growth', ...config });
  if (state.mode !== 'growth') throw new Error('growth 상태가 아닙니다.');
  return state;
}

function play(state: GrowthState, actions: readonly PatternAction[]): GrowthState {
  return actions.reduce<GrowthState>((acc, action) => {
    const next = reduce(acc, action);
    if (next.mode !== 'growth') throw new Error('growth 상태가 아닙니다.');
    return next;
  }, state);
}

function fill(state: GrowthState, cell: string, digits: string): GrowthState {
  return play(state, [
    { type: 'activate', cell },
    ...[...digits].map((key): PatternAction => ({ type: 'type', key })),
  ]);
}

function predicate(name: string, state: GrowthState, args: Record<string, unknown> = {}) {
  const fn = engine.predicates?.[name];
  if (!fn) throw new Error(`predicate ${name} 없음`);
  return fn(observe(state), args as never);
}

describe('growth 모양', () => {
  it('세 모양의 n=1·2·5 개수와 규칙', () => {
    const counts = (shape: GrowthShape) => [1, 2, 5].map((n) => stageCubes(shape, n).length);
    expect(counts('L')).toEqual([1, 3, 9]);
    expect(counts('stairs')).toEqual([1, 3, 15]);
    expect(counts('tower2')).toEqual([2, 4, 10]);
    expect(stageCount('L', 4)).toBe(7);
  });

  it('좌표는 정수이고 겹치지 않는다', () => {
    for (const shape of SHAPES) {
      for (const n of [1, 2, 5, 8]) {
        const cubes = stageCubes(shape, n);
        const keys = new Set(cubes.map((c) => c.join(',')));
        expect(keys.size).toBe(cubes.length);
        expect(cubes.every((c) => c.every(Number.isInteger))).toBe(true);
      }
    }
  });

  it('n단계는 n-1단계를 모두 포함하고 늘어난 좌표는 그 차이다', () => {
    for (const shape of SHAPES) {
      for (let n = 2; n <= 8; n += 1) {
        const before = new Set(stageCubes(shape, n - 1).map((c) => c.join(',')));
        const now = new Set(stageCubes(shape, n).map((c) => c.join(',')));
        for (const key of before) expect(now.has(key)).toBe(true);
        const fresh = newCubes(shape, n).map((c) => c.join(','));
        expect(fresh).toHaveLength(now.size - before.size);
        for (const key of fresh) expect(before.has(key)).toBe(false);
        expect(incrementOf(shape, n)).toBe(fresh.length);
      }
    }
    expect([2, 3, 4].map((n) => incrementOf('L', n))).toEqual([2, 2, 2]);
    expect(incrementOf('L', 1)).toBeNull();
    expect(newCubes('L', 1)).toHaveLength(1);
  });
});

describe('growth 설정·빈칸', () => {
  it('기본값', () => {
    expect(growthSettings({ mode: 'growth' })).toEqual({
      shape: 'L',
      stepsShown: 3,
      highlightIncrement: true,
      table: { upTo: 5, counts: 'given', increments: 'blank' },
      look: 'cubes',
    });
  });

  it('범위 밖 값은 범위로 맞춘다', () => {
    const s = growthSettings({ mode: 'growth', stepsShown: 9, table: { upTo: 99 } });
    expect(s.stepsShown).toBe(5);
    expect(s.table?.upTo).toBe(8);
    const low = growthSettings({ mode: 'growth', stepsShown: 4, table: { upTo: 1 } });
    expect(low.table?.upTo).toBe(4);
    expect(growthSettings({ mode: 'growth', table: false }).table).toBeNull();
  });

  it('빈칸 키: given/blank, increments off', () => {
    expect(blankKeys(growthSettings({ mode: 'growth' }))).toEqual([
      '2.inc',
      '3.inc',
      '4.count',
      '4.inc',
      '5.count',
      '5.inc',
    ]);
    expect(blankKeys(growthSettings({ mode: 'growth', table: { counts: 'blank' } }))).toContain(
      '1.count',
    );
    const off = growthSettings({ mode: 'growth', table: { increments: 'off' } });
    expect(blankKeys(off)).toEqual(['4.count', '5.count']);
    expect(blankKeys(growthSettings({ mode: 'growth', table: false }))).toEqual([]);
  });

  it('expectedValue', () => {
    expect(expectedValue('L', '5.count')).toBe(9);
    expect(expectedValue('L', '4.inc')).toBe(2);
    expect(expectedValue('L', '1.inc')).toBeNull();
    expect(expectedValue('L', 'x')).toBeNull();
  });

  it('look none이면 보기 판 배치가 없다', () => {
    expect(growthLayout(growthSettings({ mode: 'growth', look: 'none' }))).toBeNull();
    expect(growthLayout(growthSettings({ mode: 'growth' }))?.panels).toHaveLength(3);
  });
});

describe('growth reduce', () => {
  it('빈칸만 고를 수 있다', () => {
    const state = start();
    expect(reduce(state, { type: 'activate', cell: '1.count' })).toBe(state);
    expect(reduce(state, { type: 'activate', cell: '2.inc' })).toMatchObject({ active: '2.inc' });
  });

  it('숫자는 최대 3자리, 0 뒤 숫자는 0을 바꾼다, backspace·clear', () => {
    let state = fill(start(), '4.count', '1234');
    expect(state.cells['4.count']).toBe('123');
    state = play(state, [{ type: 'backspace' }]);
    expect(state.cells['4.count']).toBe('12');
    state = play(state, [{ type: 'clear' }]);
    expect(state.cells['4.count']).toBeUndefined();
    state = fill(state, '4.count', '07');
    expect(state.cells['4.count']).toBe('7');
    expect(reduce(state, { type: 'type', key: 'a' })).toBe(state);
  });

  it('활성 칸이 없으면 입력은 무시한다', () => {
    const state = start();
    expect(reduce(state, { type: 'type', key: '1' })).toBe(state);
    expect(reduce(state, { type: 'backspace' })).toBe(state);
  });

  it('move: 첫 빈칸으로 시작해 같은 줄·다른 줄로 옮긴다', () => {
    let state = play(start(), [{ type: 'move', dir: 'right' }]);
    expect(state.active).toBe('2.inc');
    state = play(state, [{ type: 'move', dir: 'right' }]);
    expect(state.active).toBe('3.inc');
    state = play(state, [{ type: 'move', dir: 'up' }]);
    // 3단계 개수는 주어졌으므로 가장 가까운 빈 개수 칸(4)으로 간다.
    expect(state.active).toBe('4.count');
    state = play(state, [{ type: 'move', dir: 'down' }]);
    expect(state.active).toBe('4.inc');
    expect(reduce(state, { type: 'move', dir: 'down' })).toBe(state);
    expect(moveBlank([], null, 'left')).toBeNull();
  });

  it('상태는 JSON으로 직렬화되고 이전 상태를 바꾸지 않는다', () => {
    const state = start();
    const next = fill(state, '2.inc', '2');
    expect(state.cells).toEqual({});
    expect(JSON.parse(JSON.stringify(next))).toEqual(next);
  });

  it('다른 모드의 Action은 growth 상태를 바꾸지 않는다', () => {
    const state = start();
    expect(reduce(state, { type: 'place', slot: 0, token: 'circle' })).toBe(state);
    expect(reduce(state, { type: 'tap-cell', col: 0, h: 1 })).toBe(state);
  });

  it('emit은 이벤트를 만들지 않는다', () => {
    const state = start();
    const next = fill(state, '2.inc', '2');
    expect(engine.emit?.(state, next, { type: 'type', key: '2' })).toEqual([]);
  });
});

describe('growth Observation·predicate', () => {
  it('Observation에 정답 개수가 없다', () => {
    const obs = observe(start());
    expect(Object.keys(obs).sort()).toEqual(
      [
        'blanks',
        'blanksCorrect',
        'entries',
        'misconceptions',
        'mode',
        'shape',
        'stepsShown',
        'upTo',
      ].sort(),
    );
    expect(obs['blanksCorrect']).toBe(false);
    expect(obs['entries']).toEqual({});
  });

  it('incrementsCorrect: 늘어난 수 빈칸이 모두 맞아야 한다(2, 2)', () => {
    let state = start({ table: { upTo: 3 } });
    expect(predicate('incrementsCorrect', state)).toBe(false);
    state = fill(state, '2.inc', '2');
    expect(predicate('incrementsCorrect', state)).toBe(false);
    state = fill(state, '3.inc', '2');
    expect(predicate('incrementsCorrect', state)).toBe(true);
    state = fill(play(state, [{ type: 'clear' }]), '3.inc', '3');
    expect(predicate('incrementsCorrect', state)).toBe(false);
  });

  it('inc 빈칸이 없으면 incrementsCorrect는 false', () => {
    const state = start({ table: { increments: 'off' } });
    expect(predicate('incrementsCorrect', state)).toBe(false);
  });

  it('countCorrect, growthEntryIs, blanksCorrect', () => {
    let state = start();
    expect(predicate('countCorrect', state, { stage: 5 })).toBe(false);
    expect(predicate('countCorrect', state, { stage: 2 })).toBe(true); // 주어진 칸
    expect(predicate('countCorrect', state, { stage: 9 })).toBe(false);
    state = fill(state, '5.count', '9');
    expect(predicate('countCorrect', state, { stage: 5 })).toBe(true);
    expect(predicate('growthEntryIs', state, { cell: '5.count', value: 9 })).toBe(true);
    expect(predicate('growthEntryIs', state, { cell: '5.count', value: 7 })).toBe(false);
    expect(predicate('growthEntryIs', state, { cell: '4.count', value: 7 })).toBe(false);
    expect(predicate('blanksCorrect', state)).toBe(false);
    const answers: [string, string][] = [
      ['2.inc', '2'],
      ['3.inc', '2'],
      ['4.count', '7'],
      ['4.inc', '2'],
      ['5.inc', '2'],
    ];
    for (const [cell, value] of answers) state = fill(state, cell, value);
    expect(predicate('blanksCorrect', state)).toBe(true);
    expect(observe(state)['blanksCorrect']).toBe(true);
  });

  it('MC-PATTERN-GROWTH-TOTAL: 4단계 개수에 2를 쓰면 걸린다', () => {
    const state = fill(start(), '4.count', '2');
    expect(observe(state)['misconceptions']).toEqual(['MC-PATTERN-GROWTH-TOTAL']);
    expect(predicate('hasMisconception', state, { code: 'MC-PATTERN-GROWTH-TOTAL' })).toBe(true);
  });

  it('MC-PATTERN-GROWTH-TOTAL: 맞는 개수, 다른 수, 1단계, 우연히 같은 경우는 걸지 않는다', () => {
    expect(observe(fill(start(), '4.count', '7'))['misconceptions']).toEqual([]);
    expect(observe(fill(start(), '4.count', '5'))['misconceptions']).toEqual([]);
    const first = fill(start({ table: { counts: 'blank' } }), '1.count', '1');
    expect(observe(first)['misconceptions']).toEqual([]);
    // tower2: 1단계 개수는 2, 2단계 개수는 4, 늘어난 수는 2.
    const tower = { shape: 'tower2', table: { counts: 'blank' } } as const;
    expect(observe(fill(start(tower), '1.count', '2'))['misconceptions']).toEqual([]);
    expect(observe(fill(start(tower), '2.count', '4'))['misconceptions']).toEqual([]);
    expect(observe(fill(start(tower), '2.count', '2'))['misconceptions']).toEqual([
      'MC-PATTERN-GROWTH-TOTAL',
    ]);
    // 늘어난 수 칸에 쓴 2는 오개념이 아니다.
    expect(observe(fill(start(), '4.inc', '2'))['misconceptions']).toEqual([]);
  });

  it('맞는 개수를 쓰면 걸지 않는다(L 2단계 3)', () => {
    // L 2단계: 개수 3, 늘어난 수 2. 3을 쓰면 정답이라 안 걸린다.
    const state = fill(start({ table: { counts: 'blank' } }), '2.count', '3');
    expect(observe(state)['misconceptions']).toEqual([]);
  });
});
