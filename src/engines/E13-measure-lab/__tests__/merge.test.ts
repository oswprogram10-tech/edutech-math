/** E13 length `mergeRule` 테스트: 10개 합체, 틈·9개는 합체 안 함, 연속 합체, measuredAs, 이벤트. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { lengthPredicates } from '../length/events';
import { snapStartGrid } from '../length/merge';
import { observeLength } from '../length/observe';
import { createLengthState, reduceLength } from '../length/reduce';
import type { LengthAction, LengthConfig, MeasureState } from '../length/types';
import { E13_EVENT_NAMES, emit } from '../modes';

const board: LengthConfig = {
  mode: 'length',
  units: ['cm-10-rod'],
  mergeRule: { from: 'cm-10-rod', count: 10, to: 'm-tape' },
  object: { name: 'blackboard', lengthCm: 320 },
};

function make(config: LengthConfig = board): MeasureState {
  return createLengthState(config);
}

function play(state: MeasureState, ...actions: LengthAction[]): MeasureState {
  return actions.reduce(reduceLength, state);
}

/** 10cm 막대를 from(cm)부터 틈 없이 count개 놓는 Action. */
function rods(count: number, from = 0): LengthAction[] {
  return Array.from({ length: count }, (_, i) => ({
    type: 'add',
    unit: 'cm-10-rod',
    start: String(from + i * 10),
  }));
}

const obs = (state: MeasureState) => observeLength(state);

describe('mergeRule 설정', () => {
  it('설정이 올바르면 오류가 없고 길이 상한이 400cm로 늘어난다', () => {
    const state = make();
    expect(state.error).toBeNull();
    expect(state.mergeRule).toBe(true);
    expect(state.objectCm).toBe('320');
    expect(make({ ...board, object: { name: 'blackboard', lengthCm: 400 } }).error).toBeNull();
    expect(make({ ...board, object: { name: 'blackboard', lengthCm: 401 } }).error).not.toBeNull();
  });

  it('mergeRule이 없으면 길이 상한은 그대로 100cm이고 Observation에 합체 칸이 없다', () => {
    const plain = make({
      mode: 'length',
      units: ['cm-10-rod'],
      object: { name: 'a', lengthCm: 50 },
    });
    expect(plain.mergeRule).toBe(false);
    expect(
      make({ mode: 'length', units: ['cm-10-rod'], object: { name: 'a', lengthCm: 101 } }).error,
    ).not.toBeNull();
    expect(obs(plain)).not.toHaveProperty('merges');
  });

  it.each([
    ['from 다름', { from: 'cm-block', count: 10, to: 'm-tape' }],
    ['count 다름', { from: 'cm-10-rod', count: 9, to: 'm-tape' }],
    ['to 다름', { from: 'cm-10-rod', count: 10, to: 'cm-block' }],
  ])('잘못된 mergeRule(%s)은 설정 오류', (_name, rule) => {
    expect(make({ ...board, mergeRule: rule as never }).error).not.toBeNull();
  });

  it('단위 목록에 1m 줄자를 넣을 수 있다(트레이에서 바로 꺼내기)', () => {
    expect(make({ ...board, units: ['cm-10-rod', 'm-tape'] }).error).toBeNull();
  });
});

describe('합체', () => {
  it('10개가 0부터 틈 없이 이어지면 1m 줄자 하나로 바뀐다(Action 하나)', () => {
    const nine = play(make(), ...rods(9));
    expect(obs(nine)).toMatchObject({ merges: 0, meters: 0, count: 9 });
    const merged = play(nine, ...rods(1, 90));
    expect(merged.pieces).toEqual([{ unit: 'm-tape', start: '0' }]);
    expect(obs(merged)).toMatchObject({ merges: 1, meters: 1, restCm: '0', count: 1 });
  });

  it('9개로는 합체하지 않는다', () => {
    const state = play(make(), ...rods(9));
    expect(state.pieces).toHaveLength(9);
    expect(state.merges).toBe(0);
  });

  it('틈이 있으면 합체하지 않는다(마지막 막대가 10cm 떨어져 있음)', () => {
    const state = play(make(), ...rods(9), { type: 'add', unit: 'cm-10-rod', start: '100' });
    expect(state.pieces).toHaveLength(10);
    expect(state.merges).toBe(0);
    expect(obs(state)).toMatchObject({ gaps: 1, merges: 0 });
  });

  it('틈이 메워지면 그 move로 합체한다', () => {
    const gap = play(make(), ...rods(9), { type: 'add', unit: 'cm-10-rod', start: '100' });
    const fixed = play(gap, { type: 'move', index: 9, start: '90' });
    expect(fixed.pieces).toEqual([{ unit: 'm-tape', start: '0' }]);
    expect(fixed.merges).toBe(1);
  });

  it('0이 아닌 곳에서 시작한 막대 10개는 합체하지 않는다', () => {
    const state = play(make(), ...rods(10, 10));
    expect(state.pieces).toHaveLength(10);
    expect(state.merges).toBe(0);
  });

  it('순서와 상관없이 마지막에 0번 자리를 채워도 합체한다', () => {
    const state = play(make(), ...rods(9, 10), { type: 'add', unit: 'cm-10-rod', start: '0' });
    expect(state.pieces).toEqual([{ unit: 'm-tape', start: '0' }]);
  });

  it('합체 뒤 이어지는 막대도 같은 규칙을 따른다(200cm에서 두 번째 합체)', () => {
    const state = play(make(), ...rods(10), ...rods(10, 100));
    expect(state.pieces).toEqual([
      { unit: 'm-tape', start: '0' },
      { unit: 'm-tape', start: '100' },
    ]);
    expect(state.merges).toBe(2);
    expect(obs(state)).toMatchObject({ meters: 2, restCm: '0', merges: 2 });
  });

  it('두 번째 합체는 첫 합체 뒤에 놓은 막대로도 일어난다', () => {
    const first = play(make(), ...rods(10));
    expect(first.merges).toBe(1);
    const second = play(first, ...rods(9, 100));
    expect(second.merges).toBe(1);
    expect(play(second, ...rods(1, 190)).merges).toBe(2);
  });

  it('1m 줄자 뒤에 놓은 막대 몇 개는 restCm에 센다(3m 20cm)', () => {
    const state = play(make(), ...rods(10), ...rods(10, 100), ...rods(10, 200), ...rods(2, 300));
    expect(obs(state)).toMatchObject({
      meters: 3,
      restCm: '20',
      merges: 3,
      exact: true,
      reachesEnd: true,
      gaps: 0,
      overlaps: 0,
    });
  });

  it('트레이에서 바로 꺼낸 1m 줄자도 놓을 수 있고 다음 막대와 이어진다', () => {
    const state = make({ ...board, units: ['cm-10-rod', 'm-tape'] });
    const next = play(state, { type: 'add', unit: 'm-tape', start: '0' }, ...rods(10, 100));
    expect(next.pieces).toEqual([
      { unit: 'm-tape', start: '0' },
      { unit: 'm-tape', start: '100' },
    ]);
    expect(next.merges).toBe(1);
  });

  it('합체된 1m 줄자는 끌어 옮길 수 있고, 옮기면 다시 막대로 풀리지는 않는다', () => {
    const merged = play(make(), ...rods(10));
    const moved = play(merged, { type: 'move', index: 0, start: '50' });
    expect(moved.pieces).toEqual([{ unit: 'm-tape', start: '50' }]);
    expect(moved.merges).toBe(1);
  });

  it('reset은 합체 횟수까지 되돌린다', () => {
    const merged = play(make(), ...rods(10));
    const back = play(merged, { type: 'reset' });
    expect(back.pieces).toEqual([]);
    expect(back.merges).toBe(0);
  });
});

