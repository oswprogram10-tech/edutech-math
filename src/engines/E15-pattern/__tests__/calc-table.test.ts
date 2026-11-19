/** E15 calc-pattern 표 변형 순수 계산·reduce·판정·오개념 테스트. */
import { describe, expect, it } from 'vitest';
import {
  amountIsCorrect,
  calcTableSettings,
  entriesAllCorrect,
  moveCell,
  rowColCells,
  stepDiffs,
  stepFrom,
  valueAt,
} from '../calc-table';
import engine from '../index';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { CalcTableConfig, CalcTableState, PatternAction } from '../types';

function start(config: Partial<CalcTableConfig> = {}): CalcTableState {
  const state = createInitialState({ mode: 'calc-pattern', table: 'addition', ...config });
  if (state.mode !== 'calc-pattern' || state.variant !== 'table') {
    throw new Error('표 변형 상태가 아닙니다.');
  }
  return state;
}

function play(state: CalcTableState, actions: readonly PatternAction[]): CalcTableState {
  return actions.reduce<CalcTableState>((acc, action) => {
    const next = reduce(acc, action);
    if (next.mode !== 'calc-pattern' || next.variant !== 'table') {
      throw new Error('표 변형 상태가 아닙니다.');
    }
    return next;
  }, state);
}

function write(state: CalcTableState, cell: string, digits: string): CalcTableState {
  return play(state, [
    { type: 'activate', cell },
    ...[...digits].map((key): PatternAction => ({ type: 'type', key })),
  ]);
}

function predicate(name: string, state: CalcTableState, args: Record<string, unknown> = {}) {
  const fn = engine.predicates?.[name];
  if (!fn) throw new Error(`predicate ${name} 없음`);
  return fn(observe(state), args as never);
}

describe('표 값과 설정', () => {
  it('덧셈은 행머리 + 열머리, 곱셈은 행머리 × 열머리(start 1)', () => {
    const add = calcTableSettings({ mode: 'calc-pattern', table: 'addition' });
    const mul = calcTableSettings({ mode: 'calc-pattern', table: 'multiplication' });
    expect(valueAt(add, 0, 0)).toBe(2);
    expect(valueAt(add, 2, 3)).toBe(7);
    expect(valueAt(mul, 4, 3)).toBe(20);
    expect(valueAt(mul, 5, 5)).toBe(36);
  });

  it('start 0이면 머리가 0부터이고 곱셈 첫 줄은 모두 0이다', () => {
    const mul = calcTableSettings({ mode: 'calc-pattern', table: 'multiplication', start: 0 });
    expect(valueAt(mul, 0, 5)).toBe(0);
    expect(valueAt(mul, 2, 3)).toBe(6);
    const add = calcTableSettings({ mode: 'calc-pattern', table: 'addition', start: 0 });
    expect(valueAt(add, 0, 0)).toBe(0);
  });

  it('크기 경계: 2~9는 받고 1·10·소수·길이 틀림은 오류', () => {
    const ok = (size: unknown) =>
      calcTableSettings({ mode: 'calc-pattern', table: 'addition', size } as never).error;
    expect(ok([2, 2])).toBeNull();
    expect(ok([9, 9])).toBeNull();
    expect(ok([1, 6])).toBe('size');
    expect(ok([6, 10])).toBe('size');
    expect(ok([2.5, 3])).toBe('size');
    expect(ok([3])).toBe('size');
  });

  it('범위 밖 설정은 오류 판 상태(settings.error)이고 reduce가 아무것도 바꾸지 않는다', () => {
    for (const bad of [
      { table: 'division' },
      { start: 10 },
      { start: -1 },
      { magnifierUses: 6 },
      { hidden: [[9, 0]] },
      { hidden: 'all' },
    ]) {
      const state = start(bad as never);
      expect(state.settings.error).not.toBeNull();
      expect(reduce(state, { type: 'set-tool', tool: 'write' })).toBe(state);
    }
  });

  it('hidden most는 첫 몸통 행·첫 몸통 열 말고 모두', () => {
    const { hidden } = start({ size: [3, 4] }).settings;
    expect(hidden).toEqual(['1.1', '1.2', '1.3', '2.1', '2.2', '2.3']);
    expect(hidden).not.toContain('0.2');
    expect(hidden).not.toContain('2.0');
    // 기본은 most, 6×6이면 25칸
    expect(start().settings.hidden).toHaveLength(25);
  });

  it('hidden 목록은 정렬·중복 제거한다', () => {
    const { hidden } = start({
      hidden: [
        [2, 1],
        [0, 3],
        [2, 1],
      ],
    }).settings;
    expect(hidden).toEqual(['0.3', '2.1']);
  });
});

