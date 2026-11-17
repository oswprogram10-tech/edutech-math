import { describe, expect, it, vi } from 'vitest';
import type { Observation } from '../../../core/engine-sdk';
import { emit, EVENT_NAMES, predicates } from '../events';
import definition from '../index';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { LatheConfig, LatheState, SolidAction, SolidConfig } from '../types';

function make(config: Partial<LatheConfig> = {}): LatheState {
  return createInitialState({ mode: 'lathe', ...config });
}

function run(state: LatheState, actions: readonly SolidAction[]): LatheState {
  return actions.reduce<LatheState>((s, a) => reduce(s, a), state);
}

function pred(name: string, obs: Observation, args?: unknown): boolean {
  const fn = predicates[name];
  expect(fn, name).toBeDefined();
  return fn?.(obs, args as never) ?? false;
}

const cut = { crossSection: { planes: ['perpendicular', 'through-axis'] } } as const;
const pick = (profile: 'rectangle' | 'right-triangle' | 'semicircle'): SolidAction => ({
  type: 'lt-pick-profile',
  profile,
});
const attach = (edge: string): SolidAction => ({
  type: 'lt-attach',
  edge: edge as never,
});
const angle = (a: number): SolidAction => ({ type: 'lt-set-angle', angle: a });

function built(
  profile: 'rectangle' | 'right-triangle' | 'semicircle',
  edge: string,
  config: Partial<LatheConfig> = cut,
): LatheState {
  return run(make(config), [pick(profile), attach(edge), angle(360)]);
}

describe('E12 lathe 설정·초기 상태', () => {
  it('기본값: 도형 셋, 레이저 없음, 단면 보임, 회전 손잡이 보임', () => {
    const s = make({ axis: 'vertical' });
    expect(s.settings.profiles).toEqual(['rectangle', 'right-triangle', 'semicircle']);
    expect(s.settings.planes).toEqual([]);
    expect(s.settings.showSection).toBe(true);
    expect(s.settings.rotateHandle).toBe(true);
    expect(s.settings.preset).toBeNull();
    expect(s).toMatchObject({ profile: null, edge: null, angle: 0, laser: null });
    expect(s.view).toEqual({ yaw: 0, pitch: 15 });
  });

  it('custom과 알 수 없는 도형은 경고하고 무시한다, 다 무시되면 기본 셋이다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = make({ profiles: ['semicircle', 'custom', 'bogus', 'semicircle'] });
    expect(s.settings.profiles).toEqual(['semicircle']);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(make({ profiles: ['custom'] }).settings.profiles).toHaveLength(3);
    expect(make({ profiles: [] }).settings.profiles).toHaveLength(3);
    warn.mockRestore();
  });

  it('crossSection: false면 면 없음, planes 생략이면 둘 다, 일부만 줄 수 있다', () => {
    expect(make({ crossSection: false }).settings.planes).toEqual([]);
    expect(make({ crossSection: {} }).settings.planes).toEqual(['perpendicular', 'through-axis']);
    expect(
      make({ crossSection: { planes: ['through-axis', 'through-axis'] } }).settings.planes,
    ).toEqual(['through-axis']);
  });

  it('preset이면 처음부터 붙여 360°로 시작한다', () => {
    const s = make({ preset: { profile: 'right-triangle', edge: 'leg-vertical' }, ...cut });
    expect(s).toMatchObject({ profile: 'right-triangle', edge: 'leg-vertical', angle: 360 });
    expect(observe(s)).toMatchObject({ complete: true, solid: 'cone' });
  });

  it('맞지 않는 preset은 경고하고 무시한다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = make({ preset: { profile: 'rectangle', edge: 'hypotenuse' } });
    expect(s.profile).toBeNull();
    expect(s.angle).toBe(0);
    warn.mockRestore();
  });

  it('엔진 정의에 lathe 모드와 힌트 오버레이가 등록돼 있다', () => {
    expect(definition.modes).toContain('lathe');
    expect(Object.keys(definition.overlays ?? {})).toEqual(
      expect.arrayContaining(['axis-compare', 'n-grow']),
    );
  });
});

