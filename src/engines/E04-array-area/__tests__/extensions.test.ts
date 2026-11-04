import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { Rational } from '../../../core/math';
import { decimalAreaOf, decimalFactor, fractionAreaOf, puzzlePiecesOf, tileFit } from '../area';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { ArrayAreaAction, ArrayAreaConfig, ArrayAreaState } from '../types';

function stateOf(config: ArrayAreaConfig): ArrayAreaState {
  return createInitialState(config);
}

function apply(state: ArrayAreaState, actions: readonly ArrayAreaAction[]): ArrayAreaState {
  return actions.reduce(reduce, state);
}

describe('E04 tiling', () => {
  it('12×18 방은 타일 1·2·3·6에서 남는 칸이 없고 4에서는 남는다', () => {
    const sizes = [1, 2, 3, 4, 6];
    const fits = sizes.map((size) => tileFit(12, 18, size));
    expect(fits.filter((item) => item.fits).map((item) => item.size)).toEqual([1, 2, 3, 6]);
    expect(fits.find((item) => item.size === 4)?.leftover).toBe(24);
    expect(fits.find((item) => item.size === 6)).toMatchObject({ tiles: 6, leftover: 0 });
  });

  it('타일 크기는 고를 수 있는 값만 받고 기록은 정렬·중복 제거한다', () => {
    const state = stateOf({ mode: 'tiling', width: 12, height: 18 });
    expect(state.tileSize).toBeNull();
    expect(apply(state, [{ type: 'set-tile', size: 99 }])).toBe(state);
    const six = reduce(state, { type: 'set-tile', size: 6 });
    expect(six.tileSize).toBe(6);
    const recorded = apply(six, [
      { type: 'record-tile' },
      { type: 'set-tile', size: 4 },
      { type: 'record-tile' },
      { type: 'set-tile', size: 6 },
      { type: 'record-tile' },
    ]);
    expect(recorded.recordedSizes).toEqual([4, 6]);
    expect(observe(recorded)['recordedSizes']).toEqual([4, 6]);
    expect(observe(recorded)['fitsAll']).toBe(true);
  });

  it('두 방 비교는 같은 타일 크기로 방마다 남는 칸을 센다', () => {
    const state = stateOf({
      mode: 'tiling',
      width: 12,
      height: 18,
      compare: { width: 10, height: 15 },
      tileSizes: [4, 6],
    });
    const six = reduce(state, { type: 'set-tile', size: 6 });
    const observation = observe(six);
    expect(observation['leftoverCells']).toEqual([0, 78]);
    expect(observation['tilesUsed']).toEqual([6, 2]);
    expect(observation['fitsAll']).toBe(false);
    expect(observation['width']).toBe(12);
  });

  it('타일을 고르면 tile-changed 이벤트가 난다', () => {
    const state = stateOf({ mode: 'tiling', width: 12, height: 18 });
    const next = reduce(state, { type: 'set-tile', size: 6 });
    expect(emit(state, next)).toContainEqual({
      name: 'tile-changed',
      payload: { size: 6, fitsAll: true },
    });
  });
});

