import { describe, expect, it, vi } from 'vitest';
import type { Observation } from '../../../core/engine-sdk';
import { emit, EVENT_NAMES, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { ShapesSortConfig, ShapesState, SolidAction } from '../types';
import definition from '../index';

function make(config: Partial<ShapesSortConfig> = {}): ShapesState {
  return createInitialState({ mode: 'shapes-sort', ...config });
}

function run(state: ShapesState, actions: readonly SolidAction[]): ShapesState {
  return actions.reduce<ShapesState>((s, a) => reduce(s, a), state);
}

function pred(name: string, obs: Observation, args?: unknown): boolean {
  const fn = predicates[name];
  expect(fn, name).toBeDefined();
  return fn?.(obs, args as never) ?? false;
}

const sel = (id: string): SolidAction => ({ type: 'ss-select', id });

describe('E12 shapes-sort 설정·초기 상태', () => {
  it('기본값: ramp-and-tower, 상자·둥근기둥·공, 탑 4칸, 둥근기둥은 세운 방향', () => {
    const s = make({ physics: 'scripted' });
    expect(s.settings.scene).toBe('ramp-and-tower');
    expect(s.settings.towerMax).toBe(4);
    expect(s.settings.mystery).toBeNull();
    expect(s.settings.objects.map((o) => o.kind)).toEqual(['box', 'cylinder', 'sphere']);
    expect(s.settings.objects.map((o) => o.id)).toEqual(['box', 'cylinder', 'sphere']);
    expect(s.settings.objects[0]).toMatchObject({ color: 'red', size: 'large' });
    expect(s.pose).toEqual({ box: 'flat', cylinder: 'standing', sphere: 'any' });
    expect(s.selected).toBeNull();
    expect(s.trials).toEqual([]);
  });

  it('towerMax는 1~5로 자르고, 알 수 없는 scene·물건은 기본값/무시한다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(make({ towerMax: 0 }).settings.towerMax).toBe(1);
    expect(make({ towerMax: 9 }).settings.towerMax).toBe(5);
    expect(make({ towerMax: 2.4 }).settings.towerMax).toBe(2);
    expect(make({ scene: 'bogus' as never }).settings.scene).toBe('ramp-and-tower');
    const s = make({ objects: ['sphere', 'pyramid', 'sphere'] as never });
    expect(s.settings.objects.map((o) => o.id)).toEqual(['sphere', 'sphere-2']);
    expect(make({ objects: [] }).settings.objects).toHaveLength(3);
    warn.mockRestore();
  });

  it('ShapeItem 목록을 그대로 받고 빠진 색·크기는 차례로 채운다', () => {
    const s = make({
      objects: [
        { id: 'a', kind: 'cylinder', color: 'green', size: 'small' },
        { id: 'b', kind: 'box' } as never,
      ],
    });
    expect(s.settings.objects[0]).toEqual({
      id: 'a',
      kind: 'cylinder',
      color: 'green',
      size: 'small',
    });
    expect(s.settings.objects[1]).toMatchObject({ id: 'b', kind: 'box', color: 'blue' });
  });

  it('mystery 설정: shadow가 없거나 잘못되면 null', () => {
    expect(make({ scene: 'mystery', mystery: { kind: 'box' } }).settings.mystery).toEqual({
      kind: 'box',
      shadow: null,
    });
    expect(
      make({ scene: 'mystery', mystery: { kind: 'sphere', shadow: 'top' } }).settings.mystery,
    ).toEqual({ kind: 'sphere', shadow: 'top' });
    expect(make({ mystery: { kind: 'cone' } as never }).settings.mystery).toBeNull();
  });
});

