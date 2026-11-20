/**
 * E20 판 배치(논리 1000×600). 화면과 오버레이가 같은 좌표를 쓰도록 순수 함수로 둔다.
 * 화면 좌표는 number, 수학 값(비·위치)은 Rational에서 온다.
 */
import type { Rational } from '../../core/math';
import { E20_STRINGS as S } from './strings.ko';
import { stripPosition } from './observe';
import type { Ingredient, MixState, Size } from './types';

// ───────────── mix ─────────────

export const STRIP = { x: 80, y: 475, w: 840, h: 40 };
export const MARKER_LABEL_Y = 358;
export const MARKER_LABEL_STEP = 20;

export const STRIP_SEGMENTS = 10;
const LIGHT = [0xf7, 0xef, 0xe2] as const;
const DARK = [0x3f, 0x23, 0x0f] as const;

export function positionNumber(pos: Rational): number {
  return Number(pos.n) / Number(pos.d);
}

/** 실제 진하기(0~1)에 해당하는 섞인 색. 우유색에서 시럽색으로 곧게 섞는다(결정적). */
export function shade(position: number): string {
  const t = Math.min(1, Math.max(0, position));
  const channel = (i: 0 | 1 | 2) => Math.round(LIGHT[i] + (DARK[i] - LIGHT[i]) * t);
  return `#${[0, 1, 2]
    .map((i) =>
      channel(i as 0 | 1 | 2)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

/** 진하기가 띠 범위(stripMax)를 넘는가. */
export function isOverflow(pos: Rational, stripMax: number): boolean {
  return positionNumber(pos) > stripMax + 1e-12;
}

/** 띠 위 가로 위치. 범위를 넘으면 띠 오른쪽 끝. */
export function stripX(pos: Rational, stripMax: number): number {
  return STRIP.x + STRIP.w * Math.min(1, positionNumber(pos) / stripMax);
}

/** 띠 범위 안의 색 단계(0~9). */
export function stageOf(pos: Rational, stripMax: number): number {
  return Math.min(
    STRIP_SEGMENTS - 1,
    Math.floor((positionNumber(pos) / stripMax) * STRIP_SEGMENTS + 1e-9),
  );
}

export type CupRole = 'reference' | 'cup' | 'fixed';

export interface Block {
  readonly kind: Ingredient;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface CupLayout {
  readonly key: string;
  readonly role: CupRole;
  readonly label: string;
  readonly milk: number;
  readonly syrup: number;
  /** blocks 모양에서만 있다. */
  readonly body: { x: number; y: number; w: number; h: number } | null;
  readonly labelX: number;
  readonly labelY: number;
  readonly textX: number;
  readonly textY: number;
  readonly anchor: 'middle' | 'start';
  readonly blocks: readonly Block[];
  /** 띠 위 위치. 빈 컵이면 null. */
  readonly position: Rational | null;
  /** 띠 위 표시의 가로 위치(범위를 넘으면 오른쪽 끝). 빈 컵이면 null. */
  readonly markerX: number | null;
  readonly overflow: boolean;
  /** 실제 진하기로 칠한 섞은 색. 빈 컵이면 null. */
  readonly color: string | null;
  /** blocks 모양: 컵 안쪽 아래부터 블록 높이까지 칠하는 칸. */
  readonly fill: { x: number; y: number; w: number; h: number } | null;
  /** strip·ratio 모양: 섞은 색 견본 칸. */
  readonly swatch: { x: number; y: number; w: number; h: number } | null;
}

const CUP = { w: 150, h: 216, top: 85, side: 10, bottom: 6, innerH: 200, taper: 6 };
const SIZES = [30, 24, 20, 16, 13, 11, 9, 7, 6, 5, 4];

export const CUP_GEOMETRY = CUP;

function gridBlocks(milk: number, syrup: number, bodyX: number): Block[] {
  const innerX = bodyX + CUP.side;
  const innerW = CUP.w - CUP.side * 2;
  const bottom = CUP.top + CUP.h - CUP.bottom;
  let size = SIZES[SIZES.length - 1] ?? 4;
  for (const s of SIZES) {
    const cols = Math.floor(innerW / s);
    if ((Math.ceil(milk / cols) + Math.ceil(syrup / cols)) * s <= CUP.innerH) {
      size = s;
      break;
    }
  }
  const cols = Math.floor(innerW / size);
  const left = innerX + (innerW - cols * size) / 2;
  const milkRows = Math.ceil(milk / cols);
  const blocks: Block[] = [];
  for (let i = 0; i < milk; i += 1) {
    blocks.push({
      kind: 'milk',
      index: i,
      x: left + (i % cols) * size,
      y: bottom - (Math.floor(i / cols) + 1) * size,
      w: size,
      h: size,
    });
  }
  for (let j = 0; j < syrup; j += 1) {
    blocks.push({
      kind: 'syrup',
      index: j,
      x: left + (j % cols) * size,
      y: bottom - (milkRows + Math.floor(j / cols) + 1) * size,
      w: size,
      h: size,
    });
  }
  return blocks;
}

export const ROW = { top: 60, step: 56, barX: 230, barW: 700, cellH: 34, labelX: 40 };

function rowBlocks(milk: number, syrup: number, rowY: number): Block[] {
  const total = milk + syrup;
  if (total === 0) return [];
  const size = Math.min(30, Math.floor(ROW.barW / total));
  const blocks: Block[] = [];
  for (let i = 0; i < total; i += 1) {
    const isMilk = i < milk;
    blocks.push({
      kind: isMilk ? 'milk' : 'syrup',
      index: isMilk ? i : i - milk,
      x: ROW.barX + i * size,
      y: rowY + 8,
      w: size,
      h: ROW.cellH,
    });
  }
  return blocks;
}

interface CupEntry {
  readonly key: string;
  readonly role: CupRole;
  readonly label: string;
  readonly milk: number;
  readonly syrup: number;
}

export function mixEntries(state: MixState): CupEntry[] {
  const entries: CupEntry[] = [];
  if (state.reference !== null) {
    entries.push({
      key: 'reference',
      role: 'reference',
      label: S.mix.referenceName,
      ...state.reference,
    });
  }
  for (const fixed of state.fixedCups) {
    entries.push({
      key: fixed.id,
      role: 'fixed',
      label: fixed.label,
      milk: fixed.milk,
      syrup: fixed.syrup,
    });
  }
  if (state.settings.hasCup) {
    entries.push({ key: 'cup', role: 'cup', label: S.mix.cupName, ...state.cup });
  }
  return entries;
}

export function mixCups(state: MixState): CupLayout[] {
  const entries = mixEntries(state);
  const n = entries.length;
  const { look } = state.settings;
  return entries.map((entry, i) => {
    const position = stripPosition(entry);
    const { stripMax } = state.settings;
    const common = {
      position,
      markerX: position === null ? null : stripX(position, stripMax),
      overflow: position !== null && isOverflow(position, stripMax),
      color: position === null ? null : shade(positionNumber(position)),
    };
    if (look === 'blocks') {
      const slot = 920 / Math.max(n, 1);
      const cx = 40 + slot * (i + 0.5);
      const bodyX = cx - CUP.w / 2;
      const blocks = gridBlocks(entry.milk, entry.syrup, bodyX);
      const top = blocks.length === 0 ? 0 : Math.min(...blocks.map((b) => b.y));
      const bottom = CUP.top + CUP.h - CUP.bottom;
      return {
        ...entry,
        body: { x: bodyX, y: CUP.top, w: CUP.w, h: CUP.h },
        labelX: cx,
        labelY: 62,
        textX: cx,
        textY: CUP.top + CUP.h + 34,
        anchor: 'middle',
        blocks,
        fill:
          blocks.length === 0
            ? null
            : { x: bodyX + CUP.side, y: top, w: CUP.w - CUP.side * 2, h: bottom - top },
        swatch: null,
        ...common,
      };
    }
    const rowY = ROW.top + i * ROW.step;
    return {
      ...entry,
      body: null,
      labelX: ROW.labelX,
      labelY: rowY + 20,
      textX: ROW.labelX,
      textY: rowY + 46,
      anchor: 'start',
      blocks: look === 'strip' ? rowBlocks(entry.milk, entry.syrup, rowY) : [],
      fill: null,
      swatch: position === null ? null : { x: ROW.barX - 36, y: rowY + 11, w: 28, h: 28 },
      ...common,
    };
  });
}

// ───────────── resize ─────────────

export const PIC = { x0: 60, y0: 52, areaW: 540, areaH: 490, maxCell: 70 };
export const PANEL = { x: 690, y: 40, w: 280, itemTop: 78, itemH: 54 };

export function cellSize(size: Size): number {
  return Math.min(PIC.areaW / size.w, PIC.areaH / size.h, PIC.maxCell);
}

export interface PictureRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly cell: number;
}

export function pictureRect(size: Size): PictureRect {
  const cell = cellSize(size);
  return { x: PIC.x0, y: PIC.y0, w: size.w * cell, h: size.h * cell, cell };
}

/**
 * 띠 위 이름표가 서로 겹치지 않게 줄(row)을 정한다. 왼쪽부터 놓되, 앞 이름표와 가로로 겹치면 한 줄 아래로 내린다.
 * 글자 너비는 글자 수로 어림한다(논리 20px 글자).
 */
export function markerLabel(cup: CupLayout): {
  text: string;
  anchor: 'middle' | 'end';
  x: number;
} {
  const x = cup.markerX ?? 0;
  return cup.overflow
    ? { text: `${cup.label} ${S.mix.overflow}`, anchor: 'end', x: x + 14 }
    : { text: cup.label, anchor: 'middle', x };
}

export function markerRows(cups: readonly CupLayout[]): Map<string, number> {
  const placed = cups
    .filter((c) => c.markerX !== null)
    .map((c) => {
      const label = markerLabel(c);
      const width = label.text.length * 20 + 12;
      const center = label.anchor === 'end' ? label.x - width / 2 : label.x;
      return { key: c.key, left: center - width / 2, right: center + width / 2 };
    })
    .sort((a, b) => a.left - b.left);
  const rowRight: number[] = [];
  const rows = new Map<string, number>();
  for (const item of placed) {
    let row = rowRight.findIndex((right) => item.left > right + 4);
    if (row === -1) row = rowRight.length;
    rowRight[row] = item.right;
    rows.set(item.key, row);
  }
  return rows;
}
