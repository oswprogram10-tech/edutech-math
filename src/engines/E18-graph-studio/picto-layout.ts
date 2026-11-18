/**
 * E18 그림그래프의 그림 배치(순수 함수).
 *
 * 그림그래프 SVG의 논리 좌표는 화면 px와 같다(1:1). 가로폭은 그래프 영역의 실제 폭이고,
 * 작은 그림 한 변은 View가 받는 `targetSize` px로 두어 누르는 그림이 늘 targetSize 이상이게 한다.
 * 한 줄에 다 들어가지 않으면 그림을 겹치지 않고 다음 줄로 접는다(가로 스크롤은 없다).
 * View·올가미 판정·오버레이가 같은 계산을 쓴다.
 */
import { selectInside } from '../../core/engine-sdk';
import type { Point } from '../../core/engine-sdk';
import type { PictographRow } from './types';

/** 그림 사이 간격(px). 누르는 자리(slot)는 그림 한 변 + 간격이다. */
export const ICON_GAP = 6;
/** 큰 그림은 작은 그림의 1.6배 크기다. */
export const BIG_FACTOR = 1.6;
const SIDE_PAD = 10;
const ROW_PAD = 6;

export type PictoKind = 'big' | 'small';

export interface PictoItem {
  readonly kind: PictoKind;
  /** 그 종류 안에서 몇 번째인가(0부터). */
  readonly index: number;
  /** 그림 상자의 왼쪽 위(논리 좌표). */
  readonly x: number;
  readonly y: number;
  readonly side: number;
}

/** 행 조작 단추 묶음의 자리(논리 좌표 = 화면 px). */
export interface PictoControlsRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PictoRowLayout {
  readonly cat: string;
  readonly index: number;
  readonly top: number;
  readonly height: number;
  /** 그림 칸의 높이(행 높이에서 단추 줄 `below`를 뺀 것). 행 이름은 이 안에서 가운데다. */
  readonly areaHeight: number;
  readonly items: readonly PictoItem[];
  /** 학생이 만드는 그림그래프의 행 조작 단추 자리. 없으면 undefined. */
  readonly controls?: PictoControlsRect;
}

/**
 * 행 조작 단추 배치. `side`는 행 오른쪽 끝(그림은 그 왼쪽에만 놓는다), `below`는 그 행 바로 아래 줄.
 * `width`는 `side`일 때 단추 묶음 폭, `height`는 단추 높이(targetSize)다.
 */
export interface PictoControlsOption {
  readonly mode: 'side' | 'below';
  readonly width: number;
  readonly height: number;
}

export interface PictoLayout {
  readonly width: number;
  readonly height: number;
  readonly labelWidth: number;
  /** 작은 그림 한 변. */
  readonly icon: number;
  /** 큰 그림 한 변. */
  readonly bigSide: number;
  readonly rows: readonly PictoRowLayout[];
}

export function bigSideOf(icon: number): number {
  return Math.round(icon * BIG_FACTOR);
}

export function labelWidthOf(width: number): number {
  return Math.round(Math.min(150, Math.max(64, width * 0.22)));
}

