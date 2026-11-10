/**
 * T105 대칭·합동 테스트. 합동 포개기, 선대칭 축, 점대칭 압정, 완성하기를
 * Observation과 predicates로만 확인한다(정답 문자열 비교 없음).
 */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import { predicates } from '../events';
import type {
  CongruenceConfig,
  CongruenceState,
  LineSymmetryConfig,
  LineSymmetryState,
  PointSymmetryConfig,
  PointSymmetryState,
  TransformAction,
  TransformConfig,
  TransformState,
} from '../types';

function apply(config: TransformConfig, actions: readonly TransformAction[]): TransformState {
  return actions.reduce<TransformState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

function congruenceState(
  config: CongruenceConfig,
  actions: readonly TransformAction[],
): CongruenceState {
  const state = apply(config, actions);
  if (state.mode !== 'congruence') throw new Error('congruence 상태가 아닙니다.');
  return state;
}

function lineState(
  config: LineSymmetryConfig,
  actions: readonly TransformAction[],
): LineSymmetryState {
  const state = apply(config, actions);
  if (state.mode !== 'line-symmetry') throw new Error('line-symmetry 상태가 아닙니다.');
  return state;
}

function pointState(
  config: PointSymmetryConfig,
  actions: readonly TransformAction[],
): PointSymmetryState {
  const state = apply(config, actions);
  if (state.mode !== 'point-symmetry') throw new Error('point-symmetry 상태가 아닙니다.');
  return state;
}

const OVERLAP_ACTIONS: readonly TransformAction[] = [
  { type: 'select-center', index: 2 },
  { type: 'turn', direction: 'cw', angle: 90, center: [6, 9] },
  { type: 'slide', dx: 1, dy: -2 },
];

function pairActions(pairs: readonly (readonly [number, number])[]): TransformAction[] {
  return pairs.map(([moving, fixed]) => ({ type: 'pair-sides', moving, fixed }));
}

describe('E10 congruence', () => {
  it('기본 설정에서 ㄷ 중심 시계 90° 뒤 1,−2 밀면 포개지고 대응점이 0,1,2,3이다', () => {
    const state = congruenceState({ mode: 'congruence' }, OVERLAP_ACTIONS);
    const result = observe(state);
    expect(result['overlapped']).toBe(true);
    expect(result['everOverlapped']).toBe(true);
    expect(result['correspondence']).toEqual([0, 1, 2, 3]);
    expect(result['moves']).toHaveLength(2);
    expect(predicates['overlapped']?.(result, undefined)).toBe(true);
  });

  it('quad-a와 quad-b는 넓이가 같아도 congruent가 아니다', () => {
    const result = observe(
      createInitialState({ mode: 'congruence', fixed: 'quad-b', moving: 'quad-a' }),
    );
    expect(result['fixedArea']).toBe(result['movingArea']);
    expect(result['congruent']).toBe(false);
  });

  it('대응변 네 짝을 바르게 지으면 sidePairsMatch, 하나라도 어긋나면 거짓이다', () => {
    const base = createInitialState({ mode: 'congruence' });
    const overlapped = OVERLAP_ACTIONS.reduce<TransformState>(
      (state, action) => reduce(state, action),
      base,
    );
    const correct = pairActions([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ]).reduce<TransformState>((state, action) => reduce(state, action), overlapped);
    expect(observe(correct)['sidePairsCorrect']).toBe(true);
    expect(predicates['sidePairsMatch']?.(observe(correct), undefined)).toBe(true);

    const wrong = pairActions([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 1],
    ]).reduce<TransformState>((state, action) => reduce(state, action), overlapped);
    expect(observe(wrong)['sidePairsCorrect']).toBe(false);
    expect(predicates['sidePairsMatch']?.(observe(wrong), undefined)).toBe(false);
  });
});