describe('E12 lathe Action', () => {
  it('lt-pick-profile: 허용된 도형만, 변과 각을 비운다', () => {
    const s = make({ profiles: ['rectangle', 'semicircle'] });
    expect(reduce(s, pick('right-triangle'))).toBe(s);
    const picked = reduce(s, pick('rectangle'));
    expect(picked).toMatchObject({ profile: 'rectangle', edge: null, angle: 0 });
    // 같은 도형을 다시 골라도(아직 붙이기 전) 그대로다
    expect(reduce(picked, pick('rectangle'))).toBe(picked);
    const turned = run(picked, [attach('long'), angle(120)]);
    const repicked = reduce(turned, pick('semicircle'));
    expect(repicked).toMatchObject({ profile: 'semicircle', edge: null, angle: 0, laser: null });
  });

  it('lt-attach: 지금 도형에 있는 변만, 각을 0으로 한다', () => {
    const s = make();
    expect(reduce(s, attach('long'))).toBe(s); // 도형을 안 골랐다
    const picked = reduce(s, pick('rectangle'));
    expect(reduce(picked, attach('hypotenuse'))).toBe(picked);
    expect(reduce(picked, { type: 'lt-attach', edge: 'bogus' as never })).toBe(picked);
    const attached = reduce(picked, attach('short'));
    expect(attached).toMatchObject({ edge: 'short', angle: 0 });
    expect(reduce(attached, attach('short'))).toBe(attached);
    const rotated = reduce(attached, angle(90));
    expect(reduce(rotated, attach('short'))).toMatchObject({ edge: 'short', angle: 0 });
    expect(reduce(rotated, attach('long'))).toMatchObject({ edge: 'long', angle: 0 });
  });

  it('lt-set-angle: 붙인 뒤에만, 0~360을 30 단위로 맞춘다', () => {
    const picked = reduce(make(), pick('semicircle'));
    expect(reduce(picked, angle(90))).toBe(picked); // 변을 안 붙였다
    const s = reduce(picked, attach('diameter'));
    expect(reduce(s, angle(44)).angle).toBe(30);
    expect(reduce(s, angle(46)).angle).toBe(60);
    expect(reduce(s, angle(-20)).angle).toBe(0);
    expect(reduce(s, angle(500)).angle).toBe(360);
    expect(reduce(s, angle(0))).toBe(s);
    expect(reduce(s, angle(Number.NaN))).toBe(s);
    expect(reduce(s, { type: 'lt-set-angle', angle: '90' as never })).toBe(s);
    const at90 = reduce(s, angle(90));
    expect(reduce(at90, angle(100))).toBe(at90); // 같은 30 단위
  });

  it('lt-reset: 비운다, preset이면 preset으로 되돌린다', () => {
    const s = built('rectangle', 'long');
    expect(reduce(s, { type: 'lt-reset' })).toMatchObject({
      profile: null,
      edge: null,
      angle: 0,
    });
    const empty = make();
    expect(reduce(empty, { type: 'lt-reset' })).toBe(empty);
    const pre = make({ preset: { profile: 'semicircle', edge: 'diameter' }, ...cut });
    const changed = run(pre, [
      { type: 'lt-set-laser', plane: 'perpendicular', t: 3 },
      pick('rectangle'),
    ]);
    expect(changed.profile).toBe('rectangle');
    const back = reduce(changed, { type: 'lt-reset' });
    expect(back).toMatchObject({
      profile: 'semicircle',
      edge: 'diameter',
      angle: 360,
      laser: null,
    });
    expect(reduce(pre, { type: 'lt-reset' })).toBe(pre);
  });

  it('lt-set-laser: 완성 전·없는 면은 무시한다', () => {
    const half = run(make(cut), [pick('rectangle'), attach('long'), angle(180)]);
    expect(reduce(half, { type: 'lt-set-laser', plane: 'perpendicular', t: 5 })).toBe(half);
    const full = built('rectangle', 'long');
    expect(reduce(full, { type: 'lt-set-laser', plane: 'perpendicular', t: 5 }).laser).toEqual({
      plane: 'perpendicular',
      t: 5,
    });
    const noPlane = built('rectangle', 'long', { crossSection: { planes: ['perpendicular'] } });
    expect(reduce(noPlane, { type: 'lt-set-laser', plane: 'through-axis', t: 0 })).toBe(noPlane);
    const off = built('rectangle', 'long', { crossSection: false });
    expect(reduce(off, { type: 'lt-set-laser', plane: 'perpendicular', t: 5 })).toBe(off);
    expect(reduce(full, { type: 'lt-set-laser', plane: 'bogus' as never, t: 5 })).toBe(full);
    expect(reduce(full, { type: 'lt-set-laser', plane: 'perpendicular', t: Number.NaN })).toBe(
      full,
    );
  });

  it('lt-set-laser: t는 0~10 정수로 맞추고, 축을 포함하면 t를 무시한다', () => {
    const full = built('right-triangle', 'leg-vertical');
    const at = (t: number) => reduce(full, { type: 'lt-set-laser', plane: 'perpendicular', t });
    expect(at(-3).laser?.t).toBe(0);
    expect(at(14).laser?.t).toBe(10);
    expect(at(4.6).laser?.t).toBe(5);
    const h3 = at(3);
    expect(reduce(h3, { type: 'lt-set-laser', plane: 'perpendicular', t: 3 })).toBe(h3);
    const v = reduce(h3, { type: 'lt-set-laser', plane: 'through-axis', t: 9 });
    expect(v.laser).toEqual({ plane: 'through-axis', t: 3 });
    expect(reduce(v, { type: 'lt-set-laser', plane: 'through-axis', t: 0 })).toBe(v);
    const first = reduce(full, { type: 'lt-set-laser', plane: 'through-axis', t: 9 });
    expect(first.laser?.plane).toBe('through-axis');
  });

  it('lt-clear-laser, 그리고 다시 돌리면 레이저가 꺼진다', () => {
    const lit = reduce(built('rectangle', 'long'), {
      type: 'lt-set-laser',
      plane: 'perpendicular',
      t: 5,
    });
    expect(reduce(lit, { type: 'lt-clear-laser' }).laser).toBeNull();
    const nolaser = reduce(lit, { type: 'lt-clear-laser' });
    expect(reduce(nolaser, { type: 'lt-clear-laser' })).toBe(nolaser);
    expect(reduce(lit, angle(300)).laser).toBeNull();
    expect(reduce(lit, attach('short')).laser).toBeNull();
    expect(reduce(lit, pick('semicircle')).laser).toBeNull();
  });

  it('set-view·rotate-view: 완성 뒤에만, pitch는 -30~60', () => {
    const half = run(make(), [pick('rectangle'), attach('long'), angle(180)]);
    expect(reduce(half, { type: 'rotate-view', dYaw: 15, dPitch: 0 })).toBe(half);
    expect(reduce(half, { type: 'set-view', yaw: 45, pitch: 30 })).toBe(half);
    const s = built('rectangle', 'long');
    expect(reduce(s, { type: 'rotate-view', dYaw: 15, dPitch: 0 }).view).toEqual({
      yaw: 15,
      pitch: 15,
    });
    expect(reduce(s, { type: 'set-view', yaw: 50, pitch: 30 }).view).toEqual({
      yaw: 45,
      pitch: 30,
    });
    expect(reduce(s, { type: 'set-view', yaw: 0, pitch: 90 }).view.pitch).toBe(60);
    expect(reduce(s, { type: 'set-view', yaw: 0, pitch: -90 }).view.pitch).toBe(-30);
    expect(reduce(s, { type: 'rotate-view', dYaw: 0, dPitch: 0 })).toBe(s);
    expect(reduce(s, { type: 'rotate-view', dYaw: Number.NaN, dPitch: Number.NaN })).toBe(s);
    const top = reduce(s, { type: 'set-view', yaw: 0, pitch: 60 });
    expect(reduce(top, { type: 'rotate-view', dYaw: 0, dPitch: 15 })).toBe(top);
  });

  it('다른 모드의 Action은 무시한다', () => {
    const s = built('rectangle', 'long');
    expect(reduce(s, { type: 'add', x: 0, y: 0 })).toBe(s);
    expect(reduce(s, { type: 'ss-play' })).toBe(s);
    expect(reduce(s, { type: 'toggle-xray' })).toBe(s);
  });

  it('상태는 JSON 왕복이 같다', () => {
    const s = reduce(built('semicircle', 'diameter'), {
      type: 'lt-set-laser',
      plane: 'perpendicular',
      t: 7,
    });
    const copy = JSON.parse(JSON.stringify(s)) as LatheState;
    expect(copy).toEqual(s);
    expect(observe(copy)).toEqual(observe(s));
    const again = JSON.parse(JSON.stringify(observe(s))) as Observation;
    expect(again).toEqual(observe(s));
  });

  it('입력 상태를 바꾸지 않는다', () => {
    const s = built('rectangle', 'long');
    const frozen = JSON.stringify(s);
    reduce(s, angle(30));
    reduce(s, { type: 'lt-set-laser', plane: 'perpendicular', t: 4 });
    reduce(s, { type: 'lt-reset' });
    expect(JSON.stringify(s)).toBe(frozen);
  });
});