describe('쓰기·돋보기', () => {
  const base = {
    hidden: [
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ] as [number, number][],
    magnifierUses: 3,
  };

  it('가린 칸에만 쓸 수 있고 숫자 3자리까지다', () => {
    let s = start(base);
    expect(reduce(s, { type: 'activate', cell: '0.0' })).toBe(s);
    s = write(s, '1.1', '1234');
    expect(s.entries['1.1']).toBe('123');
    s = play(s, [{ type: 'backspace' }]);
    expect(s.entries['1.1']).toBe('12');
    s = play(s, [{ type: 'clear' }]);
    expect(s.entries['1.1']).toBeUndefined();
  });

  it('0 뒤에 숫자를 쓰면 0을 바꾼다', () => {
    const s = write(start(base), '1.1', '05');
    expect(s.entries['1.1']).toBe('5');
  });

  it('peek: 가린 칸만, 횟수만큼만, 열면 써 둔 수를 거두고 입력 칸이 아니다', () => {
    let s = write(start(base), '1.1', '9');
    expect(reduce(s, { type: 'peek', cell: '0.0' })).toBe(s);
    s = play(s, [{ type: 'peek', cell: '1.1' }]);
    expect(s.revealed).toEqual(['1.1']);
    expect(s.entries['1.1']).toBeUndefined();
    // 연 칸에는 쓸 수 없다
    const after = play(s, [
      { type: 'activate', cell: '1.1' },
      { type: 'type', key: '4' },
    ]);
    expect(after.entries['1.1']).toBeUndefined();
    // 같은 칸을 다시 열어도 횟수를 쓰지 않는다
    expect(reduce(s, { type: 'peek', cell: '1.1' })).toBe(s);
    s = play(s, [
      { type: 'peek', cell: '2.2' },
      { type: 'peek', cell: '3.3' },
    ]);
    expect(s.revealed).toHaveLength(3);
    // 횟수 0이면 무시
    expect(reduce(s, { type: 'peek', cell: '4.4' })).toBe(s);
    expect(observe(s)['magnifierLeft']).toBe(0);
  });

  it('돋보기 0이면 magnifier 도구를 쓸 수 없다', () => {
    const s = start({ magnifierUses: 0 });
    expect(reduce(s, { type: 'set-tool', tool: 'magnifier' })).toBe(s);
    expect(reduce(s, { type: 'peek', cell: '1.1' })).toBe(s);
  });

  it('화살표를 끄면 arrow 도구를 쓸 수 없다', () => {
    const s = start();
    expect(reduce(s, { type: 'set-tool', tool: 'arrow' })).toBe(s);
  });

  it('move: 같은 줄·같은 칸의 가린 칸 사이를 옮기고 가장자리에서 멈춘다', () => {
    let s = start({ size: [3, 3] }); // 가린 칸 1.1 1.2 2.1 2.2
    s = play(s, [{ type: 'move', dir: 'right' }]);
    expect(s.active).toBe('1.1');
    s = play(s, [{ type: 'move', dir: 'right' }]);
    expect(s.active).toBe('1.2');
    s = play(s, [{ type: 'move', dir: 'right' }]);
    expect(s.active).toBe('1.2');
    s = play(s, [{ type: 'move', dir: 'down' }]);
    expect(s.active).toBe('2.2');
    s = play(s, [
      { type: 'move', dir: 'left' },
      { type: 'move', dir: 'up' },
    ]);
    expect(s.active).toBe('1.1');
  });

  it('moveCell은 후보가 없으면 지금 칸을 돌려준다', () => {
    const grid = { table: 'addition', rows: 3, cols: 3, start: 1 } as const;
    expect(moveCell(grid, [], '1.1', 'right')).toBe('1.1');
    expect(moveCell(grid, ['1.1'], '1.1', 'left')).toBe('1.1');
  });

  it('도구를 바꾸면 화살표 초안을 지우고 새 도구의 후보가 아닌 고른 칸을 거둔다', () => {
    let s = start({ ...base, drawArrows: true });
    s = play(s, [
      { type: 'activate', cell: '1.1' },
      { type: 'set-tool', tool: 'arrow' },
    ]);
    expect(s.active).toBe('1.1'); // 화살표는 몸통 전체가 후보
    s = play(s, [{ type: 'arrow-start', cell: '0.0' }]);
    expect(s.draftArrow).not.toBeNull();
    s = play(s, [{ type: 'set-tool', tool: 'write' }]);
    expect(s.draftArrow).toBeNull();
    // 화살표 도구로 고른 안 가린 칸은 쓰기 도구로 바꾸면 거둔다.
    expect(s.active).toBeNull();
  });
});

