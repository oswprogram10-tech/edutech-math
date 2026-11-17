/**
 * E12 `surface-volume` 기하(순수 함수, 정수만 쓴다).
 *
 * 치수 단위는 cm다. 겉넓이·부피·약수 조합은 판정(관찰)에만 쓰고 학생 화면에는 쓰지 않는다.
 */
import type { XrayFaceId } from '../xray/geometry';

export const SV_FACE_IDS: readonly XrayFaceId[] = [
  'front',
  'back',
  'left',
  'right',
  'top',
  'bottom',
];

/** 마주 보는 면 쌍. 칠하기에서 같은 색과 무늬를 쓴다. */
export type SvPairId = 'fb' | 'lr' | 'tb';

const PAIR_OF: Readonly<Record<XrayFaceId, SvPairId>> = {
  front: 'fb',
  back: 'fb',
  left: 'lr',
  right: 'lr',
  top: 'tb',
  bottom: 'tb',
};

export function pairOf(face: XrayFaceId): SvPairId {
  return PAIR_OF[face];
}

export function isSvFaceId(value: unknown): value is XrayFaceId {
  return typeof value === 'string' && (SV_FACE_IDS as readonly string[]).includes(value);
}

/** 면의 가로·세로 칸 수(cm). */
export function faceSize(
  face: XrayFaceId,
  w: number,
  d: number,
  h: number,
): readonly [number, number] {
  switch (face) {
    case 'front':
    case 'back':
      return [w, h];
    case 'left':
    case 'right':
      return [d, h];
    case 'top':
    case 'bottom':
      return [w, d];
  }
}

export function faceArea(face: XrayFaceId, w: number, d: number, h: number): number {
  const [a, b] = faceSize(face, w, d, h);
  return a * b;
}

export function surfaceArea(w: number, d: number, h: number): number {
  return 2 * (w * d + w * h + d * h);
}

export function volume(w: number, d: number, h: number): number {
  return w * d * h;
}

export function paintedArea(faces: readonly XrayFaceId[], w: number, d: number, h: number): number {
  return faces.reduce((sum, f) => sum + faceArea(f, w, d, h), 0);
}

/** 세 수를 정렬한 키(2×3×4 = 4×3×2). */
export function sortedDims(w: number, d: number, h: number): readonly [number, number, number] {
  const list = [w, d, h].sort((a, b) => a - b);
  return [list[0] ?? 0, list[1] ?? 0, list[2] ?? 0];
}

export function sameBox(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): boolean {
  const x = sortedDims(a[0], a[1], a[2]);
  const y = sortedDims(b[0], b[1], b[2]);
  return x[0] === y[0] && x[1] === y[1] && x[2] === y[2];
}

export function divisors(n: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= n; i += 1) {
    if (n % i === 0) out.push(i);
  }
  return out;
}

/** w ≤ d ≤ h이고 w·d·h = V인 정수 조합(사전순). */
export function boxesOfVolume(v: number): readonly (readonly [number, number, number])[] {
  const out: [number, number, number][] = [];
  if (!Number.isInteger(v) || v < 1) return out;
  for (let w = 1; w * w * w <= v; w += 1) {
    if (v % w !== 0) continue;
    const rest = v / w;
    for (let d = w; d * d <= rest; d += 1) {
      if (rest % d !== 0) continue;
      out.push([w, d, rest / d]);
    }
  }
  return out;
}

/** 겉넓이가 가장 작은 조합(같으면 목록 앞쪽). */
export function minSurfaceBox(v: number): readonly [number, number, number] | null {
  const list = boxesOfVolume(v);
  let best: readonly [number, number, number] | null = null;
  let bestArea = Infinity;
  for (const box of list) {
    const area = surfaceArea(box[0], box[1], box[2]);
    if (area < bestArea) {
      best = box;
      bestArea = area;
    }
  }
  return best;
}

// ---------------------------------------------------------------- 전개도(십자형)

export interface SvNetFace {
  readonly face: XrayFaceId;
  /** 칸 좌표(왼쪽 위 기준). */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** `back`은 뒤집혀 놓인다. */
  readonly flipped: boolean;
}

/**
 * 십자형 전개도: front가 가운데, 위에 top, 아래에 bottom, 그 아래에 back(뒤집힘),
 * 왼쪽에 left, 오른쪽에 right. 전체 칸 수 폭 `2d + w`, 높이 `2d + 2h`.
 */
export function netLayout(w: number, d: number, h: number): readonly SvNetFace[] {
  return [
    { face: 'top', x: d, y: 0, w, h: d, flipped: false },
    { face: 'left', x: 0, y: d, w: d, h, flipped: false },
    { face: 'front', x: d, y: d, w, h, flipped: false },
    { face: 'right', x: d + w, y: d, w: d, h, flipped: false },
    { face: 'bottom', x: d, y: d + h, w, h: d, flipped: false },
    { face: 'back', x: d, y: 2 * d + h, w, h, flipped: true },
  ];
}

export function netBounds(
  w: number,
  d: number,
  h: number,
): { readonly cols: number; readonly rows: number } {
  return { cols: 2 * d + w, rows: 2 * d + 2 * h };
}

export function netFaceById(
  w: number,
  d: number,
  h: number,
  face: XrayFaceId,
): SvNetFace | undefined {
  return netLayout(w, d, h).find((f) => f.face === face);
}
