/** E13 estimate zoomLevels(mm 확대, T211) 순수 로직 테스트: 설정, zoom 토글, Observation, predicates, JSON 왕복. */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { estimatePredicates } from '../estimate/events';
import { observeEstimate } from '../estimate/observe';
import { createEstimateState, reduceEstimate } from '../estimate/reduce';
import { boardHeight } from '../estimate/layout';
import type { EstimateAction, EstimateConfig, EstimateState } from '../estimate/types';

const lead: EstimateConfig = {
  mode: 'estimate',
  object: { name: 'pencil', lengthCm: '3.7' },
  ruler: { offsetCm: 0, draggable: true },
  zoomLevels: ['cm', 'mm'],
};

function make(config: EstimateConfig = lead): EstimateState {
  return createEstimateState(config);
}
function play(state: EstimateState, ...actions: EstimateAction[]): EstimateState {
  return actions.reduce(reduceEstimate, state);
}
const zoom = (on: boolean): EstimateAction => ({ type: 'zoom', on });

describe('zoomLevels 설정', () => {
  it('기본과 [cm]은 확대가 없고, [cm, mm]만 확대 칸이 있다', () => {
    expect(make({ ...lead, zoomLevels: undefined }).zoomMm).toBe(false);
    expect(make({ ...lead, zoomLevels: ['cm'] }).zoomMm).toBe(false);
    expect(make().zoomMm).toBe(true);
    expect(make().zoomed).toBe(false);
  });

  it.each([
    ['mm만', ['mm']],
    ['순서가 반대', ['mm', 'cm']],
    ['모르는 단위', ['cm', 'km']],
    ['세 단계', ['cm', 'mm', 'um']],
    ['빈 배열', []],
  ])('잘못된 zoomLevels(%s)는 설정 오류다', (_name, zoomLevels) => {
    const state = make({ ...lead, zoomLevels });
    expect(state.error).not.toBeNull();
    expect(play(state, zoom(true))).toBe(state);
  });

  it('배열이 아닌 zoomLevels도 설정 오류다', () => {
    expect(make({ ...lead, zoomLevels: 'mm' as unknown as string[] }).error).not.toBeNull();
  });
});

describe('zoom Action', () => {
  it('켜고 끄는 토글이고, 같은 값으로 또 바꾸면 거절한다', () => {
    const start = make();
    const on = play(start, zoom(true));
    expect(on.zoomed).toBe(true);
    expect(on.moves).toBe(1);
    expect(play(on, zoom(true))).toBe(on);
    const off = play(on, zoom(false));
    expect(off.zoomed).toBe(false);
    expect(play(start, zoom(false))).toBe(start);
  });

  it("['cm']에서는 zoom을 거절한다", () => {
    const state = make({ ...lead, zoomLevels: ['cm'] });
    expect(play(state, zoom(true))).toBe(state);
    const plain = make({ ...lead, zoomLevels: undefined });
    expect(play(plain, zoom(true))).toBe(plain);
  });

  it('어림 먼저이고 아직 어림을 넣지 않았으면(자가 없으면) 거절한다', () => {
    const first = make({ ...lead, estimateFirst: true });
    expect(play(first, zoom(true))).toBe(first);
    const locked = play(first, { type: 'estimate', value: 4 }, zoom(true));
    expect(locked.zoomed).toBe(true);
  });

  it('boolean이 아닌 on은 거절한다', () => {
    const state = make();
    expect(play(state, { type: 'zoom', on: 1 as unknown as boolean })).toBe(state);
  });

  it('확대 중에도 자를 옮길 수 있고 확대는 그대로다', () => {
    const state = play(make({ ...lead, ruler: { offsetCm: 3 } }), zoom(true), {
      type: 'move-ruler',
      offsetCm: '0',
    });
    expect(state.zoomed).toBe(true);
    expect(state.rulerOffset).toBe('0');
  });

  it('[처음으로](자 제자리로)는 확대를 건드리지 않는다', () => {
    const state = play(
      make({ ...lead, ruler: { offsetCm: 3 } }),
      zoom(true),
      { type: 'move-ruler', offsetCm: '0' },
      { type: 'reset' },
    );
    expect(state.zoomed).toBe(true);
    expect(state.rulerOffset).toBe('3');
  });
});

describe('Observation·predicates·JSON', () => {
  it('3.7cm면 lengthMm은 37이다(Rational 문자열)', () => {
    const obs = observeEstimate(make());
    expect(obs).toMatchObject({ lengthCm: '37/10', lengthMm: '37', zoomed: false });
  });

  it('경계: 1cm는 10mm, 20cm는 200mm, 0.1cm 격자 6.5는 65mm', () => {
    const mm = (lengthCm: string) =>
      observeEstimate(make({ ...lead, object: { name: 'a', lengthCm } }))['lengthMm'];
    expect(mm('1')).toBe('10');
    expect(mm('20')).toBe('200');
    expect(mm('6.5')).toBe('65');
  });

  it('zoomLevels가 없으면 Observation에 zoomed·lengthMm이 붙지 않는다(기존 그대로)', () => {
    const obs = observeEstimate(make({ ...lead, zoomLevels: undefined }));
    expect(obs).not.toHaveProperty('zoomed');
    expect(obs).not.toHaveProperty('lengthMm');
  });

  it('zoomed predicate', () => {
    const p = estimatePredicates['zoomed'];
    expect(p?.(observeEstimate(make()), undefined)).toBe(false);
    expect(p?.(observeEstimate(play(make(), zoom(true))), undefined)).toBe(true);
  });

  it('상태와 Observation이 JSON으로 왕복한다', () => {
    const state = play(make(), zoom(true));
    assertSerializable(state);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    assertSerializable(observeEstimate(state));
  });

  it('논리 높이: mm 확대가 있으면 더 크지만 600 이하이고, 없으면 그대로 384', () => {
    expect(boardHeight()).toBe(384);
    expect(boardHeight(make({ ...lead, zoomLevels: ['cm'] }))).toBe(384);
    expect(boardHeight(make())).toBeGreaterThan(384);
    expect(boardHeight(make())).toBeLessThanOrEqual(600);
    // 확대를 켜고 꺼도 높이가 같다.
    expect(boardHeight(play(make(), zoom(true)))).toBe(boardHeight(make()));
  });
});
