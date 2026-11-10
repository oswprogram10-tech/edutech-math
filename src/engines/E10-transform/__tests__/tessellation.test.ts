/**
 * T105 쪽매맞춤 테스트. 정사각 9장, 어긋난 겹침, 변 깎은 타일 12장,
 * 정오각형 한 꼭짓점 둘레, 계열 고정을 정확한 칸 수로 확인한다.
 */
import { describe, expect, it } from 'vitest';
import { emit, predicates } from '../events';
import { hexagonCells } from '../tri';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type {
  PlacedTile,
  TessellationConfig,
  TessellationState,
  TransformAction,
  TransformState,
} from '../types';

function initial(config: TessellationConfig): TessellationState {
  const state = createInitialState(config);
  if (state.mode !== 'tessellation') throw new Error('tessellation 상태가 아닙니다.');
  return state;
}

function apply(state: TessellationState, actions: readonly TransformAction[]): TessellationState {
  const next = actions.reduce<TransformState>((current, action) => reduce(current, action), state);
  if (next.mode !== 'tessellation') throw new Error('tessellation 상태가 아닙니다.');
  return next;
}

function slide(dx: number, dy: number): TransformAction {
  return { type: 'move', move: { kind: 'slide', dx, dy } };
}

/** Rational 문자열(`"1"`, `"1/3"`)을 비교용 수로. 판정에는 쓰지 않는다. */
function coverageNumber(value: unknown): number {
  const text = String(value);
  const [numerator, denominator] = text.split('/');
  return Number(numerator) / Number(denominator ?? 1);
}

const NINE_PLACEMENTS: readonly TransformAction[] = [
  { type: 'place' },
  slide(6, 0),
  { type: 'place' },
  slide(6, 0),
  { type: 'place' },
  slide(-12, 6),
  { type: 'place' },
  slide(6, 0),
  { type: 'place' },
  slide(6, 0),
  { type: 'place' },
  slide(-12, 6),
  { type: 'place' },
  slide(6, 0),
  { type: 'place' },
  slide(6, 0),
  { type: 'place' },
];

describe('E10 쪽매맞춤 정사각 계열', () => {
  it('정사각형 9장을 0·6·12 격자에 놓으면 coverage가 1이고 겹침이 없다', () => {
    const state = apply(initial({ mode: 'tessellation' }), NINE_PLACEMENTS);
    const result = observe(state);
    expect(result['placedCount']).toBe(9);
    expect(result['frameCells']).toBe(324);
    expect(result['coverage']).toBe('1');
    expect(result['overlapCells']).toBe(0);
    expect(result['gapCells']).toBe(0);
    expect(predicates['fullCover']?.(result, { tile: 'square' })).toBe(true);
  });

  it('한 장을 3칸 밀면 겹침이 생기고 coverage가 1보다 작다', () => {
    const state = apply(initial({ mode: 'tessellation' }), [
      { type: 'place' },
      slide(3, 0),
      { type: 'place' },
    ]);
    const result = observe(state);
    expect(result['overlapCells']).toBeGreaterThan(0);
    expect(coverageNumber(result['coverage'])).toBeLessThan(1);
    expect(result['gapCells']).toBeGreaterThan(0);
  });

  it('왼쪽 띠 (0,2)를 뺀 변형 타일 12장이 18×18 틀을 덮는다', () => {
    const state = apply(
      initial({ mode: 'tessellation', baseTiles: ['square'], customize: 'edge-translate' }),
      [
        { type: 'toggle-notch', cell: [0, 2] },
        { type: 'select-tile', tile: 'custom' },
        slide(-6, 0),
        { type: 'place' },
        slide(6, 0),
        { type: 'place' },
        slide(6, 0),
        { type: 'place' },
        slide(6, 0),
        { type: 'place' },
        slide(-18, 6),
        { type: 'place' },
        slide(6, 0),
        { type: 'place' },
        slide(6, 0),
        { type: 'place' },
        slide(6, 0),
        { type: 'place' },
        slide(-18, 6),
        { type: 'place' },
        slide(6, 0),
        { type: 'place' },
        slide(6, 0),
        { type: 'place' },
        slide(6, 0),
        { type: 'place' },
      ],
    );
    const result = observe(state);
    expect(result['placedCount']).toBe(12);
    expect(result['coverage']).toBe('1');
    expect(result['overlapCells']).toBe(0);
    expect(result['gapCells']).toBe(0);
    expect(result['customUsed']).toBe(true);
  });

  it('깊이 규칙을 어긴 toggle-notch은 무시한다', () => {
    const state = initial({ mode: 'tessellation', customize: 'edge-translate' });
    const next = reduce(state, { type: 'toggle-notch', cell: [1, 2] });
    expect(next).toBe(state);
  });

  it('놓인 타일이 있으면 다른 계열 select-tile을 무시한다', () => {
    const placed = apply(initial({ mode: 'tessellation' }), [{ type: 'place' }]);
    expect(reduce(placed, { type: 'select-tile', tile: 'triangle' })).toBe(placed);
  });
});

describe('E10 쪽매맞춤 삼각 계열', () => {
  it('정육각형 배치가 삼각 틀을 빈틈없이 덮는다', () => {
    const centers: readonly (readonly [number, number])[] = [
      [1, 0],
      [2, 1],
      [4, 0],
      [5, 1],
      [7, 0],
      [8, 1],
      [0, 2],
      [3, 2],
      [6, 2],
      [1, 3],
      [4, 3],
      [7, 3],
      [-1, 4],
      [2, 4],
      [5, 4],
      [0, 5],
      [3, 5],
      [6, 5],
      [-2, 6],
      [1, 6],
      [4, 6],
    ];
    const placed: PlacedTile[] = centers.map(([a, b], index) => ({
      id: index + 1,
      tile: 'hexagon',
      cells: hexagonCells(a, b),
    }));
    const state: TessellationState = {
      ...initial({ mode: 'tessellation', baseTiles: ['hexagon'] }),
      tile: 'hexagon',
      placed,
      nextId: placed.length + 1,
    };
    const result = observe(state);
    expect(result['frameCells']).toBe(96);
    expect(result['coverage']).toBe('1');
    expect(result['overlapCells']).toBe(0);
    expect(result['gapCells']).toBe(0);
    expect(predicates['fullCover']?.(result, { tile: 'hexagon' })).toBe(true);
  });
});

describe('E10 쪽매맞춤 정오각형', () => {
  it('3개면 36° 빈틈, 4개면 72° 겹침이고 gap-shown은 한 번이다', () => {
    const start = initial({ mode: 'tessellation', baseTiles: ['pentagon-regular'] });
    expect(start.tile).toBe('pentagon-regular');
    let state: TransformState = start;
    const events: string[] = [];
    for (const action of [{ type: 'hub-add' }, { type: 'hub-add' }] satisfies TransformAction[]) {
      const next = reduce(state, action);
      events.push(...emit(state, next).map((event) => event.name));
      state = next;
    }
    expect(events).toEqual(['gap-shown']);
    const three = observe(state);
    expect(three['pentagon']).toEqual({
      count: 3,
      angleSum: 324,
      gapDegrees: 36,
      overlapDegrees: 0,
    });
    expect(predicates['pentagonGapSeen']?.(three, undefined)).toBe(true);

    const four = observe(reduce(state, { type: 'hub-add' }));
    expect(four['pentagon']).toEqual({
      count: 4,
      angleSum: 432,
      gapDegrees: 0,
      overlapDegrees: 72,
    });
  });
});
