import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import { isShareState } from '../types';
import type {
  AddSubState,
  DecimalGridState,
  DiscreteState,
  FractionModelAction,
  FractionModelConfig,
  FractionModelState,
  MixedState,
  OverlayState,
  PartitionState,
  ShadeState,
} from '../types';

function apply(state: FractionModelState, action: FractionModelAction): FractionModelState {
  return reduce(state, action);
}

function partition(config: FractionModelConfig = {}): PartitionState {
  return createInitialState({ mode: 'partition', ...config }) as PartitionState;
}

function shade(config: FractionModelConfig = {}): ShadeState {
  return createInitialState({ mode: 'shade', ...config }) as ShadeState;
}

function verticalCut(x: number, y1 = 150, y2 = 450): FractionModelAction {
  return {
    type: 'cut',
    tool: 'line',
    points: [
      { x, y: y1 },
      { x, y: y2 },
    ],
  };
}

function overlay(config: FractionModelConfig = {}): OverlayState {
  return createInitialState({ mode: 'overlay-slicer', ...config }) as OverlayState;
}

function discrete(config: FractionModelConfig = {}): DiscreteState {
  return createInitialState({ mode: 'discrete', ...config }) as DiscreteState;
}

function addSub(config: FractionModelConfig = {}): AddSubState {
  return createInitialState({ mode: 'add-sub', ...config }) as AddSubState;
}

function mixed(config: FractionModelConfig = {}): MixedState {
  return createInitialState({ mode: 'mixed', ...config }) as MixedState;
}

function decimalGrid(config: FractionModelConfig = {}): DecimalGridState {
  return createInitialState({ mode: 'decimal-grid', ...config }) as DecimalGridState;
}