describe('화살표', () => {
  const add = start({ table: 'addition', drawArrows: true });
  const mul = start({ table: 'multiplication', drawArrows: true });

  function draw(
    state: CalcTableState,
    cell: string,
    dir: 'right' | 'down' | 'down-right' | 'down-left',
    amount: string,
  ): CalcTableState {
    return play(state, [
      { type: 'set-tool', tool: 'arrow' },
      { type: 'arrow-start', cell },
      { type: 'arrow-dir', dir },
      ...[...amount].map((key): PatternAction => ({ type: 'arrow-type', key })),
      { type: 'arrow-commit' },
    ]);
  }

  it('덧셈표 ↘ = 2, → ↓ = 1, ↙ = 0이 맞는 증가량이다', () => {
    const grid = add.settings;
    expect(amountIsCorrect(grid, { from: '2.2', dir: 'down-right', amount: '2' })).toBe(true);
    expect(amountIsCorrect(grid, { from: '2.2', dir: 'down-right', amount: '1' })).toBe(false);
    expect(amountIsCorrect(grid, { from: '2.2', dir: 'right', amount: '1' })).toBe(true);
    expect(amountIsCorrect(grid, { from: '2.2', dir: 'down', amount: '1' })).toBe(true);
    expect(amountIsCorrect(grid, { from: '2.2', dir: 'down-left', amount: '0' })).toBe(true);
    expect(amountIsCorrect(grid, { from: '2.2', dir: 'down-left', amount: '' })).toBe(false);
  });

  it('곱셈표는 위치마다 증가량이 다르다', () => {
    const grid = mul.settings;
    // 5단(행 4)에서 → 는 +5, 4단(행 3)에서는 +4
    expect(amountIsCorrect(grid, { from: '4.2', dir: 'right', amount: '5' })).toBe(true);
    expect(amountIsCorrect(grid, { from: '3.2', dir: 'right', amount: '5' })).toBe(false);
    expect(amountIsCorrect(grid, { from: '3.2', dir: 'right', amount: '4' })).toBe(true);
    expect(amountIsCorrect(grid, { from: '2.5', dir: 'down', amount: '6' })).toBe(true);
    // 3×3 → 4×4 = 9 → 16: +7
    expect(amountIsCorrect(grid, { from: '2.2', dir: 'down-right', amount: '7' })).toBe(true);
  });

  it('몸통 밖으로 나가는 방향은 고를 수 없다', () => {
    let s = play(add, [
      { type: 'set-tool', tool: 'arrow' },
      { type: 'arrow-start', cell: '5.5' },
    ]);
    expect(reduce(s, { type: 'arrow-dir', dir: 'right' })).toBe(s);
    expect(reduce(s, { type: 'arrow-dir', dir: 'down' })).toBe(s);
    s = play(s, [{ type: 'arrow-start', cell: '0.0' }]);
    expect(reduce(s, { type: 'arrow-dir', dir: 'down-left' })).toBe(s); // 0열이라 ↙ 없음
    expect(stepFrom(add.settings, '0.0', 'down-right')).toEqual([1, 1]);
    expect(stepFrom(add.settings, '5.0', 'down')).toBeNull();
  });

  it('방향·증가량·놓기 순서로 그리고 Observation에 amountCorrect만 담긴다', () => {
    const s = draw(add, '1.1', 'down-right', '2');
    expect(s.arrows).toEqual([{ from: '1.1', dir: 'down-right', amount: '2' }]);
    expect(s.draftArrow).toBeNull();
    const o = observe(s);
    expect(o['arrows']).toEqual([
      { from: '1.1', dir: 'down-right', amount: '2', amountCorrect: true },
    ]);
    expect(predicate('arrowFound', s, { dir: 'down-right' })).toBe(true);
    expect(predicate('arrowFound', s, { dir: 'down-right', amount: 2 })).toBe(true);
    expect(predicate('arrowFound', s, { dir: 'down-right', amount: 3 })).toBe(false);
    expect(predicate('arrowFound', s, { dir: 'right' })).toBe(false);
    const wrong = draw(add, '1.1', 'down-right', '3');
    expect(predicate('arrowFound', wrong, { dir: 'down-right' })).toBe(false);
  });

  it('방향이나 증가량이 없으면 놓을 수 없고 음수·글자는 받지 않는다', () => {
    let s = play(add, [
      { type: 'set-tool', tool: 'arrow' },
      { type: 'arrow-start', cell: '1.1' },
    ]);
    expect(reduce(s, { type: 'arrow-commit' })).toBe(s);
    s = play(s, [{ type: 'arrow-dir', dir: 'right' }]);
    expect(reduce(s, { type: 'arrow-commit' })).toBe(s);
    expect(reduce(s, { type: 'arrow-type', key: '-' })).toBe(s);
    expect(reduce(s, { type: 'arrow-type', key: 'a' })).toBe(s);
    s = play(s, [{ type: 'arrow-type', key: '1' }]);
    expect(s.draftArrow?.amount).toBe('1');
    s = play(s, [{ type: 'arrow-backspace' }]);
    expect(s.draftArrow?.amount).toBe('');
  });

  it('최대 6개, 같은 칸·같은 방향은 바꿔 놓고 arrow-remove로 지운다', () => {
    let s = add;
    const cells = ['0.0', '0.1', '0.2', '0.3', '0.4', '1.0'];
    for (const cell of cells) s = draw(s, cell, 'right', '1');
    expect(s.arrows).toHaveLength(6);
    const seventh = draw(s, '2.0', 'right', '1');
    expect(seventh.arrows).toHaveLength(6);
    const replaced = draw(s, '0.0', 'right', '7');
    expect(replaced.arrows).toHaveLength(6);
    expect(replaced.arrows[0]?.amount).toBe('7');
    const removed = play(s, [{ type: 'arrow-remove', index: 0 }]);
    expect(removed.arrows).toHaveLength(5);
    expect(reduce(removed, { type: 'arrow-remove', index: 9 })).toBe(removed);
  });
});

