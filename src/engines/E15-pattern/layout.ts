/**
 * E15 sequence 트랙의 논리 좌표(화면 좌표라 number). 화면(SequenceView)과 오버레이가 같이 쓴다.
 * 판은 viewBox 900 × (최소 440)이다. 칸이 많으면 줄을 바꾸고 높이만 늘린다.
 */
import { colOf, drawnCells, rowOf } from './chart';
import type { ChartSettings, SequenceSettings } from './types';

export const TRACK_WIDTH = 900;
export const TRACK_MIN_HEIGHT = 440;
/** 칸 한 변. 저학년 64px 터치 대상도 크롬북·아이패드 판에서 넘도록 크게 잡는다(E2E로 잼). */
export const CELL = 100;
export const GAP = 12;
const PITCH = CELL + GAP;
const EXTEND_PER_ROW = 8;
const TRANSLATE_PER_ROW = 6;
/** 칸 아래 ▲ 표시를 위한 여백. */
const MARK = 26;
const ROW_GAP = 44;
const CHUNK_GAP = 24;
const LABEL_X = 10;
/** 줄 이름 글자 크기(논리). 칸이 targetSize 이상으로 그려지므로 화면에서 14px 이상이 된다. */
export const LABEL_FONT = 30;
/** translate 위쪽에 비워 두는 띠. 힌트 mapping-card가 여기에 짝 카드를 그린다. */
const TRANSLATE_BAND = 64;
const TRANSLATE_LEFT = 200;

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export interface RowLabel {
  readonly kind: 'source' | 'target' | 'restored';
  readonly x: number;
  readonly y: number;
}

export interface TrackLayout {
  readonly width: number;
  readonly height: number;
  readonly given: readonly Box[];
  readonly slots: readonly Box[];
  /** translate에서 '보내기' 뒤에 그리는 셋째 줄(보내지 않았으면 빈 배열). */
  readonly restored: readonly Box[];
  readonly labels: readonly RowLabel[];
  /** extend에서 한 줄에 놓는 칸 수. */
  readonly perRow: number;
}

function centerX(count: number): number {
  return (TRACK_WIDTH - (count * PITCH - GAP)) / 2;
}

export function trackLayout(settings: SequenceSettings, sent: boolean): TrackLayout {
  if (settings.variant === 'translate') return translateLayout(settings, sent);
  const givenCount = settings.given.length;
  const total = givenCount + settings.blanks;
  const rows = Math.ceil(total / EXTEND_PER_ROW);
  const rowHeight = CELL + MARK;
  const height = Math.max(TRACK_MIN_HEIGHT, rows * rowHeight + (rows - 1) * 16 + 80);
  const top = (height - (rows * rowHeight + (rows - 1) * 16)) / 2;
  const given: Box[] = [];
  const slots: Box[] = [];
  for (let t = 0; t < total; t += 1) {
    const row = Math.floor(t / EXTEND_PER_ROW);
    const inRow = Math.min(EXTEND_PER_ROW, total - row * EXTEND_PER_ROW);
    const col = t - row * EXTEND_PER_ROW;
    const box: Box = {
      x: centerX(inRow) + col * PITCH,
      y: top + row * (rowHeight + 16),
      size: CELL,
    };
    if (t < givenCount) given.push(box);
    else slots.push(box);
  }
  return {
    width: TRACK_WIDTH,
    height,
    given,
    slots,
    restored: [],
    labels: [],
    perRow: EXTEND_PER_ROW,
  };
}

function translateLayout(settings: SequenceSettings, sent: boolean): TrackLayout {
  const total = settings.given.length;
  const chunks = Math.ceil(total / TRANSLATE_PER_ROW);
  // 셋째 줄(되돌린 무늬) 자리는 '보내기' 뒤에만 잡아 묶음 사이에 빈 공간이 남지 않게 한다.
  const rowsPerChunk = sent ? 3 : 2;
  const blockHeight = rowsPerChunk * CELL + (rowsPerChunk - 1) * ROW_GAP + MARK;
  const content = chunks * blockHeight + (chunks - 1) * CHUNK_GAP;
  const height = Math.max(TRACK_MIN_HEIGHT, content + TRANSLATE_BAND + 40);
  const top = TRANSLATE_BAND + (height - TRANSLATE_BAND - content) / 2;
  const given: Box[] = [];
  const slots: Box[] = [];
  const restored: Box[] = [];
  const labels: RowLabel[] = [];
  for (let chunk = 0; chunk < chunks; chunk += 1) {
    const y0 = top + chunk * (blockHeight + CHUNK_GAP);
    const start = chunk * TRANSLATE_PER_ROW;
    const count = Math.min(TRANSLATE_PER_ROW, total - start);
    labels.push({ kind: 'source', x: LABEL_X, y: y0 + CELL / 2 });
    labels.push({ kind: 'target', x: LABEL_X, y: y0 + CELL + ROW_GAP + CELL / 2 });
    if (sent) {
      labels.push({ kind: 'restored', x: LABEL_X, y: y0 + 2 * (CELL + ROW_GAP) + CELL / 2 });
    }
    for (let col = 0; col < count; col += 1) {
      const x = TRANSLATE_LEFT + col * PITCH;
      given.push({ x, y: y0, size: CELL });
      slots.push({ x, y: y0 + CELL + ROW_GAP, size: CELL });
      if (sent) restored.push({ x, y: y0 + 2 * (CELL + ROW_GAP), size: CELL });
    }
  }
  return {
    width: TRACK_WIDTH,
    height,
    given,
    slots,
    restored,
    labels,
    perRow: TRANSLATE_PER_ROW,
  };
}

// ─────────────────────────────────────────────────────────────
// hundred-chart
// ─────────────────────────────────────────────────────────────

export const CHART_CELL = 60;
export const CHART_PAD = 6;

export interface ChartLayout {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly number[];
  /** 칸 번호 → 위치. 그리는 칸만 있다. */
  readonly boxes: ReadonlyMap<number, Box>;
}

/** 그리는 칸의 바깥 상자를 viewBox로 삼는다(cross-only·row·column은 그 부분만 크게 보인다). */
export function chartLayout(settings: ChartSettings): ChartLayout {
  const range = { from: settings.from, count: settings.count };
  const cells = drawnCells(range, settings.view, settings.center, settings.focus);
  let minCol = Number.POSITIVE_INFINITY;
  let maxCol = Number.NEGATIVE_INFINITY;
  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  for (const cell of cells) {
    const col = colOf(range, cell);
    const row = rowOf(range, cell);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
  }
  if (cells.length === 0) {
    minCol = 0;
    maxCol = 0;
    minRow = 0;
    maxRow = 0;
  }
  const boxes = new Map<number, Box>();
  for (const cell of cells) {
    boxes.set(cell, {
      x: CHART_PAD + (colOf(range, cell) - minCol) * CHART_CELL,
      y: CHART_PAD + (rowOf(range, cell) - minRow) * CHART_CELL,
      size: CHART_CELL,
    });
  }
  return {
    width: (maxCol - minCol + 1) * CHART_CELL + CHART_PAD * 2,
    height: (maxRow - minRow + 1) * CHART_CELL + CHART_PAD * 2,
    cells,
    boxes,
  };
}