describe('E05 partition (넓이 기반 등분)', () => {
  it('직사각형을 세로 칼선 3개로 나누면 4조각이고 넓이가 모두 같다', () => {
    let state = partition();
    for (const x of [325, 500, 675]) state = apply(state, verticalCut(x)) as PartitionState;
    const observation = observe(state, { mode: 'partition' });
    const wholes = observation['wholes'] as Array<Record<string, unknown>>;
    expect(wholes[0]).toMatchObject({ parts: 4, equal: true, shaded: 0, value: '0' });
    expect(observation['equal']).toBe(true);
  });

  it('조각 수가 4여도 넓이가 다르면 4등분이 아니다', () => {
    let state = partition();
    for (const x of [300, 500, 700]) state = apply(state, verticalCut(x)) as PartitionState;
    const observation = observe(state, { mode: 'partition' });
    const wholes = observation['wholes'] as Array<Record<string, unknown>>;
    expect(wholes[0]).toMatchObject({ parts: 4, equal: false });
    expect(observation['equal']).toBe(false);
  });

  it('색칠한 조각이 전체에서 차지하는 분수를 약분 전/후로 낸다', () => {
    let state = partition({ fixedParts: 4 });
    state = apply(state, { type: 'shade-piece', index: 0 }) as PartitionState;
    state = apply(state, { type: 'shade-piece', index: 2 }) as PartitionState;
    const observation = observe(state, { mode: 'partition' });
    const wholes = observation['wholes'] as Array<Record<string, unknown>>;
    expect(wholes[0]).toMatchObject({ parts: 4, shaded: 2, raw: '2/4', value: '1/2' });
  });

  it('약분 탐정: 18/24은 groupSize 6일 때 3/4이고 기약이다', () => {
    let state = partition({
      fraction: '18/24',
      groupChoices: [2, 3, 4, 5, 6, 8],
      showGcdShortcut: true,
    });
    const before = observe(state, { mode: 'partition' });
    expect(before['irreducible']).toBe(false);
    state = apply(state, { type: 'set-group-size', size: 6 }) as PartitionState;
    const after = observe(state, { mode: 'partition' });
    expect(after['irreducible']).toBe(true);
    expect(after['simplify']).toMatchObject({
      groupedNumerator: 3,
      groupedDenominator: 4,
    });
  });

  it('약분 탐정: 나누어떨어지지 않는 크기(5)는 새 이름을 확정하지 않는다', () => {
    let state = partition({ fraction: '18/24', groupChoices: [2, 3, 4, 5, 6, 8] });
    state = apply(state, { type: 'set-group-size', size: 5 }) as PartitionState;
    const observation = observe(state, { mode: 'partition' });
    expect(observation['simplify']).toMatchObject({
      groupSize: 5,
      groupedNumerator: null,
      groupedDenominator: null,
      irreducible: false,
    });
    expect(observation['irreducible']).toBe(false);
  });

  it('약분 탐정: 2칸씩 묶으면 9/12이고 아직 기약이 아니다', () => {
    let state = partition({ fraction: '18/24', groupChoices: [2, 3, 4, 5, 6, 8] });
    state = apply(state, { type: 'set-group-size', size: 2 }) as PartitionState;
    const observation = observe(state, { mode: 'partition' });
    expect(observation['simplify']).toMatchObject({
      groupSize: 2,
      groupedNumerator: 9,
      groupedDenominator: 12,
      irreducible: false,
    });
    expect(observation['irreducible']).toBe(false);
  });

  it('약분 탐정: 1칸씩은 묶지 않은 것으로 보고 확정하지 않는다', () => {
    let state = partition({ fraction: '18/24', groupChoices: [1, 2, 6] });
    state = apply(state, { type: 'set-group-size', size: 1 }) as PartitionState;
    const observation = observe(state, { mode: 'partition' });
    expect(observation['simplify']).toMatchObject({
      groupSize: 1,
      groupedNumerator: null,
      groupedDenominator: null,
      irreducible: false,
    });
  });

  it('약분 탐정: 최대공약수 6으로 묶을 때만 기약이 된다', () => {
    const results = [2, 3, 4, 6, 8].map((size) => {
      let state = partition({ fraction: '18/24', groupChoices: [2, 3, 4, 5, 6, 8] });
      state = apply(state, { type: 'set-group-size', size }) as PartitionState;
      return observe(state, { mode: 'partition' })['irreducible'];
    });
    expect(results).toEqual([false, false, false, true, false]);
  });

  it('원을 방사형으로 4등분하면 부채꼴 넓이가 같다', () => {
    let state = partition({ shape: 'circle' });
    for (const angle of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
      state = apply(state, {
        type: 'cut',
        tool: 'radial',
        points: [
          { x: 500, y: 300 },
          {
            x: 500 + 210 * Math.cos(angle - Math.PI / 2),
            y: 300 + 210 * Math.sin(angle - Math.PI / 2),
          },
        ],
      }) as PartitionState;
    }
    const observation = observe(state, { mode: 'partition' });
    const wholes = observation['wholes'] as Array<Record<string, unknown>>;
    expect(wholes[0]).toMatchObject({ parts: 4, equal: true });
  });

  it('교차하는 칼선 2개는 4조각이고 실제 조각 수로 기약 여부를 판정한다', () => {
    let state = partition();
    state = apply(state, {
      type: 'cut',
      tool: 'line',
      points: [
        { x: 150, y: 300 },
        { x: 850, y: 300 },
      ],
    }) as PartitionState;
    state = apply(state, verticalCut(500)) as PartitionState;

    let observation = observe(state, { mode: 'partition' });
    let wholes = observation['wholes'] as Array<Record<string, unknown>>;
    expect(wholes[0]).toMatchObject({ parts: 4 });

    // 2/4는 약분되지 않았으므로 irreducible=false여야 한다.
    // cuts.length + 1(=3)로 계산하면 gcd(2, 3)=1이 되어 잘못 true가 된다.
    state = apply(state, { type: 'shade-piece', index: 0 }) as PartitionState;
    state = apply(state, { type: 'shade-piece', index: 1 }) as PartitionState;
    observation = observe(state, { mode: 'partition' });
    wholes = observation['wholes'] as Array<Record<string, unknown>>;
    expect(wholes[0]).toMatchObject({ parts: 4, shaded: 2, raw: '2/4', value: '1/2' });
    expect(observation['irreducible']).toBe(false);
  });

  it('fixedParts로 미리 나눈 10칸은 cut·clear-cuts를 무시하고 색칠만 바꾼다', () => {
    let state = partition({ shape: 'bar', fixedParts: 10 });
    expect(state.preset).toBe(true);
    expect(state.cuts).toHaveLength(9);
    expect(observe(state, { mode: 'partition' })['wholes']).toMatchObject([{ parts: 10 }]);

    state = apply(state, verticalCut(500, 230, 370)) as PartitionState;
    expect(state.cuts).toHaveLength(9);
    expect(observe(state, { mode: 'partition' })['wholes']).toMatchObject([{ parts: 10 }]);

    state = apply(state, { type: 'shade-piece', index: 0 }) as PartitionState;
    state = apply(state, { type: 'clear-cuts' }) as PartitionState;
    expect(state.cuts).toHaveLength(9);
    expect(state.shaded).toEqual([0]);
    expect(observe(state, { mode: 'partition' })['wholes']).toMatchObject([
      { parts: 10, shaded: 1 },
    ]);
  });

  it('presetCuts로 미리 나눈 도형도 자르기 도구를 쓰지 않는다', () => {
    let state = partition({
      shape: 'rect',
      presetCuts: [
        {
          points: [
            { x: 300, y: 150 },
            { x: 300, y: 450 },
          ],
        },
        {
          points: [
            { x: 500, y: 150 },
            { x: 500, y: 450 },
          ],
        },
        {
          points: [
            { x: 700, y: 150 },
            { x: 700, y: 450 },
          ],
        },
      ],
    });
    expect(state.preset).toBe(true);
    expect(state.cuts).toHaveLength(3);
    expect(state.fixedParts).toBeNull();

    state = apply(state, verticalCut(400)) as PartitionState;
    expect(state.cuts).toHaveLength(3);
    state = apply(state, { type: 'clear-cuts' }) as PartitionState;
    expect(state.cuts).toHaveLength(3);
    expect(observe(state, { mode: 'partition' })['wholes']).toMatchObject([{ parts: 4 }]);
  });

  it('미리 나누지 않은 도형은 그대로 자르고 지울 수 있다', () => {
    let state = partition();
    expect(state.preset).toBe(false);
    state = apply(state, verticalCut(500)) as PartitionState;
    expect(state.cuts).toHaveLength(1);
    state = apply(state, { type: 'clear-cuts' }) as PartitionState;
    expect(state.cuts).toHaveLength(0);
  });
});

