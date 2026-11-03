import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, piecesOf, reduce, totalOf } from '../reduce';
import type { ArrayAreaAction, ArrayAreaConfig, ArrayAreaState } from '../types';
import { cellKey } from '../area';

function stateOf(config: ArrayAreaConfig): ArrayAreaState {
  return createInitialState(config);
}

function apply(state: ArrayAreaState, actions: readonly ArrayAreaAction[]): ArrayAreaState {
  return actions.reduce(reduce, state);
}

describe('E04 createInitialState', () => {
  it('dot-array는 기본 0×0이고, split은 7×8부터 시작한다', () => {
    const dot = stateOf({ mode: 'dot-array' });
    expect([dot.rows, dot.cols]).toEqual([0, 0]);
    expect(totalOf(dot)).toBe(0);

    const split = stateOf({ mode: 'split' });
    expect([split.rows, split.cols]).toEqual([7, 8]);
  });

  it('설정 키만 보고 모드를 고른다', () => {
    expect(stateOf({}).mode).toBe('dot-array');
    expect(stateOf({ maxSplits: 2 }).mode).toBe('split');
    expect(stateOf({ a: 23, b: 4 }).mode).toBe('area-model');
    expect(stateOf({ size: [9, 9] }).mode).toBe('times-table');
  });

  it('area-model 자릿값 경계는 place-value일 때만 미리 놓인다', () => {
    const placed = stateOf({ mode: 'area-model', a: 312, b: 3, splitA: 'place-value' });
    expect(placed.areaSplitsA).toEqual([300, 310]);
    const free = stateOf({ mode: 'area-model', a: 312, b: 3, splitA: 'free' });
    expect(free.areaSplitsA).toEqual([]);
  });

  it('초기 상태는 JSON 직렬화할 수 있다', () => {
    const configs: ArrayAreaConfig[] = [
      { mode: 'dot-array', rows: 3, cols: 4, rotate: true, factFamily: true },
      { mode: 'split', rows: 7, cols: 8, allowExtend: true, snapHints: [5] },
      { mode: 'area-model', a: 23, b: 4, splitA: 'place-value' },
      { mode: 'times-table', size: [9, 9], includeZero: true, prefill: 'rows-2-5' },
    ];
    for (const config of configs) assertSerializable(stateOf(config));
  });
});

describe('E04 dot-array', () => {
  it('resize는 maxRows·maxCols에서 멈추고 소수는 반올림한다', () => {
    const state = stateOf({ mode: 'dot-array', maxRows: 5, maxCols: 4 });
    expect(apply(state, [{ type: 'resize', rows: 3, cols: 4 }]).rows).toBe(3);
    expect(apply(state, [{ type: 'resize', rows: 99, cols: 99 }])).toMatchObject({
      rows: 5,
      cols: 4,
    });
    expect(apply(state, [{ type: 'resize', rows: -3, cols: -1 }])).toMatchObject({
      rows: 0,
      cols: 0,
    });
    expect(apply(state, [{ type: 'resize', rows: 2.6, cols: 3.2 }])).toMatchObject({
      rows: 3,
      cols: 3,
    });
  });

  it('rotate 두 번은 원상복귀하고 rotations는 2가 된다', () => {
    const state = stateOf({ mode: 'dot-array', rows: 3, cols: 4, rotate: true });
    const once = reduce(state, { type: 'rotate' });
    expect([once.rows, once.cols]).toEqual([4, 3]);
    const twice = reduce(once, { type: 'rotate' });
    expect([twice.rows, twice.cols]).toEqual([3, 4]);
    expect(twice.rotations).toBe(2);
  });

  it('rotate가 꺼져 있으면 아무 일도 하지 않는다', () => {
    const state = stateOf({ mode: 'dot-array', rows: 3, cols: 4 });
    expect(reduce(state, { type: 'rotate' })).toBe(state);
  });

  it('기록은 같은 배열과 돌린 배열을 하나로 센다', () => {
    const state = stateOf({ mode: 'dot-array', rows: 3, cols: 4, rotate: true });
    const once = reduce(state, { type: 'record-arrangement' });
    const rotated = reduce(reduce(once, { type: 'rotate' }), { type: 'record-arrangement' });
    expect(rotated.recorded).toEqual([{ rows: 3, cols: 4 }]);

    const other = reduce(rotated, { type: 'resize', rows: 4, cols: 4 });
    const recorded = reduce(other, { type: 'record-arrangement' });
    expect(recorded.recorded).toHaveLength(2);
    expect(observe(recorded)['distinctArrangements']).toBe(2);
  });

  it('0×0은 기록하지 않는다', () => {
    const state = stateOf({ mode: 'dot-array' });
    expect(reduce(state, { type: 'record-arrangement' })).toBe(state);
  });

  it('set-split-line은 범위 안으로 자른다', () => {
    const state = stateOf({ mode: 'dot-array', rows: 3, cols: 4, showSplitLines: true });
    const moved = reduce(state, { type: 'set-split-line', orientation: 'cols', at: 99 });
    expect(moved.splitLine).toEqual({ orientation: 'cols', at: 3 });
    const zero = reduce(moved, { type: 'set-split-line', orientation: 'cols', at: 0 });
    expect(zero.splitLine).toEqual({ orientation: 'cols', at: 1 });
  });

  it('showSplitLines가 꺼져 있으면 split-line을 만들지 않는다', () => {
    const state = stateOf({ mode: 'dot-array', rows: 3, cols: 4 });
    expect(reduce(state, { type: 'set-split-line', orientation: 'rows', at: 2 })).toBe(state);
  });
});

