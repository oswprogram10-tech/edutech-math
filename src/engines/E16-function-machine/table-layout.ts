/**
 * 대응표 SVG의 논리 좌표(화면 px와 1:1, 배율은 부모가 정한다). 표(RelationTable)와 오버레이가 같이 쓴다.
 *
 * 위에서 아래로: 윗띠(오버레이 문구) · ○ 줄 · □ 줄 · 차이 띠(오버레이 화살표) · 표시 띠(✓/✕) · 아랫띠(오버레이 사슬·설명).
 */
/** 열이 이보다 적어도 이만큼의 칸 자리를 그려 표 모양을 보인다. */
export const MIN_COLUMNS = 3;
const MIN_WIDTH = 360;

export interface TableLayout {
  readonly width: number;
  readonly height: number;
  readonly labelW: number;
  readonly cellW: number;
  readonly cellH: number;
  readonly topH: number;
  readonly arrowH: number;
  readonly markH: number;
  readonly footH: number;
  /** 그리는 칸 자리 수(열 수와 MIN_COLUMNS 중 큰 쪽). */
  readonly slots: number;
}

export function tableLayout(count: number, xLabel: string, yLabel: string): TableLayout {
  // 칸은 저학년 모드(64)에서도 되도록 늘 64px 이상으로 둔다(배율 ≥ 1이면 모든 설정을 만족한다).
  const cellW = 80;
  const cellH = 64;
  const longest = Math.max([...xLabel].length, [...yLabel].length);
  const labelW = Math.min(180, Math.max(72, longest * 17 + 20));
  const topH = 28;
  const arrowH = 30;
  const markH = 38;
  const footH = 60;
  const slots = Math.max(count, MIN_COLUMNS);
  return {
    width: Math.max(MIN_WIDTH, labelW + slots * cellW + 8),
    height: topH + 2 * cellH + arrowH + markH + footH,
    labelW,
    cellW,
    cellH,
    topH,
    arrowH,
    markH,
    footH,
    slots,
  };
}

export const colX = (layout: TableLayout, index: number): number =>
  layout.labelW + index * layout.cellW;
export const row0Top = (layout: TableLayout): number => layout.topH;
export const row1Top = (layout: TableLayout): number => layout.topH + layout.cellH;
export const arrowTop = (layout: TableLayout): number => layout.topH + 2 * layout.cellH;
export const markTop = (layout: TableLayout): number => arrowTop(layout) + layout.arrowH;
export const footTop = (layout: TableLayout): number => markTop(layout) + layout.markH;