describe('E05 shade (동치분수·경계값)', () => {
  it('3/4을 ×2 하면 6/8이지만 값은 3/4 그대로다', () => {
    let state = shade({ whole: { shape: 'bar', partsX: 4, shaded: [0, 1, 2] } });
    let observation = observe(state, { mode: 'shade' });
    expect(observation['wholes']).toEqual([
      expect.objectContaining({ raw: '3/4', value: '3/4', reduced: '3/4' }),
    ]);
    state = apply(state, { type: 'refine', factor: 2 }) as ShadeState;
    observation = observe(state, { mode: 'shade' });
    expect(observation['wholes']).toEqual([
      expect.objectContaining({ raw: '6/8', value: '3/4', reduced: '3/4' }),
    ]);
    expect(observation['irreducible']).toBe(false);
  });

  it('6/8을 ÷2 하면 3/4로 돌아간다', () => {
    let state = shade({ whole: { shape: 'bar', partsX: 8, shaded: [0, 1, 2, 3, 4, 5] } });
    state = apply(state, { type: 'coarsen', factor: 2 }) as ShadeState;
    expect(state.parts).toBe(4);
    expect(state.shaded).toEqual([0, 1, 2]);
  });

  it('색칠이 조각 경계와 맞지 않으면 더 굵게 묶지 않는다', () => {
    const state = shade({ whole: { shape: 'bar', partsX: 8, shaded: [0, 1, 2] } });
    const next = apply(state, { type: 'coarsen', factor: 2 });
    expect(next).toBe(state);
  });

  it('1등분·0·1 경계값을 다룬다', () => {
    const onePart = shade({ whole: { shape: 'bar', partsX: 1, shaded: [] } });
    expect(observe(onePart, { mode: 'shade' })['wholes']).toEqual([
      expect.objectContaining({ parts: 1, shaded: 0, raw: '0/1', value: '0' }),
    ]);
    const full = shade({ whole: { shape: 'bar', partsX: 5, shaded: [0, 1, 2, 3, 4] } });
    expect(observe(full, { mode: 'shade' })['wholes']).toEqual([
      expect.objectContaining({ raw: '5/5', value: '1' }),
    ]);
  });

  it('큰 분모에서도 값을 정확히 약분한다', () => {
    const state = shade({
      whole: { shape: 'bar', partsX: 100, shaded: Array.from({ length: 50 }, (_, i) => i) },
    });
    expect(observe(state, { mode: 'shade' })['wholes']).toEqual([
      expect.objectContaining({ parts: 100, shaded: 50, value: '1/2' }),
    ]);
  });
});

