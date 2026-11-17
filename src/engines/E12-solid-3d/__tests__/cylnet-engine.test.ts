import { describe, expect, it } from 'vitest';
import type { Observation } from '../../../core/engine-sdk';
import { emit, EVENT_NAMES, predicates } from '../events';
import definition from '../index';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { CylinderNetConfig, CylinderNetState, SolidAction, SolidState } from '../types';

function make(config: Partial<CylinderNetConfig> = {}): CylinderNetState {
  return createInitialState({ mode: 'net-fold', target: 'cylinder', ...config });
}

function run(state: CylinderNetState, actions: readonly SolidAction[]): CylinderNetState {
  return actions.reduce<CylinderNetState>((s, a) => reduce(s, a), state);
}

function pred(name: string, obs: Observation, args?: unknown): boolean {
  const fn = predicates[name];
  expect(fn, name).toBeDefined();
  return fn?.(obs, args as never) ?? false;
}

const assemble: SolidAction = { type: 'cn-set-step', step: 'assemble' };
const width = (by: number): SolidAction => ({ type: 'cn-width', by });
const radius = (by: number): SolidAction => ({ type: 'cn-radius', by });
const height = (by: number): SolidAction => ({ type: 'cn-height', by });
const roll = (by: number): SolidAction => ({ type: 'cn-roll', by });
const times = (n: number, action: SolidAction): SolidAction[] =>
  Array.from({ length: n }, () => action);

/** 반지름 2, 세로 5, 가로 12.6으로 맞춘 조립 단계 상태. */
function matched(): CylinderNetState {
  // 처음: 가로 6, 반지름 1, 세로 3 → 가로 +1 x6, +0.1 x6, 반지름 +0.5 x2, 세로 +0.5 x4
  return run(make(), [
    assemble,
    ...times(6, width(10)),
    ...times(6, width(1)),
    ...times(2, radius(1)),
    ...times(4, height(1)),
  ]);
}

describe('E12 cylinder-net 초기 상태', () => {
  it('기본값', () => {
    const s = make();
    expect(s).toMatchObject({
      mode: 'cylinder-net',
      step: 'roll',
      rollEighths: 0,
      widthTenths: 60,
      pieceRadiusHalves: 2,
      pieceHeightHalves: 6,
      folded: false,
      viewYaw: 0,
      settings: {
        radiusHalves: 4,
        heightHalves: 10,
        pi: '3.14',
        steps: ['roll', 'assemble'],
        rollPaint: true,
        showDims: true,
      },
    });
  });

  it('설정을 읽고, 범위 밖 값은 기본값으로 돌린다', () => {
    const s = make({ radius: 2.5, height: 7, pi: '3.1', steps: ['assemble'], rollPaint: false });
    expect(s.settings).toMatchObject({
      radiusHalves: 5,
      heightHalves: 14,
      pi: '3.1',
      steps: ['assemble'],
      rollPaint: false,
    });
    expect(s.step).toBe('assemble');
    expect(make({ radius: 6 }).settings.radiusHalves).toBe(4);
    expect(make({ radius: 0.7 }).settings.radiusHalves).toBe(4);
    expect(make({ height: 11 }).settings.heightHalves).toBe(10);
    expect(make({ height: 2.5 }).settings.heightHalves).toBe(10);
    expect(make({ pi: '3.15' }).settings.pi).toBe('3.14');
    expect(make({ steps: [] }).step).toBeNull();
  });

  it('start 크기를 읽고, 안 맞으면 기본값을 쓴다', () => {
    const s = make({ start: { width: '12.5', radius: '2', height: '5' } });
    expect(s).toMatchObject({ widthTenths: 125, pieceRadiusHalves: 4, pieceHeightHalves: 10 });
    const bad = make({ start: { width: '0.05', radius: '11', height: '5.25' } });
    expect(bad).toMatchObject({ widthTenths: 60, pieceRadiusHalves: 2, pieceHeightHalves: 6 });
  });

  it('editablePieces는 읽기만 하고 쓰지 않는다', () => {
    const a = make({ editablePieces: ['circle', 'circle', 'rect'] });
    expect(a).toEqual(make());
  });
});

