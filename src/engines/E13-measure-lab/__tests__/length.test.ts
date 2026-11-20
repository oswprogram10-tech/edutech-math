/** E13 length 순수 로직 테스트: 자석·틈·겹침 경계, countIs·exact, 자 만들기, 거절, JSON 왕복. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { lengthPredicates } from '../length/events';
import { observeLength } from '../length/observe';
import { createLengthState, reduceLength } from '../length/reduce';
import { analyze, endStart, rulerReady, snapStart, validStart } from '../length/settings';
import type { LengthAction, LengthConfig, MeasureState } from '../length/types';
import { UNITS, unitLength } from '../units';
import { Rational } from '../../../core/math';

const pencil: LengthConfig = {
  mode: 'length',
  object: { name: 'pencil', lengthCm: 12 },
  units: ['hand-span-a', 'hand-span-b', 'clip-3cm', 'cm-block', 'eraser-5cm'],
  buildRuler: true,
};

function make(config: LengthConfig = pencil): MeasureState {
  return createLengthState(config);
}

function play(state: MeasureState, ...actions: LengthAction[]): MeasureState {
  return actions.reduce(reduceLength, state);
}

function add(unit: string, start: string): LengthAction {
  return { type: 'add', unit, start };
}

/** 같은 단위를 틈 없이 count개 이어 붙이는 Action 목록. */
function chain(unit: string, count: number, from = 0): LengthAction[] {
  const step = Number(unitLength(unit)?.toString());
  return Array.from({ length: count }, (_, i) => add(unit, String(from + i * step)));
}

const obs = (state: MeasureState) => observeLength(state);

describe('단위와 설정', () => {
  it('단위 길이: 뼘 가 15, 뼘 나 12, 클립 3, 1cm 블록 1, 지우개 5', () => {
    expect(UNITS.map((unit) => `${unit.id}:${unit.cm}`)).toEqual([
      'hand-span-a:15',
      'hand-span-b:12',
      'clip-3cm:3',
      'cm-block:1',
      'eraser-5cm:5',
    ]);
    expect(unitLength('nope')).toBeNull();
  });

  it('설정이 mode뿐이면 샌드박스 기본(연필 12cm, 클립·1cm 블록, 자 만들기)', () => {
    const state = make({ mode: 'length' });
    expect(state.error).toBeNull();
    expect(state.objectCm).toBe('12');
    expect(state.units).toEqual(['clip-3cm', 'cm-block']);
    expect(state.buildRuler).toBe(true);
    expect(state.showGapOverlap).toBe(true);
  });

  it('lengthCm는 문자열·숫자·0.5 격자를 받고, 격자가 아니면 오류', () => {
    expect(make({ ...pencil, object: { name: 'desk', lengthCm: '7/2' } }).objectCm).toBe('7/2');
    expect(make({ ...pencil, object: { name: 'desk', lengthCm: 4.5 } }).objectCm).toBe('9/2');
    expect(make({ ...pencil, object: { name: 'desk', lengthCm: 4.3 } }).error).not.toBeNull();
  });

  it.each([
    ['물건 없음', { units: ['cm-block'] }],
    ['길이 0', { object: { name: 'a', lengthCm: 0 }, units: ['cm-block'] }],
    ['길이 101', { object: { name: 'a', lengthCm: 101 }, units: ['cm-block'] }],
    ['단위 없음', { object: { name: 'a', lengthCm: 5 }, units: [] }],
    ['모르는 단위', { object: { name: 'a', lengthCm: 5 }, units: ['ruler'] }],
    [
      '뼘 시연 길이 0',
      {
        object: { name: 'a', lengthCm: 5 },
        units: ['cm-block'],
        demoSpans: { objectName: 'desk', objectCm: 0 },
      },
    ],
  ] as const)('잘못된 설정(%s)은 오류 상태이고 조작은 거절된다', (_name, partial) => {
    const state = make({ mode: 'length', ...(partial as object) } as LengthConfig);
    expect(state.error).not.toBeNull();
    expect(reduceLength(state, add('cm-block', '0'))).toBe(state);
    expect(obs(state)['error']).toBe(true);
  });

  it('뼘 시연 설정은 상태에 들어가고 객체 길이는 Rational 문자열', () => {
    const state = make({ ...pencil, demoSpans: { objectName: 'desk', objectCm: 60 } });
    expect(state.demo).toEqual({ objectName: 'desk', objectCm: '60' });
  });
});