describe('E05 overlay-slicer (공통 격자)', () => {
  it('1/2과 1/3을 겹치면 6칸 공통 격자가 생긴다', () => {
    let state = overlay({ a: '1/2', b: '1/3' });
    state = apply(state, { type: 'overlay' }) as OverlayState;
    const observation = observe(state, { mode: 'overlay-slicer' });
    expect(observation['commonGrid']).toBe(6);
    expect(observation['aCells']).toBe(3);
    expect(observation['bCells']).toBe(2);
  });

  it('5/6과 3/4은 24칸에서 12칸으로 줄일 수 있다', () => {
    let state = overlay({ a: '5/6', b: '3/4' });
    state = apply(state, { type: 'overlay' }) as OverlayState;
    expect(observe(state, { mode: 'overlay-slicer' })['commonGrid']).toBe(24);
    state = apply(state, { type: 'set-grid', size: 12 }) as OverlayState;
    const observation = observe(state, { mode: 'overlay-slicer' });
    expect(observation['commonGrid']).toBe(12);
    expect(observation['aCells']).toBe(10);
    expect(observation['bCells']).toBe(9);
  });

  it('두 분모의 공배수가 아닌 격자는 받지 않는다', () => {
    let state = overlay({ a: '5/6', b: '3/4' });
    state = apply(state, { type: 'overlay' }) as OverlayState;
    const next = apply(state, { type: 'set-grid', size: 10 });
    expect(next).toBe(state);
  });
});

describe('E05 discrete', () => {
  it('12개를 4개씩 묶고 한 묶음을 고르면 12의 1/3 = 4다', () => {
    let state = discrete({ items: 12, groupSizeOptions: [2, 3, 4, 6] });
    state = apply(state, { type: 'set-group-size', size: 4 }) as DiscreteState;
    state = apply(state, { type: 'toggle-group', index: 0 }) as DiscreteState;
    const observation = observe(state, { mode: 'discrete' });
    expect(observation).toMatchObject({
      groupSize: 4,
      groups: 3,
      selectedGroups: [0],
      selectedCount: 4,
    });
    expect(observation['wholes']).toEqual([
      expect.objectContaining({ parts: 3, shaded: 1, value: '1/3' }),
    ]);
  });

  it('12를 나누지 못하는 묶음 크기는 받지 않는다', () => {
    const state = discrete({ items: 12 });
    expect(apply(state, { type: 'set-group-size', size: 5 })).toBe(state);
  });
});