describe('E04 decimal-area', () => {
  it('0.6×0.3은 겹친 칸 18, 곱 0.18이다', () => {
    const state = stateOf({ mode: 'decimal-area', a: '0.6', b: '0.3' });
    const observation = observe(state);
    expect(observation['overlapCells']).toBe(18);
    expect(observation['product']).toBe('0.18');
    expect(observation['a']).toBe('0.6');
    expect(observation['b']).toBe('0.3');
  });

  it('1.2×0.4(maxA 2)는 48칸이고 0을 곱하면 0칸이다', () => {
    const wide = stateOf({ mode: 'decimal-area', a: '1.2', b: '0.4', maxA: '2' });
    expect(observe(wide)['overlapCells']).toBe(48);
    const zero = stateOf({ mode: 'decimal-area', a: '0', b: '0.7' });
    expect(observe(zero)['overlapCells']).toBe(0);
    expect(observe(zero)['product']).toBe('0');
  });

  it('set-factor는 0.1 단위로 자르고 최댓값을 넘지 않는다', () => {
    const state = stateOf({ mode: 'decimal-area', a: '0', b: '0', maxA: '1', maxB: '1' });
    const a = reduce(state, { type: 'set-factor', side: 'a', value: '0.6' });
    const b = reduce(a, { type: 'set-factor', side: 'b', value: '0.3' });
    expect(observe(b)['overlapCells']).toBe(18);

    const capped = reduce(b, { type: 'set-factor', side: 'a', value: '9.9' });
    expect(capped.decimal?.a).toBe('1');
    const invalid = reduce(capped, { type: 'set-factor', side: 'a', value: 'abc' });
    expect(invalid.decimal?.a).toBe('0');
  });

  it('인수가 바뀌면 area-changed 이벤트가 문자열 값으로 난다', () => {
    const state = stateOf({ mode: 'decimal-area', a: '0', b: '0' });
    const next = reduce(state, { type: 'set-factor', side: 'a', value: '0.6' });
    expect(emit(state, next)).toContainEqual({
      name: 'area-changed',
      payload: { a: '0.6', b: '0', product: '0' },
    });
  });

  it('decimalAreaOf는 소수를 number로 곱하지 않는다', () => {
    const facts = decimalAreaOf('0.6', '0.3', '1', '1');
    expect(facts.product.toDecimalString()).toBe('0.18');
    expect(facts.overlapCells).toBe(18);
    expect(facts.unitSquares).toBe(100);
  });

  it('maxA "1.5"도 createInitialState·set-factor "1.4"가 동작하고 정사각형 2개다', () => {
    const state = stateOf({ mode: 'decimal-area', a: '0', b: '0', maxA: '1.5' });
    const next = reduce(state, { type: 'set-factor', side: 'a', value: '1.4' });
    expect(next.decimal?.a).toBe('1.4');
    expect(observe(next)['a']).toBe('1.4');
    expect(observe(next)['unitSquares']).toBe(200);
  });

  it('decimalFactor의 max는 소수 문자열과 Rational을 받는다', () => {
    expect(decimalFactor('1.4', '1.5')).toBe('1.4');
    expect(decimalFactor('1.9', '1.5')).toBe('1.5');
    expect(decimalFactor('1.9', Rational.of(3, 2))).toBe('1.5');
  });
});

describe('E04 fraction-area', () => {
  it('2/3×3/4는 겹친 칸 6·전체 12칸, 곱은 1/2이다', () => {
    const state = stateOf({ mode: 'fraction-area', a: '2/3', b: '3/4' });
    const observation = observe(state);
    expect(observation['overlapCells']).toBe(6);
    expect(observation['totalCells']).toBe(12);
    expect(observation['product']).toBe('1/2');
    expect(observation['a']).toBe('2/3');
    expect(observation['b']).toBe('3/4');
  });

  it('set-parts는 칠한 조각 수를 새 조각 수 이하로 자른다', () => {
    const state = stateOf({ mode: 'fraction-area', a: '3/4', b: '1/2' });
    const next = reduce(state, { type: 'set-parts', side: 'a', n: 2 });
    expect(next.fraction?.a).toEqual({ n: 2, k: 2 });
    const shaded = reduce(next, { type: 'set-shaded', side: 'a', k: 1 });
    expect(observe(shaded)['overlapCells']).toBe(1);
    const capped = reduce(shaded, { type: 'set-shaded', side: 'a', k: 99 });
    expect(capped.fraction?.a.k).toBe(2);
  });

  it('분수 넓이 계산도 Rational만 쓴다', () => {
    const facts = fractionAreaOf({ n: 3, k: 2 }, { n: 4, k: 3 });
    expect(facts.product.toString()).toBe('1/2');
    expect(facts.overlapCells).toBe(6);
  });
});

describe('E04 scaler', () => {
  const config: ArrayAreaConfig = {
    mode: 'fraction-area',
    variant: 'scaler',
    base: 12,
    multipliers: ['1/4', '1/2', '3/4', '1', '5/4'],
    predictFirst: true,
  };

  it('예측 전에는 곱하는 수를 고를 수 없다', () => {
    const state = stateOf(config);
    expect(state.fraction).toBeNull();
    expect(reduce(state, { type: 'set-multiplier', index: 2 })).toBe(state);
    expect(observe(state)['multiplier']).toBeNull();
    expect(observe(state)['result']).toBeNull();
  });

  it('12×3/4은 9, 12×5/4은 15이고 예측 적중을 판정한다', () => {
    const state = stateOf(config);
    const predicted = reduce(state, { type: 'predict', value: 'smaller' });
    const threeQuarters = reduce(predicted, { type: 'set-multiplier', index: 2 });
    expect(observe(threeQuarters)['result']).toBe('9');
    expect(observe(threeQuarters)['predictionFits']).toBe(true);
    expect(observe(threeQuarters)['tried']).toEqual(['3/4']);

    const fiveQuarters = reduce(threeQuarters, { type: 'set-multiplier', index: 4 });
    expect(observe(fiveQuarters)['result']).toBe('15');
    expect(observe(fiveQuarters)['predictionFits']).toBe(false);
    expect(observe(fiveQuarters)['tried']).toEqual(['3/4', '5/4']);
  });
});