describe('자석', () => {
  it('조각이 없으면 0에서 1cm 안은 0에 붙고, 넘으면 놓은 자리에 둔다(앞 틈)', () => {
    const state = make();
    expect(snapStart(state, 'clip-3cm', 0.4).toString()).toBe('0');
    expect(snapStart(state, 'clip-3cm', 1).toString()).toBe('0');
    expect(snapStart(state, 'clip-3cm', 1.5).toString()).toBe('3/2');
    expect(snapStart(state, 'clip-3cm', 2.5).toString()).toBe('5/2');
  });

  it('마지막 조각 끝에서 1cm 안이면 붙고(1cm 포함) 1cm를 넘으면 틈으로 남는다', () => {
    const state = play(make(), add('clip-3cm', '0')); // 끝 = 3
    expect(snapStart(state, 'clip-3cm', 3).toString()).toBe('3');
    expect(snapStart(state, 'clip-3cm', 4).toString()).toBe('3');
    expect(snapStart(state, 'clip-3cm', 2).toString()).toBe('3');
    expect(snapStart(state, 'clip-3cm', 4.5).toString()).toBe('9/2');
    expect(snapStart(state, 'clip-3cm', 1.5).toString()).toBe('3/2');
  });

  it('값은 0.5 격자에 맞고 띠 범위(0 ~ 물건+15cm) 안으로 당긴다', () => {
    const state = make(); // 띠 27cm
    expect(snapStart(state, 'clip-3cm', 5.26).toString()).toBe('11/2');
    expect(snapStart(state, 'clip-3cm', 99).toString()).toBe('24');
    expect(snapStart(state, 'clip-3cm', -9).toString()).toBe('0');
  });

  it('옮기는 조각은 자기 자신 끝에는 붙지 않는다', () => {
    const state = play(make(), add('clip-3cm', '0'), add('clip-3cm', '3'));
    // 두 번째(index 1)를 옮길 때 기준은 첫 조각(끝 3)이다.
    expect(snapStart(state, 'clip-3cm', 3.5, 1).toString()).toBe('3');
    // 첫 번째(index 0)를 옮길 때 기준은 두 번째(끝 6)이다.
    expect(snapStart(state, 'clip-3cm', 6.5, 0).toString()).toBe('6');
  });

  it('endStart: 마지막 조각 끝(없으면 0), 띠 밖이면 null', () => {
    expect(endStart(make(), 'clip-3cm')?.toString()).toBe('0');
    const full = play(make(), ...chain('cm-block', 27));
    expect(full.pieces).toHaveLength(27);
    expect(endStart(full, 'cm-block')).toBeNull();
  });

  it('validStart: 0.5 격자·0 이상·띠 안', () => {
    const state = make();
    expect(validStart(state, 'clip-3cm', Rational.of(24))).toBe(true);
    expect(validStart(state, 'clip-3cm', Rational.of(49, 2))).toBe(false);
    expect(validStart(state, 'clip-3cm', Rational.of(1, 3))).toBe(false);
    expect(validStart(state, 'clip-3cm', Rational.of(-1, 2))).toBe(false);
  });
});