describe('E04 split', () => {
  it('자석 힌트 근처는 힌트 위치로 붙는다', () => {
    const state = stateOf({
      mode: 'split',
      rows: 7,
      cols: 10,
      orientation: 'cols',
      snapHints: [5],
    });
    const near = reduce(state, { type: 'place-split', orientation: 'cols', at: 6 });
    expect(near.splits).toEqual([{ orientation: 'cols', at: 5 }]);
  });

  it('maxSplits를 넘거나 같은 자리에 또 놓으면 무시한다', () => {
    const state = stateOf({ mode: 'split', rows: 7, cols: 10, maxSplits: 1 });
    const once = reduce(state, { type: 'place-split', orientation: 'cols', at: 5 });
    expect(reduce(once, { type: 'place-split', orientation: 'rows', at: 3 })).toBe(once);

    const limit = stateOf({ mode: 'split', rows: 7, cols: 10, maxSplits: 2 });
    const two = apply(limit, [
      { type: 'place-split', orientation: 'cols', at: 5 },
      { type: 'place-split', orientation: 'rows', at: 7 },
    ]);
    expect(two.splits).toHaveLength(2);
    expect(reduce(two, { type: 'place-split', orientation: 'rows', at: 6 })).toBe(two);
  });

  it('orientation 설정에 맞지 않는 방향은 놓지 않는다', () => {
    const state = stateOf({ mode: 'split', orientation: 'rows' });
    expect(reduce(state, { type: 'place-split', orientation: 'cols', at: 4 })).toBe(state);
  });

  it('7×8을 5|3으로 나누면 35와 21이 된다', () => {
    const state = apply(stateOf({ mode: 'split', rows: 7, cols: 8 }), [
      { type: 'place-split', orientation: 'cols', at: 5 },
    ]);
    expect(
      piecesOf(state)
        .map((piece) => piece.product)
        .sort((a, b) => a - b),
    ).toEqual([21, 35]);
    const observation = observe(state);
    expect(observation['partialSum']).toBe(56);
    expect(observation['total']).toBe(56);

    expect(predicates.splitAt?.(observation, { orientation: 'cols', at: 5 })).toBe(true);
    expect(predicates.splitAt?.(observation, { orientation: 'cols', at: 4 })).toBe(false);
    expect(predicates.partialsAre?.(observation, { products: [35, 21] })).toBe(true);
    expect(predicates.partialsAre?.(observation, { products: [35, 21], ordered: true })).toBe(true);
    expect(predicates.partialsAre?.(observation, { products: [21, 35], ordered: true })).toBe(
      false,
    );
  });

  it('allowExtend는 아래 한 줄을 빼는 조각(sign −1)으로 만든다', () => {
    const state = apply(stateOf({ mode: 'split', rows: 10, cols: 6, allowExtend: true }), [
      { type: 'extend', rows: 1 },
    ]);
    const pieces = piecesOf(state);
    expect(pieces).toEqual([
      { rows: 10, cols: 6, product: 60, sign: 1 },
      { rows: 1, cols: 6, product: 6, sign: -1 },
    ]);
    expect(observe(state)['partialSum']).toBe(54);
  });

  it('allowExtend가 꺼져 있으면 늘릴 수 없다', () => {
    const state = stateOf({ mode: 'split', rows: 10, cols: 6 });
    expect(reduce(state, { type: 'extend', rows: 1 })).toBe(state);
  });

  it('분할 기록은 순서가 달라도 같은 분할로 센다', () => {
    const state = apply(stateOf({ mode: 'split', rows: 7, cols: 10, maxSplits: 2 }), [
      { type: 'place-split', orientation: 'rows', at: 7 },
      { type: 'place-split', orientation: 'cols', at: 5 },
      { type: 'record-split' },
    ]);
    expect(state.recordedSplits).toHaveLength(1);
    const same = apply(state, [
      { type: 'remove-split', index: 0 },
      { type: 'remove-split', index: 0 },
      { type: 'place-split', orientation: 'cols', at: 5 },
      { type: 'place-split', orientation: 'rows', at: 7 },
      { type: 'record-split' },
    ]);
    expect(same.recordedSplits).toHaveLength(1);
    expect(reduce(same, { type: 'record-split' })).toBe(same);
  });

  it('remove-split은 없는 자리를 지우지 않는다', () => {
    const state = stateOf({ mode: 'split' });
    expect(reduce(state, { type: 'remove-split', index: 0 })).toBe(state);
  });
});