describe('E04 area-model puzzle', () => {
  const config: ArrayAreaConfig = {
    mode: 'area-model',
    a: 32,
    b: 23,
    puzzle: { splitsA: [30], splitsB: [20], seed: 1 },
  };

  function placeCorrectly(state: ArrayAreaState): ArrayAreaState {
    if (state.puzzle === null) return state;
    let next = state;
    for (const piece of state.puzzle.pieces) {
      const col = piece.w === 30 ? 0 : 1;
      const row = piece.h === 20 ? 0 : 1;
      next = reduce(next, { type: 'place-piece', id: piece.id, col, row });
    }
    return next;
  }

  it('네 조각을 너비·높이에 맞게 놓으면 조립되고 변 길이 합은 32·23이다', () => {
    const state = stateOf(config);
    expect(state.puzzle?.pieces).toHaveLength(4);
    const assembled = placeCorrectly(state);
    expect(observe(assembled)['puzzleAssembled']).toBe(true);
    expect(observe(assembled)['assembledDims']).toEqual({ a: 32, b: 23 });
    expect(observe(assembled)['placedPieces']).toBe(4);
  });

  it('같은 열에 너비가 다른 조각을 놓으면 조립되지 않는다', () => {
    const state = stateOf(config);
    const first = state.puzzle?.pieces[0];
    const second = state.puzzle?.pieces[1];
    if (!first || !second) throw new Error('조각이 없습니다.');
    const wrong = apply(state, [
      { type: 'place-piece', id: first.id, col: 0, row: 0 },
      { type: 'place-piece', id: second.id, col: 0, row: 1 },
    ]);
    expect(observe(wrong)['puzzleAssembled']).toBe(false);
  });

  it('이미 놓인 슬롯에 놓으면 두 조각을 맞바꾼다', () => {
    const state = stateOf(config);
    const pieces = state.puzzle?.pieces ?? [];
    const first = pieces[0];
    const second = pieces[1];
    if (!first || !second) throw new Error('조각이 없습니다.');
    const placed = apply(state, [
      { type: 'place-piece', id: first.id, col: 0, row: 0 },
      { type: 'place-piece', id: second.id, col: 0, row: 0 },
    ]);
    expect(placed.puzzle?.placed[first.id]).toBeUndefined();
    expect(placed.puzzle?.placed[second.id]).toEqual({ col: 0, row: 0 });
    const unplaced = reduce(placed, { type: 'unplace-piece', id: second.id });
    expect(Object.keys(unplaced.puzzle?.placed ?? {})).toHaveLength(0);
  });

  it('둘 다 놓인 조각을 같은 슬롯에 놓으면 자리를 맞바꾼다', () => {
    const state = stateOf(config);
    const pieces = state.puzzle?.pieces ?? [];
    const first = pieces[0];
    const second = state.puzzle?.pieces.find(
      (piece) => piece.w !== first?.w || piece.h !== first?.h,
    );
    if (!first || !second) throw new Error('조각이 없습니다.');
    const placed = apply(state, [
      { type: 'place-piece', id: first.id, col: 0, row: 0 },
      { type: 'place-piece', id: second.id, col: 1, row: 0 },
      { type: 'place-piece', id: second.id, col: 0, row: 0 },
    ]);
    expect(placed.puzzle?.placed[first.id]).toEqual({ col: 1, row: 0 });
    expect(placed.puzzle?.placed[second.id]).toEqual({ col: 0, row: 0 });
  });

  it('seed가 같으면 조각 순서가 같고 다르면 달라진다', () => {
    const one = puzzlePiecesOf(32, 23, [30], [20], 1);
    const same = puzzlePiecesOf(32, 23, [30], [20], 1);
    const other = puzzlePiecesOf(32, 23, [30], [20], 7);
    expect(one.map((piece) => piece.id)).toEqual(same.map((piece) => piece.id));
    expect(one.map((piece) => `${piece.w}x${piece.h}`)).toEqual(
      same.map((piece) => `${piece.w}x${piece.h}`),
    );
    expect(one.map((piece) => `${piece.w}x${piece.h}`)).not.toEqual(
      other.map((piece) => `${piece.w}x${piece.h}`),
    );
  });
});

