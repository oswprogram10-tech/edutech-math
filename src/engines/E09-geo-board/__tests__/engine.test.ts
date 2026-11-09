/**
 * E09 기하판 reduce·observe 단위 테스트.
 *
 * 카드(T100) 결정 12의 경계 사례를 고정한다.
 */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import type { Observation } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { GeoAction, GeoConfig, GeoState } from '../types';

function apply(config: GeoConfig, actions: readonly GeoAction[]): GeoState {
  return actions.reduce<GeoState>(
    (state, action) => reduce(state, action),
    createInitialState(config),
  );
}

function observation(config: GeoConfig, actions: readonly GeoAction[]): Observation {
  return observe(apply(config, actions));
}

function shapes(observationValue: Observation): readonly Readonly<Record<string, unknown>>[] {
  const value = observationValue['shapes'];
  if (!Array.isArray(value)) return [];
  const result: Readonly<Record<string, unknown>>[] = [];
  for (const item of value) {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) result.push(item);
  }
  return result;
}

describe('E09 geoboard reduce', () => {
  it('같은 못을 연달아 넣으면 무시한다', () => {
    const state = apply({ mode: 'geoboard' }, [
      { type: 'start-band', peg: [0, 0] },
      { type: 'add-peg', peg: [0, 0] },
    ]);
    expect(state.mode).toBe('geoboard');
    if (state.mode !== 'geoboard') return;
    expect(state.bands).toHaveLength(1);
    expect(state.bands[0]?.pegs).toEqual([[0, 0]]);
  });

  it('못 2개로 close-band를 보내면 무시한다', () => {
    const state = apply({ mode: 'geoboard' }, [
      { type: 'start-band', peg: [0, 0] },
      { type: 'add-peg', peg: [2, 0] },
      { type: 'close-band' },
    ]);
    expect(state.mode).toBe('geoboard');
    if (state.mode !== 'geoboard') return;
    expect(state.bands[0]?.closed).toBe(false);
    expect(state.activeBand).not.toBeNull();
  });

  it('첫 못을 다시 고르면 닫히고, 일직선 못은 꼭짓점에서 빠진다', () => {
    const state = apply({ mode: 'geoboard', grid: [5, 5] }, [
      { type: 'start-band', peg: [0, 0] },
      { type: 'add-peg', peg: [1, 0] },
      { type: 'add-peg', peg: [2, 0] },
      { type: 'add-peg', peg: [2, 1] },
      { type: 'add-peg', peg: [1, 1] },
      { type: 'close-band' },
    ]);
    expect(state.mode).toBe('geoboard');
    if (state.mode !== 'geoboard') return;
    const band = state.bands[0];
    expect(band?.closed).toBe(true);
    const shape = shapes(observe(state))[0];
    expect(shape?.['vertices']).toBe(4);
    expect(shape?.['sides']).toBe(4);
    expect(shape?.['pegCount']).toBe(5);
    expect(shape?.['simple']).toBe(true);
  });

  it('넓이가 0인 일직선 삼각형은 단순 다각형이 아니다', () => {
    const state = apply({ mode: 'geoboard', grid: [5, 5] }, [
      { type: 'start-band', peg: [0, 0] },
      { type: 'add-peg', peg: [1, 0] },
      { type: 'add-peg', peg: [2, 0] },
      { type: 'close-band' },
    ]);
    const shape = shapes(observe(state))[0];
    expect(shape?.['simple']).toBe(false);
    expect(observe(state)['closedShapes']).toBe(0);
  });

  it('닫힌 고무줄의 꼭짓점을 끌어 옮긴다', () => {
    const state = apply({ mode: 'geoboard', grid: [5, 5] }, [
      { type: 'start-band', peg: [0, 0] },
      { type: 'add-peg', peg: [2, 0] },
      { type: 'add-peg', peg: [2, 2] },
      { type: 'close-band' },
      { type: 'move-peg', band: 'b1', index: 2, peg: [3, 2] },
    ]);
    expect(state.mode).toBe('geoboard');
    if (state.mode !== 'geoboard') return;
    expect(state.bands[0]?.pegs[2]).toEqual([3, 2]);
  });
});

