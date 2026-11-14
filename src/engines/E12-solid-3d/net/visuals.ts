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

/**
 * 펼침·접힘·회전 4방향과 빈 슬롯까지 모두 뷰박스 안에 들어오도록
 * 일관된 중심과 배율을 계산한다.
 */
export function computeStageFit(
  faces: readonly NetFaceInput[],
  evaluation: NetEvaluation,
  viewTurn: ViewTurn,
  width: number,
  height: number,
  padding: number,
): StageFitTransform {
  const samplePoints: Vec3[] = [];
  if (faces.length > 0) {
    for (const tr of foldTransforms(faces, 0)) {
      samplePoints.push(...tr.corners);
    }
    for (const tr of foldTransforms(faces, Math.PI / 2)) {
      samplePoints.push(...tr.corners);
    }
  }
  for (const box of evaluation.slotBoxes) {
    samplePoints.push(...slotCorners3D(box));
  }
  if (samplePoints.length === 0) {
    samplePoints.push([0, 0, 0], [1, 1, 1]);
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, y, z] of samplePoints) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const center: Vec3 = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];

  let projMinX = Infinity;
  let projMaxX = -Infinity;
  let projMinY = Infinity;
  let projMaxY = -Infinity;
  const turns: readonly ViewTurn[] = [0, 1, 2, 3];
  for (const t of turns) {
    for (const pt of samplePoints) {
      const p = projectOrthoPoint(pt, center, t, 1, 0, 0);
      if (p.x < projMinX) projMinX = p.x;
      if (p.x > projMaxX) projMaxX = p.x;
      if (p.y < projMinY) projMinY = p.y;
      if (p.y > projMaxY) projMaxY = p.y;
    }
  }

  const spanX = Math.max(0.5, projMaxX - projMinX);
  const spanY = Math.max(0.5, projMaxY - projMinY);
  const availW = Math.max(20, width - padding * 2);
  const availH = Math.max(20, height - padding * 2);
  const scale = Math.min(availW / spanX, availH / spanY);

  // 현재 시점의 투영 중심을 무대 중앙에 맞춘다.
  let curMinX = Infinity;
  let curMaxX = -Infinity;
  let curMinY = Infinity;
  let curMaxY = -Infinity;
  for (const pt of samplePoints) {
    const p = projectOrthoPoint(pt, center, viewTurn, scale, 0, 0);
    if (p.x < curMinX) curMinX = p.x;
    if (p.x > curMaxX) curMaxX = p.x;
    if (p.y < curMinY) curMinY = p.y;
    if (p.y > curMaxY) curMaxY = p.y;
  }

  return {
    center,
    scale,
    offsetX: width / 2 - (curMinX + curMaxX) / 2,
    offsetY: height / 2 - (curMinY + curMaxY) / 2,
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
