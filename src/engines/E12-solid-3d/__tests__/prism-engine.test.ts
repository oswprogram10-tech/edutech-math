import { describe, expect, it, vi } from 'vitest';
import type { Observation } from '../../../core/engine-sdk';
import { emit, predicates } from '../events';
import { observe } from '../observe';
import { createInitialState, reduce } from '../reduce';
import type { PrismConfig, PrismState, SolidAction } from '../types';

function make(config: Partial<PrismConfig> = {}): PrismState {
  return createInitialState({ mode: 'prism-pyramid', ...config });
}

function run(state: PrismState, actions: readonly SolidAction[]): PrismState {
  return actions.reduce<PrismState>((s, a) => reduce(s, a), state);
}

function pred(name: string, obs: Observation, args?: unknown): boolean {
  const fn = predicates[name];
  expect(fn, name).toBeDefined();
  return fn?.(obs, args as never) ?? false;
}

describe('E12 prism-pyramid 상태·관측·판정·이벤트', () => {
  it('설정 정규화: 기본값, 범위 자르기, 고정 n', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const d = make({ stage: 'auto', fallback: 'x', variant: 'y' });
    expect(d.sides).toBe(3);
    expect(d.height).toBe(0);
    expect(d.top).toBe('flat');
    expect(d.settings.sidesMin).toBe(3);
    expect(d.settings.sidesMax).toBe(8);
    expect(d.settings.handles).toEqual(['extrude', 'apex']);
    expect(d.settings.showName).toBe(true);
    expect(d.settings.counterTable).toBe(false);
    expect(d.settings.orientation).toBe('upright');
    expect(d.view).toEqual({ yaw: 30, pitch: 30 });
    expect(d.tool).toBe('face');
    expect(warn).not.toHaveBeenCalled();

    const clamped = make({
      baseSides: { min: 1, max: 20 },
      initial: { sides: 99, height: 9, top: 'apex' },
      view: { yaw: 195, pitch: 90 },
    });
    expect(clamped.settings.sidesMin).toBe(3);
    expect(clamped.settings.sidesMax).toBe(8);
    expect(clamped.sides).toBe(8);
    expect(clamped.height).toBe(4);
    expect(clamped.top).toBe('apex');
    expect(clamped.view).toEqual({ yaw: -165, pitch: 75 });
    expect(warn).toHaveBeenCalled();

    const fixed = make({ baseSides: 5 });
    expect(fixed.settings.sidesMin).toBe(5);
    expect(fixed.settings.sidesMax).toBe(5);
    expect(fixed.sides).toBe(5);

    const range = make({ baseSides: { min: 4, max: 6 }, initial: { sides: 3 } });
    expect(range.sides).toBe(4);

    expect(make({ tools: [] }).tool).toBeNull();
    warn.mockRestore();
  });

  it('Action 무시 조건: 고정 n, 없는 손잡이, 범위 밖 값', () => {
    const fixed = make({ baseSides: 5 });
    expect(reduce(fixed, { type: 'set-sides', n: 6 })).toBe(fixed);

    const range = make({ baseSides: { min: 4, max: 6 } });
    expect(reduce(range, { type: 'set-sides', n: 3 })).toBe(range);
    expect(reduce(range, { type: 'set-sides', n: 7 })).toBe(range);
    expect(reduce(range, { type: 'set-sides', n: 4 })).toBe(range);
    expect(reduce(range, { type: 'set-sides', n: 4.5 })).toBe(range);
    expect(reduce(range, { type: 'set-sides', n: 5 }).sides).toBe(5);

    const noExtrude = make({ handles: ['apex'] });
    expect(reduce(noExtrude, { type: 'set-height', h: 2 })).toBe(noExtrude);
    const noApex = make({ handles: ['extrude'] });
    expect(reduce(noApex, { type: 'set-top', top: 'apex' })).toBe(noApex);

    const s = make();
    expect(reduce(s, { type: 'set-height', h: 5 })).toBe(s);
    expect(reduce(s, { type: 'set-height', h: -1 })).toBe(s);
    expect(reduce(s, { type: 'set-height', h: 1.5 })).toBe(s);
    expect(reduce(s, { type: 'set-height', h: 0 })).toBe(s);
    expect(reduce(s, { type: 'set-top', top: 'flat' })).toBe(s);
    expect(reduce(s, { type: 'set-tool', tool: 'query' })).toBe(s);
    expect(reduce(make({ rotate: false }), { type: 'set-view', yaw: 60, pitch: 0 }).view).toEqual({
      yaw: 30,
      pitch: 30,
    });
    const noXray = make({ xrayToggle: false });
    expect(reduce(noXray, { type: 'toggle-xray' })).toBe(noXray);
    const onlyFace = make({ tools: ['face'] });
    expect(reduce(onlyFace, { type: 'set-tool', tool: 'edge' })).toBe(onlyFace);
  });

  it('다른 모드 전용 Action은 상태를 그대로 돌려준다(cubes 모양 set-height 포함)', () => {
    const s = run(make(), [{ type: 'set-height', h: 2 }]);
    expect(reduce(s, { type: 'add', x: 0, y: 0 })).toBe(s);
    expect(reduce(s, { type: 'fold' })).toBe(s);
    expect(reduce(s, { type: 'query-face', face: 'top' })).toBe(s);
    expect(reduce(s, { type: 'clear' })).toBe(s);
    expect(reduce(s, { type: 'set-height', x: 0, y: 0, h: 3 })).toBe(s);
    // 반대로 prism 전용 Action은 cubes 상태를 바꾸지 않는다
    const cubes = createInitialState({});
    expect(reduce(cubes, { type: 'set-height', h: 3 })).toBe(cubes);
    expect(reduce(cubes, { type: 'set-sides', n: 5 })).toBe(cubes);
  });

  it('h=0에서는 표시를 막고 표 줄 추가를 막는다', () => {
    const s = make({ counterTable: true });
    expect(reduce(s, { type: 'toggle-mark', kind: 'face', id: 'bottom' })).toBe(s);
    expect(reduce(s, { type: 'add-table-row' })).toBe(s);
  });

  it('toggle-mark는 지금 입체에 있는 id만 받고 고정 순서로 정렬한다', () => {
    let s = run(make({ initial: { sides: 4, height: 2 } }), []);
    expect(reduce(s, { type: 'toggle-mark', kind: 'face', id: 'apex' })).toBe(s);
    expect(reduce(s, { type: 'toggle-mark', kind: 'vertex', id: 'apex' })).toBe(s);
    expect(reduce(s, { type: 'toggle-mark', kind: 'face', id: 's9' })).toBe(s);
    s = run(s, [
      { type: 'toggle-mark', kind: 'face', id: 's1' },
      { type: 'toggle-mark', kind: 'face', id: 'top' },
      { type: 'toggle-mark', kind: 'face', id: 'bottom' },
      { type: 'toggle-mark', kind: 'edge', id: 'el0' },
      { type: 'toggle-mark', kind: 'edge', id: 'eb2' },
      { type: 'toggle-mark', kind: 'vertex', id: 't3' },
      { type: 'toggle-mark', kind: 'vertex', id: 'b0' },
    ]);
    expect(s.marked.faces).toEqual(['bottom', 'top', 's1']);
    expect(s.marked.edges).toEqual(['eb2', 'el0']);
    expect(s.marked.vertices).toEqual(['b0', 't3']);
    s = reduce(s, { type: 'toggle-mark', kind: 'face', id: 's1' });
    expect(s.marked.faces).toEqual(['bottom', 'top']);
    const tools = make({ tools: ['face'], initial: { height: 1 } });
    expect(reduce(tools, { type: 'toggle-mark', kind: 'edge', id: 'eb0' })).toBe(tools);
  });

  it('표시 비우기 규칙: n 변경, h=0, 윗면 바뀜에서 비우고 높이 1→2는 유지한다', () => {
    let s = run(make({ initial: { sides: 4, height: 2 } }), [
      { type: 'toggle-mark', kind: 'face', id: 'bottom' },
    ]);
    expect(reduce(s, { type: 'set-height', h: 3 }).marked.faces).toEqual(['bottom']);
    expect(reduce(s, { type: 'set-height', h: 0 }).marked.faces).toEqual([]);
    expect(reduce(s, { type: 'set-sides', n: 5 }).marked.faces).toEqual([]);
    expect(reduce(s, { type: 'set-top', top: 'apex' }).marked.faces).toEqual([]);
    s = reduce(s, { type: 'clear-marks' });
    expect(s.marked).toEqual({ faces: [], edges: [], vertices: [] });
    expect(reduce(s, { type: 'clear-marks' })).toBe(s);
  });

  it('apexPlayed는 apex로 한 번이라도 바꾸면 true이고 되돌려도 유지된다', () => {
    let s = make({ initial: { height: 2 } });
    expect(s.apexPlayed).toBe(false);
    s = reduce(s, { type: 'set-top', top: 'apex' });
    expect(s.apexPlayed).toBe(true);
    s = reduce(s, { type: 'set-top', top: 'flat' });
    expect(s.apexPlayed).toBe(true);
    expect(make({ initial: { height: 2, top: 'apex' } }).apexPlayed).toBe(false);
  });

  it('xrayUsed는 초기 설정으로 켜지지 않고 toggle-xray로 켤 때 true가 된다', () => {
    const s0 = make({ xray: true });
    expect(s0.xray).toBe(true);
    expect(s0.xrayUsed).toBe(false);
    const s1 = reduce(s0, { type: 'toggle-xray' });
    expect(s1.xrayUsed).toBe(false);
    const s2 = reduce(s1, { type: 'toggle-xray' });
    expect(s2.xrayUsed).toBe(true);
    expect(reduce(s2, { type: 'toggle-xray' }).xrayUsed).toBe(true);
  });

  it('표: 줄 추가·같은 줄 무시·12줄 한도·칸 입력 범위·줄 빼기', () => {
    const base = make({ counterTable: true, initial: { sides: 3, height: 1 } });
    const off = make({ initial: { sides: 3, height: 1 } });
    expect(reduce(off, { type: 'add-table-row' })).toBe(off);

    let s = reduce(base, { type: 'add-table-row' });
    expect(s.table).toEqual([{ kind: 'prism', n: 3, faces: null, edges: null, vertices: null }]);
    expect(reduce(s, { type: 'add-table-row' })).toBe(s);

    s = reduce(s, { type: 'set-top', top: 'apex' });
    s = reduce(s, { type: 'add-table-row' });
    expect(s.table.map((r) => r.kind)).toEqual(['prism', 'pyramid']);

    expect(reduce(s, { type: 'set-table-cell', row: 0, col: 'faces', value: 100 })).toBe(s);
    expect(reduce(s, { type: 'set-table-cell', row: 0, col: 'faces', value: -1 })).toBe(s);
    expect(reduce(s, { type: 'set-table-cell', row: 0, col: 'faces', value: 1.5 })).toBe(s);
    expect(reduce(s, { type: 'set-table-cell', row: 5, col: 'faces', value: 1 })).toBe(s);
    expect(reduce(s, { type: 'set-table-cell', row: 0, col: 'faces', value: null })).toBe(s);
    expect(reduce(s, { type: 'remove-table-row', row: 9 })).toBe(s);
    s = reduce(s, { type: 'set-table-cell', row: 0, col: 'faces', value: 99 });
    expect(s.table[0]?.faces).toBe(99);
    s = reduce(s, { type: 'set-table-cell', row: 0, col: 'faces', value: 0 });
    expect(s.table[0]?.faces).toBe(0);
    s = reduce(s, { type: 'set-table-cell', row: 0, col: 'faces', value: null });
    expect(s.table[0]?.faces).toBeNull();
    s = reduce(s, { type: 'remove-table-row', row: 0 });
    expect(s.table).toHaveLength(1);
    expect(s.table[0]?.kind).toBe('pyramid');

    // 12줄 한도: 6개 n × 2종류 = 12줄까지 가능. 13번째는 없지만 한도 검사는 줄 수로 한다.
    let full = make({ counterTable: true, initial: { height: 1 } });
    for (let n = 3; n <= 8; n += 1) {
      full = run(full, [
        { type: 'set-sides', n },
        { type: 'set-top', top: 'flat' },
        { type: 'add-table-row' },
        { type: 'set-top', top: 'apex' },
        { type: 'add-table-row' },
      ]);
    }
    expect(full.table).toHaveLength(12);
    const blocked = reduce(full, { type: 'remove-table-row', row: 0 });
    expect(blocked.table).toHaveLength(11);
  });

  it('상태는 JSON 왕복이 된다', () => {
    let s = make({ counterTable: true, initial: { sides: 5, height: 3 } });
    s = run(s, [
      { type: 'toggle-mark', kind: 'face', id: 'top' },
      { type: 'toggle-mark', kind: 'edge', id: 'el3' },
      { type: 'add-table-row' },
      { type: 'set-table-cell', row: 0, col: 'edges', value: 15 },
    ]);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('Observation: kind·trueCount·tableCorrect와 다른 모드 키가 없음', () => {
    let s = make({ counterTable: true, initial: { sides: 5, height: 2 } });
    let o = observe(s);
    expect(o['mode']).toBe('prism-pyramid');
    expect(o['kind']).toBe('prism');
    expect(o['trueCount']).toEqual({ face: 7, edge: 15, vertex: 10 });
    expect(o['markedCount']).toEqual({ face: 0, edge: 0, vertex: 0 });
    expect(o['orientation']).toBe('upright');
    expect(o['cubes']).toBeUndefined();
    expect(o['solid']).toBeUndefined();

    s = run(s, [
      { type: 'add-table-row' },
      { type: 'set-table-cell', row: 0, col: 'faces', value: 7 },
      { type: 'set-table-cell', row: 0, col: 'edges', value: 15 },
    ]);
    expect(observe(s)['tableCorrect']).toEqual([false]);
    s = reduce(s, { type: 'set-table-cell', row: 0, col: 'vertices', value: 10 });
    o = observe(s);
    expect(o['tableCorrect']).toEqual([true]);
    expect(o['table']).toEqual([{ kind: 'prism', n: 5, faces: 7, edges: 15, vertices: 10 }]);

    const pyramid = run(make({ initial: { sides: 6, height: 1, top: 'apex' } }), []);
    expect(observe(pyramid)['kind']).toBe('pyramid');
    expect(observe(pyramid)['trueCount']).toEqual({ face: 7, edge: 12, vertex: 7 });
    const flat = make();
    expect(observe(flat)['kind']).toBe('base');
    expect(observe(flat)['trueCount']).toBeNull();
    expect(observe(flat)['visibleFaces']).toEqual(['bottom']);
  });

  it('predicate: solidIs, markedCountIs, allMarked, markedBasesOk', () => {
    let s = make({ initial: { sides: 6, height: 2 } });
    expect(pred('solidIs', observe(s), { kind: 'prism' })).toBe(true);
    expect(pred('solidIs', observe(s), { kind: 'prism', n: 6 })).toBe(true);
    expect(pred('solidIs', observe(s), { kind: 'prism', n: 5 })).toBe(false);
    expect(pred('solidIs', observe(s), { kind: 'pyramid' })).toBe(false);
    expect(pred('solidIs', observe(s), { kind: 'cube' })).toBe(false);
    expect(pred('solidIs', observe(s), { kind: 'prism', n: 'x' })).toBe(false);
    expect(pred('solidIs', observe(s), undefined)).toBe(false);
    expect(pred('solidIs', observe(make()), { kind: 'base', n: 3 })).toBe(true);

    expect(pred('markedBasesOk', observe(s))).toBe(false);
    s = run(s, [
      { type: 'toggle-mark', kind: 'face', id: 'top' },
      { type: 'toggle-mark', kind: 'face', id: 'bottom' },
    ]);
    expect(pred('markedBasesOk', observe(s))).toBe(true);
    expect(pred('markedCountIs', observe(s), { kind: 'face', n: 2 })).toBe(true);
    expect(pred('markedCountIs', observe(s), { kind: 'face', n: 3 })).toBe(false);
    expect(pred('markedCountIs', observe(s), { kind: 'edge', n: 0 })).toBe(true);
    expect(pred('markedCountIs', observe(s), { kind: 'point', n: 0 })).toBe(false);
    expect(pred('markedCountIs', observe(s), { kind: 'face', n: 2.5 })).toBe(false);
    s = reduce(s, { type: 'toggle-mark', kind: 'face', id: 's2' });
    expect(pred('markedBasesOk', observe(s))).toBe(false);

    // 모든 모서리 표시: 육각기둥 모서리 18개
    const edges = prismEdgeIds(6, 'prism');
    let e = make({ initial: { sides: 6, height: 2 } });
    for (const id of edges.slice(0, -1)) e = reduce(e, { type: 'toggle-mark', kind: 'edge', id });
    expect(pred('allMarked', observe(e), { kind: 'edge' })).toBe(false);
    e = reduce(e, { type: 'toggle-mark', kind: 'edge', id: edges[edges.length - 1] as string });
    expect(pred('allMarked', observe(e), { kind: 'edge' })).toBe(true);
    expect(pred('allMarked', observe(e), { kind: 'face' })).toBe(false);
    expect(pred('allMarked', observe(e), { kind: 'zzz' })).toBe(false);

    // 각뿔은 밑면 하나만
    let p = make({ initial: { sides: 4, height: 2, top: 'apex' } });
    p = reduce(p, { type: 'toggle-mark', kind: 'face', id: 'bottom' });
    expect(pred('markedBasesOk', observe(p))).toBe(true);
    p = reduce(p, { type: 'toggle-mark', kind: 'face', id: 's0' });
    expect(pred('markedBasesOk', observe(p))).toBe(false);
    // 눕힌 입체에서도 같은 id로 판정한다
    const lying = make({ orientation: 'lying', initial: { sides: 3, height: 2 } });
    expect(observe(lying)['orientation']).toBe('lying');
    expect(pred('markedBasesOk', observe(lying))).toBe(false);
  });

  it('predicate: 표 관련과 apexPlayedIs', () => {
    let s = make({ counterTable: true, initial: { sides: 6, height: 2, top: 'apex' } });
    s = run(s, [
      { type: 'add-table-row' },
      { type: 'set-table-cell', row: 0, col: 'vertices', value: 12 },
    ]);
    const o = observe(s);
    expect(pred('tableRowIs', o, { kind: 'pyramid', n: 6, vertices: 12 })).toBe(true);
    expect(pred('tableRowIs', o, { kind: 'pyramid', n: 6, vertices: 7 })).toBe(false);
    expect(pred('tableRowIs', o, { kind: 'pyramid', n: 6 })).toBe(true);
    expect(pred('tableRowIs', o, { kind: 'pyramid', n: 6, faces: null })).toBe(false);
    expect(pred('tableRowIs', o, { kind: 'prism', n: 6 })).toBe(false);
    expect(pred('tableRowIs', o, { kind: 'pyramid', n: 6, faces: 'a' })).toBe(false);
    expect(pred('tableRowIs', o, { kind: 'pyramid' })).toBe(false);
    expect(pred('tableRowCorrect', o, { kind: 'pyramid', n: 6 })).toBe(false);
    expect(pred('tableCorrectAtLeast', o, { count: 0 })).toBe(true);
    expect(pred('tableCorrectAtLeast', o, { count: 1 })).toBe(false);
    expect(pred('tableCorrectAtLeast', o, { count: 'x' })).toBe(false);

    s = run(s, [
      { type: 'set-table-cell', row: 0, col: 'faces', value: 7 },
      { type: 'set-table-cell', row: 0, col: 'edges', value: 12 },
      { type: 'set-table-cell', row: 0, col: 'vertices', value: 7 },
    ]);
    const done = observe(s);
    expect(pred('tableRowCorrect', done, { kind: 'pyramid', n: 6 })).toBe(true);
    expect(pred('tableRowCorrect', done, { kind: 'prism', n: 6 })).toBe(false);
    expect(pred('tableCorrectAtLeast', done, { count: 1 })).toBe(true);

    expect(pred('apexPlayedIs', observe(make()), { value: false })).toBe(true);
    expect(pred('apexPlayedIs', done, { value: true })).toBe(false); // 초기값이 apex여도 set-top을 안 했으면 false
    expect(pred('apexPlayedIs', done, { value: 'x' })).toBe(false);
    const played = run(make({ initial: { height: 1 } }), [{ type: 'set-top', top: 'apex' }]);
    expect(pred('apexPlayedIs', observe(played), { value: true })).toBe(true);
  });

  it('markedCountIs·allMarked는 xray 관찰에서 지금처럼 동작한다(회귀)', () => {
    let state = createInitialState({ mode: 'xray' });
    state = reduce(state, { type: 'toggle-mark', kind: 'face', id: 'top' });
    state = reduce(state, { type: 'toggle-mark', kind: 'face', id: 'front' });
    const obs = observe(state);
    expect(obs['mode']).toBe('xray');
    expect(pred('markedCountIs', obs, { kind: 'face', n: 2 })).toBe(true);
    expect(pred('markedCountIs', obs, { kind: 'face', n: 1 })).toBe(false);
    expect(pred('allMarked', obs, { kind: 'face' })).toBe(false);
    let all = createInitialState({ mode: 'xray' });
    for (const id of ['front', 'back', 'left', 'right', 'bottom', 'top']) {
      all = reduce(all, { type: 'toggle-mark', kind: 'face', id });
    }
    expect(pred('allMarked', observe(all), { kind: 'face' })).toBe(true);
    expect(pred('allMarked', observe(all), { kind: 'edge' })).toBe(false);
    // cubes·net 관찰에서는 false
    const cubes = observe(createInitialState({}));
    expect(pred('markedCountIs', cubes, { kind: 'face', n: 0 })).toBe(false);
    expect(pred('allMarked', cubes, { kind: 'face' })).toBe(false);
  });

  it('다른 모드 predicate와 서로 false이다', () => {
    const prismObs = observe(make({ counterTable: true, initial: { height: 2 } }));
    for (const name of [
      'netValid',
      'xrayUsedIs',
      'sketchComplete',
      'markedFacesParallelTo',
      'countIs',
    ]) {
      if (predicates[name]) {
        expect(pred(name, prismObs, { face: 'top', value: false, n: 1 }), name).toBe(false);
      }
    }
    const xrayObs = observe(createInitialState({ mode: 'xray' }));
    const cubesObs = observe(createInitialState({}));
    for (const name of [
      'solidIs',
      'tableRowIs',
      'tableRowCorrect',
      'tableCorrectAtLeast',
      'apexPlayedIs',
      'markedBasesOk',
    ]) {
      expect(pred(name, xrayObs, { kind: 'prism', n: 3, count: 0, value: false }), name).toBe(
        false,
      );
      expect(pred(name, cubesObs, { kind: 'prism', n: 3, count: 0, value: false }), name).toBe(
        false,
      );
    }
  });

  it('이벤트: sides·height·top·table·view·xray·mark', () => {
    let s = make({ counterTable: true, tools: ['face', 'edge', 'vertex'] });
    const step = (action: SolidAction) => {
      const next = reduce(s, action);
      const events = emit(s, next);
      s = next;
      return events;
    };
    expect(step({ type: 'set-sides', n: 5 })).toEqual([
      { name: 'sides-changed', payload: { n: 5 } },
    ]);
    expect(step({ type: 'set-height', h: 2 })).toEqual([
      { name: 'height-changed', payload: { h: 2 } },
    ]);
    expect(step({ type: 'set-top', top: 'apex' })).toEqual([
      { name: 'top-changed', payload: { top: 'apex' } },
    ]);
    expect(step({ type: 'rotate-view', dYaw: 45, dPitch: 0 })).toEqual([
      { name: 'view-changed', payload: { yaw: 75, pitch: 30 } },
    ]);
    expect(step({ type: 'toggle-xray' })).toEqual([
      { name: 'xray-toggled', payload: { on: true } },
    ]);
    expect(step({ type: 'toggle-mark', kind: 'vertex', id: 'apex' })).toEqual([
      { name: 'mark-toggled', payload: { kind: 'vertex', id: 'apex', marked: true } },
    ]);
    expect(step({ type: 'add-table-row' })).toEqual([
      { name: 'table-row-added', payload: { kind: 'pyramid', n: 5 } },
    ]);
    expect(step({ type: 'set-table-cell', row: 0, col: 'faces', value: 6 })).toEqual([
      { name: 'table-cell-set', payload: { row: 0, col: 'faces' } },
    ]);
    expect(emit(s, s)).toEqual([]);
  });
});

function prismEdgeIds(n: number, kind: 'prism' | 'pyramid'): readonly string[] {
  const range = Array.from({ length: n }, (_, i) => i);
  const base = range.map((i) => `eb${i}`);
  const top = range.map((i) => `et${i}`);
  const lat = range.map((i) => `el${i}`);
  return kind === 'prism' ? [...base, ...top, ...lat] : [...base, ...lat];
}
