/**
 * E17 sort 판 배치. 본 판·오버레이·E2E가 같은 좌표를 쓰도록 한 곳에 모은다.
 * 논리 너비 1000, 높이는 `sortBoardHeight`다(설정과 무관하게 같은 값). 좌표만 number다.
 */
import type { Point } from '../../../core/engine-sdk';
import type { Box } from '../layout';
import { activeBinIds } from './settings';
import type { BinId, SortState } from './types';

export const SORT_WIDTH = 1000;
/** 위쪽 카드 칸·벨트 영역 높이. */
export const SORT_TOP = 200;
const BIN_TOP = SORT_TOP + 8;
const BIN_HEIGHT = 342;
const HEADER_HEIGHT = 64;
export const SORT_HEIGHT = BIN_TOP + BIN_HEIGHT + 10;

/** 카드 칸의 카드 칸(셀) 크기와 그림 크기. */
export const TRAY_CELL = { width: 160, height: 82 } as const;
export const TRAY_COLUMNS = 6;
export const TRAY_CARD = 66;
export const BIN_CARD = 60;
export const BELT_CARD = 104;

/** 판 논리 높이. sort 판은 설정과 상관없이 하나의 높이를 쓴다(오버레이도 같은 함수를 쓴다). */
export function sortBoardHeight(): number {
  return SORT_HEIGHT;
}

export function trayBox(): Box {
  return { x: 0, y: 0, width: SORT_WIDTH, height: SORT_TOP };
}

export function trayCardCenter(index: number): Point {
  const row = Math.floor(index / TRAY_COLUMNS);
  const col = index % TRAY_COLUMNS;
  return {
    x: 20 + col * TRAY_CELL.width + TRAY_CELL.width / 2,
    y: 36 + row * TRAY_CELL.height + TRAY_CELL.height / 2,
  };
}

/** 벨트에 온 카드의 자리. */
export function beltCardCenter(): Point {
  return { x: 500, y: 112 };
}

export function binBoxes(count: number): Box[] {
  if (count <= 0) return [];
  const gap = 16;
  const width = Math.min(300, (SORT_WIDTH - 40 - (count - 1) * gap) / count);
  const total = count * width + (count - 1) * gap;
  const left = (SORT_WIDTH - total) / 2;
  return Array.from({ length: count }, (_, index) => ({
    x: left + index * (width + gap),
    y: BIN_TOP,
    width,
    height: BIN_HEIGHT,
  }));
}

export function binHeaderBox(box: Box): Box {
  return { x: box.x, y: box.y, width: box.width, height: HEADER_HEIGHT };
}

function binColumns(box: Box): number {
  return box.width >= 280 ? 4 : 3;
}

/** 상자 안 카드 자리 중심(index번째). */
export function binSlotCenter(box: Box, index: number): Point {
  const columns = binColumns(box);
  const rows = Math.ceil(12 / columns);
  const bodyTop = box.y + HEADER_HEIGHT + 6;
  const bodyHeight = box.height - HEADER_HEIGHT - 12;
  const slotWidth = box.width / columns;
  const slotHeight = bodyHeight / rows;
  return {
    x: box.x + (index % columns) * slotWidth + slotWidth / 2,
    y: bodyTop + Math.floor(index / columns) * slotHeight + slotHeight / 2,
  };
}

export type SlotWhere = 'tray' | 'belt' | BinId;

export interface CardSlot {
  readonly id: string;
  readonly center: Point;
  readonly size: number;
  readonly where: SlotWhere;
}

/** 지금 판에 보이는 카드들의 자리. 컨베이어에서는 벨트의 지금 카드 하나만 트레이 쪽에 보인다. */
export function sortCardSlots(state: SortState, current: string | null): CardSlot[] {
  const slots: CardSlot[] = [];
  const binIds = activeBinIds(state.settings, state.criterion);
  const boxes = binBoxes(binIds.length);
  const counters = new Map<string, number>();
  const trayIds: string[] = [];
  for (const id of state.settings.cards) {
    const bin = state.binOf[id] ?? null;
    if (bin === null) {
      trayIds.push(id);
      continue;
    }
    const index = binIds.indexOf(bin);
    const box = boxes[index];
    if (!box) continue;
    const n = counters.get(bin) ?? 0;
    counters.set(bin, n + 1);
    slots.push({ id, center: binSlotCenter(box, n), size: BIN_CARD, where: bin });
  }
  if (state.settings.conveyor) {
    if (current !== null) {
      slots.push({ id: current, center: beltCardCenter(), size: BELT_CARD, where: 'belt' });
    }
  } else {
    trayIds.forEach((id, index) => {
      slots.push({ id, center: trayCardCenter(index), size: TRAY_CARD, where: 'tray' });
    });
  }
  return slots;
}

export type DropTarget =
  { readonly kind: 'tray' } | { readonly kind: 'bin'; readonly index: number };

export function sortTargetAt(point: Point, binCount: number): DropTarget | null {
  const boxes = binBoxes(binCount);
  for (let index = 0; index < boxes.length; index += 1) {
    const box = boxes[index];
    if (
      box &&
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    ) {
      return { kind: 'bin', index };
    }
  }
  if (point.y <= SORT_TOP + 4) return { kind: 'tray' };
  return null;
}
