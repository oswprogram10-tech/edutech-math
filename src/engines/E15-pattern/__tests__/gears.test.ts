/** E15 gears 모드 단위 테스트: 맞닿음, 되돌리기, 예측 잠금, 오개념, 이벤트, 직렬화. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { gcd, isMeeting, lcm, meetingsUpTo } from '../gears';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { GearsConfig, GearsState, PatternAction, PatternState } from '../types';

function gears(state: PatternState): GearsState {
  if (state.mode !== 'gears') throw new Error('gears 상태가 아니다');
  return state;
}

function run(config: GearsConfig, actions: readonly PatternAction[]): GearsState {
  return gears(
    actions.reduce<PatternState>((s, action) => reduce(s, action), createInitialState(config)),
  );
}

const turns = (n: number, by: 1 | -1 = 1): PatternAction[] =>
  Array.from({ length: n }, () => ({ type: 'turn', by }));

function typed(text: string): PatternAction[] {
  return [...text].map((key) => ({ type: 'predict-type', key }));
}

describe('E15 gears 맞닿음', () => {
  it('4·6은 12칸, 24칸에서 맞닿는다', () => {
    const state = run({ mode: 'gears' }, turns(24));
    expect(state.meetings).toEqual([12, 24]);
    expect(isMeeting(state.settings, 12)).toBe(true);
    expect(isMeeting(state.settings, 6)).toBe(false);
    expect(isMeeting(state.settings, 0)).toBe(true);
  });

  it('6·9는 18칸, 서로소 3·5는 15칸, 같은 수 4·4는 4칸이다', () => {
    expect(run({ mode: 'gears', teethA: 6, teethB: 9 }, turns(36)).meetings).toEqual([18, 36]);
    expect(run({ mode: 'gears', teethA: 3, teethB: 5 }, turns(30)).meetings).toEqual([15, 30]);
    const same = run({ mode: 'gears', teethA: 4, teethB: 4 }, []);
    expect(meetingsUpTo(same.settings, 12)).toEqual([4, 8, 12]);
  });

  it('gcd·lcm 경계', () => {
    expect(gcd(12, 18)).toBe(6);
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(3, 5)).toBe(15);
    expect(lcm(7, 7)).toBe(7);
  });

  it('맞닿은 칸에서만 aligned이고 Observation에 최소공배수 값이 따로 없다', () => {
    const at12 = observe(run({ mode: 'gears' }, turns(12)));
    expect(at12['aligned']).toBe(true);
    expect(observe(run({ mode: 'gears' }, turns(5)))['aligned']).toBe(false);
    expect(Object.keys(at12).sort()).toEqual(
      [
        'aligned',
        'maxReached',
        'meetings',
        'misconceptions',
        'mode',
        'prediction',
        'steps',
        'teethA',
        'teethB',
      ].sort(),
    );
  });
});

describe('E15 gears 돌리기', () => {
  it('0과 maxSteps에서 자른다', () => {
    expect(run({ mode: 'gears' }, turns(1, -1)).steps).toBe(0);
    expect(run({ mode: 'gears', maxSteps: 12 }, turns(20)).steps).toBe(12);
    expect(run({ mode: 'gears', maxSteps: 12 }, [{ type: 'turn-to', steps: 99 }]).steps).toBe(12);
    expect(run({ mode: 'gears' }, [{ type: 'turn-to', steps: -5 }]).steps).toBe(0);
  });

  it('되돌려도 meetings와 maxReached는 지우지 않고, reset은 지운다', () => {
    const back = run({ mode: 'gears' }, [...turns(12), ...turns(5, -1)]);
    expect(back.steps).toBe(7);
    expect(back.meetings).toEqual([12]);
    expect(back.maxReached).toBe(12);
    const again = reduce(back, { type: 'turn-to', steps: 12 });
    expect(gears(again).meetings).toEqual([12]);
    const reset = run({ mode: 'gears' }, [...turns(12), { type: 'reset' }]);
    expect(reset.steps).toBe(0);
    expect(reset.meetings).toEqual([]);
    expect(reset.maxReached).toBe(0);
  });

  it('끌어서 한꺼번에 건너뛰어도 지나간 맞닿음을 센다', () => {
    const state = run({ mode: 'gears' }, [{ type: 'turn-to', steps: 25 }]);
    expect(state.meetings).toEqual([12, 24]);
  });

  it('잘못된 Action은 같은 상태를 돌려준다', () => {
    const start = createInitialState({ mode: 'gears' });
    expect(reduce(start, { type: 'turn', by: 2 as 1 })).toBe(start);
    expect(reduce(start, { type: 'turn-to', steps: Number.NaN })).toBe(start);
    expect(reduce(start, { type: 'predict-type', key: '5' })).toBe(start);
  });

  it('설정은 범위로 맞춘다', () => {
    const s = gears(createInitialState({ mode: 'gears', teethA: 1, teethB: 99, maxSteps: 3 }));
    expect(s.settings.teethA).toBe(3);
    expect(s.settings.teethB).toBe(12);
    expect(s.settings.maxSteps).toBe(12);
    expect(gears(createInitialState({ mode: 'gears' })).settings).toMatchObject({
      teethA: 4,
      teethB: 6,
      maxSteps: 60,
      predict: false,
      showLaps: true,
    });
  });
});

describe('E15 gears 예측', () => {
  const P: GearsConfig = { mode: 'gears', predict: true };

  it('예측을 정하기 전에는 돌릴 수 없다', () => {
    expect(run(P, turns(3)).steps).toBe(0);
    expect(run(P, [{ type: 'turn-to', steps: 5 }]).steps).toBe(0);
    expect(run(P, [...typed('12'), { type: 'predict-lock' }, ...turns(3)]).steps).toBe(3);
  });

  it('맨 앞 0·4자리·빈 값은 받지 않고 한 번 정하면 바꿀 수 없다', () => {
    expect(run(P, typed('0')).predictionDraft).toBe('');
    expect(run(P, typed('1234')).predictionDraft).toBe('123');
    expect(run(P, [{ type: 'predict-lock' }]).prediction).toBeNull();
    const locked = run(P, [...typed('24'), { type: 'predict-lock' }]);
    expect(locked.prediction).toBe('24');
    const after = run(P, [
      ...typed('24'),
      { type: 'predict-lock' },
      ...typed('5'),
      { type: 'predict-backspace' },
      { type: 'predict-lock' },
    ]);
    expect(after.prediction).toBe('24');
    expect(run(P, [...typed('12'), { type: 'predict-backspace' }]).predictionDraft).toBe('1');
  });

  it('predict가 꺼져 있으면 예측 Action은 무시한다', () => {
    const state = run({ mode: 'gears' }, [...typed('24'), { type: 'predict-lock' }]);
    expect(state.prediction).toBeNull();
    expect(state.predictionDraft).toBe('');
  });

  it('4·6에 24를 정하면 MC-LCM-AS-PRODUCT, 3·5에 15는 아니다', () => {
    const wrong = run(P, [...typed('24'), { type: 'predict-lock' }]);
    expect(observe(wrong)['misconceptions']).toEqual(['MC-LCM-AS-PRODUCT']);
    const detect = predicates['hasMisconception'];
    expect(detect?.(observe(wrong), { code: 'MC-LCM-AS-PRODUCT' })).toBe(true);
    const right = run(P, [...typed('12'), { type: 'predict-lock' }]);
    expect(observe(right)['misconceptions']).toEqual([]);
    const coprime = run({ ...P, teethA: 3, teethB: 5 }, [...typed('15'), { type: 'predict-lock' }]);
    expect(observe(coprime)['misconceptions']).toEqual([]);
    const same = run({ ...P, teethA: 4, teethB: 4 }, [...typed('16'), { type: 'predict-lock' }]);
    expect(observe(same)['misconceptions']).toEqual(['MC-LCM-AS-PRODUCT']);
  });
});

describe('E15 gears 판정과 이벤트', () => {
  it('predicate: metAtLeast, reachedSteps, predictionIs, predictionLocked', () => {
    const o = observe(
      run({ mode: 'gears', predict: true }, [
        ...typed('12'),
        { type: 'predict-lock' },
        ...turns(14),
        ...turns(4, -1),
      ]),
    );
    expect(predicates['metAtLeast']?.(o, { n: 1 })).toBe(true);
    expect(predicates['metAtLeast']?.(o, { n: 2 })).toBe(false);
    expect(predicates['reachedSteps']?.(o, { n: 14 })).toBe(true);
    expect(predicates['reachedSteps']?.(o, { n: 15 })).toBe(false);
    expect(predicates['predictionIs']?.(o, { value: 12 })).toBe(true);
    expect(predicates['predictionIs']?.(o, { value: 24 })).toBe(false);
    expect(predicates['predictionLocked']?.(o, {})).toBe(true);
    const fresh = observe(createInitialState({ mode: 'gears', predict: true }));
    expect(predicates['predictionLocked']?.(fresh, {})).toBe(false);
    expect(predicates['metAtLeast']?.(fresh, { n: 1 })).toBe(false);
  });

  it('돌리면 value-changed {value: 글자}를, 처음 맞닿을 때 gears-met을 낸다', () => {
    let state = createInitialState({ mode: 'gears', teethA: 3, teethB: 3 });
    const events: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const action: PatternAction = { type: 'turn', by: 1 };
      const next = reduce(state, action);
      for (const e of emit(state, next, action)) {
        events.push(`${e.name}:${JSON.stringify(e.payload)}`);
      }
      state = next;
    }
    expect(events).toEqual([
      'value-changed:{"value":"1"}',
      'value-changed:{"value":"2"}',
      'value-changed:{"value":"3"}',
      'gears-met:{"steps":3}',
    ]);
    // 되돌려도 다시 맞닿음 이벤트는 없다. 값 이벤트만 나간다.
    const back = reduce(state, { type: 'turn', by: -1 });
    expect(emit(state, back, { type: 'turn', by: -1 })).toEqual([
      { name: 'value-changed', payload: { value: '2' } },
    ]);
    // 바뀌지 않으면 이벤트가 없다.
    const start = createInitialState({ mode: 'gears' });
    const none: PatternAction = { type: 'turn', by: -1 };
    expect(emit(start, reduce(start, none), none)).toEqual([]);
  });

  it('상태·Observation은 JSON으로 직렬화된다', () => {
    const state = run({ mode: 'gears', predict: true }, [
      ...typed('24'),
      { type: 'predict-lock' },
      ...turns(13),
    ]);
    expect(() => assertSerializable(state)).not.toThrow();
    expect(() => assertSerializable(observe(state))).not.toThrow();
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