describe('E05 mixed (가분수·대분수)', () => {
  it('11/4을 두 번 융합하면 2 3/4이다', () => {
    let state = mixed({ direction: 'improper-to-mixed', value: '11/4' });
    state = apply(state, { type: 'fuse' }) as MixedState;
    state = apply(state, { type: 'fuse' }) as MixedState;
    const observation = observe(state, { mode: 'mixed' });
    expect(observation).toMatchObject({
      wholeCount: 2,
      remainderNumerator: 3,
      denominator: 4,
      mixedLabel: '2 3/4',
      improperLabel: '11/4',
    });
    expect(observation['fusedCount']).toBe(2);
  });

  it('2 1/3의 자연수 1을 풀면 7/3이다', () => {
    let state = mixed({
      direction: 'mixed-to-improper',
      value: '2 1/3',
      allowBreakWhole: true,
    });
    state = apply(state, { type: 'break-whole' }) as MixedState;
    const observation = observe(state, { mode: 'mixed' });
    expect(observation).toMatchObject({
      wholeCount: 1,
      remainderNumerator: 4,
      improperNumerator: 7,
    });
    expect(observation['mixedLabel']).toBe('2 1/3');
    expect(observation['brokeWholeCount']).toBe(1);
  });

  it('5/5는 한 번 융합하면 1이다', () => {
    let state = mixed({ direction: 'improper-to-mixed', value: '5/5' });
    state = apply(state, { type: 'fuse' }) as MixedState;
    expect(observe(state, { mode: 'mixed' })['mixedLabel']).toBe('1');
  });

  it('3 1/6에서 자연수 막대 하나를 풀면 자연수 2, 조각 14/12다 (A3 과제 1)', () => {
    let state = mixed({
      mode: 'mixed',
      op: '-',
      a: '3 1/6',
      b: '1 3/4',
      breakWhole: true,
      commonGrid: 12,
    });
    expect(state.borrowed).toBe(false);

    state = apply(state, { type: 'break-whole' }) as MixedState;
    expect(state).toMatchObject({
      borrowed: true,
      naturalPart: 2,
      pieceCount: 14,
      pieceDenominator: 12,
      commonGrid: 12,
    });

    const observation = observe(state, { mode: 'mixed' });
    expect(observation).toMatchObject({
      naturalPart: 2,
      pieceCount: 14,
      pieceDenominator: 12,
      pieceValue: '14/12',
      brokeWhole: 1,
    });

    // 과제 1 판정: Observation의 자연수 부분과 raw 조각 값만으로 확인할 수 있다.
    const task1Passed = observation['naturalPart'] === 2 && observation['pieceValue'] === '14/12';
    expect(task1Passed).toBe(true);

    // 막대 하나만 풀 수 있으므로 두 번째 요청은 상태를 바꾸지 않는다.
    expect(apply(state, { type: 'break-whole' })).toBe(state);
  });
});

describe('E05 add-sub', () => {
  it('1/2 + 1/3은 공통 격자를 먼저 만들지 않으면 합치지 않는다', () => {
    let state = addSub({ op: '+', a: '1/2', b: '1/3', requireCommonGrid: true });
    expect(apply(state, { type: 'combine' })).toBe(state);
    state = apply(state, { type: 'overlay' }) as AddSubState;
    expect(state.commonGrid).toBe(6);
    state = apply(state, { type: 'combine' }) as AddSubState;
    const observation = observe(state, { mode: 'add-sub' });
    expect(observation['result']).toBe('5/6');
    expect(observation['resultMixed']).toBe('5/6');
  });

  it('2/5 + 4/5는 6/5이고 분수 부분이 1을 넘어 융합 이벤트가 난다', () => {
    let state = addSub({ op: 'add', a: '2/5', b: '4/5' });
    state = apply(state, { type: 'combine' }) as AddSubState;
    const observation = observe(state, { mode: 'add-sub' });
    expect(observation['result']).toBe('6/5');
    expect(observation['resultMixed']).toBe('1 1/5');
    expect(state.counters.fused).toBe(1);
  });

  it('3 1/4 − 1 3/4은 자연수 1을 푼 뒤 1 1/2이다', () => {
    let state = addSub({
      op: 'sub',
      a: '3 1/4',
      b: '1 3/4',
      allowBreakWhole: true,
      strategyChoice: ['separate', 'improper'],
    });
    state = apply(state, { type: 'break-whole' }) as AddSubState;
    expect(state.borrowed).toBe(true);
    state = apply(state, { type: 'combine' }) as AddSubState;
    const observation = observe(state, { mode: 'add-sub' });
    expect(observation['result']).toBe('3/2');
    expect(observation['resultMixed']).toBe('1 1/2');
    expect(observation['brokeWhole']).toBe(1);
  });
});

