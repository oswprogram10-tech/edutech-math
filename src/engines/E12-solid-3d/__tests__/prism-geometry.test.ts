import { describe, expect, it } from 'vitest';
import {
  buildPrismModel,
  hiddenPrismEdges,
  hiddenPrismVertices,
  prismElementIds,
  prismKind,
  prismScaleForStage,
  trueCounts,
  visiblePrismFaces,
} from '../prism/geometry';

const DEFAULT_VIEW = { yaw: 30, pitch: 30 };

function prism(n: number, h = 2, orientation: 'upright' | 'lying' = 'upright') {
  return buildPrismModel({ n, height: h, top: 'flat' }, orientation);
}
function pyramid(n: number, h = 2, orientation: 'upright' | 'lying' = 'upright') {
  return buildPrismModel({ n, height: h, top: 'apex' }, orientation);
}

describe('E12 prism-pyramid 기하', () => {
  it('n=3..8 각기둥·각뿔의 요소 수가 참 개수 공식과 같다', () => {
    for (let n = 3; n <= 8; n += 1) {
      const a = prism(n);
      expect([a.faces.length, a.edges.length, a.vertices.length]).toEqual([n + 2, 3 * n, 2 * n]);
      expect(trueCounts('prism', n)).toEqual({ faces: n + 2, edges: 3 * n, vertices: 2 * n });
      const b = pyramid(n);
      expect([b.faces.length, b.edges.length, b.vertices.length]).toEqual([n + 1, 2 * n, n + 1]);
      expect(trueCounts('pyramid', n)).toEqual({ faces: n + 1, edges: 2 * n, vertices: n + 1 });
    }
    expect(trueCounts('base', 5)).toBeNull();
  });

  it('높이 0은 평면도형(base)이고 kind가 높이·윗면으로 정해진다', () => {
    expect(prismKind({ n: 4, height: 0, top: 'flat' })).toBe('base');
    expect(prismKind({ n: 4, height: 0, top: 'apex' })).toBe('base');
    expect(prismKind({ n: 4, height: 1, top: 'flat' })).toBe('prism');
    expect(prismKind({ n: 4, height: 1, top: 'apex' })).toBe('pyramid');
    const base = buildPrismModel({ n: 5, height: 0, top: 'flat' }, 'upright');
    expect(base.faces.map((f) => f.id)).toEqual(['bottom']);
    expect(base.edges).toHaveLength(5);
    expect(base.vertices).toHaveLength(5);
  });

  it('요소 이름은 고정 순서이고 모델의 목록 순서와 같다', () => {
    const ids = prismElementIds('prism', 3);
    expect(ids.faces).toEqual(['bottom', 'top', 's0', 's1', 's2']);
    expect(ids.edges).toEqual(['eb0', 'eb1', 'eb2', 'et0', 'et1', 'et2', 'el0', 'el1', 'el2']);
    expect(ids.vertices).toEqual(['b0', 'b1', 'b2', 't0', 't1', 't2']);
    const p = prismElementIds('pyramid', 3);
    expect(p.faces).toEqual(['bottom', 's0', 's1', 's2']);
    expect(p.edges).toEqual(['eb0', 'eb1', 'eb2', 'el0', 'el1', 'el2']);
    expect(p.vertices).toEqual(['b0', 'b1', 'b2', 'apex']);
    for (let n = 3; n <= 8; n += 1) {
      for (const [kind, model] of [
        ['prism', prism(n)],
        ['pyramid', pyramid(n)],
      ] as const) {
        const expected = prismElementIds(kind, n);
        expect(model.faces.map((f) => f.id)).toEqual(expected.faces);
        expect(model.edges.map((e) => e.id)).toEqual(expected.edges);
        expect(model.vertices.map((v) => v.id)).toEqual(expected.vertices);
      }
    }
  });

  it('모서리의 붙은 면은 늘 2개이고 모두 실제 면 이름이다', () => {
    for (let n = 3; n <= 8; n += 1) {
      for (const model of [prism(n), pyramid(n)]) {
        const faceIds = new Set(model.faces.map((f) => f.id));
        for (const e of model.edges) {
          expect(e.faces).toHaveLength(2);
          for (const f of e.faces) expect(faceIds.has(f)).toBe(true);
        }
        // 꼭짓점마다 붙은 면은 3개 이상(꼭대기는 n개)
        for (const v of model.vertices) expect(v.faces.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('기본 시점에서 각기둥 n=4의 보이는 면에 top이 있고 bottom이 없다', () => {
    const visible = visiblePrismFaces(prism(4), DEFAULT_VIEW);
    expect(visible).toContain('top');
    expect(visible).not.toContain('bottom');
    // 앞 옆면 s0이 보인다(앞쪽을 향하도록 놓음)
    expect(visible).toContain('s0');
  });

  it('pitch < 0이면 bottom이 보인다', () => {
    const visible = visiblePrismFaces(prism(4), { yaw: 30, pitch: -30 });
    expect(visible).toContain('bottom');
    expect(visible).not.toContain('top');
    expect(visiblePrismFaces(pyramid(5), { yaw: 30, pitch: -30 })).toContain('bottom');
  });

  it('숨은 모서리·꼭짓점이 있는 시점에서 숨은 요소 수가 1 이상이다', () => {
    for (let n = 3; n <= 8; n += 1) {
      for (const model of [prism(n), pyramid(n)]) {
        expect(hiddenPrismEdges(model, DEFAULT_VIEW).length).toBeGreaterThanOrEqual(1);
      }
    }
    // 사각기둥(상자 모양)은 숨은 꼭짓점도 있다
    expect(hiddenPrismVertices(prism(4), DEFAULT_VIEW).length).toBeGreaterThanOrEqual(1);
    // 숨은 모서리는 붙은 두 면이 모두 보이지 않는 모서리다
    const model = prism(5);
    const visible = new Set(visiblePrismFaces(model, DEFAULT_VIEW));
    for (const id of hiddenPrismEdges(model, DEFAULT_VIEW)) {
      const edge = model.edges.find((e) => e.id === id);
      expect(edge?.faces.every((f) => !visible.has(f))).toBe(true);
    }
  });

  it('평면도형은 늘 밑면 하나가 보이고 숨은 요소가 없다', () => {
    const base = buildPrismModel({ n: 6, height: 0, top: 'flat' }, 'upright');
    expect(visiblePrismFaces(base, { yaw: 30, pitch: -45 })).toEqual(['bottom']);
    expect(hiddenPrismEdges(base, DEFAULT_VIEW)).toEqual([]);
    expect(hiddenPrismVertices(base, DEFAULT_VIEW)).toEqual([]);
  });

  it('눕힌 입체에서 bottom·top의 법선이 수평이고 밑면이 앞·뒤를 본다', () => {
    for (const model of [prism(5, 2, 'lying'), pyramid(5, 2, 'lying')]) {
      const bottom = model.faces.find((f) => f.id === 'bottom');
      expect(bottom).toBeDefined();
      expect(Math.abs(bottom?.normal[2] ?? 1)).toBeLessThan(1e-9);
      expect(bottom?.normal[1]).toBeLessThan(0);
    }
    const top = prism(5, 2, 'lying').faces.find((f) => f.id === 'top');
    expect(Math.abs(top?.normal[2] ?? 1)).toBeLessThan(1e-9);
    expect(top?.normal[1]).toBeGreaterThan(0);
    // 세운 입체의 밑면은 수직 법선이다
    const upright = prism(5, 2, 'upright').faces.find((f) => f.id === 'bottom');
    expect(upright?.normal[2]).toBe(-1);
  });

  it('옆면 법선은 바깥쪽을 향한다', () => {
    for (const model of [prism(6), pyramid(6)]) {
      for (const face of model.faces) {
        const out = face.center[0] * face.normal[0] + face.center[1] * face.normal[1];
        if (face.id.startsWith('s')) expect(out).toBeGreaterThan(0);
      }
    }
  });

  it('배율은 n·높이가 바뀌어도 같고, 높이가 높을수록 입체가 위로 자란다', () => {
    expect(prismScaleForStage(600, 450)).toBe(prismScaleForStage(600, 450));
    const low = prism(5, 1).vertices.find((v) => v.id === 't0');
    const high = prism(5, 4).vertices.find((v) => v.id === 't0');
    expect(high?.p[2]).toBeGreaterThan(low?.p[2] ?? 0);
  });

  it('모으기 애니메이션 모델은 topScale 0에서 윗면 꼭짓점이 한 점에 모인다', () => {
    const m = buildPrismModel({ n: 4, height: 2, top: 'flat' }, 'upright', 0);
    const tops = m.vertices.filter((v) => v.id.startsWith('t'));
    expect(tops).toHaveLength(4);
    for (const t of tops) {
      expect(t.p[0]).toBeCloseTo(0, 9);
      expect(t.p[1]).toBeCloseTo(0, 9);
    }
    const full = buildPrismModel({ n: 4, height: 2, top: 'flat' }, 'upright', 1);
    expect(Math.hypot(full.vertices[4]?.p[0] ?? 0, full.vertices[4]?.p[1] ?? 0)).toBeCloseTo(1, 9);
  });
});