describe('E12 lathe Observation', () => {
  it('완성되기 전에는 solid·section이 null이다', () => {
    const s = run(make(cut), [pick('right-triangle'), attach('hypotenuse'), angle(330)]);
    expect(observe(s)).toEqual({
      mode: 'lathe',
      profile: 'right-triangle',
      edge: 'hypotenuse',
      angle: 330,
      complete: false,
      solid: null,
      laser: null,
      section: null,
    });
  });

  it.each([
    ['rectangle', 'long', 'cylinder'],
    ['rectangle', 'short', 'cylinder'],
    ['right-triangle', 'leg-vertical', 'cone'],
    ['right-triangle', 'leg-horizontal', 'cone'],
    ['right-triangle', 'hypotenuse', 'double-cone'],
    ['semicircle', 'diameter', 'sphere'],
  ] as const)('%s + %s를 한 바퀴 돌리면 %s', (profile, edge, solid) => {
    expect(observe(built(profile, edge))).toMatchObject({ complete: true, solid, angle: 360 });
  });

  it('레이저를 켜면 단면이 나온다(표와 같다)', () => {
    const cone = built('right-triangle', 'leg-vertical');
    const lit = (plane: 'perpendicular' | 'through-axis', t: number) =>
      observe(reduce(cone, { type: 'lt-set-laser', plane, t }));
    expect(lit('perpendicular', 5)).toMatchObject({ section: 'circle', laser: { t: 5 } });
    expect(lit('perpendicular', 10)).toMatchObject({ section: 'point' });
    expect(lit('through-axis', 5)).toMatchObject({ section: 'isosceles-triangle' });
    const cylinder = reduce(built('rectangle', 'long'), {
      type: 'lt-set-laser',
      plane: 'through-axis',
      t: 0,
    });
    expect(observe(cylinder)).toMatchObject({ section: 'rectangle' });
  });
});

