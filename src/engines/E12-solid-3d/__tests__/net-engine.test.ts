import { describe, expect, it, vi } from 'vitest';
import { assertSerializable, type JsonValue, type Observation } from '../../../core/engine-sdk';
import { emit, EVENT_NAMES, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { NetFoldConfig, SolidAction, SolidConfig, SolidState } from '../types';

function checkPred(name: string, observation: Observation, args?: JsonValue): boolean {
  const fn = predicates[name];
  if (!fn) throw new Error(`Missing predicate: ${name}`);
  return fn(observation, args);
}

function apply(config: SolidConfig, actions: readonly SolidAction[]): SolidState {
  let state = createInitialState(config);
  assertSerializable(state);
  for (const action of actions) {
    state = reduce(state, action);
    assertSerializable(state);
  }
  return state;
}

const CROSS_COORDS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [3, 1],
  [1, 2],
];

const CROSS_PLACE_ACTIONS: readonly SolidAction[] = CROSS_COORDS.map(([x, y]) => ({
  type: 'place-face',
  x,
  y,
}));

describe('E12 net-fold reduce, observe, predicates, events', () => {
  it('Action별 무시 조건을 지킨다', () => {
    // 모눈 밖 & 겹침 & maxFaces & remove locked
    const baseConfig: NetFoldConfig = {
      mode: 'net-fold',
      grid: [4, 4],
      maxFaces: 6,
      given: [{ at: [1, 1], w: 1, h: 1, label: '★☆', locked: true }],
    };
    const s0 = createInitialState(baseConfig);
    expect(s0.mode).toBe('net-fold');
    if (s0.mode !== 'net-fold') return;
    expect(s0.faces).toEqual([{ x: 1, y: 1, w: 1, h: 1, label: '★', locked: true }]);

    // 모눈 밖 무시
    expect(reduce(s0, { type: 'place-face', x: -1, y: 0 })).toBe(s0);
    expect(reduce(s0, { type: 'place-face', x: 4, y: 0 })).toBe(s0);

    // 겹침 무시
    expect(reduce(s0, { type: 'place-face', x: 1, y: 1 })).toBe(s0);

    // 잠긴 면 remove 무시
    expect(reduce(s0, { type: 'remove-face', x: 1, y: 1 })).toBe(s0);

    // 빈 칸 remove 무시
    expect(reduce(s0, { type: 'remove-face', x: 0, y: 0 })).toBe(s0);

    // maxFaces 도달 시 무시
    let sFull: SolidState = s0;
    for (const [x, y] of [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [0, 1],
    ] as const) {
      sFull = reduce(sFull, { type: 'place-face', x, y });
    }
    expect(sFull.mode === 'net-fold' && sFull.faces.length).toBe(6);
    expect(reduce(sFull, { type: 'place-face', x: 2, y: 1 })).toBe(sFull);

    // folded일 때 place/remove/predict 무시
    const folded = reduce(sFull, { type: 'fold' });
    expect(reduce(folded, { type: 'remove-face', x: 0, y: 0 })).toBe(folded);
    expect(reduce(folded, { type: 'place-face', x: 3, y: 3 })).toBe(folded);

    // clear는 잠긴 면만 남기고 folded=false
    const cleared = reduce(folded, { type: 'clear' });
    expect(cleared.mode === 'net-fold' && cleared.faces).toHaveLength(1);
    expect(cleared.mode === 'net-fold' && cleared.folded).toBe(false);

    // !editable일 때 place/remove/select-shape/rotate-shape/clear 무시
    const ro = createInitialState({
      mode: 'net-fold',
      target: 'cuboid',
      dims: [4, 3, 2],
      grid: [8, 10],
      editable: false,
      given: [{ at: [0, 0], w: 4, h: 3 }],
    });
    expect(reduce(ro, { type: 'place-face', x: 4, y: 0 })).toBe(ro);
    expect(reduce(ro, { type: 'remove-face', x: 0, y: 0 })).toBe(ro);
    expect(reduce(ro, { type: 'select-shape', w: 4, h: 2 })).toBe(ro);
    expect(reduce(ro, { type: 'rotate-shape' })).toBe(ro);
    expect(reduce(ro, { type: 'clear' })).toBe(ro);

    // !foldable일 때 fold 무시
    const noFold = createInitialState({ mode: 'net-fold', foldable: false });
    expect(reduce(noFold, { type: 'fold' })).toBe(noFold);
  });

  it('직육면체 모양 선택·회전 및 교차 모드 Action 무시', () => {
    const state = apply(
      {
        mode: 'net-fold',
        target: 'cuboid',
        dims: [4, 3, 2],
        grid: [8, 10],
      },
      [
        { type: 'select-shape', w: 4, h: 2 },
        { type: 'rotate-shape' },
        { type: 'select-shape', w: 9, h: 9 }, // 허용 안 됨 -> 무시
      ],
    );
    expect(state.mode).toBe('net-fold');
    if (state.mode !== 'net-fold') return;
    expect(state.shape).toEqual([2, 4]);

    // cubes 전용 Action 무시
    expect(reduce(state, { type: 'add', x: 0, y: 0 })).toBe(state);
    // net 전용 Action을 cubes 상태에서 무시
    const cubes = createInitialState({ mode: 'cubes' });
    expect(reduce(cubes, { type: 'fold' })).toBe(cubes);
    expect(reduce(cubes, { type: 'place-face', x: 0, y: 0 })).toBe(cubes);
  });

  it('잘못된 target 및 given(크기·밖·겹침)은 경고 후 정리한다', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const state = createInitialState({
      mode: 'net-fold',
      target: 'prism' as unknown as 'cube',
      faceSize: 2,
      grid: [6, 6],
      given: [
        { at: [0, 0], w: 2, h: 2, label: 'ㄱ' }, // valid
        { at: [0, 0], w: 2, h: 2, label: 'ㄴ' }, // 겹침
        { at: [5, 0], w: 2, h: 2, label: 'ㄷ' }, // 모눈 밖
        { at: [2, 0], w: 1, h: 1, label: 'ㄹ' }, // 크기 불일치
      ],
    });
    expect(state.mode).toBe('net-fold');
    if (state.mode !== 'net-fold') return;
    expect(state.settings.target).toBe('cube');
    expect(state.faces).toEqual([{ x: 0, y: 0, w: 2, h: 2, label: 'ㄱ', locked: false }]);
    expect(warnSpy).toHaveBeenCalledTimes(4);
    warnSpy.mockRestore();
  });

  it('predict 흐름: 기준 면·존재하지 않는 면·접은 뒤 예측은 무시된다', () => {
    const predictConfig: NetFoldConfig = {
      mode: 'net-fold',
      editable: false,
      predict: { of: '★' },
      given: [
        { at: [0, 0], w: 1, h: 1, label: '★' },
        { at: [0, 1], w: 1, h: 1, label: 'ㄱ' },
        { at: [1, 1], w: 1, h: 1, label: 'ㄴ' },
        { at: [2, 1], w: 1, h: 1, label: 'ㄷ' },
        { at: [3, 1], w: 1, h: 1, label: 'ㄹ' },
        { at: [2, 2], w: 1, h: 1, label: 'ㅁ' },
      ],
    };
    const s0 = createInitialState(predictConfig);
    expect(reduce(s0, { type: 'predict', label: '★' })).toBe(s0);
    expect(reduce(s0, { type: 'predict', label: 'ㅎ' })).toBe(s0);

    // 이웃 면(ㄱ) 예측 -> predictedAdjacent true
    const sAdj = reduce(s0, { type: 'predict', label: 'ㄱ' });
    expect(checkPred('predictedAdjacent', observe(sAdj), { of: '★' })).toBe(true);
    expect(checkPred('predictedOpposite', observe(sAdj), { of: '★' })).toBe(false);

    // 접기 전에 마주 보는 면(ㅁ)으로 바꿈 -> 접은 뒤 변경 불가
    const sOpp = reduce(sAdj, { type: 'predict', label: 'ㅁ' });
    const sFolded = reduce(sOpp, { type: 'fold' });
    expect(reduce(sFolded, { type: 'predict', label: 'ㄱ' })).toBe(sFolded);

    const obs = observe(sFolded);
    expect(obs['prediction']).toBe('ㅁ');
    expect(obs['predictedBeforeFold']).toBe(true);
    expect(checkPred('predictedOpposite', obs, { of: '★' })).toBe(true);
    expect(checkPred('predictedAdjacent', obs, { of: '★' })).toBe(false);
    expect(checkPred('oppositeIs', obs, { a: '★', b: 'ㅁ' })).toBe(true);
  });

  it('netLog가 회전·뒤집어 같은 전개도는 중복 기록하지 않고, 새 전개도는 추가한다', () => {
    let state = apply({ mode: 'net-fold', netLog: true }, [
      ...CROSS_PLACE_ACTIONS,
      { type: 'fold' },
    ]);
    expect(state.mode === 'net-fold' && state.foundNets).toHaveLength(1);
    expect(checkPred('foundNetsAtLeast', observe(state), { n: 1 })).toBe(true);
    expect(checkPred('foundNetsAtLeast', observe(state), { n: 2 })).toBe(false);

    // 지우고(foundNets 유지) 90° 회전한 십자를 다시 접어도 개수 1 유지
    state = reduce(state, { type: 'clear' });
    for (const [x, y] of [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
      [1, 3],
    ] as const) {
      state = reduce(state, { type: 'place-face', x, y });
    }
    state = reduce(state, { type: 'fold' });
    expect(state.mode === 'net-fold' && state.foundNets).toHaveLength(1);

    // 다른 전개도 (1-4-1: (0,0)(0,1)(1,1)(2,1)(3,1)(2,2)) -> 2개
    state = reduce(state, { type: 'clear' });
    for (const [x, y] of [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [2, 2],
    ] as const) {
      state = reduce(state, { type: 'place-face', x, y });
    }
    state = reduce(state, { type: 'fold' });
    expect(state.mode === 'net-fold' && state.foundNets).toHaveLength(2);
    expect(checkPred('foundNetsAtLeast', observe(state), { n: 2 })).toBe(true);
  });

  it('JSON 왕복 직렬화가 손실 없이 된다', () => {
    const state = apply({ mode: 'net-fold', netLog: true }, [
      ...CROSS_PLACE_ACTIONS,
      { type: 'fold' },
      { type: 'turn', dir: 'right' },
    ]);
    const roundtrip = JSON.parse(JSON.stringify(state)) as SolidState;
    expect(roundtrip).toEqual(state);
    expect(observe(roundtrip)).toEqual(observe(state));
  });

  it('접기 전(folded:false)에도 판정 predicate들이 동작하고 잘못된 인자는 false다', () => {
    const validUnfolded = apply({ mode: 'net-fold' }, CROSS_PLACE_ACTIONS);
    const obsValid = observe(validUnfolded);
    expect(obsValid['folded']).toBe(false);
    expect(checkPred('netValid', obsValid)).toBe(true);
    expect(checkPred('netSixInvalid', obsValid)).toBe(false);
    expect(checkPred('netFaceCountIs', obsValid, { n: 6 })).toBe(true);
    expect(checkPred('netFaceCountIs', obsValid, { n: '6' })).toBe(false);
    expect(checkPred('netFaceCountIs', obsValid)).toBe(false);

    // 일렬 6 -> netSixInvalid
    const line6 = apply(
      { mode: 'net-fold' },
      [0, 1, 2, 3, 4, 5].map((x) => ({ type: 'place-face', x, y: 0 }) as const),
    );
    const obsInvalid = observe(line6);
    expect(checkPred('netValid', obsInvalid)).toBe(false);
    expect(checkPred('netSixInvalid', obsInvalid)).toBe(true);
    expect(checkPred('predictedOpposite', obsInvalid, { of: 123 })).toBe(false);
    expect(checkPred('oppositeIs', obsInvalid, { a: '★' })).toBe(false);
  });

  it('cubes predicate는 모두 net 관찰에서 false를 돌려준다', () => {
    const netState = apply({ mode: 'net-fold' }, [...CROSS_PLACE_ACTIONS, { type: 'fold' }]);
    const obs = observe(netState);

    expect(checkPred('isConnected', obs)).toBe(false);
    expect(checkPred('countIs', obs, { count: 6 })).toBe(false);
    expect(checkPred('sameShape', obs, { cubes: [] })).toBe(false);
    expect(checkPred('projectionMatches', obs, { view: 'top', cells: [[1]] })).toBe(false);
    expect(checkPred('projectionsMatch', obs, { top: [[1]] })).toBe(false);
    expect(checkPred('heightsMatch', obs, { heights: [[1]] })).toBe(false);
    expect(checkPred('numbersMatch', obs, {})).toBe(false);
    expect(checkPred('numbersSum', obs, { sum: 0 })).toBe(false);
    expect(checkPred('layerPaintMatches', obs, {})).toBe(false);
    expect(checkPred('layerPaintFloating', obs, { against: 'cubes' })).toBe(false);
    expect(checkPred('layersMatch', obs, { layers: [[[1]]] })).toBe(false);
    expect(checkPred('paintedMatches', obs, { view: 'top' })).toBe(false);
    expect(checkPred('paintedMirrored', obs, { view: 'top' })).toBe(false);
    expect(checkPred('paintedShorter', obs, { view: 'front' })).toBe(false);
    expect(checkPred('countIsViewsMin', obs)).toBe(false);
    expect(checkPred('countIsViewsMax', obs)).toBe(false);
  });

  it('모든 공개 net 이벤트를 정확히 내보낸다', () => {
    expect(EVENT_NAMES).toContain('face-placed');
    expect(EVENT_NAMES).toContain('face-removed');
    expect(EVENT_NAMES).toContain('net-folded');
    expect(EVENT_NAMES).toContain('net-unfolded');
    expect(EVENT_NAMES).toContain('prediction-set');
    expect(EVENT_NAMES).toContain('view-turned');

    const s0 = createInitialState({
      mode: 'net-fold',
      predict: { of: '★' },
      given: [{ at: [1, 1], w: 1, h: 1, label: '★', locked: true }],
    });
    const s1 = reduce(s0, { type: 'place-face', x: 0, y: 1 });
    expect(emit(s0, s1)).toEqual([
      { name: 'face-placed', payload: { x: 0, y: 1, w: 1, h: 1, count: 2 } },
    ]);

    const s2 = reduce(s1, { type: 'remove-face', x: 0, y: 1 });
    expect(emit(s1, s2)).toEqual([
      { name: 'face-removed', payload: { x: 0, y: 1, w: 1, h: 1, count: 1 } },
    ]);

    const sPredConfig = createInitialState({
      mode: 'net-fold',
      predict: { of: '★' },
      given: [
        { at: [1, 1], w: 1, h: 1, label: '★' },
        { at: [0, 1], w: 1, h: 1, label: 'ㄱ' },
      ],
    });
    const sPred = reduce(sPredConfig, { type: 'predict', label: 'ㄱ' });
    expect(emit(sPredConfig, sPred)).toEqual([
      { name: 'prediction-set', payload: { label: 'ㄱ' } },
    ]);

    const sFold = reduce(sPred, { type: 'fold' });
    expect(emit(sPred, sFold)).toEqual([
      { name: 'net-folded', payload: { valid: false, overlapPairs: 0, missingCount: 4 } },
    ]);

    const sTurn = reduce(sFold, { type: 'turn', dir: 'right' });
    expect(emit(sFold, sTurn)).toEqual([{ name: 'view-turned', payload: { viewTurn: 1 } }]);

    const sUnfold = reduce(sTurn, { type: 'unfold' });
    expect(emit(sTurn, sUnfold)).toEqual([{ name: 'net-unfolded', payload: {} }]);
  });
});