describe('E09 geoboard observe', () => {
  it('거울상 사각형 두 개는 꼭짓점 4개 기준으로 합동이라 distinctBy["4"] = 1이다', () => {
    const config: GeoConfig = {
      mode: 'geoboard',
      grid: [6, 6],
      shapes: [
        [
          [0, 0],
          [2, 0],
          [2, 1],
          [0, 1],
        ],
        [
          [3, 0],
          [5, 0],
          [5, 1],
          [3, 1],
        ],
      ],
    };
    const result = observe(createInitialState(config));
    const distinct = result['distinctBy'];
    expect(distinct !== null && typeof distinct === 'object' && !Array.isArray(distinct)).toBe(
      true,
    );
    if (distinct === null || typeof distinct !== 'object' || Array.isArray(distinct)) return;
    expect(distinct['4']).toBe(1);
    expect(result['closedShapes']).toBe(2);
  });

  it('넓이는 같지만 합동이 아닌 두 도형은 서로 다른 도형으로 센다', () => {
    const config: GeoConfig = {
      mode: 'geoboard',
      grid: [6, 6],
      shapes: [
        [
          [0, 0],
          [2, 0],
          [2, 1],
          [0, 1],
        ],
        [
          [2, 1],
          [3, 0],
          [5, 0],
          [4, 1],
        ],
      ],
    };
    const result = observe(createInitialState(config));
    const distinct = result['distinctBy'];
    if (distinct === null || typeof distinct !== 'object' || Array.isArray(distinct)) {
      throw new Error('distinctBy가 없습니다.');
    }
    expect(distinct['4']).toBe(2);
  });

  it('shapeWithVertices 판정은 단순 다각형만 센다', () => {
    const config: GeoConfig = { mode: 'geoboard', grid: [5, 5] };
    const triangle = observation(config, [
      { type: 'start-band', peg: [0, 0] },
      { type: 'add-peg', peg: [2, 0] },
      { type: 'add-peg', peg: [0, 2] },
      { type: 'close-band' },
    ]);
    expect(predicates['shapeWithVertices']?.(triangle, { count: 3 })).toBe(true);
    expect(predicates['shapeWithVertices']?.(triangle, { count: 4 })).toBe(false);
  });
});