describe('E12 lathe predicate', () => {
  it('solidIs: lathe 관찰이면 입체 이름으로 판정한다', () => {
    const obs = observe(built('right-triangle', 'hypotenuse'));
    expect(pred('solidIs', obs, { kind: 'double-cone' })).toBe(true);
    expect(pred('solidIs', obs, { kind: 'cone' })).toBe(false);
    expect(pred('solidIs', obs, { kind: 'bogus' })).toBe(false);
    expect(pred('solidIs', obs, undefined)).toBe(false);
    expect(pred('solidIs', observe(make()), { kind: 'cone' })).toBe(false);
  });

  it('solidIs: prism-pyramid 관찰은 지금까지처럼 판정한다', () => {
    const prism = observe(
      createInitialState({ mode: 'prism-pyramid', initial: { sides: 6, height: 2 } }),
    );
    expect(prism['mode']).toBe('prism-pyramid');
    expect(pred('solidIs', prism, { kind: 'prism' })).toBe(true);
    expect(pred('solidIs', prism, { kind: 'prism', n: 6 })).toBe(true);
    expect(pred('solidIs', prism, { kind: 'prism', n: 5 })).toBe(false);
    expect(pred('solidIs', prism, { kind: 'pyramid' })).toBe(false);
    // lathe의 입체 이름은 prism 관찰에서 참이 되지 않는다
    expect(pred('solidIs', prism, { kind: 'cone' })).toBe(false);
    expect(pred('solidIs', prism, { kind: 'cylinder' })).toBe(false);
  });

  it('profileAttached: 도형(과 변)', () => {
    const obs = observe(run(make(), [pick('right-triangle'), attach('hypotenuse')]));
    expect(pred('profileAttached', obs, { profile: 'right-triangle' })).toBe(true);
    expect(pred('profileAttached', obs, { profile: 'right-triangle', edge: 'hypotenuse' })).toBe(
      true,
    );
    expect(pred('profileAttached', obs, { profile: 'right-triangle', edge: 'leg-vertical' })).toBe(
      false,
    );
    expect(pred('profileAttached', obs, { profile: 'rectangle' })).toBe(false);
    expect(pred('profileAttached', obs, { profile: 'bogus' })).toBe(false);
    expect(pred('profileAttached', obs, { profile: 'right-triangle', edge: 'bogus' })).toBe(false);
    expect(pred('profileAttached', obs, undefined)).toBe(false);
    const picked = observe(reduce(make(), pick('right-triangle')));
    expect(pred('profileAttached', picked, { profile: 'right-triangle' })).toBe(false);
  });

  it('latheComplete: 360°에서만', () => {
    const s = run(make(), [pick('semicircle'), attach('diameter'), angle(330)]);
    expect(pred('latheComplete', observe(s))).toBe(false);
    expect(pred('latheComplete', observe(reduce(s, angle(360))))).toBe(true);
    expect(pred('latheComplete', observe(make()))).toBe(false);
  });

  it('sectionIs·laserPlaneIs', () => {
    const cone = built('right-triangle', 'leg-vertical');
    const h5 = observe(reduce(cone, { type: 'lt-set-laser', plane: 'perpendicular', t: 5 }));
    expect(pred('sectionIs', h5, { shape: 'circle' })).toBe(true);
    expect(pred('sectionIs', h5, { shape: 'rectangle' })).toBe(false);
    expect(pred('sectionIs', h5, { shape: 'bogus' })).toBe(false);
    expect(pred('sectionIs', h5, undefined)).toBe(false);
    expect(pred('laserPlaneIs', h5, { plane: 'perpendicular' })).toBe(true);
    expect(pred('laserPlaneIs', h5, { plane: 'through-axis' })).toBe(false);
    expect(pred('laserPlaneIs', h5, { plane: 'bogus' })).toBe(false);
    const none = observe(cone);
    expect(pred('sectionIs', none, { shape: 'circle' })).toBe(false);
    expect(pred('laserPlaneIs', none, { plane: 'perpendicular' })).toBe(false);
  });

  it('lathe predicate는 다른 모드 관찰에서 모두 false다', () => {
    const others: Observation[] = [
      observe(createInitialState({})),
      observe(createInitialState({ mode: 'net-fold' } as SolidConfig)),
      observe(createInitialState({ mode: 'xray' } as SolidConfig)),
      observe(createInitialState({ mode: 'prism-pyramid' } as SolidConfig)),
      observe(createInitialState({ mode: 'surface-volume' } as SolidConfig)),
      observe(createInitialState({ mode: 'shapes-sort' } as SolidConfig)),
    ];
    const names: readonly [string, unknown][] = [
      ['solidIs', { kind: 'cylinder' }],
      ['profileAttached', { profile: 'rectangle' }],
      ['latheComplete', undefined],
      ['sectionIs', { shape: 'circle' }],
      ['laserPlaneIs', { plane: 'perpendicular' }],
    ];
    for (const obs of others) {
      for (const [name, args] of names) {
        expect(pred(name, obs, args), `${String(obs['mode'])}/${name}`).toBe(false);
      }
    }
  });

  it('다른 모드 predicate는 lathe 관찰에서 모두 false다', () => {
    const lathe = ['solidIs', 'profileAttached', 'latheComplete', 'sectionIs', 'laserPlaneIs'];
    const obs = observe(built('rectangle', 'long'));
    const argSets: unknown[] = [
      undefined,
      {},
      { kind: 'cylinder' },
      { kind: 'prism', n: 3 },
      { n: 1 },
      { shape: 'circle' },
    ];
    for (const name of Object.keys(predicates)) {
      if (lathe.includes(name)) continue;
      for (const args of argSets) {
        expect(pred(name, obs, args), `${name} ${JSON.stringify(args)}`).toBe(false);
      }
    }
  });
});

