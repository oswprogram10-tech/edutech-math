import { describe, expect, it } from 'vitest';
import definition from '../index';
import { emit, predicates, primaryValue, receive } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type {
  AddSubState,
  FractionModelAction,
  FractionModelConfig,
  FractionModelState,
  OverlayState,
  ShadeState,
} from '../types';

function shade(): ShadeState {
  return createInitialState({
    mode: 'shade',
    whole: { shape: 'bar', partsX: 4, shaded: [0, 1, 2] },
  }) as ShadeState;
}

function overlay(): OverlayState {
  return createInitialState({ mode: 'overlay-slicer', a: '1/2', b: '1/3' }) as OverlayState;
}

function addSub(): AddSubState {
  return createInitialState({ mode: 'add-sub', op: '+', a: '2/5', b: '4/5' }) as AddSubState;
}

function step(
  state: FractionModelState,
  action: FractionModelAction,
): {
  prev: FractionModelState;
  next: FractionModelState;
  events: ReturnType<typeof emit>;
} {
  const next = reduce(state, action);
  return { prev: state, next, events: emit(state, next, action) };
}

describe('E05 이벤트', () => {
  it('value-changed payload는 정확히 { value } 모양이다', () => {
    const { events } = step(shade(), { type: 'toggle-part', index: 3 });
    const changed = events.find((event) => event.name === 'value-changed');
    expect(changed).toEqual({ name: 'value-changed', payload: { value: '1' } });
    expect(Object.keys(changed?.payload as Record<string, unknown>)).toEqual(['value']);
  });

  it('칼선·색칠·겹치기·융합·풀기 이벤트를 낸다', () => {
    const partition = createInitialState({ mode: 'partition' });
    const cut = step(partition, {
      type: 'cut',
      tool: 'line',
      points: [
        { x: 500, y: 150 },
        { x: 500, y: 450 },
      ],
    });
    expect(cut.events.map((event) => event.name)).toContain('partitioned');

    const shaded = step(shade(), { type: 'toggle-part', index: 3 });
    expect(shaded.events.map((event) => event.name)).toContain('shaded');

    const overlaid = step(overlay(), { type: 'overlay' });
    expect(overlaid.events.map((event) => event.name)).toContain('overlaid');

    const mixedState = createInitialState({
      mode: 'mixed',
      direction: 'improper-to-mixed',
      value: '11/4',
    });
    const fused = step(mixedState, { type: 'fuse' });
    expect(fused.events.map((event) => event.name)).toContain('fused');

    const mixedToImproper = createInitialState({
      mode: 'mixed',
      direction: 'mixed-to-improper',
      value: '2 1/3',
      allowBreakWhole: true,
    });
    const broke = step(mixedToImproper, { type: 'break-whole' });
    expect(broke.events.map((event) => event.name)).toContain('broke-whole');
  });

  it('바뀐 것이 없으면 이벤트를 내지 않는다', () => {
    const state = shade();
    expect(emit(state, state, { type: 'toggle-part', index: 0 })).toEqual([]);
  });

  it('가분수를 융합해도 값은 그대로라 value-changed를 내지 않는다', () => {
    const state = createInitialState({
      mode: 'mixed',
      direction: 'improper-to-mixed',
      value: '11/4',
    });
    const { events } = step(state, { type: 'fuse' });
    expect(events.map((event) => event.name)).toEqual(['fused']);
  });
});

describe('E05 receive', () => {
  it('value-changed를 받으면 shade의 색칠 칸을 맞춘다', () => {
    const action = receive(shade(), { name: 'value-changed', payload: { value: '1/2' } }, {});
    expect(action).toEqual({ type: 'set-shade-value', value: '1/2' });
    const next = reduce(shade(), action as FractionModelAction) as ShadeState;
    expect(next.shaded).toEqual([0, 1]);
  });

  it('value-changed를 받으면 compare의 선택 막대를 맞춘다', () => {
    const compare = createInitialState({
      mode: 'compare',
      bars: [{ parts: 4, shaded: [] }],
    });
    const action = receive(compare, { name: 'value-changed', payload: { value: '2/4' } }, {});
    expect(action).toEqual({ type: 'set-bar-value', bar: 0, value: '1/2' });
    const next = reduce(compare, action as FractionModelAction);
    expect(observe(next, { mode: 'compare' })['wholes']).toEqual([
      expect.objectContaining({ shaded: 2, value: '1/2' }),
    ]);
  });

  it('다른 이벤트나 잘못된 payload는 무시한다', () => {
    expect(receive(shade(), { name: 'fused' }, {})).toBeNull();
    expect(receive(shade(), { name: 'value-changed', payload: { value: 'abc' } }, {})).toBeNull();
  });
});