describe('E10 line-symmetry find-axis', () => {
  it('직사각형 축 두 개를 서로 다른 점 쌍으로 세 번 접으면 axesFound가 2다', () => {
    const state = lineState({ mode: 'line-symmetry' }, [
      { type: 'pick-point', at: [4, 0] },
      { type: 'pick-point', at: [4, 8] },
      { type: 'fold' },
      { type: 'pick-point', at: [4, 1] },
      { type: 'pick-point', at: [4, 7] },
      { type: 'fold' },
      { type: 'pick-point', at: [0, 4] },
      { type: 'pick-point', at: [8, 4] },
      { type: 'fold' },
    ]);
    const result = observe(state);
    const rectangle = (result['shapes'] as readonly Record<string, unknown>[]).find(
      (entry) => entry['id'] === 'rectangle',
    );
    expect(result['folds']).toHaveLength(3);
    expect(rectangle?.['axesFound']).toBe(2);
    expect(predicates['axesFound']?.(result, { shape: 'rectangle', count: 2 })).toBe(true);
  });

  it('직사각형 대각선 접기는 diagonal이 참이고 ok가 거짓이다', () => {
    const state = lineState({ mode: 'line-symmetry' }, [
      { type: 'pick-point', at: [2, 3] },
      { type: 'pick-point', at: [6, 5] },
      { type: 'fold' },
    ]);
    const result = observe(state);
    expect(result['lastFold']).toEqual({ ok: false, diagonal: true });
    expect(predicates['triedDiagonalAxis']?.(result, { shape: 'rectangle' })).toBe(true);
    expect(predicates['lastFoldOk']?.(result, undefined)).toBe(false);
  });

  it('정육각형은 축을 여섯 개 찾을 수 있다', () => {
    const axes: readonly (readonly [[number, number], [number, number]])[] = [
      [
        [5, 3],
        [4, 3],
      ],
      [
        [4, 4],
        [4, 3],
      ],
      [
        [3, 4],
        [4, 3],
      ],
      [
        [5, 4],
        [4, 3],
      ],
      [
        [3, 5],
        [4, 3],
      ],
      [
        [2, 4],
        [4, 3],
      ],
    ];
    const actions: TransformAction[] = [{ type: 'select-shape', index: 2 }];
    for (const [from, to] of axes) {
      actions.push(
        { type: 'pick-point', at: from },
        { type: 'pick-point', at: to },
        { type: 'fold' },
      );
    }
    const result = observe(lineState({ mode: 'line-symmetry' }, actions));
    expect(predicates['axesFound']?.(result, { shape: 'regular-hexagon', count: 6 })).toBe(true);
  });
});

describe('E10 point-symmetry pin', () => {
  it('평행사변형은 압정 (8,9)에서 중심을 찾고 (8,8)에서는 아니다', () => {
    const found = observe(
      pointState({ mode: 'point-symmetry' }, [
        { type: 'place-pin', at: [8, 9] },
        { type: 'turn-180' },
      ]),
    );
    expect(found['overlaps']).toBe(true);
    expect(found['centerFound']).toEqual(['parallelogram']);
    expect(predicates['centerFound']?.(found, { shape: 'parallelogram' })).toBe(true);

    const miss = observe(
      pointState({ mode: 'point-symmetry' }, [
        { type: 'place-pin', at: [8, 8] },
        { type: 'turn-180' },
      ]),
    );
    expect(miss['overlaps']).toBe(false);
    expect(miss['centerFound']).toEqual([]);
  });

  it('글자 S는 (9,9), 글자 N은 (10,9)에서 중심을 찾는다', () => {
    const result = observe(
      pointState({ mode: 'point-symmetry' }, [
        { type: 'select-shape', index: 1 },
        { type: 'place-pin', at: [9, 9] },
        { type: 'turn-180' },
        { type: 'select-shape', index: 2 },
        { type: 'place-pin', at: [10, 9] },
        { type: 'turn-180' },
      ]),
    );
    expect(result['centerFound']).toEqual(['letter-S', 'letter-N']);
  });

  it('정오각형은 모든 반 칸 압정에서 겹치지 않는다', () => {
    let state = pointState({ mode: 'point-symmetry' }, [{ type: 'select-shape', index: 3 }]);
    for (let y = 0; y <= 18; y += 1) {
      for (let x = 0; x <= 18; x += 1) {
        state = reduce(state, { type: 'place-pin', at: [x, y] }) as PointSymmetryState;
        state = reduce(state, { type: 'turn-180' }) as PointSymmetryState;
        expect(observe(state)['overlaps']).toBe(false);
      }
    }
  });

  it('뒤집기는 flipUsed를 남긴다', () => {
    const result = observe(
      pointState({ mode: 'point-symmetry' }, [
        { type: 'place-pin', at: [8, 9] },
        { type: 'flip', side: 'left' },
      ]),
    );
    expect(result['flipUsed']).toBe(true);
    expect(predicates['flipUsed']?.(result, undefined)).toBe(true);
  });
});