describe('틈·겹침 경계', () => {
  it('클립 4개를 0부터 이으면 exact(틈·겹침 0, 0에서 시작, 끝에 닿음)', () => {
    const state = play(make(), ...chain('clip-3cm', 4));
    expect(obs(state)).toMatchObject({
      count: 4,
      countByUnit: { 'clip-3cm': 4 },
      gaps: 0,
      overlaps: 0,
      startsAtZero: true,
      reachesEnd: true,
      exact: true,
      misconceptions: [],
    });
  });

  it('정확히 끝: 3개면 닿지 못하고 5개면 끝을 넘는다', () => {
    expect(obs(play(make(), ...chain('clip-3cm', 3)))).toMatchObject({
      reachesEnd: false,
      exact: false,
    });
    const five = play(make(), ...chain('clip-3cm', 5));
    expect(obs(five)).toMatchObject({ gaps: 0, overlaps: 0, reachesEnd: false, exact: false });
  });

  it('0이 아닌 시작은 앞 틈이다(조각이 하나면 오개념은 아직 기록하지 않는다)', () => {
    const one = play(make(), add('clip-3cm', '5/2'));
    expect(obs(one)).toMatchObject({
      gaps: 1,
      startsAtZero: false,
      exact: false,
      misconceptions: [],
    });
    const two = play(one, add('clip-3cm', '11/2'));
    expect(obs(two)).toMatchObject({ gaps: 1, misconceptions: ['MC-MEASURE-GAP'] });
  });

  it('1cm 넘는 틈과 0.5cm 틈은 모두 틈 하나로 센다', () => {
    const wide = play(make(), add('clip-3cm', '0'), add('clip-3cm', '9/2')); // 끝 3, 시작 4.5 → 틈 1.5
    expect(analyze(wide).gaps).toHaveLength(1);
    expect(
      analyze(wide)
        .gaps[0]?.to.sub(analyze(wide).gaps[0]?.from as Rational)
        .toString(),
    ).toBe('3/2');
    const small = play(make(), add('clip-3cm', '0'), add('clip-3cm', '7/2'));
    expect(obs(small)).toMatchObject({ gaps: 1, overlaps: 0, misconceptions: ['MC-MEASURE-GAP'] });
  });

  it('겹침: 이웃 조각이 앞 조각 끝보다 앞에서 시작하면 겹침 하나', () => {
    const state = play(make(), add('clip-3cm', '0'), add('clip-3cm', '5/2'));
    expect(obs(state)).toMatchObject({
      gaps: 0,
      overlaps: 1,
      exact: false,
      misconceptions: ['MC-MEASURE-GAP'],
    });
    const span = analyze(state).overlaps[0];
    expect(span?.from.toString()).toBe('5/2');
    expect(span?.to.toString()).toBe('3');
  });

  it('놓은 순서와 상관없이 시작 위치 순으로 비교한다', () => {
    const state = play(
      make(),
      add('clip-3cm', '6'),
      add('clip-3cm', '0'),
      add('clip-3cm', '3'),
      add('clip-3cm', '9'),
    );
    expect(obs(state)).toMatchObject({ exact: true, gaps: 0, overlaps: 0 });
    const pieces = obs(state)['pieces'];
    expect(
      Array.isArray(pieces) && pieces.map((piece) => (piece as { start: string }).start),
    ).toEqual(['0', '3', '6', '9']);
  });

  it('다른 단위를 섞어도 이으면 exact: 지우개 5 + 클립 3 + 1cm 블록 4개', () => {
    const state = play(
      make(),
      add('eraser-5cm', '0'),
      add('clip-3cm', '5'),
      ...chain('cm-block', 4, 8),
    );
    expect(obs(state)).toMatchObject({
      count: 6,
      countByUnit: { 'eraser-5cm': 1, 'clip-3cm': 1, 'cm-block': 4 },
      exact: true,
    });
  });

  it('조각이 없으면 모두 0·false이고 오개념도 없다', () => {
    expect(obs(make())).toMatchObject({
      count: 0,
      gaps: 0,
      overlaps: 0,
      startsAtZero: false,
      reachesEnd: false,
      exact: false,
      misconceptions: [],
    });
  });
});