describe('E12 cylinder-net 굴리기', () => {
  it('cn-roll +-1은 0~8로 자른다', () => {
    let s = make();
    expect(run(s, [roll(-1)])).toBe(s);
    s = run(s, times(3, roll(1)));
    expect(s.rollEighths).toBe(3);
    s = run(s, times(10, roll(1)));
    expect(s.rollEighths).toBe(8);
    expect(run(s, [roll(1)])).toBe(s);
    expect(run(s, [roll(-1)]).rollEighths).toBe(7);
  });

  it('by가 +-1이 아니면 무시한다', () => {
    const s = make();
    expect(run(s, [roll(2)])).toBe(s);
    expect(run(s, [roll(0)])).toBe(s);
  });

  it('cn-roll-full은 8로, 이미 8이면 그대로, cn-roll-reset은 0으로', () => {
    const s = run(make(), [{ type: 'cn-roll-full' }]);
    expect(s.rollEighths).toBe(8);
    expect(run(s, [{ type: 'cn-roll-full' }])).toBe(s);
    expect(run(s, [{ type: 'cn-roll-reset' }]).rollEighths).toBe(0);
    const zero = make();
    expect(run(zero, [{ type: 'cn-roll-reset' }])).toBe(zero);
  });

  it('roll 단계가 아니면 굴려지지 않는다', () => {
    const s = run(make(), [assemble]);
    expect(run(s, [roll(1)])).toBe(s);
    expect(run(s, [{ type: 'cn-roll-full' }])).toBe(s);
  });

  it('rollPaint가 false여도 rollEighths는 센다', () => {
    const s = run(make({ rollPaint: false }), times(2, roll(1)));
    expect(s.rollEighths).toBe(2);
  });
});

describe('E12 cylinder-net 단계·조절·접기', () => {
  it('cn-set-step: 설정에 없는 단계는 무시한다', () => {
    const only = make({ steps: ['roll'] });
    expect(run(only, [assemble])).toBe(only);
    expect(run(make(), [assemble]).step).toBe('assemble');
    const none = make({ steps: [] });
    expect(run(none, [assemble])).toBe(none);
  });

  it('조절은 assemble 단계에서만 된다', () => {
    const s = make();
    expect(run(s, [width(1)])).toBe(s);
    expect(run(s, [radius(1)])).toBe(s);
    expect(run(s, [height(1)])).toBe(s);
    expect(run(s, [{ type: 'cn-fold' }])).toBe(s);
  });

  it('cn-width는 +-10, +-1만, 범위 10~400으로 자른다', () => {
    const s0 = run(make(), [assemble]);
    expect(run(s0, [width(10)]).widthTenths).toBe(70);
    expect(run(s0, [width(-1)]).widthTenths).toBe(59);
    expect(run(s0, [width(5)])).toBe(s0);
    const low = run(s0, times(8, width(-10)));
    expect(low.widthTenths).toBe(10);
    expect(run(low, [width(-1)])).toBe(low);
    const high = run(s0, times(40, width(10)));
    expect(high.widthTenths).toBe(400);
    expect(run(high, [width(10)])).toBe(high);
  });

  it('cn-radius는 1~10, cn-height는 2~20으로 자른다', () => {
    const s0 = run(make(), [assemble]);
    expect(run(s0, times(3, radius(-1))).pieceRadiusHalves).toBe(1);
    expect(run(s0, times(12, radius(1))).pieceRadiusHalves).toBe(10);
    expect(run(s0, times(10, height(-1))).pieceHeightHalves).toBe(2);
    expect(run(s0, times(20, height(1))).pieceHeightHalves).toBe(20);
    expect(run(s0, [radius(2)])).toBe(s0);
    expect(run(s0, [height(0)])).toBe(s0);
  });

  it('접기·펴기, 접은 동안은 가로·반지름·세로를 바꿀 수 없다', () => {
    const s0 = run(make(), [assemble]);
    const folded = run(s0, [{ type: 'cn-fold' }]);
    expect(folded.folded).toBe(true);
    expect(run(folded, [{ type: 'cn-fold' }])).toBe(folded);
    expect(run(folded, [width(1)])).toBe(folded);
    expect(run(folded, [radius(1)])).toBe(folded);
    expect(run(folded, [height(1)])).toBe(folded);
    const open = run(folded, [{ type: 'cn-unfold' }]);
    expect(open.folded).toBe(false);
    expect(run(open, [{ type: 'cn-unfold' }])).toBe(open);
    expect(run(open, [width(1)]).widthTenths).toBe(61);
  });

  it('cn-rotate-view는 15 단위로 0~345를 돈다', () => {
    const s = make();
    expect(run(s, [{ type: 'cn-rotate-view', by: 15 }]).viewYaw).toBe(15);
    expect(run(s, [{ type: 'cn-rotate-view', by: -15 }]).viewYaw).toBe(345);
    expect(run(s, [{ type: 'cn-rotate-view', by: 7 }])).toBe(s);
    expect(run(s, [{ type: 'cn-rotate-view', by: 0 }])).toBe(s);
  });

  it('다른 모드 Action은 무시한다', () => {
    const s = make();
    expect(reduce(s, { type: 'toggle-fold' })).toBe(s);
  });
});

