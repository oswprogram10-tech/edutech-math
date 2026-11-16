/**
 * E12 `net-fold` 공통 시각 상수·정사영·쌍 무늬·결과 문구 도우미.
 */
import { solid3dStrings as S } from '../strings.ko';
import type { NetFace, NetFoldState, ViewTurn } from '../types';
import {
  foldTransforms,
  type Box3D,
  type FaceTransform3D,
  type NetEvaluation,
  type NetFaceInput,
  type SharedEdgeSegment,
  type Vec3,
} from './geometry';

export type PairShape = 'circle' | 'triangle' | 'square';

export interface PairStyle {
  readonly fill: string;
  readonly stroke: string;
  readonly glyph: string;
  readonly shape: PairShape;
}

export const PAIR_STYLES: readonly [PairStyle, PairStyle, PairStyle] = [
  { fill: '#dbeafe', stroke: '#1d4ed8', glyph: '●', shape: 'circle' },
  { fill: '#fef3c7', stroke: '#b45309', glyph: '▲', shape: 'triangle' },
  { fill: '#dcfce7', stroke: '#15803d', glyph: '■', shape: 'square' },
];

export const NET_PLAIN_STYLE = {
  fill: '#f6ebd8',
  stroke: '#3d485c',
} as const;

export const NET_LOCKED_STYLE = {
  fill: '#e6ebf5',
  stroke: '#334155',
} as const;

export function pairStyleForSlot(slot: number | null): PairStyle | null {
  if (slot === null || slot < 0 || slot > 5) return null;
  const pairIdx = Math.floor(slot / 2) as 0 | 1 | 2;
  return PAIR_STYLES[pairIdx];
}

