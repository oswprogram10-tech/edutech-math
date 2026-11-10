/**
 * E09 drag-test 모드 테스트(T101).
 *
 * 흔들기 결정성, 컴퍼스·원 위 점으로 만든 이등변·정삼각형, 눈대중 이등변의 붕괴,
 * 계급 1 거절, 연쇄 삭제, 각 고르기, 사각형 구성을 고정한다.
 */
import { describe, expect, it } from 'vitest';
import { assertSerializable } from '../../../core/engine-sdk';
import type { Observation } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import type { DragNode, DragTestState } from '../modes/drag-test/types';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { GeoAction, GeoConfig, GeoState } from '../types';

function apply(config: GeoConfig, actions: readonly GeoAction[]): DragTestState {
  const state = actions.reduce<GeoState>(
    (value, action) => reduce(value, action),
    createInitialState(config),
  );
  if (state.mode !== 'drag-test') throw new Error('drag-test 상태가 아니다');
  return state;
}

function idOf(state: DragTestState, label: string): string {
  const node = state.nodes.find((candidate) => 'label' in candidate && candidate.label === label);
  if (!node) throw new Error(`${label} 점이 없다`);
  return node.id;
}

function circles(state: DragTestState): (DragNode & { readonly kind: 'circle' })[] {
  return state.nodes.filter(
    (node): node is DragNode & { readonly kind: 'circle' } => node.kind === 'circle',
  );
}