describe('E12 lathe 이벤트', () => {
  it('EVENT_NAMES에 네 이벤트가 들어 있다', () => {
    for (const name of ['profile-picked', 'edge-attached', 'angle-changed', 'laser-set']) {
      expect(EVENT_NAMES).toContain(name);
    }
  });

  it('profile-picked·edge-attached·angle-changed·laser-set', () => {
    const s0 = make(cut);
    const s1 = reduce(s0, pick('right-triangle'));
    expect(emit(s0, s1)).toEqual([
      { name: 'profile-picked', payload: { profile: 'right-triangle' } },
    ]);
    const s2 = reduce(s1, attach('hypotenuse'));
    expect(emit(s1, s2)).toEqual([
      { name: 'edge-attached', payload: { profile: 'right-triangle', edge: 'hypotenuse' } },
    ]);
    const s3 = reduce(s2, angle(120));
    expect(emit(s2, s3)).toEqual([
      { name: 'angle-changed', payload: { angle: 120, complete: false } },
    ]);
    const s4 = reduce(s3, angle(360));
    expect(emit(s3, s4)).toEqual([
      { name: 'angle-changed', payload: { angle: 360, complete: true } },
    ]);
    const s5 = reduce(s4, { type: 'lt-set-laser', plane: 'perpendicular', t: 5 });
    expect(emit(s4, s5)).toEqual([
      { name: 'laser-set', payload: { plane: 'perpendicular', t: 5 } },
    ]);
    const s6 = reduce(s5, { type: 'lt-set-laser', plane: 'through-axis', t: 5 });
    expect(emit(s5, s6)).toEqual([{ name: 'laser-set', payload: { plane: 'through-axis', t: 5 } }]);
  });

  it('붙이기·고르기로 각이 0이 되는 것은 angle-changed를 내지 않는다', () => {
    const turned = run(make(), [pick('rectangle'), attach('long'), angle(150)]);
    const reattached = reduce(turned, attach('short'));
    expect(emit(turned, reattached).map((e) => e.name)).toEqual(['edge-attached']);
    const repicked = reduce(turned, pick('semicircle'));
    expect(emit(turned, repicked).map((e) => e.name)).toEqual(['profile-picked']);
  });

  it('바뀐 것이 없거나 시점만 바뀌면 이벤트가 없다', () => {
    const s = built('rectangle', 'long');
    expect(emit(s, s)).toEqual([]);
    const rotated = reduce(s, { type: 'rotate-view', dYaw: 15, dPitch: 0 });
    expect(emit(s, rotated)).toEqual([]);
    const cleared = reduce(reduce(s, { type: 'lt-set-laser', plane: 'perpendicular', t: 5 }), {
      type: 'lt-clear-laser',
    });
    expect(
      emit(reduce(s, { type: 'lt-set-laser', plane: 'perpendicular', t: 5 }), cleared),
    ).toEqual([]);
  });
});
