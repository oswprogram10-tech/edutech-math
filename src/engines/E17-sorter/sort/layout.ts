/**
 * E17 sort 판 배치. 본 판·오버레이·E2E가 같은 좌표를 쓰도록 한 곳에 모은다.
 * 논리 너비 1000, 높이는 `sortBoardHeight(settings)`다(설정의 최대 카드 수가 상자에 들어가는 높이, 700 이하).
 * 사물 카드는 그림 아래에 이름 글이 붙어 칸이 더 크다. 좌표만 number다.
 */
import type { Point } from '../../../core/engine-sdk';
import type { Box } from '../layout';
import { criterionValues } from './criteria';
import { activeBinIds } from './settings';
import type { BinId, SortSettings, SortState } from './types';

export const SORT_WIDTH = 1000;
export const SORT_MAX_HEIGHT = 700;
const HEADER_HEIGHT = 64;
const BIN_GAP = 16;
export const TRAY_COLUMNS = 6;
export const BELT_CARD = 104;
/** 사물 그림 밑 이름 글 높이(글자 약 17 논리 단위 ≈ 화면 12px 이상). */
export const NAME_FONT = 20;
const BIN_CARD_MAX = 66;

export interface SortGeometry {
  readonly named: boolean;
  readonly top: number;
  readonly binTop: number;
  readonly binHeight: number;
  readonly height: number;
  readonly binSize: number;
  readonly traySize: number;
  readonly slotWidth: number;
  readonly slotHeight: number;
  readonly trayRow: number;
}

function maxBinCount(settings: SortSettings): number {
  if (settings.criterionChoice !== null) {
    return Math.max(
      1,
      ...settings.criterionChoice.map(
        (criterion) => criterionValues(settings.deck, criterion).length,
      ),
    );
  }
  return Math.max(1, settings.bins);
}

function boxWidth(count: number): number {
  return Math.min(300, (SORT_WIDTH - 40 - (count - 1) * BIN_GAP) / count);
}

export function sortGeometry(settings: SortSettings): SortGeometry {
  const named = settings.deck === 'classroom-objects-12';
  const top = named ? 236 : 200;
  const binTop = top + 8;
  const slotWidth = named ? 96 : 74;
  const columns = Math.max(1, Math.floor(boxWidth(maxBinCount(settings)) / slotWidth));
  const rows = Math.max(1, Math.ceil(settings.cards.length / columns));
  const labelRoom = named ? NAME_FONT + 10 : 6;
  const maxBody = SORT_MAX_HEIGHT - binTop - 10 - HEADER_HEIGHT - 12;
  let slotHeight = named ? Math.round(BIN_CARD_MAX * 1.2) + labelRoom : BIN_CARD_MAX + labelRoom;
  slotHeight = Math.min(slotHeight, Math.floor(maxBody / rows));
  const binSize = named
    ? Math.min(BIN_CARD_MAX, Math.floor((slotHeight - labelRoom) / 1.2))
    : Math.min(BIN_CARD_MAX, slotHeight - labelRoom);
  const binHeight = HEADER_HEIGHT + 12 + rows * slotHeight;
  return {
    named,
    top,
    binTop,
    binHeight,
    height: binTop + binHeight + 10,
    binSize,
    traySize: named ? 56 : 66,
    slotWidth,
    slotHeight,
    trayRow: named ? 98 : 82,
  };
}

/** 판 논리 높이(오버레이도 같은 함수를 쓴다). */
export function sortBoardHeight(settings: SortSettings): number {
  return sortGeometry(settings).height;
}

export function trayCardCenter(geometry: SortGeometry, index: number): Point {
  const row = Math.floor(index / TRAY_COLUMNS);
  const col = index % TRAY_COLUMNS;
  const lift = geometry.named ? 34 : 41;
  return {
    x: 20 + col * 160 + 80,
    y: 34 + row * geometry.trayRow + lift,
  };
}

/** 벨트에 온 카드의 자리. */
export function beltCardCenter(geometry: SortGeometry): Point {
  return { x: 500, y: geometry.named ? 100 : 112 };
}

export function binBoxes(count: number, geometry: SortGeometry): Box[] {
  if (count <= 0) return [];
  const width = boxWidth(count);
  const total = count * width + (count - 1) * BIN_GAP;
  const left = (SORT_WIDTH - total) / 2;
  return Array.from({ length: count }, (_, index) => ({
    x: left + index * (width + BIN_GAP),
    y: geometry.binTop,
    width,
    height: geometry.binHeight,
  }));
}

export function binHeaderBox(box: Box): Box {
  return { x: box.x, y: box.y, width: box.width, height: HEADER_HEIGHT };
}

/** 상자 안 카드 자리 중심(index번째). 상자 폭에 맞춰 여러 줄로 줄바꿈한다. */
export function binSlotCenter(box: Box, geometry: SortGeometry, index: number): Point {
  const columns = Math.max(1, Math.floor(box.width / geometry.slotWidth));
  const slotWidth = box.width / columns;
  const bodyTop = box.y + HEADER_HEIGHT + 6;
  const lift = geometry.named ? geometry.binSize * 0.6 + 2 : geometry.slotHeight / 2;
  return {
    x: box.x + (index % columns) * slotWidth + slotWidth / 2,
    y: bodyTop + Math.floor(index / columns) * geometry.slotHeight + lift,
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
  const geometry = sortGeometry(state.settings);
  const slots: CardSlot[] = [];
  const binIds = activeBinIds(state.settings, state.criterion);
  const boxes = binBoxes(binIds.length, geometry);
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
    slots.push({
      id,
      center: binSlotCenter(box, geometry, n),
      size: geometry.binSize,
      where: bin,
    });
  }
  if (state.settings.conveyor) {
    if (current !== null) {
      slots.push({
        id: current,
        center: beltCardCenter(geometry),
        size: BELT_CARD,
        where: 'belt',
      });
    }
  } else {
    trayIds.forEach((id, index) => {
      slots.push({
        id,
        center: trayCardCenter(geometry, index),
        size: geometry.traySize,
        where: 'tray',
      });
    });
  }
  return slots;
}

export type DropTarget =
  { readonly kind: 'tray' } | { readonly kind: 'bin'; readonly index: number };

export function sortTargetAt(
  point: Point,
  binCount: number,
  geometry: SortGeometry,
): DropTarget | null {
  const boxes = binBoxes(binCount, geometry);
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
  if (point.y <= geometry.top + 4) return { kind: 'tray' };
  return null;
}