describe('E04 area-model', () => {
  it('312×3을 300|10|2로 나누면 900·30·6 조각이 된다', () => {
    const state = stateOf({ mode: 'area-model', a: 312, b: 3, splitA: 'place-value' });
    expect(state.areaSplitsA).toEqual([300, 310]);
    const pieces = piecesOf(state);
    expect(pieces.map((piece) => piece.product).sort((a, b) => a - b)).toEqual([6, 30, 900]);
    const observation = observe(state);
    expect(observation['pieces']).toEqual([
      { rows: 3, cols: 300, product: 900, sign: 1 },
      { rows: 3, cols: 10, product: 30, sign: 1 },
      { rows: 3, cols: 2, product: 6, sign: 1 },
    ]);
    expect(observation['partialSum']).toBe(936);
  });

  it('23×4를 20|3으로 나누면 80과 12가 된다', () => {
    const state = apply(stateOf({ mode: 'area-model', a: 23, b: 4 }), [
      { type: 'set-area-split', side: 'a', at: 20 },
    ]);
    expect(piecesOf(state).map((piece) => piece.product)).toEqual([80, 12]);
    expect(predicates.piecesAre?.(observe(state), { products: [12, 80] })).toBe(true);
    expect(observe(state)['total']).toBe(92);
  });

  it('splitA="none"이면 가로 분할선을 놓을 수 없다', () => {
    const state = stateOf({ mode: 'area-model', a: 23, b: 4, splitA: 'none' });
    expect(reduce(state, { type: 'set-area-split', side: 'a', at: 20 })).toBe(state);
  });

  it('같은 위치나 범위 밖, 3개를 넘는 분할은 무시한다', () => {
    let state = stateOf({ mode: 'area-model', a: 312, b: 3, splitA: 'free' });
    state = apply(state, [
      { type: 'set-area-split', side: 'a', at: 100 },
      { type: 'set-area-split', side: 'a', at: 200 },
      { type: 'set-area-split', side: 'a', at: 300 },
    ]);
    expect(state.areaSplitsA).toEqual([100, 200, 300]);
    expect(reduce(state, { type: 'set-area-split', side: 'a', at: 250 })).toBe(state);
    expect(reduce(state, { type: 'set-area-split', side: 'a', at: 0 })).toBe(state);
  });

  it('area-model이 아니면 area 분할 Action을 무시한다', () => {
    const state = stateOf({ mode: 'dot-array' });
    expect(reduce(state, { type: 'set-area-split', side: 'a', at: 5 })).toBe(state);
  });
});