describe('E12 shapes-sort 경사로', () => {
  it('고르기: 같은 것을 다시 누르면 풀리고, 없는 id는 무시한다', () => {
    const s = make();
    const a = reduce(s, sel('sphere'));
    expect(a.selected).toBe('sphere');
    expect(reduce(a, sel('box')).selected).toBe('box');
    expect(reduce(a, sel('sphere')).selected).toBeNull();
    expect(reduce(s, sel('nope'))).toBe(s);
  });

  it('방향: 허용된 방향만 바뀌고, 같은 방향·잘못된 방향은 무시한다', () => {
    const s = make();
    const lying = reduce(s, { type: 'ss-set-pose', id: 'cylinder', pose: 'lying' });
    expect(lying.pose['cylinder']).toBe('lying');
    expect(reduce(lying, { type: 'ss-set-pose', id: 'cylinder', pose: 'lying' })).toBe(lying);
    expect(reduce(s, { type: 'ss-set-pose', id: 'box', pose: 'lying' })).toBe(s);
    expect(reduce(s, { type: 'ss-set-pose', id: 'sphere', pose: 'standing' })).toBe(s);
    expect(reduce(s, { type: 'ss-set-pose', id: 'cylinder', pose: 'flat' })).toBe(s);
    expect(reduce(s, { type: 'ss-set-pose', id: 'nope', pose: 'lying' })).toBe(s);
  });

  it('place → play: 공은 roll, 세운 둥근기둥은 stay, 눕히면 roll', () => {
    let s = run(make(), [sel('sphere'), { type: 'ss-place-ramp' }]);
    expect(s.rampItem).toBe('sphere');
    expect(s.rampPlayed).toBe(false);
    s = reduce(s, { type: 'ss-play' });
    expect(s.rampPlayed).toBe(true);
    expect(s.trials).toEqual([{ id: 'sphere', kind: 'sphere', pose: 'any', result: 'roll' }]);
    expect(observe(s)['rampResult']).toBe('roll');

    s = run(s, [sel('sphere'), sel('cylinder'), { type: 'ss-place-ramp' }, { type: 'ss-play' }]);
    expect(s.trials[1]).toMatchObject({ kind: 'cylinder', pose: 'standing', result: 'stay' });
    expect(observe(s)['rampResult']).toBe('stay');
    s = run(s, [{ type: 'ss-set-pose', id: 'cylinder', pose: 'lying' }]);
    expect(s.rampPlayed).toBe(false);
    expect(observe(s)['rampResult']).toBeNull();
    s = reduce(s, { type: 'ss-play' });
    expect(s.trials[2]).toMatchObject({ kind: 'cylinder', pose: 'lying', result: 'roll' });
  });

  it('고른 물건이 없으면 올리지 못하고, 경사로가 비면 ▶는 무시한다', () => {
    const s = make();
    expect(reduce(s, { type: 'ss-place-ramp' })).toBe(s);
    expect(reduce(s, { type: 'ss-play' })).toBe(s);
    expect(reduce(s, { type: 'ss-reset-ramp' })).toBe(s);
  });

  it('이미 있는 물건을 다시 올리면 rampPlayed만 false로 돌린다, 다른 물건이면 바꾼다', () => {
    let s = run(make(), [sel('sphere'), { type: 'ss-place-ramp' }, { type: 'ss-play' }]);
    const again = reduce(s, { type: 'ss-place-ramp' });
    expect(again.rampPlayed).toBe(false);
    expect(again.rampItem).toBe('sphere');
    expect(reduce(again, { type: 'ss-place-ramp' })).toBe(again);
    s = run(s, [sel('sphere'), sel('box'), { type: 'ss-place-ramp' }]);
    expect(s.rampItem).toBe('box');
  });

  it('reset-ramp는 경사로를 비운다(기록은 남는다)', () => {
    const s = run(make(), [
      sel('sphere'),
      { type: 'ss-place-ramp' },
      { type: 'ss-play' },
      { type: 'ss-reset-ramp' },
    ]);
    expect(s.rampItem).toBeNull();
    expect(s.rampPlayed).toBe(false);
    expect(s.trials).toHaveLength(1);
  });

  it('▶ 기록은 최대 20개이고 오래된 것부터 버린다', () => {
    let s = run(make(), [sel('sphere'), { type: 'ss-place-ramp' }]);
    for (let i = 0; i < 25; i += 1) s = reduce(s, { type: 'ss-play' });
    expect(s.trials).toHaveLength(20);
    // 마지막에 둥근기둥을 눕혀 한 번 더: 맨 앞(공) 하나가 밀려난다
    s = run(s, [
      sel('sphere'),
      sel('cylinder'),
      { type: 'ss-set-pose', id: 'cylinder', pose: 'lying' },
      { type: 'ss-place-ramp' },
      { type: 'ss-play' },
    ]);
    expect(s.trials).toHaveLength(20);
    expect(s.trials[19]).toMatchObject({ kind: 'cylinder', pose: 'lying' });
  });

  it('경사로가 없는 scene에서는 경사로 Action을 무시한다', () => {
    const s = run(make({ scene: 'tower' }), [sel('sphere')]);
    expect(reduce(s, { type: 'ss-place-ramp' })).toBe(s);
    expect(reduce(s, { type: 'ss-play' })).toBe(s);
  });
});