describe('E12 cylinder-net 관찰', () => {
  it('처음 관찰의 모양', () => {
    expect(observe(make())).toEqual({
      mode: 'cylinder-net',
      radius: '2',
      height: '5',
      pi: '3.14',
      step: 'roll',
      rollEighths: 0,
      rolledFull: false,
      net: { width: '6', radius: '1', height: '3' },
      widthFits: false,
      radiusMatches: false,
      heightMatches: false,
      valid: false,
      folded: false,
      seam: 'gap',
    });
  });

  it('반지름 2, 세로 5, 가로 12.6이면 valid이고 seam은 closed다', () => {
    expect(observe(matched())).toMatchObject({
      net: { width: '12.6', radius: '2', height: '5' },
      widthFits: true,
      radiusMatches: true,
      heightMatches: true,
      valid: true,
      seam: 'closed',
    });
  });

  it('가로 4는 gap, 20은 overlap', () => {
    const base = run(make(), [assemble, ...times(2, radius(1))]);
    const w4 = run(base, times(2, width(-10)));
    expect(observe(w4)).toMatchObject({ net: { width: '4' }, seam: 'gap' });
    const w20 = run(base, times(14, width(10)));
    expect(observe(w20)).toMatchObject({ net: { width: '20' }, seam: 'overlap' });
  });

  it('8번 굴리면 rolledFull', () => {
    const s = run(make(), times(8, roll(1)));
    expect(observe(s)).toMatchObject({ rollEighths: 8, rolledFull: true });
  });

  it('pi 설정이 원주에 반영된다(반지름 2, pi 3 이면 가로 12가 맞음)', () => {
    const s = run(make({ pi: '3', radius: 2, height: 5 }), [
      assemble,
      ...times(6, width(10)),
      ...times(2, radius(1)),
      ...times(4, height(1)),
    ]);
    expect(observe(s)).toMatchObject({ net: { width: '12' }, widthFits: true, valid: true });
    // 같은 가로 12.6은 pi 3.14에서 맞고 pi 3에서는 틀린다.
    const off = run(s, times(6, width(1)));
    expect(observe(off)).toMatchObject({ net: { width: '12.6' }, widthFits: false });
  });
});