describe('E05 decimal-grid', () => {
  it('0.1층 한 줄은 10/100 = 0.1이다', () => {
    let state = decimalGrid({ size: 10, layers: 2 });
    state = apply(state, { type: 'shade-row', row: 0 }) as DecimalGridState;
    const observation = observe(state, { mode: 'decimal-grid' });
    const layers = observation['layers'] as Array<Record<string, unknown>>;
    expect(layers[0]).toMatchObject({ cells: 10, value: '1/10', decimal: '0.1' });
    expect(layers[1]).toMatchObject({ cells: 0, value: '0' });
  });

  it('0.01층 한 칸은 1/100 = 0.01이다', () => {
    let state = decimalGrid({ size: 10, layers: 2 });
    state = apply(state, { type: 'set-layer', layer: 1 }) as DecimalGridState;
    state = apply(state, { type: 'toggle-cell', index: 100 }) as DecimalGridState;
    const layers = observe(state, { mode: 'decimal-grid' })['layers'] as Array<
      Record<string, unknown>
    >;
    expect(layers[1]).toMatchObject({ cells: 1, value: '1/100', decimal: '0.01' });
  });

  it('층을 벗어난 셀 인덱스는 무시한다', () => {
    const state = decimalGrid({ size: 10, layers: 2 });
    expect(apply(state, { type: 'toggle-cell', index: 500 })).toBe(state);
  });
});

describe('E05 multiply (T049)', () => {
  const multiply = (config: FractionModelConfig = {}): FractionModelState =>
    createInitialState({ mode: 'multiply', ...config });

  it('2/3 × 3/4: 학생이 놓으면 겹침 6칸·전체 12칸·곱 1/2', () => {
    let state = multiply({ a: '2/3', b: '3/4' });
    let observation = observe(state, { mode: 'multiply' });
    expect(observation).toMatchObject({
      a: '0',
      b: '0',
      overlapCells: 0,
      product: '0',
    });

    state = apply(state, { type: 'set-shaded', side: 'a', count: 2 });
    state = apply(state, { type: 'set-shaded', side: 'b', count: 3 });
    observation = observe(state, { mode: 'multiply' });
    expect(observation).toMatchObject({
      a: '2/3',
      b: '3/4',
      aParts: 3,
      bParts: 4,
      squares: 1,
      overlapCells: 6,
      totalCells: 12,
      product: '1/2',
    });
  });

  it('preset이면 처음부터 a·b대로 놓인다', () => {
    const state = multiply({ a: '2/3', b: '3/4', build: 'preset' });
    expect(observe(state, { mode: 'multiply' })).toMatchObject({
      overlapCells: 6,
      product: '1/2',
    });
  });

  it('1 1/2 × 2/3: 사각형 2개에 걸쳐 칠하고 곱은 1', () => {
    const state = multiply({ a: '1 1/2', b: '2/3', build: 'preset' });
    expect(observe(state, { mode: 'multiply' })).toMatchObject({
      a: '3/2',
      b: '2/3',
      aParts: 2,
      squares: 2,
      product: '1',
    });
  });

  it('4 × 2/3: 사각형 4개, 곱은 8/3', () => {
    const state = multiply({ a: 4, b: '2/3', build: 'preset' });
    expect(observe(state, { mode: 'multiply' })).toMatchObject({
      a: '4',
      squares: 4,
      product: '8/3',
    });
  });

  it('b 쪽 색칠은 bParts를 넘지 않고 a 쪽은 전체 4개까지만 센다', () => {
    let state = multiply({ a: '2/3', b: '3/4' });
    state = apply(state, { type: 'set-shaded', side: 'b', count: 99 });
    expect(state.mode === 'multiply' ? state.bShaded : -1).toBe(4);

    state = apply(state, { type: 'set-shaded', side: 'a', count: 99 });
    expect(state.mode === 'multiply' ? state.aShaded : -1).toBe(12);
  });

  it('범위를 벗어난 칸 수는 무시하거나 한도로 자른다', () => {
    const state = multiply({ a: '2/3', b: '3/4' });
    expect(apply(state, { type: 'set-shaded', side: 'b', count: Number.NaN })).toBe(state);
  });
});

