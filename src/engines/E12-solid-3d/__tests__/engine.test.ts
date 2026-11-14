/**
 * E12 reduce·observe·events 단위 테스트(T130 16번 목록).
 */
import { describe, expect, it, vi } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { SolidAction, SolidConfig, SolidState } from '../types';
import { hasFloatingCubes } from '../voxel';

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

function apply(config: SolidConfig, actions: readonly SolidAction[]): SolidState {
  let state = createInitialState(config);
  assertSerializable(state);
  for (const action of actions) {
    deepFreeze(state);
    state = reduce(state, action);
    assertSerializable(state);
  }
  return state;
}

describe('E12 cubes reduce & observe', () => {
  it('바닥 칸에 add 3번을 보내면 높이 3(z = 0, 1, 2)이 되고 사전순 정렬된다', () => {
    const state = apply({}, [
      { type: 'add', x: 1, y: 2 },
      { type: 'add', x: 1, y: 2 },
      { type: 'add', x: 1, y: 2 },
      { type: 'add', x: 0, y: 0 },
    ]);
    expect(state.cubes.map((c) => [c.x, c.y, c.z])).toEqual([
      [0, 0, 0],
      [1, 2, 0],
      [1, 2, 1],
      [1, 2, 2],
    ]);
    const obs = observe(state);
    expect(obs['count']).toBe(4);
    expect(hasFloatingCubes(state.cubes)).toBe(false);
  });

  it('maxHeight·maxCubes·격자 밖에서는 add를 무시한다', () => {
    const fullHeight = apply({ grid: [2, 2], maxHeight: 2 }, [
      { type: 'add', x: 0, y: 0 },
      { type: 'add', x: 0, y: 0 },
      { type: 'add', x: 0, y: 0 },
      { type: 'add', x: -1, y: 0 },
      { type: 'add', x: 2, y: 0 },
      { type: 'add', x: 0, y: 2 },
    ]);
    expect(fullHeight.cubes).toHaveLength(2);

    const capped = apply({ grid: [3, 3], maxCubes: 2 }, [
      { type: 'add', x: 0, y: 0 },
      { type: 'add', x: 1, y: 0 },
      { type: 'add', x: 2, y: 0 },
    ]);
    expect(capped.cubes).toHaveLength(2);
    expect(observe(capped)['maxReached']).toBe(true);
  });

  it('remove는 맨 위만 빼고, locked 맨 위는 무시하며, clear 뒤 locked만 남는다', () => {
    const state = apply(
      {
        initial: [
          { at: [0, 0, 0], color: 'red', locked: true },
          { at: [0, 0, 1], color: 'blue', locked: false },
        ],
      },
      [
        { type: 'add', x: 0, y: 0 },
        { type: 'add', x: 1, y: 1 },
      ],
    );
    expect(state.cubes).toHaveLength(4);

    // 맨 위(z=2) 하나 빼기
    const afterOneRemove = reduce(state, { type: 'remove', x: 0, y: 0 });
    expect(afterOneRemove.cubes.filter((c) => c.x === 0 && c.y === 0)).toHaveLength(2);

    // z=1까지 빼고, locked인 z=0은 빠지지 않는다
    const afterTwoRemoves = reduce(afterOneRemove, { type: 'remove', x: 0, y: 0 });
    expect(afterTwoRemoves.cubes.filter((c) => c.x === 0 && c.y === 0)).toHaveLength(1);
    const tryLocked = reduce(afterTwoRemoves, { type: 'remove', x: 0, y: 0 });
    expect(tryLocked).toBe(afterTwoRemoves);

    // clear 뒤에는 locked 쌓기나무만 남고 공중에 뜬 것은 없다
    const cleared = reduce(state, { type: 'clear' });
    expect(cleared.cubes).toEqual([{ x: 0, y: 0, z: 0, color: 'red', locked: true }]);
    expect(hasFloatingCubes(cleared.cubes)).toBe(false);
  });

  it('initial의 공중에 뜬 쌓기나무를 버리고 개발 모드에서 경고한다', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const state = createInitialState({
      grid: [3, 3],
      maxHeight: 4,
      initial: [
        { at: [0, 0, 0] },
        { at: [0, 0, 2] }, // 공중에 뜸 (z=1 없음)
        { at: [1, 1, 1] }, // 공중에 뜸 (z=0 없음)
      ],
    });
    expect(state.cubes.map((c) => [c.x, c.y, c.z])).toEqual([[0, 0, 0]]);
    expect(hasFloatingCubes(state.cubes)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('어떤 add·remove·clear 순서로도 공중에 뜬 쌓기나무가 생기지 않는다', () => {
    const actions: SolidAction[] = [
      { type: 'add', x: 0, y: 0 },
      { type: 'add', x: 0, y: 0 },
      { type: 'add', x: 0, y: 0 },
      { type: 'add', x: 1, y: 0 },
      { type: 'remove', x: 0, y: 0 },
      { type: 'remove', x: 2, y: 2 },
      { type: 'add', x: 0, y: 0 },
      { type: 'clear' },
      { type: 'add', x: 1, y: 1 },
      { type: 'remove', x: 1, y: 1 },
    ];
    let state = createInitialState({
      initial: [{ at: [0, 0, 0], locked: true }],
    });
    for (const action of actions) {
      state = reduce(state, action);
      expect(hasFloatingCubes(state.cubes)).toBe(false);
    }
  });

  it('turn을 해도 cubes·top·front·side는 그대로이고 viewTurn만 바뀐다', () => {
    const base = apply({}, [
      { type: 'add', x: 0, y: 0 },
      { type: 'add', x: 0, y: 0 },
      { type: 'add', x: 1, y: 0 },
    ]);
    const baseObs = observe(base);
    const turned = reduce(base, { type: 'turn', dir: 'right' });
    const turnedObs = observe(turned);

    expect(turned.viewTurn).toBe(1);
    expect(turnedObs['cubes']).toEqual(baseObs['cubes']);
    expect(turnedObs['top']).toEqual(baseObs['top']);
    expect(turnedObs['front']).toEqual(baseObs['front']);
    expect(turnedObs['side']).toEqual(baseObs['side']);

    // 네 번 돌리면 제자리
    let loop = base;
    for (let i = 0; i < 4; i += 1) {
      loop = reduce(loop, { type: 'turn', dir: 'right' });
    }
    expect(loop.viewTurn).toBe(0);
    expect(reduce(base, { type: 'turn', dir: 'left' }).viewTurn).toBe(3);
  });

  it('rotationLocked면 turn Action을 무시한다', () => {
    const locked = createInitialState({ rotationLocked: true });
    expect(reduce(locked, { type: 'turn', dir: 'right' })).toBe(locked);
    expect(reduce(locked, { type: 'turn', dir: 'left' })).toBe(locked);
  });

  it('editable 기본값은 true이고 false면 조작 Action 5종을 무시하며 회전·반투명·강조는 유지한다', () => {
    expect(createInitialState({}).settings.editable).toBe(true);

    const viewOnly = createInitialState({
      editable: false,
      maxCubes: 1,
      initial: [{ at: [0, 0, 0], color: 'blue', locked: false }],
    });
    expect(viewOnly.settings.editable).toBe(false);

    expect(reduce(viewOnly, { type: 'add', x: 1, y: 0 })).toBe(viewOnly);
    expect(reduce(viewOnly, { type: 'remove', x: 0, y: 0 })).toBe(viewOnly);
    expect(reduce(viewOnly, { type: 'clear' })).toBe(viewOnly);
    expect(reduce(viewOnly, { type: 'select-tool', tool: 'remove' })).toBe(viewOnly);
    expect(reduce(viewOnly, { type: 'move-cursor', to: [2, 2] })).toBe(viewOnly);

    const turned = reduce(viewOnly, { type: 'turn', dir: 'right' });
    expect(turned.viewTurn).toBe(1);
    const translucent = reduce(turned, { type: 'set-translucent', on: true });
    expect(translucent.translucent).toBe(true);
    const focused = reduce(translucent, {
      type: 'focus-cell',
      cell: { view: 'top', row: 0, col: 0 },
    });
    expect(focused.focus).toEqual({ view: 'top', row: 0, col: 0 });

    const obs = observe(viewOnly);
    expect(obs['maxReached']).toBe(true);
    expect('editable' in obs).toBe(false);
  });

  it('sideDirection left, colorHints false, 미래 키와 잘못된 focus-cell을 안전하게 처리한다', () => {
    const state = createInitialState({
      grid: [3, 3],
      maxHeight: 3,
      sideDirection: 'left',
      colorHints: false,
      fallback: 'isometric-2d',
      variant: 'reconstruct',
      layerSlider: true,
      bidirectional: true,
      givenViews: {},
      challenge: ['any'],
      verbalInstructions: true,
      targetFromStage: true,
      initial: [{ at: [0, 0, 0], color: 'red', locked: true }],
    });
    expect(state.settings.sideDirection).toBe('right');
    expect(state.cubes[0]?.color).toBe('plain');

    expect(reduce(state, { type: 'focus-cell', cell: { view: 'top', row: 5, col: 0 } })).toBe(
      state,
    );
    const focused = reduce(state, { type: 'focus-cell', cell: { view: 'top', row: 0, col: 1 } });
    expect(focused.focus).toEqual({ view: 'top', row: 0, col: 1 });
    expect(reduce(focused, { type: 'focus-cell', cell: null }).focus).toBeNull();
  });

  it('emit은 cube-added·cube-removed·view-turned 이벤트를 내보낸다', () => {
    const s0 = createInitialState({});
    const s1 = reduce(s0, { type: 'add', x: 2, y: 1 });
    expect(emit(s0, s1)).toEqual([{ name: 'cube-added', payload: { x: 2, y: 1, z: 0, count: 1 } }]);

    const s2 = reduce(s1, { type: 'remove', x: 2, y: 1 });
    expect(emit(s1, s2)).toEqual([
      { name: 'cube-removed', payload: { x: 2, y: 1, z: 0, count: 0 } },
    ]);

    const s3 = reduce(s2, { type: 'turn', dir: 'right' });
    expect(emit(s2, s3)).toEqual([{ name: 'view-turned', payload: { viewTurn: 1 } }]);
  });
});

describe('E12 T134 2D 입력판 상태·관측·판정(predicate)', () => {
  it('설정 정규화: 크기가 다른 numberGrid·layers given을 무시하고 수를 자른다', () => {
    const badNum = createInitialState({
      grid: [3, 2],
      maxHeight: 3,
      numberGrid: {
        mode: 'given',
        given: [
          [1, 2],
          [0, 1],
        ],
      },
    });
    expect(badNum.settings.numberGrid).toBeNull();

    const clampedNum = createInitialState({
      grid: [2, 2],
      maxHeight: 3,
      numberGrid: {
        mode: 'given',
        given: [
          [-2, 9],
          [1.6, 0],
        ],
      },
    });
    expect(clampedNum.settings.numberGrid?.given).toEqual([
      [0, 3],
      [2, 0],
    ]);

    const badLayer = createInitialState({
      grid: [2, 2],
      maxHeight: 2,
      layers: {
        slider: true,
        panel: 'given',
        given: [
          [
            [1, 0],
            [0, 1],
          ],
        ],
      },
    });
    expect(badLayer.settings.layers.slider).toBe(true);
    expect(badLayer.settings.layers.panel).toBe('off');
    expect(badLayer.settings.layers.given).toBeUndefined();
  });

  it('numberGrid input과 drive의 reduce 경계 및 editable·locked·maxCubes를 지킨다', () => {
    const inputState = createInitialState({
      grid: [2, 2],
      maxHeight: 3,
      editable: false,
      numberGrid: { mode: 'input' },
    });
    const moved = reduce(inputState, { type: 'move-number-cursor', to: [1, 1] });
    expect(moved.numberCursor).toEqual([1, 1]);
    const written = reduce(moved, { type: 'set-number', row: 1, col: 1, value: 3 });
    expect(written.numbers).toEqual([
      [0, 0],
      [0, 3],
    ]);
    const clamped = reduce(written, { type: 'set-number', row: 0, col: 0, value: 9 });
    expect(clamped.numbers?.[0]?.[0]).toBe(3);
    expect(reduce(clamped, { type: 'set-number', row: 5, col: 0, value: 1 })).toBe(clamped);

    const driveState = createInitialState({
      grid: [2, 2],
      maxHeight: 3,
      maxCubes: 4,
      numberGrid: { mode: 'drive' },
      initial: [
        { at: [0, 0, 0], color: 'red', locked: true },
        { at: [0, 0, 1], color: 'blue', locked: false },
      ],
    });
    // 고정(locked) 아래(0)로 낮추기 무시
    expect(reduce(driveState, { type: 'set-height', x: 0, y: 0, h: 0 })).toBe(driveState);
    // maxHeight(3)까지 올리기(총 3개 <= 4)
    const raised = reduce(driveState, { type: 'set-height', x: 0, y: 0, h: 3 });
    expect(raised.cubes).toHaveLength(3);
    // maxCubes(4) 초과(현재 3개 + 2개 = 5개) 무시
    expect(reduce(raised, { type: 'set-height', x: 1, y: 0, h: 2 })).toBe(raised);
    // maxHeight(3) 경계 밖 무시
    expect(reduce(raised, { type: 'set-height', x: 1, y: 0, h: 4 })).toBe(raised);
    // 비고정 기둥 0으로 낮추기
    const zeroed = reduce(driveState, { type: 'set-height', x: 0, y: 0, h: 1 });
    expect(zeroed.cubes).toHaveLength(1);
    const clearedUnlocked = reduce(driveState, { type: 'set-height', x: 1, y: 1, h: 0 });
    expect(clearedUnlocked).toBe(driveState);

    const driveLocked = createInitialState({
      grid: [2, 2],
      maxHeight: 3,
      editable: false,
      numberGrid: { mode: 'drive' },
    });
    expect(reduce(driveLocked, { type: 'set-height', x: 0, y: 0, h: 2 })).toBe(driveLocked);
  });

  it('layers slider·paint와 paintViews action 및 observe 키를 검증한다', () => {
    const s0 = createInitialState({
      grid: [3, 2],
      maxHeight: 3,
      layers: { slider: true, panel: 'paint' },
      paintViews: ['front', 'side'],
      initial: [{ at: [0, 0, 0] }, { at: [0, 0, 1] }],
    });
    expect(s0.layerFocus).toBeNull();
    const s1 = reduce(s0, { type: 'focus-layer', layer: 2 });
    expect(s1.layerFocus).toBe(2);
    expect(reduce(s1, { type: 'focus-layer', layer: 5 })).toBe(s1);
    expect(reduce(s1, { type: 'focus-layer', layer: null }).layerFocus).toBeNull();

    const paintedLayer = reduce(s1, { type: 'toggle-layer-cell', layer: 1, row: 1, col: 0 });
    expect(paintedLayer.layerPaint?.[0]?.[1]?.[0]).toBe(1);
    expect(reduce(paintedLayer, { type: 'clear-layer-paint' }).layerPaint?.[0]?.[1]?.[0]).toBe(0);

    const paintedView = reduce(paintedLayer, {
      type: 'toggle-paint-cell',
      view: 'side',
      row: 2,
      col: 1,
    });
    expect(paintedView.painted?.side?.[2]?.[1]).toBe(1);
    expect(reduce(paintedView, { type: 'clear-paint', view: 'side' }).painted?.side?.[2]?.[1]).toBe(
      0,
    );

    const obs = observe(paintedView);
    expect('numbers' in obs).toBe(false);
    expect(obs['layerFocus']).toBe(2);
    expect(obs['layers']).toEqual([
      [
        [0, 0, 0],
        [1, 0, 0],
      ],
      [
        [0, 0, 0],
        [1, 0, 0],
      ],
      [
        [0, 0, 0],
        [0, 0, 0],
      ],
    ]);
    expect(obs['layerPaint']).toBeDefined();
    expect(obs['painted']).toBeDefined();

    const driveObs = observe(
      createInitialState({
        grid: [2, 2],
        numberGrid: { mode: 'drive' },
        initial: [{ at: [0, 0, 0] }],
      }),
    );
    expect(driveObs['numbers']).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect('layerPaint' in driveObs).toBe(false);
    expect('painted' in driveObs).toBe(false);
  });

  it('T134 predicate 8종: 정답·오답·오개념 상태를 정확히 판정한다', () => {
    // 1. numbersMatch & numbersSum
    let numState = createInitialState({
      grid: [2, 2],
      maxHeight: 3,
      numberGrid: { mode: 'input' },
      initial: [{ at: [0, 0, 0] }, { at: [0, 0, 1] }, { at: [1, 1, 0] }],
    });
    numState = reduce(numState, { type: 'set-number', row: 1, col: 0, value: 2 });
    expect(predicates['numbersMatch']?.(observe(numState), {})).toBe(false);
    expect(predicates['numbersSum']?.(observe(numState), { sum: 3 })).toBe(false);
    numState = reduce(numState, { type: 'set-number', row: 0, col: 1, value: 1 });
    expect(predicates['numbersMatch']?.(observe(numState), {})).toBe(true);
    expect(
      predicates['numbersMatch']?.(observe(numState), {
        numbers: [
          [0, 1],
          [2, 0],
        ],
      }),
    ).toBe(true);
    expect(predicates['numbersSum']?.(observe(numState), { sum: 3 })).toBe(true);

    // 2. layerPaintMatches & layerPaintFloating (paint/cubes 모두) & layersMatch
    let layerState = createInitialState({
      grid: [2, 2],
      maxHeight: 2,
      layers: { panel: 'paint' },
      initial: [{ at: [0, 0, 0] }, { at: [0, 0, 1] }, { at: [1, 0, 0] }],
    });
    // 2층 (row=1, col=1) 칠하기: 칠한 1층과 실제 1층은 row=1,col=0 & row=1,col=1 -> paint 기준 뜸, cubes 기준 안 뜸
    layerState = reduce(layerState, { type: 'toggle-layer-cell', layer: 2, row: 1, col: 1 });
    expect(predicates['layerPaintFloating']?.(observe(layerState), { against: 'paint' })).toBe(
      true,
    );
    expect(predicates['layerPaintFloating']?.(observe(layerState), { against: 'cubes' })).toBe(
      false,
    );

    // cubes 기준도 뜨는 위치: 2층 (row=0, col=0)은 실제 1층이 비어 있음
    const floatingBoth = reduce(layerState, {
      type: 'toggle-layer-cell',
      layer: 2,
      row: 0,
      col: 0,
    });
    expect(predicates['layerPaintFloating']?.(observe(floatingBoth), { against: 'cubes' })).toBe(
      true,
    );

    // 정답대로 칠하기
    let matchedLayers = reduce(
      createInitialState({
        grid: [2, 2],
        maxHeight: 2,
        layers: { panel: 'paint' },
        initial: [{ at: [0, 0, 0] }, { at: [0, 0, 1] }, { at: [1, 0, 0] }],
      }),
      { type: 'toggle-layer-cell', layer: 1, row: 1, col: 0 },
    );
    matchedLayers = reduce(matchedLayers, { type: 'toggle-layer-cell', layer: 1, row: 1, col: 1 });
    expect(predicates['layerPaintMatches']?.(observe(matchedLayers), { layer: 1 })).toBe(true);
    expect(predicates['layerPaintMatches']?.(observe(matchedLayers), {})).toBe(false);
    matchedLayers = reduce(matchedLayers, { type: 'toggle-layer-cell', layer: 2, row: 1, col: 0 });
    expect(predicates['layerPaintMatches']?.(observe(matchedLayers), {})).toBe(true);
    expect(predicates['layerPaintFloating']?.(observe(matchedLayers), { against: 'paint' })).toBe(
      false,
    );

    // layersMatch (평행이동 허용 vs 비허용)
    const shiftedTarget = [
      [
        [1, 1],
        [0, 0],
      ],
      [
        [1, 0],
        [0, 0],
      ],
    ];
    expect(predicates['layersMatch']?.(observe(matchedLayers), { layers: shiftedTarget })).toBe(
      true,
    );
    expect(
      predicates['layersMatch']?.(observe(matchedLayers), { layers: shiftedTarget, shift: false }),
    ).toBe(false);

    // 3. paintedMatches, paintedMirrored, paintedShorter
    // 앞줄 오른쪽(x=1,y=0) 2층, 뒷줄 왼쪽(x=0,y=1) 1층
    // side(2x2): col 0(앞) height 2, col 1(뒤) height 1 -> [[1,0],[1,1]]
    const basePaint = createInitialState({
      grid: [2, 2],
      maxHeight: 2,
      paintViews: ['front', 'side'],
      initial: [{ at: [1, 0, 0] }, { at: [1, 0, 1] }, { at: [0, 1, 0] }],
    });
    // 정답 side: [[1, 0], [1, 1]]
    let okSide = reduce(basePaint, { type: 'toggle-paint-cell', view: 'side', row: 0, col: 0 });
    okSide = reduce(okSide, { type: 'toggle-paint-cell', view: 'side', row: 1, col: 0 });
    okSide = reduce(okSide, { type: 'toggle-paint-cell', view: 'side', row: 1, col: 1 });
    expect(predicates['paintedMatches']?.(observe(okSide), { view: 'side' })).toBe(true);
    expect(predicates['paintedMirrored']?.(observe(okSide), { view: 'side' })).toBe(false);
    expect(predicates['paintedShorter']?.(observe(okSide), { view: 'side' })).toBe(false);

    // 거울 뒤집기 side: [[0, 1], [1, 1]]
    let mirrorSide = reduce(basePaint, { type: 'toggle-paint-cell', view: 'side', row: 0, col: 1 });
    mirrorSide = reduce(mirrorSide, { type: 'toggle-paint-cell', view: 'side', row: 1, col: 0 });
    mirrorSide = reduce(mirrorSide, { type: 'toggle-paint-cell', view: 'side', row: 1, col: 1 });
    expect(predicates['paintedMirrored']?.(observe(mirrorSide), { view: 'side' })).toBe(true);

    // 깊이 누락(더 낮게 칠함): [[0, 0], [1, 1]] (col 0 높이 1 < 2, col 1 높이 1 == 1)
    let shorterSide = reduce(basePaint, {
      type: 'toggle-paint-cell',
      view: 'side',
      row: 1,
      col: 0,
    });
    shorterSide = reduce(shorterSide, { type: 'toggle-paint-cell', view: 'side', row: 1, col: 1 });
    expect(predicates['paintedShorter']?.(observe(shorterSide), { view: 'side' })).toBe(true);
    expect(predicates['paintedShorter']?.(observe(shorterSide), { view: 'top' })).toBe(false);

    // 대칭 모양에서는 paintedMirrored가 false여야 한다
    const symState = reduce(
      createInitialState({
        grid: [2, 2],
        maxHeight: 2,
        paintViews: ['side'],
        initial: [{ at: [0, 0, 0] }, { at: [0, 1, 0] }],
      }),
      { type: 'toggle-paint-cell', view: 'side', row: 1, col: 0 },
    );
    const symFull = reduce(symState, { type: 'toggle-paint-cell', view: 'side', row: 1, col: 1 });
    expect(predicates['paintedMatches']?.(observe(symFull), { view: 'side' })).toBe(true);
    expect(predicates['paintedMirrored']?.(observe(symFull), { view: 'side' })).toBe(false);
  });
});