describe('MC-CHART-ROW-COL', () => {
  const mulBase: Partial<CalcTableConfig> = { table: 'multiplication' };

  it('곱셈표 5×4 칸에 15 + 4 = 19를 쓰면 걸린다(왼쪽 이웃 + 세로 한 칸 차이)', () => {
    const s = write(start({ ...mulBase, hidden: [[4, 3]] }), '4.3', '19');
    expect(observe(s)['misconceptions']).toEqual(['MC-CHART-ROW-COL']);
    expect(rowColCells(s.settings, s.entries, s.revealed)).toEqual(['4.3']);
    expect(predicate('hasMisconception', s, { code: 'MC-CHART-ROW-COL' })).toBe(true);
  });

  it('위 이웃 + 가로 한 칸 차이(16 + 5 = 21)도 걸린다', () => {
    // 위 이웃 4×4 = 16, 가로 한 칸 차이는 행머리 5
    const s = write(start({ ...mulBase, hidden: [[4, 3]] }), '4.3', '21');
    expect(observe(s)['misconceptions']).toEqual(['MC-CHART-ROW-COL']);
  });

  it('맞는 값(20)이나 상관없는 틀린 값(7)은 걸리지 않는다', () => {
    const right = write(start({ ...mulBase, hidden: [[4, 3]] }), '4.3', '20');
    expect(observe(right)['misconceptions']).toEqual([]);
    const other = write(start({ ...mulBase, hidden: [[4, 3]] }), '4.3', '7');
    expect(observe(other)['misconceptions']).toEqual([]);
  });

  it('가로·세로 차이가 같으면(4단 4열) 걸지 않는다', () => {
    const s = write(start({ ...mulBase, hidden: [[3, 3]] }), '3.3', '17');
    expect(stepDiffs(s.settings, 3, 3)).toEqual({ h: 4, v: 4 });
    expect(observe(s)['misconceptions']).toEqual([]);
  });

  it('덧셈표는 가로 = 세로 = 1이라 걸리지 않는다', () => {
    const s = write(start({ hidden: [[2, 3]] }), '2.3', '8');
    expect(observe(s)['misconceptions']).toEqual([]);
  });

  it('이웃이 가려져 있고 비어 있으면 그 이웃으로는 세지 않는다', () => {
    const base = start({
      ...mulBase,
      hidden: [
        [4, 2],
        [4, 3],
      ],
    });
    const blank = write(base, '4.3', '19');
    expect(observe(blank)['misconceptions']).toEqual([]);
    // 왼쪽 이웃에 학생이 15를 썼다면 그 값으로 센다.
    const written = write(write(base, '4.2', '15'), '4.3', '19');
    expect(observe(written)['misconceptions']).toEqual(['MC-CHART-ROW-COL']);
  });
});

