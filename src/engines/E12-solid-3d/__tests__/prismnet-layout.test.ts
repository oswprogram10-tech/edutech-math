import { describe, expect, it } from 'vitest';
import {
  edgeMidAndNormal,
  layoutBounds,
  layoutPieces,
  localPolygon,
  paperOverlaps,
  polygonCenter,
  polygonsOverlap,
  type PieceGeometry,
} from '../prismnet/layout';
import { buildPiecesFromSteps, evaluatePrismNet } from '../prismnet/model';

const S = 2;
const H = 3;

function geo(root: 'base' | 'rect', steps: Parameters<typeof buildPiecesFromSteps>[1], n: number) {
  const pieces = buildPiecesFromSteps(root, steps, n);
  if (!pieces) throw new Error('잘못된 단계');
  return pieces;
}

const square = (x: number, y: number, w = 1, h = 1) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

describe('polygonsOverlap', () => {
  it('변만 닿으면 겹침이 아니다', () => {
    expect(polygonsOverlap(square(0, 0), square(1, 0))).toBe(false);
    expect(polygonsOverlap(square(0, 0), square(0, 1))).toBe(false);
  });

  it('점만 닿으면 겹침이 아니다', () => {
    expect(polygonsOverlap(square(0, 0), square(1, 1))).toBe(false);
  });

  it('조금이라도 넓이가 겹치면 겹침이다', () => {
    expect(polygonsOverlap(square(0, 0), square(0.5, 0.5))).toBe(true);
    expect(polygonsOverlap(square(0, 0), square(0.99, 0))).toBe(true);
    expect(polygonsOverlap(square(0, 0, 2, 2), square(0.5, 0.5, 0.5, 0.5))).toBe(true);
  });

  it('허용 오차(1e-6)보다 작은 침범은 닿은 것으로 본다', () => {
    expect(polygonsOverlap(square(0, 0), square(1 - 1e-8, 0))).toBe(false);
    expect(polygonsOverlap(square(0, 0), square(1 - 1e-4, 0))).toBe(true);
  });
});

