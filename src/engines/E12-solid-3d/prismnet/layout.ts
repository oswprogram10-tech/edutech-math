/**
 * E12 각기둥 전개도 2D 배치와 종이 겹침 검사(화면용 좌표).
 *
 * - 좌표는 칸 단위 `number`이고 y는 위쪽이 +다(화면에 그릴 때 뒤집는다). 정n각형 꼭짓점에 cos·sin을 쓴다.
 * - 이 좌표는 "종이 위에서 겹쳐 오릴 수 없다"는 화면 판정과 그림에만 쓴다.
 *   AGENTS.md 절대 규칙 2번의 수학 값(분수·소수·위치·측정값)이 아니다.
 *   접었을 때 어느 자리로 가는지의 판정은 `model.ts`가 정수와 자리 이름만으로 한다.
 * - 조각 변 번호는 반시계다. 직사각형은 [0 아래, 1 오른쪽, 2 위, 3 왼쪽], 정n각형은 0..n-1이며
 *   0번 변이 아래에 오도록 꼭짓점을 둔다.
 */

export interface Pt {
  readonly x: number;
  readonly y: number;
}

export interface PieceGeometry {
  readonly id: number;
  readonly type: 'base' | 'rect';
  readonly parent: number | null;
  readonly parentEdge: number;
  readonly edge: number;
}

export interface PlacedPiece {
  readonly id: number;
  readonly type: 'base' | 'rect';
  /** 반시계 꼭짓점(y 위쪽 +). 변 k는 `points[k]` → `points[k+1]`. */
  readonly points: readonly Pt[];
}

export interface LayoutBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** 칸 길이 × 1e-6. 이 안쪽으로만 겹치는 것은 닿은 것으로 본다. */
export const OVERLAP_EPS = 1e-6;

/** 한 조각의 기본 꼭짓점(반시계). 직사각형은 왼쪽 아래 꼭짓점이 원점, 밑면은 중심이 원점이다. */
export function localPolygon(
  type: 'base' | 'rect',
  n: number,
  sideLen: number,
  height: number,
): Pt[] {
  if (type === 'rect') {
    return [
      { x: 0, y: 0 },
      { x: sideLen, y: 0 },
      { x: sideLen, y: height },
      { x: 0, y: height },
    ];
  }
  const radius = sideLen / (2 * Math.sin(Math.PI / n));
  return Array.from({ length: n }, (_, k) => {
    const angle = -Math.PI / 2 - Math.PI / n + (2 * Math.PI * k) / n;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
}

function rotate(p: Pt, angle: number): Pt {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/**
 * 조각을 모두 배치한다(입력 순서 그대로, 부모가 늘 앞). 부모를 못 찾거나 변 번호가 틀린 조각은 건너뛴다.
 * 부모의 변 A→B(반시계)에 자식의 맞댄 변 P→Q(반시계)를 맞댄다: P가 B에, Q가 A에 온다.
 */
export function layoutPieces(
  pieces: readonly PieceGeometry[],
  n: number,
  sideLen: number,
  height: number,
): PlacedPiece[] {
  const placed: PlacedPiece[] = [];
  const byId = new Map<number, PlacedPiece>();
  for (const piece of pieces) {
    const local = localPolygon(piece.type, n, sideLen, height);
    if (piece.parent === null) {
      const root: PlacedPiece = { id: piece.id, type: piece.type, points: local };
      placed.push(root);
      byId.set(piece.id, root);
      continue;
    }
    const parent = byId.get(piece.parent);
    if (!parent) continue;
    const a = parent.points[piece.parentEdge];
    const b = parent.points[(piece.parentEdge + 1) % parent.points.length];
    const p = local[piece.edge];
    const q = local[(piece.edge + 1) % local.length];
    if (!a || !b || !p || !q) continue;
    const angle = Math.atan2(a.y - b.y, a.x - b.x) - Math.atan2(q.y - p.y, q.x - p.x);
    const rp = rotate(p, angle);
    const dx = b.x - rp.x;
    const dy = b.y - rp.y;
    const points = local.map((v) => {
      const r = rotate(v, angle);
      return { x: r.x + dx, y: r.y + dy };
    });
    const child: PlacedPiece = { id: piece.id, type: piece.type, points };
    placed.push(child);
    byId.set(piece.id, child);
  }
  return placed;
}

/** 두 볼록 다각형의 넓이가 겹치는가. 변이나 점만 닿으면 겹침이 아니다(분리축 검사). */
export function polygonsOverlap(a: readonly Pt[], b: readonly Pt[], eps = OVERLAP_EPS): boolean {
  const polys = [a, b];
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i += 1) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      if (!p || !q) continue;
      const axis = { x: q.y - p.y, y: p.x - q.x };
      const len = Math.hypot(axis.x, axis.y) || 1;
      const ax = axis.x / len;
      const ay = axis.y / len;
      let minA = Infinity;
      let maxA = -Infinity;
      for (const v of a) {
        const d = v.x * ax + v.y * ay;
        if (d < minA) minA = d;
        if (d > maxA) maxA = d;
      }
      let minB = Infinity;
      let maxB = -Infinity;
      for (const v of b) {
        const d = v.x * ax + v.y * ay;
        if (d < minB) minB = d;
        if (d > maxB) maxB = d;
      }
      if (maxA <= minB + eps || maxB <= minA + eps) return false;
    }
  }
  return true;
}

/** 종이 위에서 겹치는 조각 쌍(배열 번호). */
export function paperOverlaps(
  pieces: readonly PieceGeometry[],
  n: number,
  sideLen: number,
  height: number,
): [number, number][] {
  const placed = layoutPieces(pieces, n, sideLen, height);
  const byId = new Map<number, PlacedPiece>();
  placed.forEach((p) => byId.set(p.id, p));
  const result: [number, number][] = [];
  for (let i = 0; i < pieces.length; i += 1) {
    const pi = pieces[i];
    const a = pi ? byId.get(pi.id) : undefined;
    if (!a) continue;
    for (let j = i + 1; j < pieces.length; j += 1) {
      const pj = pieces[j];
      const b = pj ? byId.get(pj.id) : undefined;
      if (!b) continue;
      if (polygonsOverlap(a.points, b.points)) result.push([i, j]);
    }
  }
  return result;
}

export function layoutBounds(placed: readonly PlacedPiece[]): LayoutBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const piece of placed) {
    for (const v of piece.points) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

/** 변의 가운데와 바깥쪽 단위 방향(반시계 다각형이므로 변 진행 방향의 오른쪽). */
export function edgeMidAndNormal(
  points: readonly Pt[],
  edge: number,
): { readonly mid: Pt; readonly normal: Pt } | null {
  const a = points[edge];
  const b = points[(edge + 1) % points.length];
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    normal: { x: dy / len, y: -dx / len },
  };
}

export function polygonCenter(points: readonly Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  const count = Math.max(1, points.length);
  return { x: x / count, y: y / count };
}
