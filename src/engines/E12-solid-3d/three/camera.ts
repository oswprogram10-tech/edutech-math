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
 * 어느 방위각·극각에서도 바닥 격자(`cols × rows`), `maxHeight` 기둥, `"앞"` 표시가
 * 원점 `(0, 0, 0)` 기준 직교 카메라 안에 들어오는 맞춤 zoom을 구한다.
 */
export function computeFitZoom(
  viewportWidth: number,
  viewportHeight: number,
  cols: number,
  rows: number,
  maxHeight: number,
): number {
  if (viewportWidth <= 0 || viewportHeight <= 0) return 32;
  const worldSpanXZ = Math.hypot(cols, rows + 1.5);
  const maxHalfHeight = Math.hypot(maxHeight, worldSpanXZ / 2);
  const fullWidth = worldSpanXZ + 0.6;
  const fullHeight = maxHalfHeight * 2 + 0.6;
  return Math.max(12, Math.min(viewportWidth / fullWidth, viewportHeight / fullHeight));
}