describe('조작과 거절', () => {
  it('add·move·remove는 Action으로만 바뀌고 모두 moves를 센다', () => {
    let state = play(make(), add('clip-3cm', '0'), add('clip-3cm', '4'));
    expect(state.moves).toBe(2);
    state = play(state, { type: 'move', index: 1, start: '3' });
    expect(obs(state)['exact']).toBe(false);
    expect(state.pieces[1]?.start).toBe('3');
    state = play(state, { type: 'remove', index: 0 });
    expect(state.pieces).toHaveLength(1);
    expect(state.moves).toBe(4);
  });

  it('조각은 최대 40개, 띠 밖·모르는 단위·격자 밖은 거절', () => {
    const cfg: LengthConfig = {
      ...pencil,
      object: { name: 'desk', lengthCm: 30 },
      units: ['cm-block', 'clip-3cm'],
    };
    const state = make(cfg);
    const forty = play(
      state,
      ...Array.from({ length: 40 }, (_, i) => add('cm-block', String(i % 20))),
    );
    expect(forty.pieces).toHaveLength(40);
    expect(reduceLength(forty, add('cm-block', '0'))).toBe(forty);
    // 띠는 0~45
    expect(reduceLength(state, add('clip-3cm', '43'))).toBe(state);
    expect(reduceLength(state, add('clip-3cm', '42'))).not.toBe(state);
    expect(reduceLength(state, add('eraser-5cm', '0'))).toBe(state); // 설정에 없는 단위
    expect(reduceLength(state, add('cm-block', '1/3'))).toBe(state);
    expect(reduceLength(state, add('cm-block', '-1'))).toBe(state);
    expect(reduceLength(state, add('cm-block', 'x'))).toBe(state);
  });

  it('move는 같은 자리·없는 index·띠 밖을 거절한다', () => {
    const state = play(make(), add('clip-3cm', '0'));
    expect(reduceLength(state, { type: 'move', index: 0, start: '0' })).toBe(state);
    expect(reduceLength(state, { type: 'move', index: 1, start: '3' })).toBe(state);
    expect(reduceLength(state, { type: 'move', index: -1, start: '3' })).toBe(state);
    expect(reduceLength(state, { type: 'move', index: 0, start: '25' })).toBe(state);
    expect(reduceLength(state, { type: 'remove', index: 3 })).toBe(state);
  });

  it('reset은 모두 지우고, 처음이면 같은 객체', () => {
    const start = make();
    expect(reduceLength(start, { type: 'reset' })).toBe(start);
    expect(reduceLength(play(start, add('clip-3cm', '0')), { type: 'reset' })).toEqual(start);
  });
});

describe('predicates', () => {
  const p = lengthPredicates;

  it('countIs: 전체 수 또는 단위별 수', () => {
    const o = obs(play(make(), ...chain('clip-3cm', 4)));
    expect(p['countIs']?.(o, { n: 4 })).toBe(true);
    expect(p['countIs']?.(o, { n: 4, unit: 'clip-3cm' })).toBe(true);
    expect(p['countIs']?.(o, { n: 4, unit: 'cm-block' })).toBe(false);
    expect(p['countIs']?.(o, { n: 0, unit: 'cm-block' })).toBe(true);
    expect(p['countIs']?.(o, { n: 5 })).toBe(false);
    expect(p['countIs']?.(o, {})).toBe(false);
    expect(p['countIs']?.(o, undefined)).toBe(false);
  });

  it('exact와 noGapOverlap(조각이 있어야 참)', () => {
    expect(p['exact']?.(obs(play(make(), ...chain('clip-3cm', 4))), undefined)).toBe(true);
    expect(p['exact']?.(obs(make()), undefined)).toBe(false);
    expect(p['noGapOverlap']?.(obs(make()), undefined)).toBe(false);
    expect(p['noGapOverlap']?.(obs(play(make(), ...chain('clip-3cm', 3))), undefined)).toBe(true);
    expect(
      p['noGapOverlap']?.(obs(play(make(), add('clip-3cm', '0'), add('clip-3cm', '4'))), undefined),
    ).toBe(false);
  });
});