describe('E04 times-table', () => {
  it('칸에 값을 쓰고 지우며, 범위 밖은 무시한다', () => {
    const state = stateOf({ mode: 'times-table', size: [9, 9] });
    const written = reduce(state, { type: 'set-cell', r: 3, c: 4, value: 12 });
    expect(written.cells[cellKey(3, 4)]).toBe(12);
    expect(predicates.cellsMatch?.(observe(written), { cells: [{ r: 3, c: 4, value: 12 }] })).toBe(
      true,
    );
    expect(predicates.cellsMatch?.(observe(written), { cells: [{ r: 3, c: 4, value: 11 }] })).toBe(
      false,
    );
    expect(reduce(written, { type: 'set-cell', r: 10, c: 4, value: 40 })).toBe(written);
    expect(reduce(written, { type: 'set-cell', r: 3, c: 4, value: -1 })).toBe(written);
    const cleared = reduce(written, { type: 'set-cell', r: 3, c: 4, value: null });
    expect(cleared.cells[cellKey(3, 4)]).toBeUndefined();
  });

  it('prefill rows-2-5는 2~5단만 채운다', () => {
    const state = stateOf({ mode: 'times-table', prefill: 'rows-2-5' });
    expect(state.cells[cellKey(2, 9)]).toBe(18);
    expect(state.cells[cellKey(5, 9)]).toBe(45);
    expect(state.cells[cellKey(6, 9)]).toBeUndefined();
    expect(state.cells[cellKey(1, 9)]).toBeUndefined();
  });

  it('includeZero는 0단·0열을 넣는다', () => {
    const state = stateOf({ mode: 'times-table', includeZero: true });
    expect(state.settings.includeZero).toBe(true);
    expect(reduce(state, { type: 'set-cell', r: 0, c: 3, value: 0 }).cells[cellKey(0, 3)]).toBe(0);
  });

  it('symmetryReveal은 (c, r) 칸을 반짝임 대상으로 삼고 값은 쓰지 않는다', () => {
    const state = stateOf({ mode: 'times-table', symmetryReveal: true });
    const written = reduce(state, { type: 'set-cell', r: 2, c: 7, value: 14 });
    expect(written.flash).toBe(cellKey(7, 2));
    expect(written.cells[cellKey(7, 2)]).toBeUndefined();
    expect(observe(written)['cells']).toEqual({ '2,7': 14 });
  });

  it('색칠은 0~3만 받고 지우기를 지원한다', () => {
    const state = stateOf({ mode: 'times-table', colorSameValue: true });
    const painted = reduce(state, { type: 'paint', r: 3, c: 6, color: 2 });
    expect(painted.painted[cellKey(3, 6)]).toBe(2);
    expect(reduce(painted, { type: 'paint', r: 3, c: 6, color: 7 })).toBe(painted);
    const cleared = reduce(painted, { type: 'paint', r: 3, c: 6, color: null });
    expect(cleared.painted[cellKey(3, 6)]).toBeUndefined();
  });

  it('select-cell은 같은 칸을 다시 누르면 해제한다', () => {
    const state = stateOf({ mode: 'times-table' });
    const selected = reduce(state, { type: 'select-cell', r: 3, c: 4 });
    expect(selected.selected).toEqual(['3,4']);
    expect(predicates.selectedAre?.(observe(selected), { cells: ['3,4'] })).toBe(true);
    expect(reduce(selected, { type: 'select-cell', r: 3, c: 4 }).selected).toEqual([]);
  });

  it('fold는 켜고 끈다', () => {
    const state = stateOf({ mode: 'times-table' });
    expect(reduce(state, { type: 'fold' }).folded).toBe(true);
    expect(reduce(reduce(state, { type: 'fold' }), { type: 'fold' }).folded).toBe(false);
  });

  it('wrongCells는 틀린 칸만 목록으로 준다', () => {
    let state = stateOf({ mode: 'times-table' });
    state = reduce(state, { type: 'set-cell', r: 3, c: 4, value: 11 });
    state = reduce(state, { type: 'set-cell', r: 3, c: 5, value: 15 });
    expect(observe(state)['wrongCells']).toEqual(['3,4']);
  });
});

