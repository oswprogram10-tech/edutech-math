import { describe, expect, it } from 'vitest';
import type { JsonValue } from '../../../core/engine-sdk';
import { assertSerializable } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import definition from '../index';
import { MC_EQUAL_ANSWER, observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { BalanceAction, BalanceConfig, BalanceState } from '../types';

function play(config: BalanceConfig, actions: readonly BalanceAction[]): BalanceState {
  return actions.reduce<BalanceState>(reduce, createInitialState(config));
}

const ADD_BOX: BalanceConfig = { left: [{ num: 25 }, { box: true }], right: [{ num: 43 }] };
const SUB_BOX: BalanceConfig = {
  left: [{ box: true }, { num: 16, neg: true }],
  right: [{ num: 29 }],
};
const FLIP_BOX: BalanceConfig = { left: [{ num: 60 }], right: [{ box: true }, { num: 37 }] };
const NO_BOX: BalanceConfig = { left: [{ num: 20 }, { num: 15 }], right: [{ num: 35 }] };

const obs = (state: BalanceState) => observe(state, {});
const tryValue = (value: string): BalanceAction => ({ type: 'try', value });

describe('설정', () => {
  it('설정이 없으면 샌드박스 기본 25 + □ = 43', () => {
    const state = createInitialState({});
    expect(state.error).toBeNull();
    expect(state.left).toEqual({ const: '25', hasBox: true });
    expect(state.right).toEqual({ const: '43', hasBox: false });
  });

  it('빼는 항은 음수로 합친다', () => {
    const state = createInitialState(SUB_BOX);
    expect(state.left).toEqual({ const: '-16', hasBox: true });
  });

  it.each([
    ['□ 두 개', { left: [{ box: true }], right: [{ box: true }] }],
    ['□ 한쪽에 둘', { left: [{ box: true }, { box: true }], right: [{ num: 3 }] }],
    ['소수', { left: [{ num: 1.5 }], right: [{ num: 3 }] }],
    ['소수 문자열', { left: [{ num: '1.5' }], right: [{ num: 3 }] }],
    ['분수 문자열', { left: [{ num: '1/2' }], right: [{ num: 3 }] }],
    ['음수 num', { left: [{ num: -3 }], right: [{ num: 3 }] }],
    ['음수 문자열', { left: [{ num: '-3' }], right: [{ num: 3 }] }],
    ['한쪽만 지정', { left: [{ num: 3 }] }],
  ])('설정 오류: %s', (_name, config) => {
    const state = createInitialState(config as unknown as BalanceConfig);
    expect(state.error).not.toBeNull();
    // 오류 상태는 어떤 Action도 받지 않는다.
    expect(reduce(state, tryValue('3'))).toBe(state);
  });

  it('수는 문자열도 받는다', () => {
    const state = createInitialState({ left: [{ num: '7' }], right: [{ num: '7' }] });
    expect(state.error).toBeNull();
    expect(obs(state)['balanced']).toBe(true);
  });
});

describe('reduce', () => {
  it('try: 넣어 보기를 기록한다', () => {
    const state = play(ADD_BOX, [tryValue('18'), tryValue('17')]);
    expect(state.tryValue).toBe('17');
    expect(state.tries).toEqual(['18', '17']);
  });

  it('try: □가 없거나 허용 안 되거나 범위 밖이면 거절', () => {
    const none = createInitialState(NO_BOX);
    expect(reduce(none, tryValue('3'))).toBe(none);
    const off = createInitialState({ ...ADD_BOX, allowTryValue: false });
    expect(reduce(off, tryValue('3'))).toBe(off);
    const state = createInitialState(ADD_BOX);
    for (const bad of ['', '1000', '-1', '1.5', 'abc']) {
      expect(reduce(state, tryValue(bad))).toBe(state);
    }
  });

  it('try: 경계값 0과 999', () => {
    expect(play(ADD_BOX, [tryValue('0')]).tryValue).toBe('0');
    expect(play(ADD_BOX, [tryValue('999')]).tryValue).toBe('999');
    expect(play(ADD_BOX, [tryValue('007')]).tryValue).toBe('7');
  });

  it('both add / remove: 두 접시가 같이 바뀐다', () => {
    const added = play(NO_BOX, [{ type: 'both', op: 'add', n: '5' }]);
    expect(added.left.const).toBe('40');
    expect(added.right.const).toBe('40');
    const removed = play(NO_BOX, [{ type: 'both', op: 'remove', n: '5' }]);
    expect(removed.left.const).toBe('30');
    expect(removed.right.const).toBe('30');
    expect(removed.ops).toEqual([{ kind: 'both-remove', n: '5' }]);
  });

  it('both remove: 한 접시의 수가 n보다 작으면 거절(상태 그대로)', () => {
    const state = createInitialState(ADD_BOX);
    // 왼쪽 25, 오른쪽 43: 26은 왼쪽이 모자란다.
    expect(reduce(state, { type: 'both', op: 'remove', n: '26' })).toBe(state);
    // 정확히 같은 수는 뺄 수 있다(경계).
    expect(reduce(state, { type: 'both', op: 'remove', n: '25' })).not.toBe(state);
    // const가 0이면 어떤 수도 못 뺀다.
    const zero = play(ADD_BOX, [{ type: 'both', op: 'remove', n: '25' }]);
    expect(reduce(zero, { type: 'both', op: 'remove', n: '1' })).toBe(zero);
  });

  it('both: 수 범위 1~999', () => {
    const state = createInitialState(NO_BOX);
    for (const bad of ['0', '1000', '', '-3', '2.5']) {
      expect(reduce(state, { type: 'both', op: 'add', n: bad })).toBe(state);
    }
    expect(reduce(state, { type: 'both', op: 'add', n: '999' }).left.const).toBe('1034');
    expect(reduce(state, { type: 'both', op: 'add', n: '1' }).left.const).toBe('36');
  });

  it('both: allowBothSides가 false면 거절', () => {
    const state = createInitialState({ ...NO_BOX, allowBothSides: false });
    expect(reduce(state, { type: 'both', op: 'add', n: '5' })).toBe(state);
  });

  it('one: 기본은 거절, allowOneSide면 한쪽만 바뀐다', () => {
    const closed = createInitialState(NO_BOX);
    expect(reduce(closed, { type: 'one', op: 'add', side: 'left', n: '5' })).toBe(closed);
    const open = play({ ...NO_BOX, allowOneSide: true }, [
      { type: 'one', op: 'remove', side: 'left', n: '5' },
    ]);
    expect(open.left.const).toBe('30');
    expect(open.right.const).toBe('35');
    expect(open.ops).toEqual([{ kind: 'one-remove', n: '5', side: 'left' }]);
    const tooMuch = createInitialState({ ...NO_BOX, allowOneSide: true });
    expect(reduce(tooMuch, { type: 'one', op: 'remove', side: 'left', n: '36' })).toBe(tooMuch);
  });

  it('predict 잠금: 예측 전에는 try·both·one 거절, 예측은 한 번만', () => {
    const config: BalanceConfig = { ...ADD_BOX, predict: true, allowOneSide: true };
    const locked = createInitialState(config);
    expect(reduce(locked, tryValue('18'))).toBe(locked);
    expect(reduce(locked, { type: 'both', op: 'add', n: '1' })).toBe(locked);
    expect(reduce(locked, { type: 'one', op: 'add', side: 'left', n: '1' })).toBe(locked);
    const predicted = reduce(locked, { type: 'predict', value: 'no' });
    expect(predicted.prediction).toBe('no');
    expect(reduce(predicted, { type: 'predict', value: 'yes' })).toBe(predicted);
    expect(reduce(predicted, tryValue('18')).tryValue).toBe('18');
  });

  it('predict: predict 설정이 없으면 받지 않는다', () => {
    const state = createInitialState(ADD_BOX);
    expect(reduce(state, { type: 'predict', value: 'yes' })).toBe(state);
  });

  it('reset: 처음으로 돌리되 tries·ops·prediction 기록은 지우지 않는다', () => {
    const config: BalanceConfig = { ...ADD_BOX, predict: true };
    const state = play(config, [
      { type: 'predict', value: 'no' },
      tryValue('17'),
      { type: 'both', op: 'remove', n: '25' },
      { type: 'reset' },
    ]);
    expect(state.left).toEqual({ const: '25', hasBox: true });
    expect(state.right).toEqual({ const: '43', hasBox: false });
    expect(state.tryValue).toBeNull();
    expect(state.tries).toEqual(['17']);
    expect(state.ops).toHaveLength(1);
    expect(state.prediction).toBe('no');
  });

  it('reset: 이미 처음이면 같은 객체', () => {
    const state = createInitialState(ADD_BOX);
    expect(reduce(state, { type: 'reset' })).toBe(state);
  });

  it('JSON 왕복 후에도 같은 결과', () => {
    const state = play({ ...ADD_BOX, allowOneSide: true }, [
      tryValue('17'),
      { type: 'both', op: 'add', n: '3' },
      { type: 'one', op: 'add', side: 'right', n: '2' },
    ]);
    assertSerializable(state);
    const copy = JSON.parse(JSON.stringify(state)) as BalanceState;
    expect(copy).toEqual(state);
    expect(reduce(copy, tryValue('20'))).toEqual(reduce(state, tryValue('20')));
    expect(obs(copy)).toEqual(obs(state));
  });
});

describe('observe: 25 + □ = 43', () => {
  it('처음에는 알 수 없다(unknown), 정답이 observation에 없다', () => {
    const o = obs(createInitialState(ADD_BOX));
    expect(o['tilt']).toBe('unknown');
    expect(o['leftValue']).toBeNull();
    expect(o['rightValue']).toBe('43');
    expect(o['balanced']).toBe(false);
    expect(o['boxValue']).toBeNull();
    expect(JSON.stringify(o)).not.toContain('18');
  });

  it('18 → balanced', () => {
    const o = obs(play(ADD_BOX, [tryValue('18')]));
    expect(o['balanced']).toBe(true);
    expect(o['tilt']).toBe('level');
    expect(o['boxValue']).toBe('18');
    expect(o['misconceptions']).toEqual([]);
  });

  it('17 → 오른쪽이 무거움', () => {
    const o = obs(play(ADD_BOX, [tryValue('17')]));
    expect(o['balanced']).toBe(false);
    expect(o['tilt']).toBe('right');
    expect(o['leftValue']).toBe('42');
  });

  it('19 → 왼쪽이 무거움', () => {
    expect(obs(play(ADD_BOX, [tryValue('19')]))['tilt']).toBe('left');
  });

  it('68 → MC-EQUAL-ANSWER (25 + 43)', () => {
    const o = obs(play(ADD_BOX, [tryValue('68')]));
    expect(o['misconceptions']).toEqual([MC_EQUAL_ANSWER]);
    expect(o['tilt']).toBe('left');
  });

  it('넣어 본 값 중 하나라도 합이면 기록한다', () => {
    const o = obs(play(ADD_BOX, [tryValue('68'), tryValue('18')]));
    expect(o['misconceptions']).toEqual([MC_EQUAL_ANSWER]);
  });

  it('양쪽에서 25 빼기 → boxIsolated, boxValue 18(학생이 만든 결과)', () => {
    const o = obs(play(ADD_BOX, [{ type: 'both', op: 'remove', n: '25' }]));
    expect(o['boxIsolated']).toBe(true);
    expect(o['boxValue']).toBe('18');
    expect(o['bothSidesOps']).toBe(1);
    expect(o['oneSideOps']).toBe(0);
  });

  it('다른 수를 빼면 boxIsolated가 아니다', () => {
    const o = obs(play(ADD_BOX, [{ type: 'both', op: 'remove', n: '10' }]));
    expect(o['boxIsolated']).toBe(false);
    expect(o['boxValue']).toBeNull();
  });
});

describe('observe: □ − 16 = 29', () => {
  it('양쪽에 16 더하기 → boxIsolated, boxValue 45', () => {
    const o = obs(play(SUB_BOX, [{ type: 'both', op: 'add', n: '16' }]));
    expect(o['boxIsolated']).toBe(true);
    expect(o['boxValue']).toBe('45');
  });

  it('빼는 항 때문에 접시의 수가 음수여도 값을 구한다', () => {
    const solved = obs(play(SUB_BOX, [tryValue('45')]));
    expect(solved['leftValue']).toBe('29');
    expect(solved['balanced']).toBe(true);
    const small = obs(play(SUB_BOX, [tryValue('5')]));
    expect(small['leftValue']).toBe('-11');
    expect(small['tilt']).toBe('right');
  });

  it('처음 설정의 수 합은 빼는 항도 절댓값으로 센다(16 + 29)', () => {
    expect(createInitialState(SUB_BOX).initialSum).toBe('45');
  });

  it('양쪽에서 빼기: 음수 접시는 거절', () => {
    const state = createInitialState(SUB_BOX);
    expect(reduce(state, { type: 'both', op: 'remove', n: '1' })).toBe(state);
  });
});

describe('observe: 60 = □ + 37', () => {
  it('97 → MC-EQUAL-ANSWER', () => {
    expect(obs(play(FLIP_BOX, [tryValue('97')]))['misconceptions']).toEqual([MC_EQUAL_ANSWER]);
  });

  it('양쪽에서 37 빼기 → boxIsolated, boxValue 23', () => {
    const o = obs(play(FLIP_BOX, [{ type: 'both', op: 'remove', n: '37' }]));
    expect(o['boxIsolated']).toBe(true);
    expect(o['boxValue']).toBe('23');
  });

  it('□가 오른쪽에 있어도 23을 넣으면 수평', () => {
    expect(obs(play(FLIP_BOX, [tryValue('23')]))['balanced']).toBe(true);
  });
});

describe('observe: □ 없는 20 + 15 = 35', () => {
  it('처음부터 수평, boxIsolated·boxValue 없음, MC 없음', () => {
    const o = obs(createInitialState(NO_BOX));
    expect(o['balanced']).toBe(true);
    expect(o['tilt']).toBe('level');
    expect(o['boxIsolated']).toBe(false);
    expect(o['boxValue']).toBeNull();
    expect(o['misconceptions']).toEqual([]);
  });

  it('양쪽에서 5 빼도 수평 유지, 한쪽만 빼면 기울어짐', () => {
    const both = play({ ...NO_BOX, allowOneSide: true }, [{ type: 'both', op: 'remove', n: '5' }]);
    expect(obs(both)['balanced']).toBe(true);
    const one = play({ ...NO_BOX, allowOneSide: true }, [
      { type: 'one', op: 'remove', side: 'left', n: '5' },
    ]);
    expect(obs(one)['balanced']).toBe(false);
    expect(obs(one)['tilt']).toBe('right');
    expect(obs(one)['oneSideOps']).toBe(1);
  });

  it('합이 곧 해이면(□ − 16 = 29에 45) MC-EQUAL-ANSWER를 기록하지 않는다', () => {
    const config: BalanceConfig = {
      left: [{ box: true }, { num: 16, neg: true }],
      right: [{ num: 29 }],
    };
    const state = play(config, [tryValue('45'), tryValue('40')]);
    expect(obs(state)['misconceptions']).toEqual([]);
  });

  it('수가 하나뿐이면 MC-EQUAL-ANSWER를 감지하지 않는다', () => {
    const state = play({ left: [{ box: true }], right: [{ num: 7 }] }, [tryValue('7')]);
    expect(obs(state)['misconceptions']).toEqual([]);
    expect(state.initialSum).toBeNull();
  });
});

describe('observe: 경계값', () => {
  it('0 넣기', () => {
    const o = obs(play({ left: [{ box: true }], right: [{ num: 0 }] }, [tryValue('0')]));
    expect(o['balanced']).toBe(true);
    expect(o['boxValue']).toBe('0');
  });

  it('999 넣기', () => {
    const o = obs(play(ADD_BOX, [tryValue('999')]));
    expect(o['leftValue']).toBe('1024');
    expect(o['tilt']).toBe('left');
  });
});

describe('predicates', () => {
  const p = predicates;
  const solved = obs(play(ADD_BOX, [tryValue('18')]));
  const isolated = obs(play(ADD_BOX, [{ type: 'both', op: 'remove', n: '25' }]));

  it('balanced', () => {
    expect(p['balanced']?.(solved, undefined)).toBe(true);
    expect(p['balanced']?.(obs(createInitialState(ADD_BOX)), undefined)).toBe(false);
  });

  it('boxValueIs: 표기 차이를 무시한다', () => {
    expect(p['boxValueIs']?.(solved, { value: '18' })).toBe(true);
    expect(p['boxValueIs']?.(solved, { value: '18/1' })).toBe(true);
    expect(p['boxValueIs']?.(solved, { value: 18 })).toBe(true);
    expect(p['boxValueIs']?.(solved, { value: '19' })).toBe(false);
    expect(p['boxValueIs']?.(isolated, { value: '18' })).toBe(true);
    expect(p['boxValueIs']?.(obs(createInitialState(ADD_BOX)), { value: '18' })).toBe(false);
    expect(p['boxValueIs']?.(solved, undefined)).toBe(false);
  });

  it('boxIsolated', () => {
    expect(p['boxIsolated']?.(isolated, undefined)).toBe(true);
    expect(p['boxIsolated']?.(solved, undefined)).toBe(false);
  });

  it('bothSidesOpsAtLeast / oneSideOpsAtLeast', () => {
    expect(p['bothSidesOpsAtLeast']?.(isolated, { n: 1 })).toBe(true);
    expect(p['bothSidesOpsAtLeast']?.(isolated, { n: 2 })).toBe(false);
    expect(p['bothSidesOpsAtLeast']?.(isolated, undefined)).toBe(false);
    const one = obs(
      play({ ...NO_BOX, allowOneSide: true }, [{ type: 'one', op: 'add', side: 'left', n: '1' }]),
    );
    expect(p['oneSideOpsAtLeast']?.(one, { n: 1 })).toBe(true);
    expect(p['oneSideOpsAtLeast']?.(isolated, { n: 1 })).toBe(false);
  });

  it('predictionIs / predictionLocked', () => {
    const config: BalanceConfig = { ...NO_BOX, predict: true };
    const before = obs(createInitialState(config));
    const after = obs(play(config, [{ type: 'predict', value: 'yes' }]));
    expect(p['predictionLocked']?.(before, undefined)).toBe(false);
    expect(p['predictionLocked']?.(after, undefined)).toBe(true);
    expect(p['predictionIs']?.(after, { value: 'yes' })).toBe(true);
    expect(p['predictionIs']?.(after, { value: 'no' })).toBe(false);
    expect(p['predictionIs']?.(before, { value: 'yes' })).toBe(false);
  });

  it('triesAtMost', () => {
    const three = obs(play(ADD_BOX, [tryValue('1'), tryValue('2'), tryValue('18')]));
    expect(p['triesAtMost']?.(three, { n: 3 })).toBe(true);
    expect(p['triesAtMost']?.(three, { n: 2 })).toBe(false);
    expect(p['triesAtMost']?.(obs(createInitialState(ADD_BOX)), { n: 0 })).toBe(true);
  });

  it('hasMisconception', () => {
    const wrong = obs(play(ADD_BOX, [tryValue('68')]));
    expect(p['hasMisconception']?.(wrong, { code: 'MC-EQUAL-ANSWER' })).toBe(true);
    expect(p['hasMisconception']?.(solved, { code: 'MC-EQUAL-ANSWER' })).toBe(false);
    expect(p['hasMisconception']?.(wrong, {} as JsonValue)).toBe(false);
  });
});

describe('emit / 정의', () => {
  it('상태가 바뀔 때만 balance-changed를 낸다', () => {
    const prev = createInitialState(ADD_BOX);
    const action = tryValue('18');
    const next = reduce(prev, action);
    expect(emit(prev, next, action)).toEqual([
      { name: 'balance-changed', payload: { balanced: true, tilt: 'level' } },
    ]);
    expect(emit(prev, prev, action)).toEqual([]);
    for (const event of emit(prev, next, action)) expect(definition.events).toContain(event.name);
  });

  it('정의: E06, equation 모드만, fit, 오버레이 둘', () => {
    expect(definition.id).toBe('E06');
    expect(definition.modes).toEqual(['equation']);
    expect(definition.layout).toBe('fit');
    expect(Object.keys(definition.overlays ?? {}).sort()).toEqual(['big-tilt', 'match-bars']);
  });
});