describe('판정(predicate)', () => {
  it('tableEntriesCorrect: 열지 않은 가린 칸이 모두 맞아야 한다', () => {
    const base = start({
      hidden: [
        [1, 1],
        [2, 2],
        [3, 3],
      ],
      magnifierUses: 1,
    });
    let s = write(base, '1.1', '4'); // 2 + 2
    expect(predicate('tableEntriesCorrect', s)).toBe(false);
    s = write(s, '2.2', '6');
    s = write(s, '3.3', '8');
    expect(predicate('tableEntriesCorrect', s)).toBe(true);
    s = write(s, '3.3', '9'); // 89
    expect(predicate('tableEntriesCorrect', s)).toBe(false);
    // 지정한 칸만 본다
    expect(predicate('tableEntriesCorrect', s, { cells: ['1.1', '2.2'] })).toBe(true);
    expect(predicate('tableEntriesCorrect', s, { cells: ['1.1', '3.3'] })).toBe(false);
    // 돋보기로 연 칸은 쓰지 않아도 된다
    let t = write(base, '1.1', '4');
    t = write(t, '2.2', '6');
    t = play(t, [
      { type: 'set-tool', tool: 'magnifier' },
      { type: 'peek', cell: '3.3' },
    ]);
    expect(predicate('tableEntriesCorrect', t)).toBe(true);
  });

  it('tableEntriesCorrect: 가린 칸이 없거나 지정 칸 형식이 틀리면 false', () => {
    expect(predicate('tableEntriesCorrect', start({ hidden: [] }))).toBe(false);
    const s = write(start({ hidden: [[1, 1]] }), '1.1', '4');
    expect(predicate('tableEntriesCorrect', s, { cells: [3] })).toBe(false);
    expect(predicate('tableEntriesCorrect', s, { cells: ['9.9'] })).toBe(false);
    // 안 가린 칸을 지정하면 이미 보이므로 맞다
    expect(predicate('tableEntriesCorrect', s, { cells: ['0.0'] })).toBe(true);
  });

  it('곱셈표 값도 판정한다(start 0 포함)', () => {
    const s = write(
      start({
        table: 'multiplication',
        start: 0,
        hidden: [
          [0, 3],
          [3, 3],
        ],
      }),
      '0.3',
      '0',
    );
    expect(predicate('tableEntriesCorrect', s, { cells: ['0.3'] })).toBe(true);
    const t = write(s, '3.3', '9');
    expect(predicate('tableEntriesCorrect', t)).toBe(true);
    expect(entriesAllCorrect(t.settings, t.entries, t.revealed, ['3.3'])).toBe(true);
  });

  it('tableEntryIs·peeksAtMost', () => {
    const s = write(
      start({
        hidden: [
          [1, 1],
          [2, 2],
        ],
        magnifierUses: 2,
      }),
      '1.1',
      '4',
    );
    expect(predicate('tableEntryIs', s, { cell: '1.1', value: 4 })).toBe(true);
    expect(predicate('tableEntryIs', s, { cell: '1.1', value: 5 })).toBe(false);
    expect(predicate('tableEntryIs', s, { cell: '2.2', value: 6 })).toBe(false);
    expect(predicate('peeksAtMost', s, { n: 0 })).toBe(true);
    const peeked = play(s, [
      { type: 'set-tool', tool: 'magnifier' },
      { type: 'peek', cell: '2.2' },
    ]);
    expect(predicate('peeksAtMost', peeked, { n: 0 })).toBe(false);
    expect(predicate('peeksAtMost', peeked, { n: 1 })).toBe(true);
  });

  it('피라미드 상태 Observation에는 표 predicate가 false다', () => {
    const pyramid = createInitialState({ mode: 'calc-pattern', pattern: 'symmetric-sum-square' });
    const fn = engine.predicates?.['tableEntriesCorrect'];
    expect(fn?.(observe(pyramid), {})).toBe(false);
  });
});

