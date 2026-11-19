/**
 * E15 calc-pattern 보기 판의 논리 좌표(화면 좌표라 number). 화면(CalcView)과 오버레이가 같이 쓴다.
 *
 * symmetric: 한 줄이 한 단계다. 블록 열 위에 높이를 쓸 자리(NUM_SPACE), 열 아래에 식을 둔다.
 * 식의 k번째 수는 k번째 열 바로 아래에 놓아 열과 수가 위아래로 1:1로 보인다.
 * repunit: 블록 그림 없이 식 한 줄이다.
 * 판 맨 아래에 step-table 오버레이가 쓸 띠(BAND)를 비워 둔다(symmetric만).
 */
import { REPUNIT, SYMMETRIC, stepColumns, stepTerms, stepTotal } from './calc';
import type { CalcSettings } from './types';

/** 블록 한 칸. 판이 최소 크기로 줄어도 화면에서 24px 이상이 되도록 논리 28을 쓴다. */
export const BLOCK = 28;
export const LABEL_W = 70;
export const NUM_SPACE = 20;
export const EXPR_H = 30;
export const ROW_GAP = 10;
export const TOP_PAD = 6;
export const SIDE_PAD = 12;
/** step-table 표 한 줄 높이(표는 두 줄). */
export const TABLE_ROW_H = 26;
export const FONT = 24;
export const OP_FONT = 20;
/** 등폭 글꼴에서 숫자 한 자의 폭(논리). */
export const DIGIT_W = 15;
export const TABLE_LABEL_W = 96;
export const TABLE_CELL_W = 44;

export interface ColBox {
  readonly col: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface TermBox {
  readonly index: number;
  readonly text: string;
  /** 가운데 x, 가운데 y. */
  readonly cx: number;
  readonly cy: number;
  /** 눌리는 칸 폭(최소 BLOCK). */
  readonly w: number;
}

export interface OpMark {
  readonly text: string;
  readonly cx: number;
  readonly cy: number;
}

export interface CalcRow {
  readonly step: number;
  readonly top: number;
  readonly bottom: number;
  readonly cols: readonly ColBox[];
  readonly terms: readonly TermBox[];
  readonly ops: readonly OpMark[];
  /** 식의 나머지(`= n × n`, `= 121`). */
  readonly tail: { readonly x: number; readonly cy: number; readonly text: string };
  readonly exprY: number;
  readonly label: { readonly x: number; readonly y: number; readonly step: number };
}

export interface CalcLayout {
  readonly width: number;
  readonly height: number;
  readonly rows: readonly CalcRow[];
  readonly drawBlocks: boolean;
  /** step-table 띠(없으면 null). */
  readonly band: { readonly x: number; readonly y: number; readonly width: number } | null;
}

function symmetricRow(settings: CalcSettings, step: number, top: number, maxCols: number): CalcRow {
  const drawBlocks = settings.look !== 'none';
  const heights = stepColumns(step);
  const cols = heights.length;
  const left = drawBlocks ? LABEL_W + ((maxCols - cols) * BLOCK) / 2 : LABEL_W;
  const blocksTop = top + NUM_SPACE;
  const blocksBottom = blocksTop + step * BLOCK;
  const exprY = drawBlocks ? blocksBottom + 4 + EXPR_H / 2 : top + EXPR_H / 2;
  const bottom = drawBlocks ? blocksBottom + 4 + EXPR_H : top + EXPR_H;
  const colBoxes: ColBox[] = drawBlocks
    ? heights.map((height, col) => ({
        col,
        height,
        x: left + col * BLOCK,
        y: blocksBottom - height * BLOCK,
        w: BLOCK,
        h: height * BLOCK,
      }))
    : [];
  const terms: TermBox[] = heights.map((height, index) => ({
    index,
    text: String(height),
    cx: left + index * BLOCK + BLOCK / 2,
    cy: exprY,
    w: BLOCK,
  }));
  const ops: OpMark[] = heights.slice(1).map((_, index) => ({
    text: '+',
    cx: left + (index + 1) * BLOCK,
    cy: exprY,
  }));
  return {
    step,
    top,
    bottom,
    cols: colBoxes,
    terms,
    ops,
    tail: {
      x: left + cols * BLOCK + 8,
      cy: exprY,
      text: `= ${step} × ${step}`,
    },
    exprY,
    label: { x: 8, y: exprY, step },
  };
}

function repunitRow(step: number, top: number): CalcRow {
  const [factor] = stepTerms(REPUNIT, step) as [string, string];
  const product = stepTotal(REPUNIT, step).toString();
  const cy = top + EXPR_H / 2;
  const opW = 2 * DIGIT_W;
  const fw = factor.length * DIGIT_W;
  const pw = product.length * DIGIT_W;
  let x = LABEL_W;
  const terms: TermBox[] = [];
  const ops: OpMark[] = [];
  terms.push({ index: 0, text: factor, cx: x + fw / 2, cy, w: Math.max(BLOCK, fw) });
  x += fw;
  ops.push({ text: '×', cx: x + opW / 2, cy });
  x += opW;
  terms.push({ index: 1, text: factor, cx: x + fw / 2, cy, w: Math.max(BLOCK, fw) });
  x += fw;
  ops.push({ text: '=', cx: x + opW / 2, cy });
  x += opW;
  terms.push({ index: 2, text: product, cx: x + pw / 2, cy, w: Math.max(BLOCK, pw) });
  x += pw;
  return {
    step,
    top,
    bottom: top + EXPR_H,
    cols: [],
    terms,
    ops,
    tail: { x, cy, text: '' },
    exprY: cy,
    label: { x: 8, y: cy, step },
  };
}

export function calcLayout(settings: CalcSettings): CalcLayout {
  const symmetric = settings.pattern === SYMMETRIC;
  const maxCols = 2 * settings.stepsShown - 1;
  const rows: CalcRow[] = [];
  let top = TOP_PAD;
  let right = 0;
  for (let step = 1; step <= settings.stepsShown; step += 1) {
    const row = symmetric ? symmetricRow(settings, step, top, maxCols) : repunitRow(step, top);
    rows.push(row);
    const tailW = row.tail.text.length * DIGIT_W;
    const lastTerm = row.terms[row.terms.length - 1];
    right = Math.max(
      right,
      symmetric ? row.tail.x + tailW : (lastTerm?.cx ?? 0) + (lastTerm?.w ?? 0) / 2,
    );
    top = row.bottom + ROW_GAP;
  }
  const rowsBottom = (rows[rows.length - 1]?.bottom ?? TOP_PAD) + 0;
  const tableW = TABLE_LABEL_W + settings.stepsShown * TABLE_CELL_W;
  const drawBlocks = symmetric && settings.look !== 'none';
  const width = Math.max(right + SIDE_PAD, symmetric ? tableW + 2 * SIDE_PAD : 0);
  const band = symmetric ? { x: SIDE_PAD, y: rowsBottom + 8, width: width - 2 * SIDE_PAD } : null;
  const height = band === null ? rowsBottom + TOP_PAD : band.y + TABLE_ROW_H * 2 + TOP_PAD;
  return { width, height, rows, drawBlocks, band };
}