describe('E04 이벤트', () => {
  it('분할이 바뀌면 partial-product-changed를 낸다', () => {
    const before = stateOf({ mode: 'split', rows: 7, cols: 8 });
    const after = reduce(before, { type: 'place-split', orientation: 'cols', at: 5 });
    const events = emit(before, after);
    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe('partial-product-changed');
    const payload = events[0]?.payload as
      { parts: { a: number; b: number; product: number; colorIndex: number }[] } | undefined;
    expect(payload?.parts).toEqual([
      { a: 7, b: 5, product: 35, colorIndex: 0 },
      { a: 7, b: 3, product: 21, colorIndex: 1 },
    ]);
  });

  it('dot-array의 수가 바뀌면 value-changed를 낸다', () => {
    const before = stateOf({ mode: 'dot-array', rows: 2, cols: 3 });
    const after = reduce(before, { type: 'resize', rows: 3, cols: 4 });
    expect(emit(before, after)).toEqual([{ name: 'value-changed', payload: { value: 12 } }]);
  });

  it('바뀐 것이 없으면 이벤트가 없다', () => {
    const state = stateOf({ mode: 'split' });
    expect(emit(state, state)).toEqual([]);
  });
});

describe('E04 observe·predicates', () => {
  it('dimsAre는 either일 때 회전한 배열도 받는다', () => {
    const state = stateOf({ mode: 'dot-array', rows: 3, cols: 4 });
    const observation = observe(state);
    expect(predicates.dimsAre?.(observation, { rows: 3, cols: 4 })).toBe(true);
    expect(predicates.dimsAre?.(observation, { rows: 4, cols: 3 })).toBe(false);
    expect(predicates.dimsAre?.(observation, { rows: 4, cols: 3, either: true })).toBe(true);
    expect(predicates.totalIs?.(observation, { value: 12 })).toBe(true);
    expect(predicates.totalIs?.(observation, { value: 11 })).toBe(false);
  });

  it('distinctArrangementsAtLeast와 distinctSplitsAtLeast가 기록 수를 본다', () => {
    let state = stateOf({ mode: 'dot-array', rotate: true });
    state = apply(state, [
      { type: 'resize', rows: 3, cols: 4 },
      { type: 'record-arrangement' },
      { type: 'resize', rows: 6, cols: 2 },
      { type: 'record-arrangement' },
    ]);
    const observation = observe(state);
    expect(predicates.distinctArrangementsAtLeast?.(observation, { count: 2, total: 12 })).toBe(
      true,
    );
    expect(predicates.distinctArrangementsAtLeast?.(observation, { count: 2, total: 11 })).toBe(
      false,
    );

    let split = stateOf({ mode: 'split', rows: 7, cols: 8 });
    split = apply(split, [
      { type: 'place-split', orientation: 'cols', at: 5 },
      { type: 'record-split' },
      { type: 'remove-split', index: 0 },
      { type: 'place-split', orientation: 'cols', at: 3 },
      { type: 'record-split' },
    ]);
    expect(predicates.distinctSplitsAtLeast?.(observe(split), { count: 2 })).toBe(true);
    expect(predicates.distinctSplitsAtLeast?.(observe(split), { count: 3 })).toBe(false);
  });

  it('partialSumIs가 부분곱 합을 읽는다', () => {
    const state = apply(stateOf({ mode: 'split', rows: 7, cols: 8 }), [
      { type: 'place-split', orientation: 'cols', at: 5 },
    ]);
    const observation = observe(state);
    expect(predicates.partialSumIs?.(observation, { value: 56 })).toBe(true);
    expect(predicates.partialSumIs?.(observation, { value: 57 })).toBe(false);
  });

  it('모든 Action 뒤에도 상태는 직렬화 가능하다', () => {
    let state = stateOf({ mode: 'split', rows: 7, cols: 10, allowExtend: true, maxSplits: 2 });
    state = apply(state, [
      { type: 'place-split', orientation: 'cols', at: 5 },
      { type: 'place-split', orientation: 'rows', at: 7 },
      { type: 'extend', rows: 1 },
      { type: 'record-split' },
    ]);
    assertSerializable(state);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