export function pictoLayout(
  categories: readonly string[],
  rows: Readonly<Record<string, PictographRow>>,
  width: number,
  icon: number,
  controls?: PictoControlsOption,
): PictoLayout {
  const w = Math.max(1, Math.floor(width));
  const bigSide = bigSideOf(icon);
  const labelWidth = labelWidthOf(w);
  const left = labelWidth + SIDE_PAD;
  const sideWidth = controls?.mode === 'side' ? controls.width : 0;
  const right = w - SIDE_PAD - (sideWidth > 0 ? sideWidth + SIDE_PAD : 0);
  const strip = controls?.mode === 'below' ? controls.height + ROW_PAD : 0;
  const minArea = controls?.mode === 'side' ? controls.height + 2 * ROW_PAD : 0;
  const smallLine = icon + ICON_GAP;
  const bigLine = bigSide + ICON_GAP;

  let cursorY = 0;
  const laid: PictoRowLayout[] = [];
  categories.forEach((cat, rowIndex) => {
    const row = rows[cat] ?? { big: 0, small: 0 };
    const top = cursorY;
    const sequence: { readonly kind: PictoKind; readonly index: number }[] = [
      ...Array.from({ length: row.big }, (_, index) => ({ kind: 'big' as const, index })),
      ...Array.from({ length: row.small }, (_, index) => ({ kind: 'small' as const, index })),
    ];
    // 줄 나누기: 다음 그림이 오른쪽 끝을 넘으면 줄을 바꾼다(한 줄에 하나는 늘 놓는다).
    const lines: { kind: PictoKind; index: number; x: number }[][] = [[]];
    let x = left;
    for (const item of sequence) {
      const pitch = (item.kind === 'big' ? bigSide : icon) + ICON_GAP;
      const current = lines[lines.length - 1] as { kind: PictoKind; index: number; x: number }[];
      if (current.length > 0 && x + pitch - ICON_GAP > right) {
        lines.push([]);
        x = left;
      }
      (lines[lines.length - 1] as { kind: PictoKind; index: number; x: number }[]).push({
        ...item,
        x,
      });
      x += pitch;
    }
    let lineTop = top + ROW_PAD;
    const items: PictoItem[] = [];
    for (const line of lines) {
      const lineHeight = line.some((item) => item.kind === 'big') ? bigLine : smallLine;
      for (const item of line) {
        const side = item.kind === 'big' ? bigSide : icon;
        items.push({
          kind: item.kind,
          index: item.index,
          x: item.x,
          y: lineTop + (lineHeight - side) / 2,
          side,
        });
      }
      lineTop += lineHeight;
    }
    const content = lineTop + ROW_PAD - top;
    const areaHeight = Math.max(content, minArea);
    // 단추 줄이 그림보다 높으면(side) 그림을 세로 가운데로 옮긴다.
    const shift = (areaHeight - content) / 2;
    const shifted = shift > 0 ? items.map((item) => ({ ...item, y: item.y + shift })) : items;
    const height = areaHeight + strip;
    let rect: PictoControlsRect | undefined;
    if (controls?.mode === 'side') {
      rect = {
        x: w - SIDE_PAD - controls.width,
        y: top + (areaHeight - controls.height) / 2,
        width: controls.width,
        height: controls.height,
      };
    } else if (controls) {
      rect = {
        x: left,
        y: top + areaHeight,
        width: Math.max(1, w - left - SIDE_PAD),
        height: controls.height,
      };
    }
    laid.push({
      cat,
      index: rowIndex,
      top,
      height,
      areaHeight,
      items: shifted,
      ...(rect ? { controls: rect } : {}),
    });
    cursorY += height;
  });

  return {
    width: w,
    height: Math.max(cursorY, smallLine + 2 * ROW_PAD),
    labelWidth,
    icon,
    bigSide,
    rows: laid,
  };
}

/** 그림 상자의 가운데. */
export function itemCenter(item: PictoItem): Point {
  return { x: item.x + item.side / 2, y: item.y + item.side / 2 };
}

export interface PictoHit {
  readonly cat: string;
  readonly kind: PictoKind;
  readonly index: number;
}

/** 점이 놓인 그림(누르는 자리 = 그림 + 간격의 절반). 없으면 null. */
export function iconAt(layout: PictoLayout, point: Point): PictoHit | null {
  const half = ICON_GAP / 2;
  for (const row of layout.rows) {
    for (const item of row.items) {
      if (
        point.x >= item.x - half &&
        point.x <= item.x + item.side + half &&
        point.y >= item.y - half &&
        point.y <= item.y + item.side + half
      ) {
        return { cat: row.cat, kind: item.kind, index: item.index };
      }
    }
  }
  return null;
}

export type LassoOutcome =
  | { readonly type: 'compress'; readonly cat: string }
  | { readonly type: 'miss'; readonly reason: 'empty' | 'rows' | 'count' };

/**
 * 올가미로 작은 그림을 묶는 판정. 올가미 안의 작은 그림이 한 행에서 정확히 `legendBig`개일 때만 묶는다.
 * 큰 그림은 세지 않는다. 개수가 다르거나 두 행에 걸치면 아무 일도 하지 않는다.
 */
export function lassoOutcome(
  layout: PictoLayout,
  polygon: readonly Point[],
  legendBig: number,
): LassoOutcome {
  const smalls = layout.rows.flatMap((row) =>
    row.items.filter((item) => item.kind === 'small').map((item) => ({ cat: row.cat, item })),
  );
  const inside = selectInside(polygon, smalls, ({ item }) => itemCenter(item));
  if (inside.length === 0) return { type: 'miss', reason: 'empty' };
  const cats = [...new Set(inside.map(({ cat }) => cat))];
  const first = cats[0];
  if (cats.length > 1 || first === undefined) return { type: 'miss', reason: 'rows' };
  if (inside.length !== legendBig) return { type: 'miss', reason: 'count' };
  return { type: 'compress', cat: first };
}