describe('layoutPieces', () => {
  it('밑면 변 0은 아래, 모두 길이 s이고 꼭짓점이 반시계다', () => {
    for (const n of [3, 4, 5, 6]) {
      const poly = localPolygon('base', n, S, H);
      expect(poly).toHaveLength(n);
      const e0a = poly[0];
      const e0b = poly[1];
      expect(e0a?.y).toBeCloseTo(e0b?.y ?? 0, 9);
      expect((e0b?.x ?? 0) - (e0a?.x ?? 0)).toBeCloseTo(S, 9);
      for (let k = 0; k < n; k += 1) {
        const a = poly[k];
        const b = poly[(k + 1) % n];
        expect(Math.hypot((b?.x ?? 0) - (a?.x ?? 0), (b?.y ?? 0) - (a?.y ?? 0))).toBeCloseTo(S, 9);
      }
      let area2 = 0;
      for (let k = 0; k < n; k += 1) {
        const a = poly[k];
        const b = poly[(k + 1) % n];
        area2 += (a?.x ?? 0) * (b?.y ?? 0) - (b?.x ?? 0) * (a?.y ?? 0);
      }
      expect(area2).toBeGreaterThan(0);
    }
  });

  it('오른쪽 변에 붙인 옆면은 종이 오른쪽에 온다', () => {
    const pieces = geo('rect', [{ parent: 0, parentEdge: 1, type: 'rect' }], 3);
    const placed = layoutPieces(pieces, 3, S, H);
    const second = placed[1];
    expect(second).toBeDefined();
    const c = polygonCenter(second?.points ?? []);
    expect(c.x).toBeCloseTo(S + S / 2, 9);
    expect(c.y).toBeCloseTo(H / 2, 9);
  });

  it('경계 상자', () => {
    const rectOnly = layoutPieces(geo('rect', [], 3), 3, S, H);
    expect(layoutBounds(rectOnly)).toEqual({ minX: 0, minY: 0, maxX: S, maxY: H });

    const stacked = layoutPieces(
      geo('rect', [{ parent: 0, parentEdge: 2, type: 'rect' }], 3),
      3,
      S,
      H,
    );
    // 위 변(s)에 붙인 옆면은 아래 변(0)으로 맞댄다 → 위로 h만큼 더 올라간다.
    const b = layoutBounds(stacked);
    expect(b.minX).toBeCloseTo(0, 9);
    expect(b.maxX).toBeCloseTo(S, 9);
    expect(b.minY).toBeCloseTo(0, 9);
    expect(b.maxY).toBeCloseTo(2 * H, 9);

    expect(layoutBounds([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  it('바깥 방향은 변 진행 방향의 오른쪽이다', () => {
    const poly = localPolygon('rect', 3, S, H);
    const bottom = edgeMidAndNormal(poly, 0);
    expect(bottom?.normal.y).toBeCloseTo(-1, 9);
    const right = edgeMidAndNormal(poly, 1);
    expect(right?.normal.x).toBeCloseTo(1, 9);
  });
});

describe('방향 규칙을 종이 위 배치와 맞춰 본다', () => {
  it('옆면 S0 위 밑면의 변 1에 붙인 옆면은 종이 오른쪽(→ S1), 아래 밑면이면 종이 왼쪽(→ S{n-1})', () => {
    const n = 5;
    const up = geo(
      'rect',
      [
        { parent: 0, parentEdge: 2, type: 'base' },
        { parent: 1, parentEdge: 1, type: 'rect' },
      ],
      n,
    );
    const upPlaced = layoutPieces(up, n, S, H);
    expect(polygonCenter(upPlaced[2]?.points ?? []).x).toBeGreaterThan(S);
    expect(evaluatePrismNet(up, n, { sideLen: S, height: H }).slotOf[2]).toBe('S1');

    const down = geo(
      'rect',
      [
        { parent: 0, parentEdge: 0, type: 'base' },
        { parent: 1, parentEdge: 1, type: 'rect' },
      ],
      n,
    );
    const downPlaced = layoutPieces(down, n, S, H);
    expect(polygonCenter(downPlaced[2]?.points ?? []).x).toBeLessThan(0);
    expect(evaluatePrismNet(down, n, { sideLen: S, height: H }).slotOf[2]).toBe(`S${n - 1}`);
  });
});

describe('종이 겹침', () => {
  it('변만 닿는 조각(띠)은 겹침이 아니다', () => {
    for (const n of [3, 4, 5, 6]) {
      const steps = Array.from({ length: n - 1 }, (_, i) => ({
        parent: i,
        parentEdge: 1,
        type: 'rect' as const,
      }));
      const pieces = geo('rect', steps, n);
      expect(paperOverlaps(pieces as readonly PieceGeometry[], n, S, H)).toEqual([]);
    }
  });

  it('정육각형 둘레 옆면 6개는 겹치지 않는다', () => {
    const steps = Array.from({ length: 6 }, (_, k) => ({
      parent: 0,
      parentEdge: k,
      type: 'rect' as const,
    }));
    const pieces = geo('base', steps, 6);
    expect(paperOverlaps(pieces as readonly PieceGeometry[], 6, S, H)).toEqual([]);
  });

  it('정육각형 둘레에서 바깥으로 계속 이어 일부러 겹치게 만들면 겹침이다', () => {
    const steps = [
      ...Array.from({ length: 6 }, (_, k) => ({
        parent: 0,
        parentEdge: k,
        type: 'rect' as const,
      })),
      // 첫 옆면의 옆 변에 옆면을 하나 더 붙이면 이웃 옆면 위로 걸쳐 놓인다.
      { parent: 1, parentEdge: 1, type: 'rect' as const },
    ];
    const pieces = geo('base', steps, 6);
    const overlaps = paperOverlaps(pieces as readonly PieceGeometry[], 6, S, H);
    expect(overlaps.length).toBeGreaterThan(0);
    const ev = evaluatePrismNet(pieces, 6, { sideLen: S, height: H });
    expect(ev.paperOverlap.length).toBeGreaterThan(0);
    expect(ev.valid).toBe(false);
  });
});