describe('E05 predicates', () => {
  const config: FractionModelConfig = {
    mode: 'shade',
    whole: { shape: 'bar', partsX: 8, shaded: [0, 1, 2, 3, 4, 5] },
  };
  const observation = observe(createInitialState(config), config);

  it('shadedEquals는 동치 분수를 받아들인다', () => {
    expect(predicates['shadedEquals']?.(observation, { value: '3/4' })).toBe(true);
    expect(predicates['shadedEquals']?.(observation, { value: '6/8' })).toBe(true);
    expect(predicates['shadedEquals']?.(observation, { value: '2/3' })).toBe(false);
  });

  it('shadedRawIs는 표기까지 같아야 한다', () => {
    expect(predicates['shadedRawIs']?.(observation, { value: '6/8' })).toBe(true);
    expect(predicates['shadedRawIs']?.(observation, { value: '3/4' })).toBe(false);
  });

  it('isIrreducible은 기약 여부를 본다', () => {
    expect(predicates['isIrreducible']?.(observation, undefined)).toBe(false);
    const reduced = observe(
      createInitialState({
        mode: 'shade',
        whole: { shape: 'bar', partsX: 4, shaded: [0, 1, 2] },
      }),
      { mode: 'shade' },
    );
    expect(predicates['isIrreducible']?.(reduced, undefined)).toBe(true);
  });

  it('commonGridIs와 별칭 commonGridSize가 같은 판정을 한다', () => {
    let state = overlay();
    state = reduce(state, { type: 'overlay' }) as OverlayState;
    const observed = observe(state, { mode: 'overlay-slicer' });
    expect(predicates['commonGridIs']?.(observed, { size: 6 })).toBe(true);
    expect(predicates['commonGridSize']?.(observed, { size: 6 })).toBe(true);
    expect(predicates['commonGridIs']?.(observed, { size: 12 })).toBe(false);
  });

  it('differentCutFrom은 절단 서명을 비교한다', () => {
    let state = createInitialState({ mode: 'partition' });
    state = reduce(state, {
      type: 'cut',
      tool: 'line',
      points: [
        { x: 500, y: 150 },
        { x: 500, y: 450 },
      ],
    });
    const observed = observe(state, { mode: 'partition' });
    const signature = observed['cutSignature'];
    expect(typeof signature).toBe('string');
    expect(predicates['differentCutFrom']?.(observed, { signature: signature as string })).toBe(
      false,
    );
    expect(predicates['differentCutFrom']?.(observed, { signature: 'line:1,2-3,4' })).toBe(true);
  });

  it('eventAtLeast는 이벤트 횟수를 본다', () => {
    let state = addSub();
    state = reduce(state, { type: 'combine' }) as AddSubState;
    const observed = observe(state, { mode: 'add-sub' });
    expect(predicates['eventAtLeast']?.(observed, { name: 'fused', count: 1 })).toBe(true);
    expect(predicates['eventAtLeast']?.(observed, { name: 'overlaid' })).toBe(false);
    expect(predicates['eventAtLeast']?.(observed, { name: 'value-changed', count: 1 })).toBe(true);
  });

  it('isEqualPartition은 조각 수와 등분 여부를 함께 본다', () => {
    let state = createInitialState({ mode: 'partition' });
    for (const x of [325, 500, 675]) {
      state = reduce(state, {
        type: 'cut',
        tool: 'line',
        points: [
          { x, y: 150 },
          { x, y: 450 },
        ],
      });
    }
    const observed = observe(state, { mode: 'partition' });
    expect(predicates['isEqualPartition']?.(observed, { parts: 4 })).toBe(true);
    expect(predicates['isEqualPartition']?.(observed, { parts: 3 })).toBe(false);
  });
});

describe('E05 engine definition', () => {
  it('모드 순서와 이벤트 이름이 카드와 같다', () => {
    expect(definition.id).toBe('E05');
    expect(definition.modes).toEqual([
      'partition',
      'shade',
      'compare',
      'overlay-slicer',
      'discrete',
      'mixed',
      'add-sub',
      'decimal-grid',
    ]);
    expect(definition.events).toEqual([
      'partitioned',
      'shaded',
      'value-changed',
      'fused',
      'broke-whole',
      'overlaid',
    ]);
    expect(Object.keys(definition.overlays ?? {})).toEqual(['size-compare', 'grid-reveal']);
  });

  it('primaryValue는 모드마다 학생이 나타낸 수를 고른다', () => {
    expect(primaryValue(shade())).toBe('3/4');
    expect(primaryValue(createInitialState({ mode: 'discrete', items: 12 }))).toBe('0');
  });
});
