/**
 * E12 reduce·observe·events 단위 테스트(T130 16번 목록).
 */
import { describe, expect, it, vi } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { emit } from '../events';
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
