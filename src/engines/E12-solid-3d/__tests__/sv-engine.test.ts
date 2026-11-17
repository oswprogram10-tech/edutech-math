import { describe, expect, it, vi } from 'vitest';
import type { Observation } from '../../../core/engine-sdk';
import { emit, EVENT_NAMES, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import { boxesOfVolume } from '../sv/geometry';
import { svPredicates } from '../sv/predicates';
import type { SolidAction, SurfaceVolumeConfig, SvState } from '../types';

function make(config: Partial<SurfaceVolumeConfig> = {}): SvState {
  return createInitialState({ mode: 'surface-volume', ...config });
}

function run(state: SvState, actions: readonly SolidAction[]): SvState {
  return actions.reduce<SvState>((s, a) => reduce(s, a), state);
}

function pred(name: string, obs: Observation, args?: unknown): boolean {
  const fn = predicates[name];
  expect(fn, name).toBeDefined();
  return fn?.(obs, args as never) ?? false;
}

const FACES = ['front', 'back', 'left', 'right', 'top', 'bottom'] as const;

function paintAll(): SolidAction[] {
  return [
    { type: 'go-step', step: 'paint' },
    { type: 'toggle-unfold' },
    ...FACES.map((face): SolidAction => ({ type: 'paint-face', face })),
  ];
}

function layerFill(): SolidAction[] {
  return [{ type: 'go-step', step: 'fill-voxels' }, { type: 'fill-layer' }, { type: 'fill-layer' }];
}

describe('E12 surface-volume 상태·관찰', () => {
  it('설정 정규화: 기본값, 받기만 하는 키, 범위 자르기', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const d = make({
      stage: 'auto',
      fallback: 'x',
      steps: ['rotate', 'unfold', 'paint', 'surface-expr', 'fill-voxels', 'volume-expr'],
    });
    expect(d.settings.variant).toBe('steps');
    expect(d.settings.solid).toEqual({ w: 4, d: 3, h: 2 });
    expect(d.settings.steps).toEqual(['rotate', 'unfold', 'paint', 'fill-voxels']);
    expect(d.settings.layerFill).toBe(true);
    expect(d.settings.pairColors).toBe(true);
    expect(d.settings.volume).toBe(24);
    expect(d.settings.log).toBe(true);
    expect(d.step).toBe('rotate');
    expect(d.dims).toEqual([4, 3, 2]);
    expect(d.view).toEqual({ yaw: 30, pitch: 30 });
    expect(d.unfolded).toBe(false);
    expect(warn).not.toHaveBeenCalled();

    const clamped = make({ solid: { w: 0, d: 99, h: 3.4 }, volume: 1000, steps: ['nope'] });
    expect(clamped.settings.solid).toEqual({ w: 1, d: 6, h: 3 });
    expect(clamped.settings.steps).toEqual(['rotate', 'unfold', 'paint', 'fill-voxels']);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('startStep·steps 순서·fixed-volume 초기 상자', () => {
    const s = make({ steps: ['fill-voxels', 'rotate'], startStep: 'rotate' });
    expect(s.settings.steps).toEqual(['fill-voxels', 'rotate']);
    expect(s.step).toBe('rotate');
    expect(make({ steps: ['fill-voxels', 'rotate'] }).step).toBe('fill-voxels');
    expect(make({ startStep: 'paint', steps: ['rotate'] }).step).toBe('rotate');

    const fixed = make({ variant: 'fixed-volume', volume: 24 });
    expect(fixed.settings.variant).toBe('fixed-volume');
    expect(fixed.dims).toEqual([1, 1, 24]);
    expect(fixed.step).toBe('rotate');
  });

  it('go-step: steps에 있는 단계로만 간다', () => {
    const s = make({ steps: ['rotate', 'fill-voxels'] });
    expect(reduce(s, { type: 'go-step', step: 'paint' })).toBe(s);
    expect(reduce(s, { type: 'go-step', step: 'rotate' })).toBe(s);
    expect(reduce(s, { type: 'go-step', step: 'fill-voxels' }).step).toBe('fill-voxels');
  });

  it('돌리기는 15도 단위로 정규화하고 같은 값이면 상태를 그대로 둔다', () => {
    const s = make();
    expect(reduce(s, { type: 'rotate-view', dYaw: 0, dPitch: 0 })).toBe(s);
    const r = reduce(s, { type: 'rotate-view', dYaw: 47, dPitch: 100 });
    expect(r.view).toEqual({ yaw: 75, pitch: 75 });
    expect(reduce(s, { type: 'set-view', yaw: 30, pitch: 30 })).toBe(s);
    expect(reduce(s, { type: 'set-view', yaw: 200, pitch: -90 }).view).toEqual({
      yaw: -165,
      pitch: -75,
    });
  });

  it('칠하기: 전개도 단계가 아니거나 접혀 있으면 무시한다', () => {
    const s = make();
    expect(reduce(s, { type: 'paint-face', face: 'front' })).toBe(s);
    expect(reduce(s, { type: 'toggle-unfold' })).toBe(s);
    const net = run(s, [{ type: 'go-step', step: 'unfold' }, { type: 'toggle-unfold' }]);
    expect(net.unfolded).toBe(true);
    // 'unfold' 단계에서는 칠하기 도구가 없다
    expect(reduce(net, { type: 'paint-face', face: 'front' })).toBe(net);
    const paint = run(s, [{ type: 'go-step', step: 'paint' }]);
    expect(reduce(paint, { type: 'paint-face', face: 'front' })).toBe(paint);
    const open = reduce(paint, { type: 'toggle-unfold' });
    const one = reduce(open, { type: 'paint-face', face: 'right' });
    expect(one.painted).toEqual(['right']);
    expect(reduce(one, { type: 'paint-face', face: 'right' }).painted).toEqual([]);
    expect(reduce(one, { type: 'paint-face', face: 'nose' as unknown as 'front' })).toBe(one);
    // 칠한 면은 고정 순서로 정렬된다
    const two = run(open, [
      { type: 'paint-face', face: 'bottom' },
      { type: 'paint-face', face: 'front' },
    ]);
    expect(two.painted).toEqual(['front', 'bottom']);
    expect(reduce(two, { type: 'clear-paint' }).painted).toEqual([]);
    const cleared = reduce(make(), { type: 'clear-paint' });
    expect(cleared.painted).toEqual([]);
  });

  it('cubes 모양의 clear-paint(view 있음)는 이 모드에서 무시한다', () => {
    const s = run(make(), [
      { type: 'go-step', step: 'paint' },
      { type: 'toggle-unfold' },
      { type: 'paint-face', face: 'top' },
    ]);
    expect(reduce(s, { type: 'clear-paint', view: 'top' })).toBe(s);
    expect(reduce(s, { type: 'clear-paint' }).painted).toEqual([]);
  });

  it('쌓기: 공중 쌓기·위가 찬 칸 빼기·중복 쌓기·범위 밖은 무시한다', () => {
    const s0 = run(make(), [{ type: 'go-step', step: 'fill-voxels' }]);
    expect(s0.step).toBe('fill-voxels');
    const a = reduce(s0, { type: 'place-cube', x: 1, y: 1 });
    expect(a.filled).toEqual([[1, 1, 0]]);
    expect(reduce(a, { type: 'place-cube', x: 1, y: 1 })).toBe(a);
    expect(reduce(s0, { type: 'place-cube', x: 4, y: 0 })).toBe(s0);
    expect(reduce(s0, { type: 'place-cube', x: 0, y: 3 })).toBe(s0);
    expect(reduce(s0, { type: 'place-cube', x: -1, y: 0 })).toBe(s0);
    // 1층(layer 1)에서는 아래가 비면 공중이다
    const up = reduce(a, { type: 'set-layer', layer: 1 });
    expect(reduce(up, { type: 'place-cube', x: 2, y: 2 })).toBe(up);
    const stacked = reduce(up, { type: 'place-cube', x: 1, y: 1 });
    expect(stacked.filled).toEqual([
      [1, 1, 0],
      [1, 1, 1],
    ]);
    // 위가 차 있으면 아래층 칸은 뺄 수 없다
    const down = reduce(stacked, { type: 'set-layer', layer: 0 });
    expect(reduce(down, { type: 'remove-cube', x: 1, y: 1 })).toBe(down);
    expect(reduce(stacked, { type: 'remove-cube', x: 1, y: 1 }).filled).toEqual([[1, 1, 0]]);
    expect(reduce(up, { type: 'remove-cube', x: 3, y: 2 })).toBe(up);
    // 단계가 다르면 무시
    expect(reduce(make(), { type: 'place-cube', x: 0, y: 0 }).filled).toEqual([]);
    expect(reduce(s0, { type: 'set-layer', layer: 2 })).toBe(s0);
    expect(reduce(s0, { type: 'set-layer', layer: -1 })).toBe(s0);
    expect(reduce(s0, { type: 'set-layer', layer: 0 })).toBe(s0);
  });

  it('한 층 채우기: 아래층이 다 차야 하고 끝나면 윗층으로 간다', () => {
    const s0 = run(make(), [{ type: 'go-step', step: 'fill-voxels' }]);
    // 아래층이 비어 있을 때 윗층 한 층 채우기는 무시
    const up = reduce(s0, { type: 'set-layer', layer: 1 });
    expect(reduce(up, { type: 'fill-layer' })).toBe(up);
    const first = reduce(s0, { type: 'fill-layer' });
    expect(first.filled).toHaveLength(12);
    expect(first.layer).toBe(1);
    const second = reduce(first, { type: 'fill-layer' });
    expect(second.filled).toHaveLength(24);
    expect(second.layer).toBe(1);
    expect(reduce(second, { type: 'fill-layer' })).toBe(second);
    // 칸이 일부만 비어 있으면 나머지만 채운다
    const partial = reduce(s0, { type: 'place-cube', x: 0, y: 0 });
    expect(reduce(partial, { type: 'fill-layer' }).filled).toHaveLength(12);
    // 아래층이 덜 찬 채 윗층은 무시
    const gap = reduce(partial, { type: 'set-layer', layer: 1 });
    expect(reduce(gap, { type: 'fill-layer' })).toBe(gap);
    // layerFill이 꺼져 있으면 무시
    const off = run(make({ layerFill: false }), [{ type: 'go-step', step: 'fill-voxels' }]);
    expect(reduce(off, { type: 'fill-layer' })).toBe(off);
    // 모두 비우기
    const cleared = reduce(second, { type: 'clear-cubes' });
    expect(cleared.filled).toEqual([]);
    expect(cleared.layer).toBe(0);
    expect(reduce(cleared, { type: 'clear-cubes' })).toBe(cleared);
  });

  it('fixed-volume: 약수가 아닌 치수는 무시하고 h는 V/(w·d)다', () => {
    const f = make({ variant: 'fixed-volume', volume: 24 });
    expect(reduce(f, { type: 'set-dims', w: 5, d: 1 })).toBe(f);
    expect(reduce(f, { type: 'set-dims', w: 4, d: 4 })).toBe(f);
    expect(reduce(f, { type: 'set-dims', w: 0, d: 1 })).toBe(f);
    expect(reduce(f, { type: 'set-dims', w: 1.5, d: 1 })).toBe(f);
    expect(reduce(f, { type: 'set-dims', w: 1, d: 1 })).toBe(f);
    expect(reduce(f, { type: 'set-dims', w: 24, d: 2 })).toBe(f);
    expect(reduce(f, { type: 'set-dims', w: 2, d: 3 }).dims).toEqual([2, 3, 4]);
    expect(reduce(f, { type: 'set-dims', w: 24, d: 1 }).dims).toEqual([24, 1, 1]);
    // steps 변형에서는 무시
    const steps = make();
    expect(reduce(steps, { type: 'set-dims', w: 2, d: 3 })).toBe(steps);
    // 큰 부피: 높이 64까지
    const big = make({ variant: 'fixed-volume', volume: 64 });
    expect(big.dims).toEqual([1, 1, 64]);
    expect(reduce(big, { type: 'set-dims', w: 4, d: 4 }).dims).toEqual([4, 4, 4]);
    // 소수 부피
    const prime = make({ variant: 'fixed-volume', volume: 7 });
    expect(reduce(prime, { type: 'set-dims', w: 7, d: 1 }).dims).toEqual([7, 1, 1]);
    expect(reduce(prime, { type: 'set-dims', w: 2, d: 1 })).toBe(prime);
  });

  it('기록: 같은 상자(정렬 비교)는 다시 더하지 않고 겉넓이는 0~9999', () => {
    const f = make({ variant: 'fixed-volume', volume: 24 });
    const a = reduce(f, { type: 'add-log-row' });
    expect(a.logRows).toEqual([{ w: 1, d: 1, h: 24, surface: null }]);
    expect(reduce(a, { type: 'add-log-row' })).toBe(a);
    const b = run(a, [{ type: 'set-dims', w: 2, d: 3 }, { type: 'add-log-row' }]);
    expect(b.logRows).toHaveLength(2);
    // 4×3×2로 놓아도 2×3×4와 같은 상자다
    const c = run(b, [{ type: 'set-dims', w: 4, d: 3 }, { type: 'add-log-row' }]);
    expect(c.logRows).toHaveLength(2);
    // 1×24×1도 1×1×24와 같다
    const d = run(b, [{ type: 'set-dims', w: 1, d: 24 }, { type: 'add-log-row' }]);
    expect(d.logRows).toHaveLength(2);

    const set = reduce(b, { type: 'set-log-surface', row: 1, value: 52 });
    expect(set.logRows[1]?.surface).toBe(52);
    expect(reduce(set, { type: 'set-log-surface', row: 1, value: 52 })).toBe(set);
    expect(reduce(b, { type: 'set-log-surface', row: 1, value: 10000 })).toBe(b);
    expect(reduce(b, { type: 'set-log-surface', row: 1, value: -1 })).toBe(b);
    expect(reduce(b, { type: 'set-log-surface', row: 1, value: 1.5 })).toBe(b);
    expect(reduce(b, { type: 'set-log-surface', row: 2, value: 5 })).toBe(b);
    expect(reduce(set, { type: 'set-log-surface', row: 1, value: null }).logRows[1]?.surface).toBe(
      null,
    );
    expect(reduce(b, { type: 'set-log-surface', row: 0, value: 0 }).logRows[0]?.surface).toBe(0);
    expect(reduce(set, { type: 'remove-log-row', row: 0 }).logRows).toHaveLength(1);
    expect(reduce(set, { type: 'remove-log-row', row: 5 })).toBe(set);

    // 부피 60은 서로 다른 상자가 열 가지다. 모두 더해도 줄은 12줄을 넘지 않고, 다시 더해도 늘지 않는다.
    let s = make({ variant: 'fixed-volume', volume: 60 });
    for (const [w, dd] of boxesOfVolume(60).map(([bw, bd]) => [bw, bd] as const)) {
      s = run(s, [{ type: 'set-dims', w, d: dd }, { type: 'add-log-row' }]);
    }
    expect(s.logRows).toHaveLength(boxesOfVolume(60).length);
    expect(s.logRows.length).toBeLessThanOrEqual(12);
    const again = run(s, [{ type: 'set-dims', w: 2, d: 6 }, { type: 'add-log-row' }]);
    expect(again.logRows).toHaveLength(s.logRows.length);
  });

  it('log:false이거나 steps 변형이면 기록 Action을 무시한다', () => {
    const noLog = make({ variant: 'fixed-volume', log: false });
    expect(reduce(noLog, { type: 'add-log-row' })).toBe(noLog);
    const steps = make();
    expect(reduce(steps, { type: 'add-log-row' })).toBe(steps);
  });

  it('상태는 JSON 왕복이 같고 입력 상태를 바꾸지 않는다', () => {
    const s = run(make(), [
      ...paintAll(),
      ...layerFill(),
      { type: 'rotate-view', dYaw: 15, dPitch: 0 },
    ]);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    const frozen = JSON.stringify(s);
    reduce(s, { type: 'clear-cubes' });
    reduce(s, { type: 'clear-paint' });
    expect(JSON.stringify(s)).toBe(frozen);
    const f = run(make({ variant: 'fixed-volume' }), [
      { type: 'set-dims', w: 2, d: 3 },
      { type: 'add-log-row' },
      { type: 'set-log-surface', row: 0, value: 52 },
    ]);
    expect(JSON.parse(JSON.stringify(f))).toEqual(f);
    expect(JSON.parse(JSON.stringify(observe(f)))).toEqual(observe(f));
  });

  it('다른 모드 Action은 이 모드 상태를 바꾸지 않는다', () => {
    const s = make();
    expect(reduce(s, { type: 'add', x: 0, y: 0 })).toBe(s);
    expect(reduce(s, { type: 'toggle-xray' })).toBe(s);
    expect(reduce(s, { type: 'set-height', x: 0, y: 0, h: 2 })).toBe(s);
    expect(reduce(s, { type: 'set-height', h: 2 })).toBe(s);
    expect(reduce(s, { type: 'toggle-fold' })).toBe(s);
  });
});

describe('E12 surface-volume 관찰값(넓이·부피·개수는 여기에만 있다)', () => {
  it('4×3×2: 칠한 넓이 52, 모두 칠함, 겉넓이 52', () => {
    const init = observe(make());
    expect(init['paintedArea']).toBe(0);
    expect(init['allPainted']).toBe(false);
    expect(init['surfaceArea']).toBe(52);
    expect(init['volume']).toBe(24);
    expect(init['cubeCount']).toBe(0);
    expect(init['fullLayers']).toBe(0);
    expect(init['complete']).toBe(false);
    const done = observe(run(make(), paintAll()));
    expect(done['mode']).toBe('surface-volume');
    expect(done['allPainted']).toBe(true);
    expect(done['paintedCount']).toBe(6);
    expect(done['paintedArea']).toBe(52);
    expect(done['unfolded']).toBe(true);
    expect(done['step']).toBe('paint');
  });

  it('3면만 칠하면 넓이가 26인 경우를 구분한다(보이는 3면)', () => {
    const s = run(make(), [
      { type: 'go-step', step: 'paint' },
      { type: 'toggle-unfold' },
      { type: 'paint-face', face: 'front' },
      { type: 'paint-face', face: 'right' },
      { type: 'paint-face', face: 'top' },
    ]);
    const o = observe(s);
    expect(o['paintedCount']).toBe(3);
    expect(o['paintedArea']).toBe(26);
    expect(o['allPainted']).toBe(false);
  });

  it('층별 채우기: fullLayers 1 → 2, complete', () => {
    let s = run(make(), [{ type: 'go-step', step: 'fill-voxels' }, { type: 'fill-layer' }]);
    expect(observe(s)['fullLayers']).toBe(1);
    expect(observe(s)['cubeCount']).toBe(12);
    expect(observe(s)['complete']).toBe(false);
    s = reduce(s, { type: 'fill-layer' });
    expect(observe(s)['fullLayers']).toBe(2);
    expect(observe(s)['complete']).toBe(true);
    // 윗층 일부만: 가득 찬 층은 아래부터 센다
    const part = run(make(), [
      { type: 'go-step', step: 'fill-voxels' },
      { type: 'fill-layer' },
      { type: 'place-cube', x: 0, y: 0 },
    ]);
    expect(observe(part)['fullLayers']).toBe(1);
    expect(observe(part)['cubeCount']).toBe(13);
  });

  it('정육면체 한 모서리 5: 겉넓이 150, 부피 125', () => {
    const o = observe(make({ solid: { w: 5, d: 5, h: 5 } }));
    expect(o['surfaceArea']).toBe(150);
    expect(o['volume']).toBe(125);
  });

  it('fixed-volume 24: 기록 1×1×24와 2×3×4, 겉넓이 입력', () => {
    let s = make({ variant: 'fixed-volume', volume: 24 });
    s = run(s, [
      { type: 'add-log-row' },
      { type: 'set-dims', w: 2, d: 3 },
      { type: 'add-log-row' },
    ]);
    let o = observe(s);
    expect(o['logDistinct']).toBe(2);
    expect(o['logCorrect']).toEqual([false, false]);
    expect(o['minSurfaceLogged']).toBe(false);
    s = run(s, [
      { type: 'set-log-surface', row: 0, value: 98 },
      { type: 'set-log-surface', row: 1, value: 26 },
    ]);
    o = observe(s);
    expect(o['logCorrect']).toEqual([true, false]);
    expect(o['minSurfaceLogged']).toBe(false);
    s = reduce(s, { type: 'set-log-surface', row: 1, value: 52 });
    o = observe(s);
    expect(o['logCorrect']).toEqual([true, true]);
    expect(o['minSurfaceLogged']).toBe(true);
    expect(o['dims']).toEqual([2, 3, 4]);
    expect(o['solid']).toEqual({ w: 2, d: 3, h: 4 });
    expect(o['logRows']).toEqual([
      { w: 1, d: 1, h: 24, surface: 98 },
      { w: 2, d: 3, h: 4, surface: 52 },
    ]);
  });
});

describe('E12 surface-volume predicate', () => {
  const painted = observe(run(make(), paintAll()));
  const filled = observe(run(make(), layerFill()));

  it('allFacesPainted·paintedFacesIs', () => {
    expect(pred('allFacesPainted', painted)).toBe(true);
    expect(pred('allFacesPainted', observe(make()))).toBe(false);
    expect(pred('paintedFacesIs', painted, { count: 6 })).toBe(true);
    expect(pred('paintedFacesIs', painted, { count: 3 })).toBe(false);
    expect(pred('paintedFacesIs', observe(make()), { count: 0 })).toBe(true);
    expect(pred('paintedFacesIs', painted, {})).toBe(false);
    expect(pred('paintedFacesIs', painted, { count: 'x' })).toBe(false);
    expect(pred('paintedFacesIs', painted, undefined)).toBe(false);
  });

  it('voxelsComplete·fullLayersIs', () => {
    expect(pred('voxelsComplete', filled)).toBe(true);
    expect(pred('voxelsComplete', observe(make()))).toBe(false);
    expect(pred('fullLayersIs', filled, { count: 2 })).toBe(true);
    expect(pred('fullLayersIs', filled, { count: 1 })).toBe(false);
    expect(pred('fullLayersIs', observe(make()), { count: 0 })).toBe(true);
    expect(pred('fullLayersIs', filled, { count: 1.5 })).toBe(false);
  });

  it('logDistinctAtLeast·logAllCorrect·logHasMinSurface·logSurfaceIs', () => {
    const base = make({ variant: 'fixed-volume', volume: 24 });
    expect(pred('logAllCorrect', observe(base))).toBe(false);
    expect(pred('logDistinctAtLeast', observe(base), { count: 0 })).toBe(true);
    const s = run(base, [
      { type: 'add-log-row' },
      { type: 'set-log-surface', row: 0, value: 98 },
      { type: 'set-dims', w: 2, d: 3 },
      { type: 'add-log-row' },
      { type: 'set-log-surface', row: 1, value: 26 },
    ]);
    const o = observe(s);
    expect(pred('logDistinctAtLeast', o, { count: 2 })).toBe(true);
    expect(pred('logDistinctAtLeast', o, { count: 3 })).toBe(false);
    expect(pred('logAllCorrect', o)).toBe(false);
    expect(pred('logHasMinSurface', o)).toBe(false);
    // MC 감지: 3면만 더한 값
    expect(pred('logSurfaceIs', o, { w: 2, d: 3, h: 4, value: 26 })).toBe(true);
    expect(pred('logSurfaceIs', o, { w: 4, d: 3, h: 2, value: 26 })).toBe(true);
    expect(pred('logSurfaceIs', o, { w: 2, d: 3, h: 4, value: 52 })).toBe(false);
    expect(pred('logSurfaceIs', o, { w: 1, d: 2, h: 12, value: 26 })).toBe(false);
    expect(pred('logSurfaceIs', o, { w: 2, d: 3, h: 4 })).toBe(false);
    const fixed = reduce(s, { type: 'set-log-surface', row: 1, value: 52 });
    const o2 = observe(fixed);
    expect(pred('logAllCorrect', o2)).toBe(true);
    expect(pred('logHasMinSurface', o2)).toBe(true);
    // 입력 칸을 비우면 맞지 않다
    const blank = observe(reduce(fixed, { type: 'set-log-surface', row: 0, value: null }));
    expect(pred('logAllCorrect', blank)).toBe(false);
    expect(pred('logHasMinSurface', blank)).toBe(true);
  });

  it('stepIs', () => {
    expect(pred('stepIs', observe(make()), { step: 'rotate' })).toBe(true);
    expect(pred('stepIs', observe(make()), { step: 'paint' })).toBe(false);
    expect(pred('stepIs', painted, { step: 'paint' })).toBe(true);
    expect(pred('stepIs', painted, {})).toBe(false);
    expect(pred('stepIs', painted, 'paint')).toBe(false);
  });

  it('다른 모드 관찰에서는 모두 false다', () => {
    const cubes = observe(createInitialState({}));
    const net = observe(createInitialState({ mode: 'net-fold' }));
    const xray = observe(createInitialState({ mode: 'xray' }));
    const prism = observe(createInitialState({ mode: 'prism-pyramid' }));
    const prismNet = observe(createInitialState({ mode: 'net-fold', target: 'prism' }));
    const argsList = [
      undefined,
      {},
      { count: 0 },
      { count: 6 },
      { step: 'rotate' },
      { w: 1, d: 1, h: 1, value: 6 },
    ];
    for (const name of Object.keys(svPredicates)) {
      for (const obs of [cubes, net, xray, prism, prismNet]) {
        for (const args of argsList) {
          expect(pred(name, obs, args), `${name} ${String(obs['mode'])}`).toBe(false);
        }
      }
    }
  });

  it('다른 모드 predicate도 이 모드 관찰에서는 false다', () => {
    const obs = painted;
    const filledObs = filled;
    const fixedObs = observe(make({ variant: 'fixed-volume' }));
    const argsList = [
      undefined,
      {},
      { count: 0 },
      { count: 1 },
      { count: 2 },
      { count: 6 },
      { kind: 'face' },
      { view: 'top' },
      { value: true },
      { sum: 0 },
    ];
    for (const [name, fn] of Object.entries(predicates)) {
      if (name in svPredicates) continue;
      for (const o of [obs, filledObs, fixedObs]) {
        for (const args of argsList) {
          expect(fn(o, args as never), `${name} ${JSON.stringify(args)}`).toBe(false);
        }
      }
    }
  });
});

describe('E12 surface-volume 이벤트', () => {
  it('이름이 EVENT_NAMES에 있고, 상태가 같으면 이벤트가 없다', () => {
    const s = make();
    expect(emit(s, s)).toEqual([]);
    const events = [
      ...emit(s, reduce(s, { type: 'go-step', step: 'paint' })),
      ...emit(s, reduce(s, { type: 'rotate-view', dYaw: 15, dPitch: 0 })),
    ];
    expect(events.map((e) => e.name)).toEqual(['sv-step-changed', 'view-changed']);
    for (const e of events) expect(EVENT_NAMES).toContain(e.name);
  });

  it('칠하기·펼치기·쌓기·치수·기록 이벤트', () => {
    const base = run(make(), [{ type: 'go-step', step: 'paint' }]);
    const open = reduce(base, { type: 'toggle-unfold' });
    expect(emit(base, open)).toEqual([{ name: 'sv-unfold-toggled', payload: { unfolded: true } }]);
    const p = reduce(open, { type: 'paint-face', face: 'top' });
    expect(emit(open, p)).toEqual([
      { name: 'sv-face-painted', payload: { face: 'top', painted: true } },
    ]);
    expect(emit(p, reduce(p, { type: 'clear-paint' }))).toEqual([
      { name: 'sv-face-painted', payload: { face: 'top', painted: false } },
    ]);

    const fill = run(make(), [{ type: 'go-step', step: 'fill-voxels' }]);
    const placed = reduce(fill, { type: 'place-cube', x: 1, y: 2 });
    expect(emit(fill, placed)).toEqual([{ name: 'sv-cube-placed', payload: { x: 1, y: 2, z: 0 } }]);
    expect(emit(placed, reduce(placed, { type: 'remove-cube', x: 1, y: 2 }))).toEqual([
      { name: 'sv-cube-removed', payload: { x: 1, y: 2, z: 0 } },
    ]);

    const f = make({ variant: 'fixed-volume' });
    const dims = reduce(f, { type: 'set-dims', w: 2, d: 3 });
    expect(emit(f, dims)).toEqual([{ name: 'sv-dims-changed', payload: { w: 2, d: 3, h: 4 } }]);
    const row = reduce(dims, { type: 'add-log-row' });
    expect(emit(dims, row)).toEqual([{ name: 'sv-log-row-added', payload: { w: 2, d: 3, h: 4 } }]);
    expect(emit(row, reduce(row, { type: 'set-log-surface', row: 0, value: 52 }))).toEqual([
      { name: 'sv-log-surface-set', payload: { row: 0 } },
    ]);
    for (const name of [
      'sv-step-changed',
      'sv-unfold-toggled',
      'sv-face-painted',
      'sv-cube-placed',
      'sv-cube-removed',
      'sv-dims-changed',
      'sv-log-row-added',
      'sv-log-surface-set',
    ]) {
      expect(EVENT_NAMES).toContain(name);
    }
  });
});