describe('E09 construct reduce·observe', () => {
  it('반직선 순서가 다르면 시작점이 달라 distinctRayStarts = 2다', () => {
    const config: GeoConfig = { mode: 'construct', grid: 5 };
    const result = observation(config, [
      { type: 'select-tool', tool: 'ray' },
      { type: 'pick', at: [0, 0] },
      { type: 'pick', at: [3, 0] },
      { type: 'pick', at: [0, 4] },
      { type: 'pick', at: [3, 4] },
    ]);
    expect(predicates['distinctRayStarts']?.(result, { count: 2 })).toBe(true);
    expect(predicates['distinctRayStarts']?.(result, { count: 3 })).toBe(false);
  });

  it('반직선 하나가 별 두 개를 정확히 맞힌다', () => {
    const config: GeoConfig = {
      mode: 'construct',
      grid: 5,
      targets: [
        [0, 0],
        [1, 0],
        [3, 0],
        [1, 2],
      ],
    };
    const result = observation(config, [
      { type: 'select-tool', tool: 'ray' },
      { type: 'pick', at: [0, 0] },
      { type: 'pick', at: [2, 0] },
    ]);
    expect(result['targetsHit']).toEqual([1, 2, 3]);
    expect(predicates['oneObjectHits']?.(result, { kind: 'ray', targets: [1, 2, 3] })).toBe(true);
    expect(predicates['oneObjectHits']?.(result, { kind: 'ray', targets: [1, 4] })).toBe(false);
    expect(predicates['hasObject']?.(result, { kind: 'ray', from: [0, 0], to: [2, 0] })).toBe(true);
    expect(predicates['hasObject']?.(result, { kind: 'ray', from: [2, 0], to: [0, 0] })).toBe(
      false,
    );
  });

  it('선분은 양 끝을 순서 없이 비교한다', () => {
    const config: GeoConfig = { mode: 'construct', grid: 5, points: [{ label: 'ㄱ', at: [0, 0] }] };
    const result = observation(config, [
      { type: 'pick', at: [0, 0] },
      { type: 'pick', at: [2, 0] },
    ]);
    expect(predicates['hasObject']?.(result, { kind: 'segment', from: 'ㄱ', to: '2,0' })).toBe(
      true,
    );
    expect(predicates['hasObject']?.(result, { kind: 'segment', from: '2,0', to: 'ㄱ' })).toBe(
      true,
    );
  });

  it('직각삼각자를 댄 각과 표시만 Observation에 담는다', () => {
    const config: GeoConfig = {
      mode: 'construct',
      grid: 5,
      tools: ['segment', 'ray', 'line', 'set-square'],
      angles: [
        { id: 'a1', vertex: [1, 1], a: [4, 1], b: [1, 4] },
        { id: 'a2', vertex: [1, 1], a: [4, 1], b: [3, 3] },
      ],
    };
    const result = observation(config, [
      { type: 'place-square', angle: 'a1' },
      { type: 'toggle-mark', angle: 'a1' },
    ]);
    expect(result['squareOn']).toBe('a1');
    expect(result['marked']).toEqual(['a1']);
    expect(result['rightAngles']).toEqual(['a1']);
    expect(predicates['markedAre']?.(result, { ids: ['a1'] })).toBe(true);
    expect(predicates['markedAre']?.(result, { ids: ['a1', 'a2'] })).toBe(false);
  });

  it('미리 그린 선은 학생 객체로 세지 않고 지울 수도 없다', () => {
    const config: GeoConfig = {
      mode: 'construct',
      grid: 5,
      given: [{ id: 'g1', kind: 'line', from: [0, 0], to: [4, 4] }],
    };
    const state = apply(config, [{ type: 'remove-object', id: 'g1' }]);
    expect(state.mode).toBe('construct');
    if (state.mode !== 'construct') return;
    expect(state.objects).toEqual([]);
    expect(state.settings.given.map((object) => object.id)).toEqual(['g1']);
  });

  it('given 반직선이 별을 지나도 학생 관찰·판정은 비어 있다', () => {
    const config: GeoConfig = {
      mode: 'construct',
      grid: 5,
      targets: [
        [1, 0],
        [3, 0],
        [1, 2],
      ],
      given: [{ id: 'g1', kind: 'ray', from: [0, 0], to: [1, 0] }],
    };
    const result = observation(config, []);
    expect(result['objects']).toEqual([]);
    expect(result['objectPoints']).toEqual([]);
    expect(result['targetPoints']).toEqual([
      [1, 0],
      [3, 0],
      [1, 2],
    ]);
    expect(result['targetsHit']).toEqual([]);
    expect(result['allTargetsHit']).toEqual([]);
    expect(predicates['hasObject']?.(result, { kind: 'ray', from: [0, 0], to: [1, 0] })).toBe(
      false,
    );
    expect(predicates['oneObjectHits']?.(result, { kind: 'ray', targets: [1] })).toBe(false);
    expect(predicates['distinctRayStarts']?.(result, { count: 1 })).toBe(false);
  });
});

describe('E09 상태 직렬화·이벤트', () => {
  it('두 모드의 상태와 Observation이 JSON으로 왕복한다', () => {
    const geoboard = apply(
      {
        mode: 'geoboard',
        grid: [5, 5],
        shapes: [
          [
            [0, 0],
            [2, 0],
            [2, 2],
          ],
        ],
      },
      [
        { type: 'start-band', peg: [1, 1] },
        { type: 'add-peg', peg: [3, 1] },
      ],
    );
    const construct = apply({ mode: 'construct', grid: 7 }, [
      { type: 'select-tool', tool: 'line' },
      { type: 'pick', at: [0, 0] },
      { type: 'pick', at: [3, 4] },
    ]);
    assertSerializable(geoboard);
    assertSerializable(construct);
    assertSerializable(observe(geoboard));
    assertSerializable(observe(construct));
  });

  it('도형이 닫힐 때 shape-closed 이벤트를 한 번 낸다', () => {
    const config: GeoConfig = { mode: 'geoboard', grid: [5, 5] };
    let state = createInitialState(config);
    const actions: GeoAction[] = [
      { type: 'start-band', peg: [0, 0] },
      { type: 'add-peg', peg: [2, 0] },
      { type: 'add-peg', peg: [2, 2] },
      { type: 'close-band' },
    ];
    const events: string[] = [];
    for (const action of actions) {
      const next = reduce(state, action);
      events.push(...emit(state, next).map((event) => event.name));
      state = next;
    }
    expect(events).toEqual(['shape-closed']);
  });
});
