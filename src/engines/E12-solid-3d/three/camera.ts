/**
 * E12 3D 무대 좌표·카메라 방위각·시점·배율 순수 계산.
 *
 * - 상태 (x, y, z)의 중심이 three 좌표 `(x + 0.5 - cols/2, z + 0.5, rows/2 - y - 0.5)`다.
 * - 바닥은 Y = 0이고, 앞 줄(y = 0)이 +Z 쪽(카메라 쪽)이다.
 * - `viewTurn = 0`은 앞-오른쪽 위(+X, +Z) 대각 방향이며 `turn` 1당 90° 회전한다.
 */
import type { ViewTurn } from '../types';

export type CameraPreset = 'iso' | 'top' | 'front' | 'side';

export const ISO_POLAR_RAD = Math.atan(Math.SQRT2);
export const MIN_POLAR_RAD = 0.001;
export const MAX_POLAR_RAD = (85 * Math.PI) / 180;
export const CAMERA_DISTANCE = 20;

export function toWorld(
  x: number,
  y: number,
  z: number,
  grid: readonly [number, number],
): readonly [number, number, number] {
  const [cols, rows] = grid;
  return [x + 0.5 - cols / 2, z + 0.5, rows / 2 - y - 0.5];
}

export function floorTileWorld(
  x: number,
  y: number,
  grid: readonly [number, number],
): readonly [number, number, number] {
  const [cols, rows] = grid;
  return [x + 0.5 - cols / 2, 0, rows / 2 - y - 0.5];
}

/**
 * `viewTurn`에 대응하는 대각 시점의 방위각(라디안).
 * `turn = 0`일 때 앞(+Z)-오른쪽(+X) 대각 `+π/4`이고, 오른쪽 회전(`turn + 1`)마다 `-π/2` 돈다.
 */
export function azimuthFor(turn: ViewTurn): number {
  return Math.PI / 4 - turn * (Math.PI / 2);
}

export function targetForPreset(
  preset: CameraPreset,
  maxHeight: number,
): readonly [number, number, number] {
  return preset === 'top' ? [0, 0, 0] : [0, maxHeight / 2, 0];
}

export function targetAnglesForPreset(
  preset: CameraPreset,
  viewTurn: ViewTurn,
): { readonly azimuth: number; readonly polar: number } {
  switch (preset) {
    case 'iso':
      return { azimuth: azimuthFor(viewTurn), polar: ISO_POLAR_RAD };
    case 'top':
      return { azimuth: 0, polar: MIN_POLAR_RAD };
    case 'front':
      return { azimuth: 0, polar: MAX_POLAR_RAD };
    case 'side':
      return { azimuth: Math.PI / 2, polar: MAX_POLAR_RAD };
  }
}

export function sphericalToPosition(
  radius: number,
  polar: number,
  azimuth: number,
): readonly [number, number, number] {
  const sinPhi = Math.sin(polar);
  return [
    radius * sinPhi * Math.sin(azimuth),
    radius * Math.cos(polar),
    radius * sinPhi * Math.cos(azimuth),
  ];
}

/** 두 각도 사이 가장 짧은 회전 차이를 `[-π, π]` 범위로 구한다. */
export function shortestAngleDelta(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * 상자(`cols × rows × maxHeight`) 꼭짓점 8개를 현재 카메라의 오른쪽·위쪽 축으로 투영한
 * 너비·높이가 무대 짧은 변의 6% 여백 안에 들어오도록 직교 카메라 zoom을 구한다.
 */
export function computeFitZoom(
  viewportWidth: number,
  viewportHeight: number,
  cols: number,
  rows: number,
  maxHeight: number,
  azimuth: number = azimuthFor(0),
  polar: number = ISO_POLAR_RAD,
): number {
  if (viewportWidth <= 0 || viewportHeight <= 0) return 32;

  const sinPhi = Math.sin(polar);
  const cosPhi = Math.cos(polar);
  const sinTheta = Math.sin(azimuth);
  const cosTheta = Math.cos(azimuth);

  const rightX = cosTheta;
  const rightZ = -sinTheta;
  const upX = -cosPhi * sinTheta;
  const upY = sinPhi;
  const upZ = -cosPhi * cosTheta;

  const halfX = cols / 2;
  const halfZ = rows / 2;
  let minU = Number.POSITIVE_INFINITY;
  let maxU = Number.NEGATIVE_INFINITY;
  let minV = Number.POSITIVE_INFINITY;
  let maxV = Number.NEGATIVE_INFINITY;

  for (const sx of [-halfX, halfX]) {
    for (const sy of [0, maxHeight]) {
      for (const sz of [-halfZ, halfZ]) {
        const u = sx * rightX + sz * rightZ;
        const v = sx * upX + sy * upY + sz * upZ;
        if (u < minU) minU = u;
        if (u > maxU) maxU = u;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
    }
  }

  const worldWidth = Math.max(0.1, maxU - minU);
  const worldHeight = Math.max(0.1, maxV - minV);
  const margin = Math.min(viewportWidth, viewportHeight) * 0.06;
  const availWidth = Math.max(1, viewportWidth - margin * 2);
  const availHeight = Math.max(1, viewportHeight - margin * 2);
  return Math.max(12, Math.min(availWidth / worldWidth, availHeight / worldHeight));
}

export function frontMarkerWorld(rows: number): readonly [number, number, number] {
  return [0, 0, rows / 2 + 0.34];
}

/** 3D '앞' HTML 이름표가 무대 상자 밖으로 나가지 않게 안쪽 가장자리로 붙인다. */
export function clampStageLabelPoint(
  rawX: number,
  rawY: number,
  stageWidth: number,
  stageHeight: number,
  labelWidth: number,
  labelHeight: number,
): { readonly x: number; readonly y: number } {
  const edgeMargin = 6;
  const padX = Math.min(stageWidth / 2, labelWidth / 2 + edgeMargin);
  const padY = Math.min(stageHeight / 2, labelHeight / 2 + edgeMargin);
  return {
    x: Math.max(padX, Math.min(stageWidth - padX, rawX)),
    y: Math.max(padY, Math.min(stageHeight - padY, rawY)),
  };
}