describe('측정 판정', () => {
  const three = play(make(), ...rods(10), ...rods(10, 100), ...rods(10, 200), ...rods(2, 300));

  it('measuredAs {m, cm}: exact이고 줄자 수·나머지 cm가 같을 때만 참', () => {
    const p = lengthPredicates['measuredAs'];
    expect(p?.(obs(three), { m: 3, cm: 20 })).toBe(true);
    expect(p?.(obs(three), { m: 3, cm: 30 })).toBe(false);
    expect(p?.(obs(three), { m: 2, cm: 20 })).toBe(false);
    expect(p?.(obs(three), { m: 3 })).toBe(false);
    expect(p?.(obs(three), { m: 3, cm: 20.5 })).toBe(false);
    // 길이가 모자라면(exact 아님) 거짓
    const short = play(make(), ...rods(10), ...rods(10, 100), ...rods(10, 200), ...rods(1, 300));
    expect(p?.(obs(short), { m: 3, cm: 10 })).toBe(false);
  });

  it('merged 판정과 이벤트: 합체한 Action에서 merged 이벤트를 낸다', () => {
    const p = lengthPredicates['merged'];
    const nine = play(make(), ...rods(9));
    expect(p?.(obs(nine), undefined)).toBe(false);
    const merged = play(nine, ...rods(1, 90));
    expect(p?.(obs(merged), undefined)).toBe(true);
    expect(E13_EVENT_NAMES).toContain('merged');
    expect(emit(nine, merged).map((event) => event.name)).toEqual(['measure-changed', 'merged']);
    // 합체가 없는 변화에서는 measure-changed만
    const ten = play(make(), ...rods(1));
    expect(emit(make(), ten).map((event) => event.name)).toEqual(['measure-changed']);
    // 합체 횟수만 싣고 길이는 싣지 않는다.
    expect(emit(nine, merged)[1]?.payload).toEqual({ merges: 1 });
  });
});

describe('10cm 격자 자석(판 배율이 작을 때)', () => {
  it('끌어 놓은 위치를 10cm 격자로 맞추고 띠 안으로 당긴다', () => {
    const state = make();
    expect(snapStartGrid(state, 'cm-10-rod', 3).toString()).toBe('0');
    expect(snapStartGrid(state, 'cm-10-rod', 4.9).toString()).toBe('0');
    expect(snapStartGrid(state, 'cm-10-rod', 5).toString()).toBe('10');
    expect(snapStartGrid(state, 'cm-10-rod', 96).toString()).toBe('100');
    expect(snapStartGrid(state, 'cm-10-rod', -30).toString()).toBe('0');
    // 띠는 0~335cm: 막대(10cm)는 시작 320까지, 줄자(100cm)는 230까지
    expect(snapStartGrid(state, 'cm-10-rod', 999).toString()).toBe('320');
    expect(snapStartGrid(state, 'm-tape', 999).toString()).toBe('230');
  });
});

describe('JSON 왕복', () => {
  it('합체 뒤 상태와 Observation은 JSON으로 직렬화된다', () => {
    const state = play(make(), ...rods(10), ...rods(3, 100));
    assertSerializable(state);
    assertSerializable(obs(state));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(JSON.parse(JSON.stringify(obs(state)))).toEqual(obs(state));
  });
});