describe('E12 shapes-sort 탑', () => {
  it('상자 3개를 쌓으면 높이 3', () => {
    const s = run(
      make({
        objects: [
          { id: 'b1', kind: 'box', color: 'red', size: 'large' },
          { id: 'b2', kind: 'box', color: 'blue', size: 'small' },
          { id: 'b3', kind: 'box', color: 'green', size: 'large' },
        ],
      }),
      [
        sel('b1'),
        { type: 'ss-stack' },
        sel('b1'),
        sel('b2'),
        { type: 'ss-stack' },
        sel('b2'),
        sel('b3'),
        { type: 'ss-stack' },
      ],
    );
    expect(s.tower).toEqual(['b1', 'b2', 'b3']);
    const obs = observe(s);
    expect(obs['towerHeight']).toBe(3);
    expect(obs['towerKinds']).toEqual(['box']);
    expect(obs['fallenCount']).toBe(0);
  });

  it('공을 상자 위에 올리면 떨어지고 탑은 그대로, fallen에 기록된다', () => {
    const s = run(make(), [sel('box'), { type: 'ss-stack' }, sel('box'), sel('sphere')]);
    const fell = reduce(s, { type: 'ss-stack' });
    expect(fell.tower).toEqual(['box']);
    expect(fell.fallen).toEqual([{ id: 'sphere', kind: 'sphere', pose: 'any' }]);
    expect(observe(fell)['fallenCount']).toBe(1);
    // 떨어진 물건도 다시 올려 볼 수 있다
    expect(reduce(fell, { type: 'ss-stack' }).fallen).toHaveLength(2);
  });

  it('공은 바닥에는 머물지만 그 위에는 아무것도 머물지 않는다', () => {
    let s = run(make(), [sel('sphere'), { type: 'ss-stack' }]);
    expect(s.tower).toEqual(['sphere']);
    s = run(s, [sel('sphere'), sel('box'), { type: 'ss-stack' }]);
    expect(s.tower).toEqual(['sphere']);
    expect(s.fallen).toHaveLength(1);
  });

  it('눕힌 둥근기둥은 바닥에 머물지만 그 위에는 못 쌓는다', () => {
    const s = run(make(), [
      sel('cylinder'),
      { type: 'ss-set-pose', id: 'cylinder', pose: 'lying' },
      { type: 'ss-stack' },
      sel('cylinder'),
      sel('box'),
      { type: 'ss-stack' },
    ]);
    expect(s.tower).toEqual(['cylinder']);
    expect(s.fallen).toHaveLength(1);
  });

  it('towerMax를 넘으면 무시하고, 이미 탑에 있는 물건을 다시 올려도 무시한다', () => {
    const objects = ['box', 'box', 'box'] as const;
    let s = make({ towerMax: 2, objects: [...objects] });
    s = run(s, [sel('box'), { type: 'ss-stack' }]);
    expect(reduce(s, { type: 'ss-stack' })).toBe(s);
    s = run(s, [sel('box'), sel('box-2'), { type: 'ss-stack' }, sel('box-2'), sel('box-3')]);
    expect(s.tower).toEqual(['box', 'box-2']);
    expect(reduce(s, { type: 'ss-stack' })).toBe(s);
  });

  it('탑에 올라간 물건은 방향을 바꿀 수 없다', () => {
    const s = run(make(), [sel('cylinder'), { type: 'ss-stack' }]);
    expect(reduce(s, { type: 'ss-set-pose', id: 'cylinder', pose: 'lying' })).toBe(s);
  });

  it('unstack은 맨 위 하나, clear-tower는 탑과 fallen 모두 비운다', () => {
    let s = run(make(), [
      sel('box'),
      { type: 'ss-stack' },
      sel('box'),
      sel('sphere'),
      { type: 'ss-stack' },
    ]);
    expect(s.fallen).toHaveLength(1);
    const popped = reduce(s, { type: 'ss-unstack' });
    expect(popped.tower).toEqual([]);
    expect(reduce(popped, { type: 'ss-unstack' })).toBe(popped);
    s = reduce(s, { type: 'ss-clear-tower' });
    expect(s.tower).toEqual([]);
    expect(s.fallen).toEqual([]);
    expect(reduce(s, { type: 'ss-clear-tower' })).toBe(s);
  });

  it('fallen 기록은 최대 20개다', () => {
    let s = run(make(), [sel('box'), { type: 'ss-stack' }, sel('box'), sel('sphere')]);
    for (let i = 0; i < 25; i += 1) s = reduce(s, { type: 'ss-stack' });
    expect(s.fallen).toHaveLength(20);
  });

  it('한 물건은 경사로와 탑에 동시에 있을 수 없다', () => {
    // 경사로에 있는 물건을 탑에 올리면 경사로에서 빠진다
    let s = run(make(), [sel('box'), { type: 'ss-place-ramp' }, { type: 'ss-stack' }]);
    expect(s.tower).toEqual(['box']);
    expect(s.rampItem).toBeNull();
    // 탑 맨 위 물건을 경사로에 두면 탑에서 빠진다
    s = reduce(s, { type: 'ss-place-ramp' });
    expect(s.tower).toEqual([]);
    expect(s.rampItem).toBe('box');
    // 맨 위가 아니면 경사로로 못 옮긴다
    s = run(s, [
      { type: 'ss-stack' },
      sel('box'),
      sel('cylinder'),
      { type: 'ss-stack' },
      sel('cylinder'),
      sel('box'),
    ]);
    expect(s.tower).toEqual(['box', 'cylinder']);
    expect(s.selected).toBe('box');
    const blocked = reduce(s, { type: 'ss-place-ramp' });
    expect(blocked).toBe(s);
  });

  it('탑이 없는 scene에서는 탑 Action을 무시한다', () => {
    const s = run(make({ scene: 'ramp' }), [sel('box')]);
    expect(reduce(s, { type: 'ss-stack' })).toBe(s);
    const t = run(make({ scene: 'ramp' }), []);
    expect(reduce(t, { type: 'ss-unstack' })).toBe(t);
  });
});