describe('자 만들기', () => {
  const ten = chain('cm-block', 10);

  it('cm-block이 0부터 틈 없이 10개면 자를 만들 수 있다', () => {
    const state = play(make(), ...ten);
    expect(rulerReady(state)).toBe(true);
    const made = play(state, { type: 'make-ruler' });
    expect(obs(made)).toMatchObject({ rulerMade: true, labelsCorrect: false });
  });

  it('9개·틈·다른 단위가 섞이면 거절한다', () => {
    const nine = play(make(), ...chain('cm-block', 9));
    expect(reduceLength(nine, { type: 'make-ruler' })).toBe(nine);
    const gap = play(make(), ...chain('cm-block', 9), add('cm-block', '10'));
    expect(reduceLength(gap, { type: 'make-ruler' })).toBe(gap);
    const mixed = play(make(), ...chain('cm-block', 9), add('clip-3cm', '9'));
    expect(reduceLength(mixed, { type: 'make-ruler' })).toBe(mixed);
    const late = play(make(), ...chain('cm-block', 10, 1));
    expect(reduceLength(late, { type: 'make-ruler' })).toBe(late);
  });

  it('buildRuler가 꺼져 있으면 만들 수 없다', () => {
    const state = play(make({ ...pencil, buildRuler: false }), ...ten);
    expect(reduceLength(state, { type: 'make-ruler' })).toBe(state);
  });

  it('12개를 놓았어도 앞의 10개가 0~9에 있으면 만들 수 있다', () => {
    const state = play(make(), ...chain('cm-block', 12));
    expect(rulerReady(state)).toBe(true);
  });

  it('자를 만들면 조각을 바꿀 수 없고, 처음으로는 자도 지운다', () => {
    const made = play(make(), ...ten, { type: 'make-ruler' });
    expect(reduceLength(made, add('cm-block', '10'))).toBe(made);
    expect(reduceLength(made, { type: 'move', index: 0, start: '1/2' })).toBe(made);
    expect(reduceLength(made, { type: 'remove', index: 0 })).toBe(made);
    expect(reduceLength(made, { type: 'make-ruler' })).toBe(made);
    expect(reduceLength(made, { type: 'reset' })).toEqual(make());
  });

  it('label: 자를 만든 뒤 0~10 정수만, 같은 눈금에 다시 놓으면 바꾼다', () => {
    const made = play(make(), ...ten, { type: 'make-ruler' });
    const before = play(make(), ...ten);
    expect(reduceLength(before, { type: 'label', tick: 0, value: 0 })).toBe(before);
    expect(reduceLength(made, { type: 'label', tick: 11, value: 0 })).toBe(made);
    expect(reduceLength(made, { type: 'label', tick: -1, value: 0 })).toBe(made);
    expect(reduceLength(made, { type: 'label', tick: 0, value: 11 })).toBe(made);
    expect(reduceLength(made, { type: 'label', tick: 0, value: 0.5 })).toBe(made);
    const once = play(made, { type: 'label', tick: 3, value: 4 });
    expect(once.labels).toEqual({ '3': 4 });
    expect(reduceLength(once, { type: 'label', tick: 3, value: 4 })).toBe(once);
    expect(play(once, { type: 'label', tick: 3, value: 3 }).labels).toEqual({ '3': 3 });
  });

  it('labelsCorrect: 모든 눈금 i에 i가 있어야 참', () => {
    const labels: LengthAction[] = Array.from({ length: 11 }, (_, i) => ({
      type: 'label',
      tick: i,
      value: i,
    }));
    const all = play(make(), ...ten, { type: 'make-ruler' }, ...labels);
    expect(obs(all)['labelsCorrect']).toBe(true);
    expect(lengthPredicates['labelsCorrect']?.(obs(all), undefined)).toBe(true);
    expect(lengthPredicates['rulerMade']?.(obs(all), undefined)).toBe(true);
    // 하나라도 틀리면 거짓
    const wrong = play(all, { type: 'label', tick: 7, value: 6 });
    expect(obs(wrong)['labelsCorrect']).toBe(false);
    // 하나 비어도 거짓
    const missing = play(make(), ...ten, { type: 'make-ruler' }, ...labels.slice(1));
    expect(obs(missing)['labelsCorrect']).toBe(false);
  });
});

describe('JSON 왕복', () => {
  it('상태와 Observation은 직렬화가 되고 왕복해도 같다', () => {
    const state = play(
      make({ ...pencil, demoSpans: { objectName: 'desk', objectCm: 60 } }),
      ...chain('cm-block', 10),
      {
        type: 'make-ruler',
      },
      { type: 'label', tick: 2, value: 2 },
    );
    assertSerializable(state);
    assertSerializable(obs(state));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(JSON.parse(JSON.stringify(obs(state)))).toEqual(obs(state));
  });
});