function figure(state: DragTestState): Readonly<Record<string, unknown>> | null {
  const value = observe(state)['figure'];
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function figureProps(state: DragTestState): string[] {
  const value = figure(state)?.['props'];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function figureNames(state: DragTestState): string[] {
  const value = figure(state)?.['names'];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function lastShake(state: DragTestState): Readonly<Record<string, unknown>> | null {
  const value = observe(state)['lastShake'];
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function freeBase(seed = 1): GeoConfig {
  return { mode: 'drag-test', seed };
}

/** 자유점 ㄱ·ㄴ·ㄷ, 선분 ㄱㄴ, 컴퍼스 원 두 개, 교점 ㄹ, 선분 ㄱㄹ·ㄴㄹ. */
function isoscelesByCircles(seed = 1): DragTestState {
  let state = apply(freeBase(seed), [
    { type: 'add-point', at: [0, 0] },
    { type: 'add-point', at: [4, 0] },
    { type: 'add-point', at: [3, 7] },
  ]);
  const a = idOf(state, 'ㄱ');
  const b = idOf(state, 'ㄴ');
  const c = idOf(state, 'ㄷ');
  state = reduce(state, { type: 'add-segment', a, b }) as DragTestState;
  state = reduce(state, { type: 'add-circle', center: a, from: a, to: c }) as DragTestState;
  state = reduce(state, { type: 'add-circle', center: b, from: a, to: c }) as DragTestState;
  const [first, second] = circles(state);
  if (!first || !second) throw new Error('원이 없다');
  state = reduce(state, {
    type: 'add-intersection',
    of: [first.id, second.id],
    which: 0,
  }) as DragTestState;
  const d = idOf(state, 'ㄹ');
  state = reduce(state, { type: 'add-segment', a, b: d }) as DragTestState;
  state = reduce(state, { type: 'add-segment', a: b, b: d }) as DragTestState;
  return state;
}

/** 폭 ㄱㄴ인 두 원의 교점으로 만든 정삼각형. */
function equilateralByCircles(seed = 1): DragTestState {
  let state = apply(freeBase(seed), [
    { type: 'add-point', at: [0, 0] },
    { type: 'add-point', at: [4, 0] },
  ]);
  const a = idOf(state, 'ㄱ');
  const b = idOf(state, 'ㄴ');
  state = reduce(state, { type: 'add-segment', a, b }) as DragTestState;
  state = reduce(state, { type: 'add-circle', center: a, from: a, to: b }) as DragTestState;
  state = reduce(state, { type: 'add-circle', center: b, from: a, to: b }) as DragTestState;
  const [first, second] = circles(state);
  if (!first || !second) throw new Error('원이 없다');
  state = reduce(state, {
    type: 'add-intersection',
    of: [first.id, second.id],
    which: 0,
  }) as DragTestState;
  const c = idOf(state, 'ㄷ');
  state = reduce(state, { type: 'add-segment', a, b: c }) as DragTestState;
  state = reduce(state, { type: 'add-segment', a: b, b: c }) as DragTestState;
  return state;
}

/** 중심 ㄱ, 반지름 ㄱㄴ인 원 위의 점 ㄷ으로 만든 이등변삼각형. */
function isoscelesByOnCircle(seed = 1): DragTestState {
  let state = apply(freeBase(seed), [
    { type: 'add-point', at: [0, 0] },
    { type: 'add-point', at: [6, 0] },
  ]);
  const a = idOf(state, 'ㄱ');
  const b = idOf(state, 'ㄴ');
  state = reduce(state, { type: 'add-circle', center: a, from: a, to: b }) as DragTestState;
  const [circle] = circles(state);
  if (!circle) throw new Error('원이 없다');
  state = reduce(state, { type: 'add-on-circle', circle: circle.id, pos: 6 }) as DragTestState;
  const c = idOf(state, 'ㄷ');
  state = reduce(state, { type: 'add-segment', a, b }) as DragTestState;
  state = reduce(state, { type: 'add-segment', a, b: c }) as DragTestState;
  state = reduce(state, { type: 'add-segment', a: b, b: c }) as DragTestState;
  return state;
}

describe('E09 drag-test 흔들기 결정성', () => {
  const actions: GeoAction[] = [
    { type: 'add-point', at: [0, 0] },
    { type: 'add-point', at: [4, 0] },
    { type: 'add-point', at: [2, 5] },
    { type: 'shake' },
    { type: 'shake' },
    { type: 'shake' },
  ];

  it('같은 seed·같은 Action 목록은 같은 상태를 만든다', () => {
    const first = apply(freeBase(7), actions);
    const second = apply(freeBase(7), actions);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('seed가 다르면 결과가 다르다', () => {
    const first = apply(freeBase(7), actions);
    const second = apply(freeBase(8), actions);
    expect(JSON.stringify(first)).not.toBe(JSON.stringify(second));
  });

  it('되감기 뒤 다시 흔들어도 같은 위치다', () => {
    const before = apply(freeBase(3), actions.slice(0, 3));
    const once = reduce(before, { type: 'shake' }) as DragTestState;
    const twice = reduce(once, { type: 'shake' }) as DragTestState;
    const direct = apply(freeBase(3), [
      ...actions.slice(0, 3),
      { type: 'shake' },
      { type: 'shake' },
    ]);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(direct));
  });

  it('상태는 JSON 직렬화 가능하다', () => {
    assertSerializable(apply(freeBase(1), actions));
  });
});

describe('E09 drag-test 컴퍼스·원 위 점', () => {
  it('컴퍼스로 만든 이등변삼각형은 5번 흔들어도 equal-sides-2를 지킨다', () => {
    let state = isoscelesByCircles(1);
    for (let index = 0; index < 5; index += 1) {
      state = reduce(state, { type: 'shake' }) as DragTestState;
      const kept = stringsOf(lastShake(state)?.['kept']);
      expect(kept).toContain('equal-sides-2');
    }
    const observation = observe(state);
    expect(predicates['keptAfterShake']?.(observation, { props: ['equal-sides-2'] })).toBe(true);
    expect(predicates['usedTools']?.(observation, { kinds: ['circle', 'intersection'] })).toBe(
      true,
    );
  });

  it('컴퍼스로 만든 정삼각형은 5번 흔들어도 equal-sides-3·equal-angles-3을 지킨다', () => {
    let state = equilateralByCircles(1);
    for (let index = 0; index < 5; index += 1) {
      state = reduce(state, { type: 'shake' }) as DragTestState;
      const kept = stringsOf(lastShake(state)?.['kept']);
      expect(kept).toContain('equal-sides-3');
      expect(kept).toContain('equal-angles-3');
    }
    expect(figureNames(state)).toContain('equilateral');
  });

  it('원 위의 점으로 만든 이등변삼각형은 5번 흔들어도 equal-sides-2를 지킨다', () => {
    let state = isoscelesByOnCircle(1);
    expect(figureProps(state)).toContain('equal-sides-2');
    for (let index = 0; index < 5; index += 1) {
      state = reduce(state, { type: 'shake' }) as DragTestState;
      expect(stringsOf(lastShake(state)?.['kept'])).toContain('equal-sides-2');
    }
  });

  it('눈대중으로 만든 이등변삼각형은 seed 2에서 흔들면 equal-sides-2를 잃는다', () => {
    let state = apply(freeBase(2), [
      { type: 'add-point', at: [0, 0] },
      { type: 'add-point', at: [6, 0] },
      { type: 'add-point', at: [3, 4] },
    ]);
    const a = idOf(state, 'ㄱ');
    const b = idOf(state, 'ㄴ');
    const c = idOf(state, 'ㄷ');
    state = reduce(state, { type: 'add-segment', a, b }) as DragTestState;
    state = reduce(state, { type: 'add-segment', a, b: c }) as DragTestState;
    state = reduce(state, { type: 'add-segment', a: b, b: c }) as DragTestState;
    expect(figureProps(state)).toContain('equal-sides-2');
    state = reduce(state, { type: 'shake' }) as DragTestState;
    expect(stringsOf(lastShake(state)?.['lost'])).toContain('equal-sides-2');
    expect(predicates['lostAfterShake']?.(observe(state), { props: ['equal-sides-2'] })).toBe(true);
  });
});

describe('E09 drag-test 계급 규칙', () => {
  it('계급 1(원×원 교점) 점을 원 중심으로 쓰면 거절한다', () => {
    const before = isoscelesByCircles(1);
    const a = idOf(before, 'ㄱ');
    const b = idOf(before, 'ㄴ');
    const c = idOf(before, 'ㄹ');
    const after = reduce(before, { type: 'add-circle', center: c, from: a, to: b });
    expect(after).toBe(before);
    expect(circles(before).length).toBe(2);
  });

  it('교점이 사라지는 move-point는 거절한다', () => {
    let state = apply(freeBase(1), [
      { type: 'add-point', at: [0, 0] },
      { type: 'add-point', at: [2, 0] },
      { type: 'add-point', at: [4, 0] },
      { type: 'add-point', at: [2, 2] },
    ]);
    const d = idOf(state, 'ㄱ');
    const a = idOf(state, 'ㄴ');
    const b = idOf(state, 'ㄷ');
    const e = idOf(state, 'ㄹ');
    state = reduce(state, { type: 'add-circle', center: a, from: a, to: d }) as DragTestState;
    state = reduce(state, { type: 'add-circle', center: b, from: d, to: e }) as DragTestState;
    const [first, second] = circles(state);
    if (!first || !second) throw new Error('원이 없다');
    state = reduce(state, {
      type: 'add-intersection',
      of: [first.id, second.id],
      which: 0,
    }) as DragTestState;
    expect(state.nodes.some((node) => node.kind === 'intersection')).toBe(true);
    const before = state;
    const after = reduce(state, { type: 'move-point', id: b, at: [20, 0] }) as DragTestState;
    expect(after).toBe(before);
    const moved = after.nodes.find((node) => node.id === b);
    expect(moved?.kind).toBe('free');
    if (moved?.kind === 'free') expect(moved.at).toEqual([4, 0]);
  });

  it('remove-node는 의존하는 노드를 함께 지운다', () => {
    const state = isoscelesByCircles(1);
    const a = idOf(state, 'ㄱ');
    const after = reduce(state, { type: 'remove-node', id: a }) as DragTestState;
    expect(after.nodes.some((node) => node.id === a)).toBe(false);
    expect(after.nodes.every((node) => node.kind === 'free')).toBe(true);
    expect(after.nodes.length).toBe(2);
  });
});

describe('E09 drag-test 각 고르기', () => {
  it('같은 두 밑각은 흔들기 전후 모두 같다', () => {
    let state = isoscelesByOnCircle(1);
    const b = idOf(state, 'ㄴ');
    const c = idOf(state, 'ㄷ');
    state = reduce(state, { type: 'toggle-angle-pick', point: b }) as DragTestState;
    state = reduce(state, { type: 'toggle-angle-pick', point: c }) as DragTestState;
    state = reduce(state, { type: 'shake' }) as DragTestState;
    expect(observe(state)['pickedAnglesEqual']).toEqual({ before: true, after: true });
    expect(predicates['pickedAnglesInvariant']?.(observe(state), {})).toBe(true);
  });

  it('꼭지각과 밑각은 같지 않다', () => {
    let state = isoscelesByOnCircle(1);
    const a = idOf(state, 'ㄱ');
    const c = idOf(state, 'ㄷ');
    state = reduce(state, { type: 'toggle-angle-pick', point: a }) as DragTestState;
    state = reduce(state, { type: 'toggle-angle-pick', point: c }) as DragTestState;
    state = reduce(state, { type: 'shake' }) as DragTestState;
    expect(observe(state)['pickedAnglesEqual']).toEqual({ before: false, after: false });
    expect(predicates['pickedAnglesInvariant']?.(observe(state), {})).toBe(false);
  });
});

describe('E09 drag-test from-diagonals', () => {
  const config: GeoConfig = {
    mode: 'drag-test',
    construction: 'from-diagonals',
    diagonalToggles: ['bisect-each-other', 'equal-length', 'perpendicular'],
    shakeButton: true,
  };

  function toggled(
    conditions: readonly ('bisect-each-other' | 'equal-length' | 'perpendicular')[],
  ) {
    return apply(
      config,
      conditions.map((condition) => ({ type: 'toggle-condition' as const, condition })),
    );
  }

  it('처음 모양은 특별한 성질이 없는 사각형이다', () => {
    const state = apply(config, []);
    expect(state.quad?.kind).toBe('from-diagonals');
    expect(figureNames(state)).toEqual(['quadrilateral']);
    assertSerializable(state);
  });

  it('이등분+수직은 흔들어도 rhombus다', () => {
    let state = toggled(['bisect-each-other', 'perpendicular']);
    expect(figureNames(state)).toContain('rhombus');
    state = reduce(state, { type: 'shake' }) as DragTestState;
    expect(figureNames(state)).toContain('rhombus');
    expect(predicates['figureNamed']?.(observe(state), { name: 'rhombus' })).toBe(true);
  });

  it('이등분+같은 길이는 rectangle이다', () => {
    let state = toggled(['bisect-each-other', 'equal-length']);
    expect(figureNames(state)).toContain('rectangle');
    state = reduce(state, { type: 'shake' }) as DragTestState;
    expect(figureNames(state)).toContain('rectangle');
  });

  it('세 조건을 모두 켜면 square다', () => {
    let state = toggled(['bisect-each-other', 'equal-length', 'perpendicular']);
    expect(figureNames(state)).toContain('square');
    state = reduce(state, { type: 'shake' }) as DragTestState;
    expect(figureNames(state)).toContain('square');
    expect(
      predicates['togglesAre']?.(observe(state), {
        toggles: ['bisect-each-other', 'equal-length', 'perpendicular'],
      }),
    ).toBe(true);
  });

  it('수직만 켜고 γ≠1이면 rhombus가 아니고 diagonals-perpendicular가 있다', () => {
    const state = toggled(['perpendicular']);
    expect(figureNames(state)).not.toContain('rhombus');
    expect(figureProps(state)).toContain('diagonals-perpendicular');
    expect(predicates['figureNotNamed']?.(observe(state), { name: 'rhombus' })).toBe(true);
    expect(predicates['figureHas']?.(observe(state), { props: ['diagonals-perpendicular'] })).toBe(
      true,
    );
  });
});

describe('E09 drag-test quad-conditions', () => {
  const config: GeoConfig = {
    mode: 'drag-test',
    construction: 'quad-conditions',
    quadToggles: ['one-parallel-pair', 'two-parallel-pairs', 'equal-sides', 'right-angle'],
    shakeButton: true,
  };

  it('two-parallel-pairs는 parallelogram·trapezoid를 만든다', () => {
    let state = apply(config, [{ type: 'toggle-condition', condition: 'two-parallel-pairs' }]);
    expect(state.toggles).toEqual(['one-parallel-pair', 'two-parallel-pairs']);
    expect(figureNames(state)).toContain('parallelogram');
    expect(figureNames(state)).toContain('trapezoid');
    state = reduce(state, { type: 'shake' }) as DragTestState;
    expect(figureNames(state)).toContain('parallelogram');
  });

  it('equal-sides를 켜면 토글이 셋으로 닫힌다', () => {
    const state = apply(config, [{ type: 'toggle-condition', condition: 'equal-sides' }]);
    expect(state.toggles).toEqual(['one-parallel-pair', 'two-parallel-pairs', 'equal-sides']);
    expect(figureNames(state)).toContain('rhombus');
    expect(predicates['togglesAre']?.(observe(state), { toggles: ['equal-sides'] })).toBe(true);
  });

  it('two-parallel-pairs를 끄면 equal-sides도 꺼진다', () => {
    let state = apply(config, [{ type: 'toggle-condition', condition: 'equal-sides' }]);
    state = reduce(state, {
      type: 'toggle-condition',
      condition: 'two-parallel-pairs',
    }) as DragTestState;
    expect(state.toggles).toEqual(['one-parallel-pair']);
  });

  it('설정에 없는 토글은 무시한다', () => {
    const limited: GeoConfig = {
      mode: 'drag-test',
      construction: 'quad-conditions',
      quadToggles: ['two-parallel-pairs'],
    };
    const state = apply(limited, []);
    expect(reduce(state, { type: 'toggle-condition', condition: 'right-angle' })).toBe(state);
  });
});

describe('E09 drag-test events', () => {
  it('흔들면 shaken 이벤트에 kept·lost를 담는다', () => {
    const before = isoscelesByCircles(1);
    const after = reduce(before, { type: 'shake' });
    const events = emit(before, after);
    const shaken = events.find((event) => event.name === 'shaken');
    expect(shaken).toBeDefined();
    const payload = shaken?.payload as { count?: unknown; kept?: unknown } | undefined;
    expect(payload?.count).toBe(1);
    expect(stringsOf(payload?.kept)).toContain('equal-sides-2');
  });
});

/** Observation 타입을 직접 쓰는 자리(타입 좁히기 확인). */
export function observationOf(state: DragTestState): Observation {
  return observe(state);
}