describe('E12 shapes-sort 만져 보기', () => {
  it('누를 때마다 단서가 하나씩 드러나고 다 드러나면 멈춘다', () => {
    let s = make({ scene: 'mystery', mystery: { kind: 'box' } });
    s = reduce(s, { type: 'ss-touch' });
    expect(s.cluesShown).toBe(1);
    s = reduce(s, { type: 'ss-touch' });
    expect(s.cluesShown).toBe(2);
    expect(reduce(s, { type: 'ss-touch' })).toBe(s);
  });

  it('공은 단서가 하나뿐이다', () => {
    const s = run(make({ scene: 'mystery', mystery: { kind: 'sphere' } }), [{ type: 'ss-touch' }]);
    expect(s.cluesShown).toBe(1);
    expect(reduce(s, { type: 'ss-touch' })).toBe(s);
  });

  it('mystery가 아니거나 mystery 설정이 없으면 무시한다', () => {
    const a = make({ scene: 'ramp', mystery: { kind: 'box' } });
    expect(reduce(a, { type: 'ss-touch' })).toBe(a);
    const b = make({ scene: 'mystery' });
    expect(reduce(b, { type: 'ss-touch' })).toBe(b);
  });
});

describe('E12 shapes-sort 직렬화·관찰', () => {
  it('상태가 JSON으로 왕복한다', () => {
    const s = run(make({ scene: 'ramp-and-tower', mystery: { kind: 'cylinder', shadow: 'top' } }), [
      sel('sphere'),
      { type: 'ss-place-ramp' },
      { type: 'ss-play' },
      sel('sphere'),
      sel('box'),
      { type: 'ss-stack' },
    ]);
    const round = JSON.parse(JSON.stringify(s)) as ShapesState;
    expect(round).toEqual(s);
    expect(reduce(round, { type: 'ss-unstack' }).tower).toEqual([]);
  });

  it('입력 상태를 바꾸지 않는다', () => {
    const s = make();
    const before = JSON.stringify(s);
    run(s, [sel('sphere'), { type: 'ss-place-ramp' }, { type: 'ss-play' }, { type: 'ss-stack' }]);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('관찰 값: 선택·시도·탑·단서', () => {
    const s = run(make({ mystery: { kind: 'cylinder' } }), [
      sel('sphere'),
      { type: 'ss-place-ramp' },
      { type: 'ss-play' },
      sel('sphere'),
      sel('cylinder'),
      { type: 'ss-place-ramp' },
      { type: 'ss-play' },
    ]);
    const obs = observe(s);
    expect(obs).toMatchObject({
      mode: 'shapes-sort',
      scene: 'ramp-and-tower',
      selected: 'cylinder',
      selectedKind: 'cylinder',
      triedKinds: ['sphere', 'cylinder'],
      rolledKinds: ['sphere'],
      rampPlayed: true,
      rampResult: 'stay',
      towerHeight: 0,
      fallenCount: 0,
      cluesShown: 0,
      mysteryKind: 'cylinder',
    });
    expect(JSON.parse(JSON.stringify(obs))).toEqual(obs);
    expect(observe(make())['mysteryKind']).toBeNull();
    expect(observe(make())['selectedKind']).toBeNull();
  });
});

describe('E12 shapes-sort predicate', () => {
  const objs = [
    { id: 'b1', kind: 'box', color: 'red', size: 'large' },
    { id: 'b2', kind: 'box', color: 'blue', size: 'small' },
    { id: 'b3', kind: 'box', color: 'green', size: 'large' },
    { id: 'c1', kind: 'cylinder', color: 'yellow', size: 'large' },
    { id: 's1', kind: 'sphere', color: 'red', size: 'small' },
  ] as const;
  const base = () => make({ objects: [...objs], towerMax: 5 });
  const stackAll = (ids: readonly string[]): SolidAction[] =>
    ids.flatMap((id): SolidAction[] => [sel(id), { type: 'ss-stack' }, sel(id)]);

  it('towerHeightIs · towerAllFlatStackers', () => {
    const empty = observe(base());
    expect(pred('towerHeightIs', empty, { n: 0 })).toBe(true);
    expect(pred('towerAllFlatStackers', empty)).toBe(false);
    const three = observe(run(base(), stackAll(['b1', 'b2', 'c1'])));
    expect(pred('towerHeightIs', three, { n: 3 })).toBe(true);
    expect(pred('towerHeightIs', three, { n: 2 })).toBe(false);
    expect(pred('towerAllFlatStackers', three)).toBe(true);
    const withSphere = observe(run(base(), stackAll(['s1'])));
    expect(pred('towerAllFlatStackers', withSphere)).toBe(false);
    const lyingBase = observe(
      run(base(), [
        sel('c1'),
        { type: 'ss-set-pose', id: 'c1', pose: 'lying' },
        { type: 'ss-stack' },
      ]),
    );
    expect(pred('towerAllFlatStackers', lyingBase)).toBe(false);
  });

  it('triedKind · cylinderTriedBothPoses', () => {
    let s = run(base(), [sel('s1'), { type: 'ss-place-ramp' }, { type: 'ss-play' }]);
    let obs = observe(s);
    expect(pred('triedKind', obs, { kind: 'sphere' })).toBe(true);
    expect(pred('triedKind', obs, { kind: 'sphere', pose: 'any' })).toBe(true);
    expect(pred('triedKind', obs, { kind: 'sphere', pose: 'lying' })).toBe(false);
    expect(pred('triedKind', obs, { kind: 'box' })).toBe(false);
    expect(pred('triedKind', obs, { kind: 'cone' })).toBe(false);
    expect(pred('triedKind', obs, undefined)).toBe(false);
    expect(pred('cylinderTriedBothPoses', obs)).toBe(false);
    s = run(s, [sel('s1'), sel('c1'), { type: 'ss-place-ramp' }, { type: 'ss-play' }]);
    obs = observe(s);
    expect(pred('triedKind', obs, { kind: 'cylinder', pose: 'standing' })).toBe(true);
    expect(pred('cylinderTriedBothPoses', obs)).toBe(false);
    s = run(s, [{ type: 'ss-set-pose', id: 'c1', pose: 'lying' }, { type: 'ss-play' }]);
    obs = observe(s);
    expect(pred('cylinderTriedBothPoses', obs)).toBe(true);
  });

  it('cluesShownAtLeast · fallenAtLeast', () => {
    const m = run(make({ scene: 'mystery', mystery: { kind: 'box' } }), [{ type: 'ss-touch' }]);
    const obs = observe(m);
    expect(pred('cluesShownAtLeast', obs, { n: 1 })).toBe(true);
    expect(pred('cluesShownAtLeast', obs, { n: 2 })).toBe(false);
    expect(pred('cluesShownAtLeast', obs, { n: 'x' })).toBe(false);
    const fell = observe(run(base(), [...stackAll(['b1']), sel('s1'), { type: 'ss-stack' }]));
    expect(pred('fallenAtLeast', fell, { n: 1 })).toBe(true);
    expect(pred('fallenAtLeast', fell, { n: 2 })).toBe(false);
    expect(pred('fallenAtLeast', fell, {})).toBe(false);
  });

  it('다른 모드의 관찰에서는 모두 false, shapes 관찰에서 다른 모드 predicate도 false', () => {
    const cubes = observe(createInitialState({}));
    const prismObs = observe(createInitialState({ mode: 'prism-pyramid' }));
    const shapes = observe(run(base(), [sel('b1'), { type: 'ss-stack' }]));
    for (const obs of [cubes, prismObs]) {
      expect(pred('towerHeightIs', obs, { n: 0 })).toBe(false);
      expect(pred('towerAllFlatStackers', obs)).toBe(false);
      expect(pred('triedKind', obs, { kind: 'box' })).toBe(false);
      expect(pred('cylinderTriedBothPoses', obs)).toBe(false);
      expect(pred('cluesShownAtLeast', obs, { n: 0 })).toBe(false);
      expect(pred('fallenAtLeast', obs, { n: 0 })).toBe(false);
    }
    const others: readonly [string, unknown][] = [
      ['countIs', { count: 0 }],
      ['isConnected', undefined],
      ['allFacesPainted', undefined],
      ['stepIs', { step: 'rotate' }],
      ['logAllCorrect', undefined],
      ['voxelsComplete', undefined],
      ['markedCountIs', { kind: 'face', n: 0 }],
    ];
    for (const [name, args] of others) {
      expect(pred(name, shapes, args), name).toBe(false);
    }
  });
});

describe('E12 shapes-sort 이벤트', () => {
  it('이벤트 이름이 EVENT_NAMES에 있다', () => {
    for (const name of ['shape-played', 'shape-stacked', 'shape-fell', 'clue-shown']) {
      expect(EVENT_NAMES as readonly string[]).toContain(name);
    }
    expect(definition.modes).toContain('shapes-sort');
  });

  it('shape-played · shape-stacked · shape-fell · clue-shown', () => {
    const s0 = make({ mystery: { kind: 'box' } });
    expect(emit(s0, s0)).toEqual([]);
    expect(emit(s0, reduce(s0, sel('sphere')))).toEqual([]);

    const placed = run(s0, [sel('sphere'), { type: 'ss-place-ramp' }]);
    const played = reduce(placed, { type: 'ss-play' });
    expect(emit(placed, played)).toEqual([
      { name: 'shape-played', payload: { kind: 'sphere', pose: 'any', result: 'roll' } },
    ]);

    const pickBox = run(played, [sel('sphere'), sel('box')]);
    const stacked = reduce(pickBox, { type: 'ss-stack' });
    expect(emit(pickBox, stacked)).toEqual([
      { name: 'shape-stacked', payload: { kind: 'box', pose: 'flat', height: 1 } },
    ]);

    const pickBall = run(stacked, [sel('box'), sel('sphere')]);
    const fell = reduce(pickBall, { type: 'ss-stack' });
    expect(emit(pickBall, fell)).toEqual([
      { name: 'shape-fell', payload: { kind: 'sphere', pose: 'any', count: 1 } },
    ]);
    // 탑을 비워도 shape-fell은 나오지 않는다
    expect(emit(fell, reduce(fell, { type: 'ss-clear-tower' }))).toEqual([]);

    const m = make({ scene: 'mystery', mystery: { kind: 'cylinder' } });
    const t1 = reduce(m, { type: 'ss-touch' });
    expect(emit(m, t1)).toEqual([{ name: 'clue-shown', payload: { index: 0, clue: 'flat' } }]);
    expect(emit(t1, reduce(t1, { type: 'ss-touch' }))).toEqual([
      { name: 'clue-shown', payload: { index: 1, clue: 'round' } },
    ]);
  });

  it('다른 모드 사이에서는 이벤트가 없다', () => {
    const a = make();
    const b = createInitialState({ mode: 'prism-pyramid' });
    expect(emit(a, b)).toEqual([]);
  });
});