describe('Observation은 가린 칸의 정답을 담지 않는다', () => {
  it('키 목록이 고정이고 hidden은 키뿐이다', () => {
    const s = write(start({ table: 'multiplication', hidden: [[7, 7]], size: [9, 9] }), '7.7', '1');
    const o = observe(s);
    expect(Object.keys(o).sort()).toEqual(
      [
        'arrows',
        'entries',
        'hidden',
        'magnifierLeft',
        'misconceptions',
        'mode',
        'revealed',
        'size',
        'start',
        'table',
        'variant',
      ].sort(),
    );
    expect(JSON.stringify(o)).not.toContain('64');
    expect(o['hidden']).toEqual(['7.7']);
  });
});

describe('기존 피라미드 상태와 직렬화', () => {
  it('table 키가 없으면 피라미드 상태이고 variant가 없다', () => {
    const state = createInitialState({ mode: 'calc-pattern', pattern: 'symmetric-sum-square' });
    expect(state.mode).toBe('calc-pattern');
    expect('variant' in state).toBe(false);
    const next = reduce(state, { type: 'tap-cell', col: 0, h: 1 });
    expect(next.mode === 'calc-pattern' && 'heights' in next && next.heights[0]).toBe(1);
    const obs = observe(next);
    expect(obs['pattern']).toBe('symmetric-sum-square');
    expect('variant' in obs).toBe(false);
  });

  it('표 상태는 JSON으로 직렬화해도 같다', () => {
    let s = start({
      magnifierUses: 2,
      drawArrows: true,
      hidden: [
        [1, 1],
        [2, 2],
      ],
    });
    s = write(s, '1.1', '4');
    s = play(s, [
      { type: 'set-tool', tool: 'magnifier' },
      { type: 'peek', cell: '2.2' },
      { type: 'set-tool', tool: 'arrow' },
      { type: 'arrow-start', cell: '1.1' },
      { type: 'arrow-dir', dir: 'down' },
      { type: 'arrow-type', key: '1' },
    ]);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    // 직렬화한 상태에서 이어도 같은 결과다
    const restored = JSON.parse(JSON.stringify(s)) as CalcTableState;
    expect(reduce(restored, { type: 'arrow-commit' })).toEqual(reduce(s, { type: 'arrow-commit' }));
  });

  it('바뀌는 것이 없으면 같은 상태 객체를 돌려준다', () => {
    const s = start();
    expect(reduce(s, { type: 'backspace' })).toBe(s);
    expect(reduce(s, { type: 'clear' })).toBe(s);
    expect(reduce(s, { type: 'arrow-remove', index: 0 })).toBe(s);
  });
});