describe('E04 dot-array shelf', () => {
  it('기록한 1×12·3×4 배열에서 약수 [1,3,4,12]을 찾는다', () => {
    const state = stateOf({
      mode: 'dot-array',
      maxRows: 12,
      maxCols: 12,
      shelf: true,
    });
    const recorded = apply(state, [
      { type: 'resize', rows: 1, cols: 12 },
      { type: 'record-arrangement' },
      { type: 'resize', rows: 3, cols: 4 },
      { type: 'record-arrangement' },
    ]);
    expect(observe(recorded)['factorsFound']).toEqual([1, 3, 4, 12]);
    expect(observe(recorded)['distinctArrangements']).toBe(2);
    expect(predicates['factorsAre']?.(observe(recorded), { a: 3, b: 4 })).toBe(true);
    expect(predicates['factorsFoundAre']?.(observe(recorded), { values: [1, 3, 4, 12] })).toBe(
      true,
    );
  });
});

describe('E04 T045 predicates·직렬화', () => {
  it('productIs는 0.18과 9/50을 같은 값으로 본다', () => {
    const decimal = stateOf({ mode: 'decimal-area', a: '0.6', b: '0.3' });
    expect(predicates['productIs']?.(observe(decimal), { value: '0.18' })).toBe(true);
    expect(predicates['productIs']?.(observe(decimal), { value: '9/50' })).toBe(true);
    expect(predicates['overlapCellsIs']?.(observe(decimal), { value: 18 })).toBe(true);

    const fraction = stateOf({ mode: 'fraction-area', a: '2/3', b: '3/4' });
    expect(predicates['productIs']?.(observe(fraction), { value: '0.5' })).toBe(true);
  });

  it('tiling·puzzle 판정을 Observation으로 한다', () => {
    const tiling = reduce(stateOf({ mode: 'tiling', width: 12, height: 18 }), {
      type: 'set-tile',
      size: 6,
    });
    expect(predicates['tileSizeIs']?.(observe(tiling), { value: 6 })).toBe(true);
    expect(predicates['fitsAll']?.(observe(tiling), undefined)).toBe(true);

    const puzzle = stateOf({
      mode: 'area-model',
      a: 32,
      b: 23,
      puzzle: { splitsA: [30], splitsB: [20] },
    });
    const pieces = puzzle.puzzle?.pieces ?? [];
    let assembled = puzzle;
    for (const piece of pieces) {
      assembled = reduce(assembled, {
        type: 'place-piece',
        id: piece.id,
        col: piece.w === 30 ? 0 : 1,
        row: piece.h === 20 ? 0 : 1,
      });
    }
    expect(predicates['puzzleAssembled']?.(observe(assembled), undefined)).toBe(true);
    expect(predicates['assembledDimsAre']?.(observe(assembled), { a: 32, b: 23 })).toBe(true);
    expect(predicates['assembledDimsAre']?.(observe(assembled), { a: 23, b: 32 })).toBe(false);
    expect(
      predicates['assembledDimsAre']?.(observe(assembled), { a: 23, b: 32, either: true }),
    ).toBe(true);
  });

  it('새 모드 상태에는 Rational 객체나 bigint가 없다', () => {
    const configs: ArrayAreaConfig[] = [
      { mode: 'tiling', width: 12, height: 18, compare: { width: 10, height: 15 } },
      { mode: 'decimal-area', a: '0.6', b: '0.3', maxA: '2' },
      { mode: 'fraction-area', a: '2/3', b: '3/4' },
      { mode: 'fraction-area', variant: 'scaler', base: 12, multipliers: ['3/4'] },
      {
        mode: 'area-model',
        a: 32,
        b: 23,
        puzzle: { splitsA: [30], splitsB: [20], seed: 1 },
      },
    ];
    for (const config of configs) assertSerializable(stateOf(config));
  });
});