describe('E05 divide-measure (T049)', () => {
  const measure = (config: FractionModelConfig = {}): FractionModelState =>
    createInitialState({ mode: 'divide-measure', ...config });

  function lay(state: FractionModelState, times: number): FractionModelState {
    let next = state;
    for (let index = 0; index < times; index += 1) {
      next = apply(next, { type: 'lay-ruler' });
    }
    return next;
  }

  it('3/4 ÷ 1/8: 자를 6번 놓으면 정확히 다 잰다', () => {
    const state = lay(measure({ dividend: '3/4', divisor: '1/8' }), 6);
    const observation = observe(state, { mode: 'divide-measure' });
    expect(observation).toMatchObject({
      dividend: '3/4',
      divisor: '1/8',
      rulersLaid: 6,
      partial: null,
      measured: '6',
      measureComplete: true,
    });
  });

  it('3/4 ÷ 2/3: 온전한 자 1개 + 부분 자 1/8', () => {
    const state = lay(measure({ dividend: '3/4', divisor: '2/3' }), 2);
    const observation = observe(state, { mode: 'divide-measure' });
    expect(observation).toMatchObject({
      rulersLaid: 1,
      partial: '1/8',
      measured: '9/8',
      measureComplete: true,
    });
  });

  it('2 ÷ 1/3: 자를 6번 놓는다', () => {
    const state = lay(measure({ dividend: 2, divisor: '1/3' }), 6);
    expect(observe(state, { mode: 'divide-measure' })).toMatchObject({
      rulersLaid: 6,
      partial: null,
      measured: '6',
      measureComplete: true,
    });
  });

  it('부분 자를 놓은 뒤에는 더 놓지 않고, 들기는 부분 자부터 지운다', () => {
    let state = lay(measure({ dividend: '3/4', divisor: '2/3' }), 2);
    const afterPartial = state;
    expect(apply(state, { type: 'lay-ruler' })).toBe(afterPartial);

    state = apply(state, { type: 'lift-ruler' });
    expect(observe(state, { mode: 'divide-measure' })).toMatchObject({
      rulersLaid: 1,
      partial: null,
      measured: '1',
    });
    state = apply(state, { type: 'lift-ruler' });
    expect(observe(state, { mode: 'divide-measure' })).toMatchObject({
      rulersLaid: 0,
      partial: null,
      measured: '0',
    });
  });
});

describe('E05 partition variant=share (T049)', () => {
  function share(config: FractionModelConfig = {}): FractionModelState {
    return createInitialState({ mode: 'partition', variant: 'share', ...config });
  }

  function dealAll(state: FractionModelState): FractionModelState {
    let next = state;
    for (let whole = 0; whole < 3; whole += 1) {
      for (let piece = 0; piece < 4; piece += 1) {
        next = apply(next, { type: 'deal-piece', whole, piece, plate: piece });
      }
    }
    return next;
  }

  it('3 전체를 4조각씩 나누어 4접시에 나르면 접시마다 3/4이고 모두 같다', () => {
    let state = share({ wholes: 3, people: 4 });
    for (let whole = 0; whole < 3; whole += 1) {
      state = apply(state, { type: 'cut-equal', whole, parts: 4 });
    }
    state = dealAll(state);
    const observation = observe(state, { mode: 'partition' });
    expect(observation).toMatchObject({
      variant: 'share',
      plates: ['3/4', '3/4', '3/4', '3/4'],
      platesEqual: true,
      allDealt: true,
      piecesPerWhole: [4, 4, 4],
      people: 4,
      equal: true,
    });
  });

  it('한 전체를 다르게 자르면 equal이 꺼진다', () => {
    let state = share({ wholes: 2, people: 3, shape: 'rect' });
    state = apply(state, { type: 'cut-equal', whole: 0, parts: 4 });
    state = apply(state, {
      type: 'cut',
      tool: 'line',
      whole: 1,
      points: [
        { x: 300, y: 150 },
        { x: 300, y: 450 },
      ],
    });
    const observation = observe(state, { mode: 'partition' });
    expect(observation['piecesPerWhole']).toEqual([4, 2]);
    expect(observation['equal']).toBe(false);
  });

  it('한 조각은 한 접시에만 놓인다(다시 놓으면 옮겨진다)', () => {
    let state = share({ wholes: 1, people: 2 });
    state = apply(state, { type: 'cut-equal', whole: 0, parts: 2 });
    state = apply(state, { type: 'deal-piece', whole: 0, piece: 0, plate: 0 });
    state = apply(state, { type: 'deal-piece', whole: 0, piece: 0, plate: 1 });
    const observation = observe(state, { mode: 'partition' });
    expect(observation['plates']).toEqual(['0', '1/2']);
    expect(observation['allDealt']).toBe(false);

    expect(isShareState(state) ? state.wholes[0]?.pieces[0]?.plate : null).toBe(1);
  });
});