describe('E10 대칭 완성하기', () => {
  it('점대칭 반쪽을 바르게 완성하면 closed·symmetric이다', () => {
    const state = pointState({ mode: 'point-symmetry', task: 'complete' }, [
      { type: 'add-vertex', at: [6, 6] },
      { type: 'add-vertex', at: [4, 6] },
      { type: 'add-vertex', at: [2, 4] },
      { type: 'add-vertex', at: [2, 2] },
    ]);
    const result = observe(state);
    expect(result['closed']).toBe(true);
    expect(result['symmetric']).toBe(true);
    expect(predicates['completedSymmetric']?.(result, undefined)).toBe(true);
  });

  it('점대칭 반쪽을 틀리게 닫으면 closed는 참이지만 symmetric은 거짓이다', () => {
    const result = observe(
      pointState({ mode: 'point-symmetry', task: 'complete' }, [
        { type: 'add-vertex', at: [6, 6] },
        { type: 'add-vertex', at: [4, 6] },
        { type: 'add-vertex', at: [2, 2] },
      ]),
    );
    expect(result['closed']).toBe(true);
    expect(result['symmetric']).toBe(false);
    expect(predicates['completedSymmetric']?.(result, undefined)).toBe(false);
  });

  it('선대칭 반쪽도 바르게·틀리게 완성할 수 있다', () => {
    const correct = observe(
      lineState({ mode: 'line-symmetry', task: 'complete' }, [
        { type: 'add-vertex', at: [4, 7] },
        { type: 'add-vertex', at: [5, 7] },
        { type: 'add-vertex', at: [7, 5] },
        { type: 'add-vertex', at: [6, 2] },
        { type: 'add-vertex', at: [4, 1] },
      ]),
    );
    expect(correct['closed']).toBe(true);
    expect(correct['symmetric']).toBe(true);

    const wrong = observe(
      lineState({ mode: 'line-symmetry', task: 'complete' }, [
        { type: 'add-vertex', at: [4, 7] },
        { type: 'add-vertex', at: [6, 6] },
        { type: 'add-vertex', at: [4, 1] },
      ]),
    );
    expect(wrong['closed']).toBe(true);
    expect(wrong['symmetric']).toBe(false);
  });
});

describe('E10 여섯 모드 직렬화', () => {
  it('여섯 모드 상태와 Observation이 JSON으로 왕복한다', () => {
    const configs: readonly TransformConfig[] = [
      { mode: 'slide-flip-turn' },
      { mode: 'predict' },
      { mode: 'tessellation' },
      { mode: 'congruence' },
      { mode: 'line-symmetry' },
      { mode: 'point-symmetry' },
    ];
    const modes = new Set<string>();
    for (const config of configs) {
      const state = createInitialState(config);
      modes.add(state.mode);
      assertSerializable(state);
      assertSerializable(observe(state));
    }
    expect([...modes].sort()).toEqual([
      'congruence',
      'line-symmetry',
      'point-symmetry',
      'predict',
      'slide-flip-turn',
      'tessellation',
    ]);
  });
});
