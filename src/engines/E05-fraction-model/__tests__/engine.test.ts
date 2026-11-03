import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
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
    ];
    for (const config of configs) {
      const state = createInitialState(config);
      expect(() => assertSerializable(state)).not.toThrow();
      const observation = observe(state, config);
      expect(() => assertSerializable(observation)).not.toThrow();
    }
  });
});
