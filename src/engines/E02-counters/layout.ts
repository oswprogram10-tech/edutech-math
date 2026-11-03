/**
 * E02 화면 배치. View·overlay가 같은 좌표를 쓰도록 한 곳에 모은다.
 * 좌표는 모두 논리 좌표(1000×600)다.
 */
import type { Point } from '../../core/engine-sdk';
import {
  FRAME_CELL,
  FRAME_GAP,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
} from './types';

const SUMMON_LEFT = 110;
const SUMMON_TOP = 190;
const SUMMON_SPACING = 66;
const SUMMON_ROW_GAP = 92;
const SUMMON_PER_ROW = 10;

/** 선반에 왼쪽부터 줄 세운 셈돌의 자리. reduce와 View가 함께 쓴다. */
export function summonPoint(index: number): Point {
  const row = Math.floor(index / SUMMON_PER_ROW);
  const column = index % SUMMON_PER_ROW;
  return {
    x: SUMMON_LEFT + column * SUMMON_SPACING,
    y: SUMMON_TOP + row * SUMMON_ROW_GAP,
  };
}

export const SUMMON_SHELF = { x: 60, y: 130, width: 880, height: 390 };

export function trayPoint(trayIndex: number): Point {
  return { x: 100 + (trayIndex % 10) * 80, y: 520 };
}

export const TRAY_TOP = 470;
export const TRAY_BOTTOM = LOGICAL_HEIGHT;

export function frameOrigin(frames: number, index: number): Point {
  if (frames <= 1) {
    return { x: (LOGICAL_WIDTH - FRAME_WIDTH) / 2, y: 120 };
  }
  const gap = 44;
  const total = FRAME_WIDTH * 2 + gap;
  const left = (LOGICAL_WIDTH - total) / 2;
  return { x: left + index * (FRAME_WIDTH + gap), y: 120 };
}

/** 칸 0~9는 2행 × 5열(왼쪽 위부터). */
export function frameCellPoint(frames: number, frame: number, cell: number): Point {
  const origin = frameOrigin(frames, frame);
  const row = Math.floor(cell / 5);
  const column = cell % 5;
  return {
    x: origin.x + column * (FRAME_CELL + FRAME_GAP) + FRAME_CELL / 2,
    y: origin.y + row * (FRAME_CELL + FRAME_GAP) + FRAME_CELL / 2,
  };
}

export function frameBounds(
  frames: number,
  frame: number,
): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const origin = frameOrigin(frames, frame);
  return { x: origin.x, y: origin.y, width: FRAME_WIDTH, height: FRAME_HEIGHT };
}

export interface PlateBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function plateBounds(parts: number, index: number): PlateBounds {
  const count = Math.max(1, parts);
  const margin = 40;
  const gap = 22;
  const total = LOGICAL_WIDTH - margin * 2;
  const width = (total - gap * (count - 1)) / count;
  return {
    x: margin + index * (width + gap),
    y: 230,
    width,
    height: 300,
  };
}

/** 접시 안 셈돌 자리. 한 줄에 5개씩 놓는다. */
export function plateSlotPoint(parts: number, plate: number, slot: number): Point {
  const bounds = plateBounds(parts, plate);
  const column = slot % 5;
  const row = Math.floor(slot / 5);
  return {
    x: bounds.x + 38 + column * 54,
    y: bounds.y + 46 + row * 54,
  };
}

export function sceneIconPoint(index: number, row: number): Point {
  const column = index % 8;
  return { x: 250 + column * 42, y: 64 + row * 46 };
}

export function inRect(
  point: Point,
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/** flash 그림 자리. layout에 따라 다른 격자를 쓴다. */
export function flashPoint(
  layout: 'dice' | 'ten-frame' | 'fingers' | 'random',
  index: number,
): Point {
  if (layout === 'ten-frame') {
    return frameCellPoint(1, 0, index);
  }
  if (layout === 'fingers') {
    const hand = Math.floor(index / 5);
    const finger = index % 5;
    return { x: 330 + hand * 300 + finger * 46, y: 260 };
  }
  if (layout === 'dice') {
    // 1~6개는 2×3, 7~10개는 2×5.
    if (index < 6) {
      return { x: 380 + (index % 3) * 80, y: 280 + Math.floor(index / 3) * 80 };
    }
    const local = index - 6;
    return { x: 340 + (local % 5) * 80, y: 260 + Math.floor(local / 5) * 80 };
  }
  return summonPoint(index);
}