describe('E05 partition variant=divide-whole (T049)', () => {
  function divideWhole(config: FractionModelConfig = {}): FractionModelState {
    return createInitialState({ mode: 'partition', variant: 'divide-whole', ...config });
  }

  it('4/5는 약분 퍼즐(simplify)로 바뀌지 않는다', () => {
    const state = divideWhole({ fraction: '4/5', divisor: 3 });
    expect(state.mode).toBe('partition');
    expect('simplify' in state).toBe(false);
    expect(observe(state, { mode: 'partition' })).toMatchObject({
      variant: 'divide-whole',
      dividend: '4/5',
      divisor: 3,
      rows: 1,
      kept: null,
      bundled: false,
    });
  });

  it('가로 3칸을 열고 한 줄만 남기면 4/15', () => {
    let state = divideWhole({ fraction: '4/5', divisor: 3 });
    state = apply(state, { type: 'set-rows', rows: 3 });
    state = apply(state, { type: 'keep-row', row: 1 });
    expect(observe(state, { mode: 'partition' })).toMatchObject({
      rows: 3,
      keptRow: 1,
      kept: '4/15',
    });
  });

  it('6/7 ÷ 3은 묶어서 나누면 한 묶음이 2/7', () => {
    let state = divideWhole({ fraction: '6/7', divisor: 3 });
    state = apply(state, { type: 'bundle' });
    state = apply(state, { type: 'keep-bundle', index: 0 });
    expect(observe(state, { mode: 'partition' })).toMatchObject({
      bundled: true,
      kept: '2/7',
    });
  });

  it('2 1/4 ÷ 3: 사각형 3개, 한 줄만 남기면 3/4', () => {
    let state = divideWhole({ fraction: '2 1/4', divisor: 3 });
    state = apply(state, { type: 'set-rows', rows: 3 });
    state = apply(state, { type: 'keep-row', row: 0 });
    expect(observe(state, { mode: 'partition' })).toMatchObject({
      squares: 3,
      rows: 3,
      kept: '3/4',
    });
  });
});

describe('E05 직렬화', () => {
  it('모든 모드의 초기 상태와 Observation이 JSON으로 안전하다', () => {
    const configs: FractionModelConfig[] = [
      { mode: 'partition', fixedParts: 4 },
      { mode: 'shade', whole: { shape: 'bar', partsX: 4, shaded: [0, 1, 2] } },
      {
        mode: 'compare',
        bars: [
          { parts: 2, shaded: [0] },
          { parts: 3, shaded: [0, 1] },
        ],
      },
      { mode: 'overlay-slicer', a: '1/2', b: '1/3' },
      { mode: 'discrete', items: 12 },
      { mode: 'mixed', direction: 'improper-to-mixed', value: '11/4' },
      { mode: 'add-sub', op: '+', a: '2/5', b: '4/5' },
      { mode: 'decimal-grid', size: 10, layers: 2 },
      { mode: 'multiply', a: '1 1/2', b: '2/3', build: 'preset', showCounts: true },
      { mode: 'divide-measure', dividend: '3/4', divisor: '1/8' },
      { mode: 'partition', variant: 'share', wholes: 3, people: 4 },
      { mode: 'partition', variant: 'divide-whole', fraction: '4/5', divisor: 3 },
    ];
    for (const config of configs) {
      const state = createInitialState(config);
      expect(() => assertSerializable(state)).not.toThrow();
      const observation = observe(state, config);
      expect(() => assertSerializable(observation)).not.toThrow();
    }
  });
});