describe('E12 cylinder-net predicate', () => {
  it('rollComplete, netValid, netFoldedClosed, netWidthIs', () => {
    const open = observe(matched());
    expect(pred('rollComplete', open)).toBe(false);
    expect(pred('netValid', open)).toBe(true);
    expect(pred('netFoldedClosed', open)).toBe(false);
    expect(pred('netWidthIs', open, { value: '12.6' })).toBe(true);
    expect(pred('netWidthIs', open, { value: '12.60' })).toBe(true);
    expect(pred('netWidthIs', open, { value: '4' })).toBe(false);

    const folded = observe(run(matched(), [{ type: 'cn-fold' }]));
    expect(pred('netFoldedClosed', folded)).toBe(true);

    const full = observe(run(make(), [{ type: 'cn-roll-full' }]));
    expect(pred('rollComplete', full)).toBe(true);
    expect(pred('netValid', full)).toBe(false);
  });

  it('접었어도 맞지 않으면 netFoldedClosed가 아니다', () => {
    const s = run(make(), [assemble, { type: 'cn-fold' }]);
    expect(pred('netFoldedClosed', observe(s))).toBe(false);
  });

  it('netWidthIs: 지름(4)을 넣은 조각을 감지한다', () => {
    const s = run(make(), [assemble, ...times(2, width(-10))]);
    expect(pred('netWidthIs', observe(s), { value: '4' })).toBe(true);
  });

  it('잘못된 인자는 false다', () => {
    const obs = observe(matched());
    for (const args of [undefined, null, {}, { value: 12.6 }, { value: 'abc' }, { value: '' }]) {
      expect(pred('netWidthIs', obs, args), JSON.stringify(args)).toBe(false);
    }
  });

  it('다른 모드 predicate는 이 관찰에서 모두 false다', () => {
    const mine = ['rollComplete', 'netValid', 'netFoldedClosed', 'netWidthIs'];
    const obs = observe(run(matched(), [{ type: 'cn-fold' }]));
    const argSets: unknown[] = [
      undefined,
      {},
      { kind: 'cylinder' },
      { kind: 'prism', n: 3 },
      { n: 1 },
      { shape: 'circle' },
      { of: 'a' },
    ];
    for (const name of Object.keys(predicates)) {
      if (mine.includes(name)) continue;
      for (const args of argSets) {
        expect(pred(name, obs, args), `${name} ${JSON.stringify(args)}`).toBe(false);
      }
    }
  });

  it('이 모드 predicate는 다른 모드 관찰에서 false다', () => {
    const others: Observation[] = [
      { mode: 'net-fold', valid: true, folded: true, rolledFull: true, net: { width: '12.6' } },
      { mode: 'lathe', valid: true, folded: true, rolledFull: true, net: { width: '12.6' } },
      { mode: 'prism-net', valid: true, folded: true, rolledFull: true },
      { mode: 'cubes' },
    ];
    for (const obs of others) {
      expect(pred('rollComplete', obs), String(obs['mode'])).toBe(false);
      expect(pred('netFoldedClosed', obs), String(obs['mode'])).toBe(false);
      expect(pred('netWidthIs', obs, { value: '12.6' }), String(obs['mode'])).toBe(false);
    }
    // netValid는 net-fold 관찰에서는 기존 뜻(valid)을 그대로 쓴다.
    expect(pred('netValid', others[0] as Observation)).toBe(true);
    expect(pred('netValid', others[1] as Observation)).toBe(false);
  });
});

describe('E12 cylinder-net 이벤트·직렬화', () => {
  it('EVENT_NAMES에 이벤트가 들어 있다', () => {
    for (const name of ['cyl-rolled', 'cyl-net-resized', 'cyl-net-folded', 'cyl-net-unfolded']) {
      expect(EVENT_NAMES).toContain(name);
    }
  });

  it('굴리기, 조절, 접기 이벤트', () => {
    const s0 = make();
    const s1 = reduce(s0, roll(1));
    expect(emit(s0, s1)).toEqual([
      { name: 'cyl-rolled', payload: { rollEighths: 1, full: false } },
    ]);
    const s2 = run(s1, [assemble]);
    expect(emit(s1, s2)).toEqual([]);
    const s3 = reduce(s2, width(1));
    expect(emit(s2, s3)).toEqual([
      { name: 'cyl-net-resized', payload: { widthTenths: 61, radiusHalves: 2, heightHalves: 6 } },
    ]);
    const s4 = reduce(s3, { type: 'cn-fold' });
    expect(emit(s3, s4)).toEqual([{ name: 'cyl-net-folded', payload: {} }]);
    expect(emit(s4, reduce(s4, { type: 'cn-unfold' }))).toEqual([
      { name: 'cyl-net-unfolded', payload: {} },
    ]);
    expect(emit(s4, s4)).toEqual([]);
  });

  it('상태는 JSON 직렬화 왕복이 되고, 수는 정수뿐이다', () => {
    const s = run(matched(), [{ type: 'cn-fold' }]);
    const copy = JSON.parse(JSON.stringify(s)) as CylinderNetState;
    expect(copy).toEqual(s);
    for (const value of [
      s.rollEighths,
      s.widthTenths,
      s.pieceRadiusHalves,
      s.pieceHeightHalves,
      s.viewYaw,
      s.settings.radiusHalves,
      s.settings.heightHalves,
    ]) {
      expect(Number.isInteger(value)).toBe(true);
    }
    expect(JSON.parse(JSON.stringify(observe(s)))).toEqual(observe(s));
  });

  it('엔진 정의로 만든 상태·관찰도 같다', () => {
    const config: CylinderNetConfig = { mode: 'net-fold', target: 'cylinder' };
    const state = definition.createInitialState(config) as SolidState;
    expect(state.mode).toBe('cylinder-net');
    expect(definition.observe(state, config)['mode']).toBe('cylinder-net');
    expect(definition.overlays?.['roll-match']).toBeDefined();
  });
});