export interface Projected2D {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

const PITCH_RAD = (30 * Math.PI) / 180;
const COS_PITCH = Math.cos(PITCH_RAD);
const SIN_PITCH = Math.sin(PITCH_RAD);

export function projectOrthoPoint(
  p: Vec3,
  center: Vec3,
  viewTurn: ViewTurn,
  scale: number,
  offsetX: number,
  offsetY: number,
): Projected2D {
  const yaw = ((45 + 90 * viewTurn) * Math.PI) / 180;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const dx = p[0] - center[0];
  const dy = p[1] - center[1];
  const dz = p[2] - center[2];

  const u = dx * cosY - dy * sinY;
  const v = dx * sinY + dy * cosY;

  return {
    x: offsetX + u * scale,
    y: offsetY + (v * SIN_PITCH - dz * COS_PITCH) * scale,
    depth: v * COS_PITCH + dz * SIN_PITCH,
  };
}

export function slotCorners3D(box: Box3D): readonly [Vec3, Vec3, Vec3, Vec3] {
  if (box.minZ === box.maxZ) {
    return [
      [box.minX, box.minY, box.minZ],
      [box.maxX, box.minY, box.minZ],
      [box.maxX, box.maxY, box.minZ],
      [box.minX, box.maxY, box.minZ],
    ];
  }
  if (box.minX === box.maxX) {
    return [
      [box.minX, box.minY, box.minZ],
      [box.minX, box.maxY, box.minZ],
      [box.minX, box.maxY, box.maxZ],
      [box.minX, box.minY, box.maxZ],
    ];
  }
  return [
    [box.minX, box.minY, box.minZ],
    [box.maxX, box.minY, box.minZ],
    [box.maxX, box.minY, box.maxZ],
    [box.minX, box.minY, box.maxZ],
  ];
}

export function boxCenter3D(box: Box3D): Vec3 {
  return [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2, (box.minZ + box.maxZ) / 2];
}

export interface StageFitTransform {
  readonly center: Vec3;
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export function isPointInPolygon2D(px: number, py: number, poly: readonly Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const pi = poly[i];
    const pj = poly[j];
    if (!pi || !pj) continue;
    const intersects =
      pi.y > py !== pj.y > py && px < ((pj.x - pi.x) * (py - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function polygonArea2D(poly: readonly Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (!a || !b) continue;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function faceSamplePoints3D(corners: readonly [Vec3, Vec3, Vec3, Vec3], gridN = 5): Vec3[] {
  const [c0, c1, c2, c3] = corners;
  const pts: Vec3[] = [];
  for (let iy = 0; iy < gridN; iy += 1) {
    const v = (iy + 0.5) / gridN;
    for (let ix = 0; ix < gridN; ix += 1) {
      const u = (ix + 0.5) / gridN;
      pts.push([
        c0[0] + (c1[0] - c0[0]) * u + (c3[0] - c0[0]) * v + (c0[0] - c1[0] + c2[0] - c3[0]) * u * v,
        c0[1] + (c1[1] - c0[1]) * u + (c3[1] - c0[1]) * v + (c0[1] - c1[1] + c2[1] - c3[1]) * u * v,
        c0[2] + (c1[2] - c0[2]) * u + (c3[2] - c0[2]) * v + (c0[2] - c1[2] + c2[2] - c3[2]) * u * v,
      ]);
    }
  }
  return pts;
}

function fitPointsToStage(
  samplePoints: readonly Vec3[],
  viewTurn: ViewTurn,
  width: number,
  height: number,
  padding: number,
): StageFitTransform {
  const pts: readonly Vec3[] =
    samplePoints.length > 0
      ? samplePoints
      : [
          [0, 0, 0],
          [1, 1, 1],
        ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, y, z] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const center: Vec3 = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];

  let pMinX = Infinity;
  let pMaxX = -Infinity;
  let pMinY = Infinity;
  let pMaxY = -Infinity;
  for (const pt of pts) {
    const p = projectOrthoPoint(pt, center, viewTurn, 1, 0, 0);
    if (p.x < pMinX) pMinX = p.x;
    if (p.x > pMaxX) pMaxX = p.x;
    if (p.y < pMinY) pMinY = p.y;
    if (p.y > pMaxY) pMaxY = p.y;
  }

  const spanX = Math.max(0.5, pMaxX - pMinX);
  const spanY = Math.max(0.5, pMaxY - pMinY);
  const availW = Math.max(20, width - padding * 2);
  const availH = Math.max(20, height - padding * 2);
  const scale = Math.min(availW / spanX, availH / spanY);

  return {
    center,
    scale,
    offsetX: width / 2 - ((pMinX + pMaxX) / 2) * scale,
    offsetY: height / 2 - ((pMinY + pMaxY) / 2) * scale,
  };
}

/**
 * 펼친(0°)·접힌(90°) 각각의 중심과 배율을 구하고, 진행도 `foldProgress`(0..1)로 보간한다.
 * 접힌 입체는 무대 가운데에서 짧은 변의 약 70%를 차지한다.
 */
export function computeStageFit(
  faces: readonly NetFaceInput[],
  evaluation: NetEvaluation,
  viewTurn: ViewTurn,
  width: number,
  height: number,
  padding: number,
  foldProgress = 1,
): StageFitTransform {
  const t = Math.min(1, Math.max(0, foldProgress));
  const effPad = Math.max(padding, Math.round(Math.min(width, height) * 0.14));

  const unfoldedPts: Vec3[] = [];
  const foldedPts: Vec3[] = [];
  if (faces.length > 0) {
    for (const tr of foldTransforms(faces, 0)) {
      unfoldedPts.push(...tr.corners);
    }
    for (const tr of foldTransforms(faces, Math.PI / 2)) {
      foldedPts.push(...tr.corners);
    }
  }
  for (const box of evaluation.slotBoxes) {
    foldedPts.push(...slotCorners3D(box));
  }

  const fit0 = fitPointsToStage(unfoldedPts, viewTurn, width, height, effPad);
  const fit1 = fitPointsToStage(foldedPts, viewTurn, width, height, effPad);
  if (t <= 0) return fit0;
  if (t >= 1) return fit1;
  return {
    center: [
      fit0.center[0] + (fit1.center[0] - fit0.center[0]) * t,
      fit0.center[1] + (fit1.center[1] - fit0.center[1]) * t,
      fit0.center[2] + (fit1.center[2] - fit0.center[2]) * t,
    ],
    scale: fit0.scale + (fit1.scale - fit0.scale) * t,
    offsetX: fit0.offsetX + (fit1.offsetX - fit0.offsetX) * t,
    offsetY: fit0.offsetY + (fit1.offsetY - fit0.offsetY) * t,
  };
}

/** 2D 지그재그 SVG path 문자열을 만든다. */
export function zigzagPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  amplitude = 4,
  stepPx = 8,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return `M${x1},${y1} L${x2},${y2}`;
  const steps = Math.max(4, Math.round(len / stepPx));
  const nx = -dy / len;
  const ny = dx / len;
  const parts: string[] = [`M${x1.toFixed(1)},${y1.toFixed(1)}`];
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const sign = i % 2 === 1 ? 1 : -1;
    const px = x1 + dx * t + nx * amplitude * sign;
    const py = y1 + dy * t + ny * amplitude * sign;
    parts.push(`L${px.toFixed(1)},${py.toFixed(1)}`);
  }
  parts.push(`L${x2.toFixed(1)},${y2.toFixed(1)}`);
  return parts.join(' ');
}

function mapFaceGridPoint3D(face: NetFaceInput, tr: FaceTransform3D, gx: number, gy: number): Vec3 {
  const u = face.w > 0 ? (gx - face.x) / face.w : 0;
  const v = face.h > 0 ? (gy - face.y) / face.h : 0;
  const [c0, c1, c2, c3] = tr.corners;
  // c0=(0,0), c1=(1,0), c2=(1,1), c3=(0,1)
  return [
    c0[0] + (c1[0] - c0[0]) * u + (c3[0] - c0[0]) * v + (c0[0] - c1[0] + c2[0] - c3[0]) * u * v,
    c0[1] + (c1[1] - c0[1]) * u + (c3[1] - c0[1]) * v + (c0[1] - c1[1] + c2[1] - c3[1]) * u * v,
    c0[2] + (c1[2] - c0[2]) * u + (c3[2] - c0[2]) * v + (c0[2] - c1[2] + c2[2] - c3[2]) * u * v,
  ];
}

export function mapSharedEdgeInFace3D(
  face: NetFaceInput,
  tr: FaceTransform3D,
  segment: SharedEdgeSegment,
): readonly [Vec3, Vec3] {
  if (segment.axis === 'x') {
    return [
      mapFaceGridPoint3D(face, tr, segment.coord, segment.lo),
      mapFaceGridPoint3D(face, tr, segment.coord, segment.hi),
    ];
  }
  return [
    mapFaceGridPoint3D(face, tr, segment.lo, segment.coord),
    mapFaceGridPoint3D(face, tr, segment.hi, segment.coord),
  ];
}

export function formatNetFoldStatus(evaluation: NetEvaluation, pairColors: boolean): string {
  if (evaluation.valid) {
    return pairColors ? S.net.foldedValidPairs : S.net.foldedValidPlain;
  }
  const parts: string[] = [];
  if (!evaluation.connected) {
    parts.push(S.net.disconnectedSummary);
  }
  if (evaluation.faceCount !== 6) {
    parts.push(S.net.faceCountSummary(evaluation.faceCount));
  }
  if (evaluation.overlapPairs > 0) {
    parts.push(S.net.overlapSummary(evaluation.overlapPairs));
  }
  if (evaluation.tornEdges > 0) {
    parts.push(S.net.tornSummary(evaluation.tornEdges));
  }
  if (evaluation.missingSlots.length > 0) {
    parts.push(S.net.missingSummary(evaluation.missingSlots.length));
  }
  return parts.join(' · ');
}

export function faceCenter2D(
  face: Pick<NetFace, 'x' | 'y' | 'w' | 'h'>,
  cellSize: number,
  pad: number,
): { readonly cx: number; readonly cy: number } {
  return {
    cx: pad + (face.x + face.w / 2) * cellSize,
    cy: pad + (face.y + face.h / 2) * cellSize,
  };
}

export function shouldShowFoldStatus(state: NetFoldState): boolean {
  return state.folded;
}

export interface FoldPathItem {
  readonly idx: number;
  readonly depth: number;
  readonly cx: number;
  readonly cy: number;
  readonly poly: readonly Point2D[];
  readonly points: string;
}

export interface FoldPathLayout {
  readonly viewTurn: ViewTurn;
  readonly items: readonly FoldPathItem[];
  readonly starVisibleArea: number;
  readonly starCenterVisible: boolean;
  readonly predVisibleRatio: number;
}

function visibleSampleRatio(
  tr: FaceTransform3D,
  center: Vec3,
  turn: ViewTurn,
  scale: number,
  offsetX: number,
  offsetY: number,
  occluders: readonly FoldPathItem[],
): number {
  const samples = faceSamplePoints3D(tr.corners, 5);
  let visible = 0;
  for (const pt of samples) {
    const p = projectOrthoPoint(pt, center, turn, scale, offsetX, offsetY);
    if (!occluders.some((occ) => isPointInPolygon2D(p.x, p.y, occ.poly))) {
      visible += 1;
    }
  }
  return samples.length > 0 ? visible / samples.length : 0;
}

function layoutFoldPathForTurn(
  transforms: readonly FaceTransform3D[],
  center: Vec3,
  ofIdx: number,
  predIdx: number,
  turn: ViewTurn,
  width: number,
  height: number,
): FoldPathLayout {
  let pMinX = Infinity;
  let pMaxX = -Infinity;
  let pMinY = Infinity;
  let pMaxY = -Infinity;
  for (const tr of transforms) {
    for (const pt of tr.corners) {
      const p = projectOrthoPoint(pt, center, turn, 1, 0, 0);
      if (p.x < pMinX) pMinX = p.x;
      if (p.x > pMaxX) pMaxX = p.x;
      if (p.y < pMinY) pMinY = p.y;
      if (p.y > pMaxY) pMaxY = p.y;
    }
  }
  const scale = Math.min(
    (width - 28) / Math.max(0.5, pMaxX - pMinX),
    (height - 24) / Math.max(0.5, pMaxY - pMinY),
  );
  const offsetX = width / 2 - ((pMinX + pMaxX) / 2) * scale;
  const offsetY = height / 2 - ((pMinY + pMaxY) / 2) * scale;

  const items: FoldPathItem[] = transforms
    .map((tr, idx) => {
      const poly = tr.corners.map((pt) => {
        const p = projectOrthoPoint(pt, center, turn, scale, offsetX, offsetY);
        return { x: p.x, y: p.y };
      });
      const c = projectOrthoPoint(tr.center, center, turn, scale, offsetX, offsetY);
      return {
        idx,
        depth: c.depth,
        cx: c.x,
        cy: c.y,
        poly,
        points: poly.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      };
    })
    .sort((a, b) => a.depth - b.depth || a.idx - b.idx);

  const starPos = items.findIndex((it) => it.idx === ofIdx);
  const predPos = items.findIndex((it) => it.idx === predIdx);
  const starItem = starPos >= 0 ? items[starPos] : undefined;
  const predItem = predPos >= 0 ? items[predPos] : undefined;
  const starTr = transforms[ofIdx];
  const predTr = transforms[predIdx];

  const starOccluders =
    starItem !== undefined
      ? items.slice(starPos + 1).filter((it) => it.depth > starItem.depth + 1e-6)
      : [];
  const predOccluders =
    predItem !== undefined
      ? items.slice(predPos + 1).filter((it) => it.depth > predItem.depth + 1e-6)
      : [];

  const starCenterVisible =
    starItem !== undefined
      ? !starOccluders.some((occ) => isPointInPolygon2D(starItem.cx, starItem.cy, occ.poly))
      : false;
  const starRatio =
    starTr !== undefined
      ? visibleSampleRatio(starTr, center, turn, scale, offsetX, offsetY, starOccluders)
      : 0;
  const starVisibleArea = starItem !== undefined ? polygonArea2D(starItem.poly) * starRatio : 0;
  const predVisibleRatio =
    predTr !== undefined && predItem !== undefined && polygonArea2D(predItem.poly) > 1e-2
      ? visibleSampleRatio(predTr, center, turn, scale, offsetX, offsetY, predOccluders)
      : 0;

  return {
    viewTurn: turn,
    items,
    starVisibleArea,
    starCenterVisible,
    predVisibleRatio,
  };
}

/**
 * `fold-path` 오버레이용 최적 시점을 고른다.
 * 네 방향 중 `★` 면이 가장 크게·가림 없이 보이고 고른 면(`predIdx`)도 보이는 시점을 선택한다.
 */
export function computeFoldPathLayout(
  transforms: readonly FaceTransform3D[],
  ofIdx: number,
  predIdx: number,
  preferredTurn: ViewTurn,
  width: number,
  height: number,
): FoldPathLayout {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const tr of transforms) {
    for (const [x, y, z] of tr.corners) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  }
  const center: Vec3 = Number.isFinite(minX)
    ? [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2]
    : [0, 0, 0];

  const turns: readonly ViewTurn[] = [0, 1, 2, 3];
  const candidates = turns.map((turn) =>
    layoutFoldPathForTurn(transforms, center, ofIdx, predIdx, turn, width, height),
  );

  const isBetter = (a: FoldPathLayout, b: FoldPathLayout): boolean => {
    const aBoth = a.starCenterVisible && a.predVisibleRatio > 0.15 ? 1 : 0;
    const bBoth = b.starCenterVisible && b.predVisibleRatio > 0.15 ? 1 : 0;
    if (aBoth !== bBoth) return aBoth > bBoth;

    const aPred = a.predVisibleRatio > 0.1 ? 1 : 0;
    const bPred = b.predVisibleRatio > 0.1 ? 1 : 0;
    if (aPred !== bPred) return aPred > bPred;

    const aCenter = a.starCenterVisible ? 1 : 0;
    const bCenter = b.starCenterVisible ? 1 : 0;
    if (aCenter !== bCenter) return aCenter > bCenter;

    if (Math.abs(a.starVisibleArea - b.starVisibleArea) > 1e-2) {
      return a.starVisibleArea > b.starVisibleArea;
    }
    if (Math.abs(a.predVisibleRatio - b.predVisibleRatio) > 1e-2) {
      return a.predVisibleRatio > b.predVisibleRatio;
    }
    return a.viewTurn === preferredTurn && b.viewTurn !== preferredTurn;
  };

  let best = candidates[0] as FoldPathLayout;
  for (let i = 1; i < candidates.length; i += 1) {
    const cand = candidates[i];
    if (cand && isBetter(cand, best)) {
      best = cand;
    }
  }
  return best;
}
