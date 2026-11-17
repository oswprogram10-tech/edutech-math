import { describe, expect, it, vi } from 'vitest';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';

describe('E12 xray 상태·관측·판정(predicate)·이벤트', () => {
  it('설정 정규화: 범위 자르기, cube, 그릴 수 없는 크기는 sketch/display를 끈다', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const cubeState = createInitialState({
      mode: 'xray',
      solid: { type: 'cube', w: 3 },
      display: 'sketch',
      sketchGrid: 'isometric',
      fallback: 'ignore',
      variant: 'ignore',
    });
    expect(cubeState.settings.solid).toEqual({ type: 'cube', w: 3, d: 3, h: 3 });
    expect(cubeState.settings.display).toBe('sketch');
    expect(cubeState.settings.rotate).toBe(false);

    const clamped = createInitialState({
      mode: 'xray',
      solid: { type: 'cuboid', w: 9, d: 0, h: 2 },
      view: { yaw: 195, pitch: 90 },
      tools: [],
    });
    expect(clamped.settings.solid).toEqual({ type: 'cuboid', w: 6, d: 1, h: 2 });
    expect(clamped.view).toEqual({ yaw: -165, pitch: 75 });
    expect(clamped.tool).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockClear();
    const badSketch = createInitialState({
      mode: 'xray',
      solid: { type: 'cuboid', w: 4, d: 4, h: 2 },
      display: 'sketch',
      sketch: { prefill: 'visible' },
    });
    expect(badSketch.settings.sketch).toBe(false);
    expect(badSketch.settings.display).toBe('solid');
    expect(badSketch.segments).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('Action별 무시 조건을 지킨다', () => {
    const sLocked = createInitialState({
      mode: 'xray',
      rotate: false,
      xrayToggle: false,
      tools: ['face'],
      faceQuery: false,
      sketch: false,
    });
    expect(reduce(sLocked, { type: 'set-view', yaw: 60, pitch: 45 })).toBe(sLocked);
    expect(reduce(sLocked, { type: 'rotate-view', dYaw: 45, dPitch: 0 })).toBe(sLocked);
    expect(reduce(sLocked, { type: 'toggle-xray' })).toBe(sLocked);
    expect(reduce(sLocked, { type: 'set-tool', tool: 'edge' })).toBe(sLocked);
    expect(reduce(sLocked, { type: 'set-tool', tool: 'query' })).toBe(sLocked);
    expect(reduce(sLocked, { type: 'toggle-mark', kind: 'edge', id: 'x00' })).toBe(sLocked);
    expect(reduce(sLocked, { type: 'query-face', face: 'top' })).toBe(sLocked);
    expect(reduce(sLocked, { type: 'set-line-style', style: 'dashed' })).toBe(sLocked);
    expect(reduce(sLocked, { type: 'add-segment', a: [0, 0], b: [1, 0], style: 'solid' })).toBe(
      sLocked,
    );

    // sketch 격자 범위 밖, 같은 점, 잠긴 선분 무시
    const sSketch = createInitialState({
      mode: 'xray',
      solid: { type: 'cuboid', w: 4, d: 3, h: 2 },
      sketch: { prefill: 'visible' },
    });
    expect(reduce(sSketch, { type: 'add-segment', a: [99, 0], b: [0, 0], style: 'dashed' })).toBe(
      sSketch,
    );
    expect(reduce(sSketch, { type: 'add-segment', a: [0, 0], b: [0, 0], style: 'dashed' })).toBe(
      sSketch,
    );
    const lockedSeg = sSketch.segments[0];
    expect(lockedSeg).toBeDefined();
    if (lockedSeg) {
      expect(reduce(sSketch, { type: 'remove-segment', a: lockedSeg.a, b: lockedSeg.b })).toBe(
        sSketch,
      );
      expect(
        reduce(sSketch, {
          type: 'add-segment',
          a: lockedSeg.a,
          b: lockedSeg.b,
          style: 'dashed',
        }),
      ).toBe(sSketch);
    }
  });

  it('xrayUsed는 초기 true 설정으로 켜지지 않고 toggle-xray로 켤 때 true가 된다', () => {
    const s0 = createInitialState({ mode: 'xray', xray: true });
    expect(s0.xray).toBe(true);
    expect(s0.xrayUsed).toBe(false);

    const s1 = reduce(s0, { type: 'toggle-xray' });
    expect(s1.xray).toBe(false);
    expect(s1.xrayUsed).toBe(false);

    const s2 = reduce(s1, { type: 'toggle-xray' });
    expect(s2.xray).toBe(true);
    expect(s2.xrayUsed).toBe(true);

    const s3 = reduce(s2, { type: 'toggle-xray' });
    expect(s3.xray).toBe(false);
    expect(s3.xrayUsed).toBe(true);
  });

  it('상태는 JSON 왕복이 되고 고정 순서로 정렬한다', () => {
    let s = createInitialState({
      mode: 'xray',
      sketch: { prefill: 'none' },
      faceQuery: true,
    });
    s = reduce(s, { type: 'toggle-mark', kind: 'face', id: 'top' });
    s = reduce(s, { type: 'toggle-mark', kind: 'face', id: 'front' });
    s = reduce(s, { type: 'add-segment', a: [3, 3], b: [1, 1], style: 'dashed' });

    const roundtrip = JSON.parse(JSON.stringify(s));
    expect(roundtrip).toEqual(s);
    expect(s.marked.faces).toEqual(['front', 'top']);
    expect(s.segments[0]).toEqual({ a: [1, 1], b: [3, 3], style: 'dashed', locked: false });
  });

  it('xray predicate 7종과 잘못된 인자·다른 모드와의 상호 배타성을 만족한다', () => {
    let s = createInitialState({
      mode: 'xray',
      solid: { type: 'cuboid', w: 4, d: 3, h: 2 },
      sketch: { prefill: 'visible' },
    });
    expect(predicates.xrayUsedIs?.(observe(s), { value: false })).toBe(true);
    s = reduce(s, { type: 'toggle-xray' });
    expect(predicates.xrayUsedIs?.(observe(s), { value: true })).toBe(true);

    // bottom 표시 -> top과 평행
    s = reduce(s, { type: 'toggle-mark', kind: 'face', id: 'bottom' });
    expect(predicates.markedCountIs?.(observe(s), { kind: 'face', n: 1 })).toBe(true);
    expect(predicates.markedFacesParallelTo?.(observe(s), { face: 'top' })).toBe(true);
    expect(predicates.markedFacesParallelTo?.(observe(s), { face: 'bad' })).toBe(false);

    // 수직인 4면 표시
    s = reduce(s, { type: 'clear-marks' });
    for (const f of ['front', 'back', 'left', 'right']) {
      s = reduce(s, { type: 'toggle-mark', kind: 'face', id: f });
    }
    expect(predicates.markedFacesPerpendicularTo?.(observe(s), { face: 'top' })).toBe(true);

    // 모든 면 추가 -> allMarked face
    for (const f of ['bottom', 'top']) {
      s = reduce(s, { type: 'toggle-mark', kind: 'face', id: f });
    }
    expect(predicates.allMarked?.(observe(s), { kind: 'face' })).toBe(true);

    // 숨은 모서리 실선 -> sketchHiddenDrawnSolid
    const sSolid = reduce(s, {
      type: 'add-segment',
      a: [3, 3],
      b: [11, 3],
      style: 'solid',
    });
    expect(predicates.sketchHiddenDrawnSolid?.(observe(sSolid), {})).toBe(true);
    expect(predicates.sketchComplete?.(observe(sSolid), {})).toBe(false);

    // 숨은 3개 점선 완성 -> sketchComplete
    let sDone = reduce(s, { type: 'add-segment', a: [3, 3], b: [11, 3], style: 'dashed' });
    sDone = reduce(sDone, { type: 'add-segment', a: [0, 0], b: [3, 3], style: 'dashed' });
    sDone = reduce(sDone, { type: 'add-segment', a: [3, 3], b: [3, 7], style: 'dashed' });
    expect(predicates.sketchComplete?.(observe(sDone), {})).toBe(true);

    // 잘못된 인자 -> false
    expect(predicates.markedCountIs?.(observe(sDone), { kind: 'unknown', n: 0 })).toBe(false);
    expect(predicates.allMarked?.(observe(sDone), { kind: 'bad' })).toBe(false);

    // 다른 모드와 상호 배타
    const cubesObs = observe(createInitialState({}));
    const netObs = observe(createInitialState({ mode: 'net-fold' }));
    const xrayObs = observe(sDone);
    expect(predicates.countIs?.(xrayObs, { n: 0 })).toBe(false);
    expect(predicates.netFaceCountIs?.(xrayObs, { n: 0 })).toBe(false);
    expect(predicates.markedCountIs?.(cubesObs, { kind: 'face', n: 0 })).toBe(false);
    expect(predicates.markedCountIs?.(netObs, { kind: 'face', n: 0 })).toBe(false);

    // 상대 모드 전용 Action 무시
    const cubesState = createInitialState({});
    expect(reduce(cubesState, { type: 'toggle-xray' })).toBe(cubesState);
    expect(reduce(sDone, { type: 'add', x: 0, y: 0 })).toBe(sDone);
  });

  it('emit은 xray 6개 이벤트를 정확히 내보낸다', () => {
    const s0 = createInitialState({ mode: 'xray', faceQuery: true, sketch: { prefill: 'none' } });
    const s1 = reduce(s0, { type: 'rotate-view', dYaw: 45, dPitch: 0 });
    expect(emit(s0, s1)).toEqual([{ name: 'view-changed', payload: { yaw: 75, pitch: 30 } }]);

    const s2 = reduce(s1, { type: 'toggle-xray' });
    expect(emit(s1, s2)).toEqual([{ name: 'xray-toggled', payload: { on: true } }]);

    const s3 = reduce(s2, { type: 'toggle-mark', kind: 'face', id: 'top' });
    expect(emit(s2, s3)).toEqual([
      { name: 'mark-toggled', payload: { kind: 'face', id: 'top', marked: true } },
    ]);

    const s4 = reduce(s3, { type: 'query-face', face: 'front' });
    expect(emit(s3, s4)).toEqual([{ name: 'face-queried', payload: { face: 'front' } }]);

    const s5 = reduce(s4, { type: 'add-segment', a: [0, 0], b: [2, 0], style: 'dashed' });
    expect(emit(s4, s5)).toEqual([{ name: 'segment-added', payload: { style: 'dashed' } }]);

    const s6 = reduce(s5, { type: 'remove-segment', a: [0, 0], b: [2, 0] });
    expect(emit(s5, s6)).toEqual([{ name: 'segment-removed', payload: {} }]);
  });
});
