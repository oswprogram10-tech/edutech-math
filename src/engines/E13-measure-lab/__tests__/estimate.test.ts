/** E13 estimate 순수 로직 테스트: 눈금·끝 눈금, 자 끌기 자석, 어림 잠금, 반올림 경계, JSON 왕복. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { estimatePredicates } from '../estimate/events';
import { observeEstimate } from '../estimate/observe';
import { createEstimateState, reduceEstimate } from '../estimate/reduce';
import { nearestCm, snapRulerOffset } from '../estimate/settings';
import type { EstimateAction, EstimateConfig, EstimateState } from '../estimate/types';

const crayon: EstimateConfig = {
  mode: 'estimate',
  object: { name: 'crayon', lengthCm: '6.7' },
  ruler: { offsetCm: 3, draggable: true },
};

function make(config: EstimateConfig = crayon): EstimateState {
  return createEstimateState(config);
}

function play(state: EstimateState, ...actions: EstimateAction[]): EstimateState {
  return actions.reduce(reduceEstimate, state);
}

const move = (offsetCm: string): EstimateAction => ({ type: 'move-ruler', offsetCm });
const obs = (state: EstimateState) => observeEstimate(state);

describe('설정', () => {
  it('설정이 mode뿐이면 샌드박스 기본(크레파스, 눈금 3, 어림 먼저)', () => {
    const state = make({ mode: 'estimate' });
    expect(state.error).toBeNull();
    expect(state.rulerOffset).toBe('3');
    expect(state.estimateFirst).toBe(true);
    expect(state.draggable).toBe(true);
  });

  it('기본값: offsetCm 0, draggable true, estimateFirst false', () => {
    const state = make({ mode: 'estimate', object: { name: 'pencil', lengthCm: 12 } });
    expect(state.rulerOffset).toBe('0');
    expect(state.draggable).toBe(true);
    expect(state.estimateFirst).toBe(false);
  });

  it('lengthCm는 0.1 격자 문자열·숫자(6.7)를 받는다', () => {
    expect(make().lengthCm).toBe('67/10');
    expect(make({ ...crayon, object: { name: 'a', lengthCm: 6.7 } }).lengthCm).toBe('67/10');
    expect(make({ ...crayon, object: { name: 'a', lengthCm: '7' } }).lengthCm).toBe('7');
  });

  it.each([
    ['길이 0.9(1 미만)', { object: { name: 'a', lengthCm: '0.9' } }],
    ['길이 20.1(20 초과)', { object: { name: 'a', lengthCm: '20.1' } }],
    ['0.1 격자 아님', { object: { name: 'a', lengthCm: '6.75' } }],
    ['물건 없음', { object: undefined }],
    ['눈금 6', { ruler: { offsetCm: 6 } }],
    ['눈금 -1', { ruler: { offsetCm: -1 } }],
    ['눈금이 정수가 아님', { ruler: { offsetCm: 1.5 } }],
  ] as const)('잘못된 설정(%s)은 오류 상태이고 조작은 거절된다', (_name, partial) => {
    const state = make({ ...crayon, ...partial } as EstimateConfig);
    expect(state.error).not.toBeNull();
    expect(play(state, move('1'), { type: 'estimate', value: 5 })).toBe(state);
    expect(obs(state)).toMatchObject({ error: true, misconceptions: [] });
  });

  it('경계: 길이 1과 20, 눈금 0과 5는 허용', () => {
    expect(make({ ...crayon, object: { name: 'a', lengthCm: 1 } }).error).toBeNull();
    expect(make({ ...crayon, object: { name: 'a', lengthCm: 20 } }).error).toBeNull();
    expect(make({ ...crayon, ruler: { offsetCm: 5 } }).error).toBeNull();
    expect(make({ ...crayon, ruler: { offsetCm: 0 } }).error).toBeNull();
  });
});

describe('Observation', () => {
  it('눈금 3에서 길이 7이면 끝 눈금은 10이다', () => {
    const state = make({ ...crayon, object: { name: 'crayon', lengthCm: 7 } });
    expect(obs(state)).toMatchObject({
      mode: 'estimate',
      rulerOffset: '3',
      zeroAligned: false,
      endTick: '10',
      nearestCm: 7,
      estimate: null,
      estimateLocked: false,
      misconceptions: [],
    });
  });

  it('영점을 맞추면 끝 눈금이 길이와 같고 zeroAligned가 참이다', () => {
    const state = play(make({ ...crayon, object: { name: 'crayon', lengthCm: 7 } }), move('0'));
    expect(obs(state)).toMatchObject({ rulerOffset: '0', zeroAligned: true, endTick: '7' });
  });

  it('끝 눈금은 Rational로 정확히 더한다(6.7 + 0.5 = 7.2)', () => {
    const state = play(make(), move('1/2'));
    expect(obs(state)['endTick']).toBe('36/5');
    expect(obs(make())['endTick']).toBe('97/10');
  });

  it('nearestCm: 6.7은 7, 6.5는 7(반올림), 6.4는 6, 1은 1, 20은 20', () => {
    const near = (lengthCm: string) =>
      nearestCm(make({ ...crayon, object: { name: 'a', lengthCm } }));
    expect(near('6.7')).toBe(7);
    expect(near('6.5')).toBe(7);
    expect(near('6.4')).toBe(6);
    expect(near('1')).toBe(1);
    expect(near('20')).toBe(20);
    expect(near('1.5')).toBe(2);
  });
});

describe('자 끌기', () => {
  it('자석: 영점 1cm 안이면 0에 붙고, 그 밖은 0.5 격자로 맞춘다', () => {
    expect(snapRulerOffset(0).toString()).toBe('0');
    expect(snapRulerOffset(0.4).toString()).toBe('0');
    expect(snapRulerOffset(1).toString()).toBe('0'); // 1cm 안(경계 포함)
    expect(snapRulerOffset(1.2).toString()).toBe('1');
    expect(snapRulerOffset(1.3).toString()).toBe('3/2');
    expect(snapRulerOffset(2.76).toString()).toBe('3');
    expect(snapRulerOffset(-2).toString()).toBe('0');
    expect(snapRulerOffset(9).toString()).toBe('5');
    expect(snapRulerOffset(Number.NaN).toString()).toBe('0');
  });

  it('move-ruler는 0.5 격자·0~5만 받고 같은 자리는 거절한다', () => {
    const state = make();
    expect(play(state, move('2')).rulerOffset).toBe('2');
    expect(play(state, move('5/2')).rulerOffset).toBe('5/2');
    expect(play(state, move('0')).rulerOffset).toBe('0');
    expect(play(state, move('5')).rulerOffset).toBe('5');
    expect(play(state, move('3'))).toBe(state); // 같은 자리
    expect(play(state, move('6'))).toBe(state);
    expect(play(state, move('-1/2'))).toBe(state);
    expect(play(state, move('1/3'))).toBe(state); // 0.5 격자 아님
    expect(play(state, move('abc'))).toBe(state);
  });

  it('zeroAligned·rulerMoved 판정', () => {
    const start = make();
    expect(estimatePredicates['zeroAligned']?.(obs(start), undefined)).toBe(false);
    expect(estimatePredicates['rulerMoved']?.(obs(start), undefined)).toBe(false);
    const aligned = play(start, move('0'));
    expect(estimatePredicates['zeroAligned']?.(obs(aligned), undefined)).toBe(true);
    expect(estimatePredicates['rulerMoved']?.(obs(aligned), undefined)).toBe(true);
  });

  it('draggable이 false이면 자를 옮길 수 없다', () => {
    const state = make({ ...crayon, ruler: { offsetCm: 3, draggable: false } });
    expect(play(state, move('0'))).toBe(state);
  });

  it('reset은 자 위치만 되돌리고 잠긴 어림은 남긴다', () => {
    const state = play(
      make({ ...crayon, estimateFirst: true }),
      { type: 'estimate', value: 8 },
      move('0'),
    );
    expect(state.rulerOffset).toBe('0');
    const back = play(state, { type: 'reset' });
    expect(back.rulerOffset).toBe('3');
    expect(back.estimate).toBe(8);
    expect(back.estimateLocked).toBe(true);
    expect(obs(back)['rulerMoved']).toBe(false);
    // 이미 제자리이면 거절(상태 그대로).
    expect(play(back, { type: 'reset' })).toBe(back);
  });
});

describe('어림 먼저(estimateFirst)', () => {
  const first = { ...crayon, estimateFirst: true } as const;

  it('잠그기 전에는 자 이동을 거절한다', () => {
    const state = make(first);
    expect(play(state, move('0'))).toBe(state);
  });

  it('어림은 1~99 정수를 한 번만 넣는다', () => {
    const state = make(first);
    expect(play(state, { type: 'estimate', value: 0 })).toBe(state);
    expect(play(state, { type: 'estimate', value: 100 })).toBe(state);
    expect(play(state, { type: 'estimate', value: 2.5 })).toBe(state);
    const locked = play(state, { type: 'estimate', value: 7 });
    expect(locked).toMatchObject({ estimate: 7, estimateLocked: true });
    expect(play(locked, { type: 'estimate', value: 9 })).toBe(locked);
    expect(play(state, { type: 'estimate', value: 1 }).estimate).toBe(1);
    expect(play(state, { type: 'estimate', value: 99 }).estimate).toBe(99);
  });

  it('잠근 뒤에는 자를 옮길 수 있고 estimateLocked가 참이다', () => {
    const locked = play(make(first), { type: 'estimate', value: 7 });
    expect(play(locked, move('0')).rulerOffset).toBe('0');
    expect(estimatePredicates['estimateLocked']?.(obs(locked), undefined)).toBe(true);
    expect(obs(locked)).toMatchObject({ estimate: 7, estimateLocked: true });
  });

  it('estimateFirst가 아니면 어림 Action은 거절된다', () => {
    const state = make();
    expect(play(state, { type: 'estimate', value: 7 })).toBe(state);
  });
});

describe('JSON 왕복', () => {
  it('상태와 Observation은 JSON으로 직렬화된다', () => {
    const state = play(
      make({ ...crayon, estimateFirst: true }),
      { type: 'estimate', value: 7 },
      move('2'),
    );
    assertSerializable(state);
    assertSerializable(obs(state));
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(JSON.parse(JSON.stringify(obs(state)))).toEqual(obs(state));
  });
});
