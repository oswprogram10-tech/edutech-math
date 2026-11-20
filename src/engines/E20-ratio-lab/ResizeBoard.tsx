/**
 * E20 resize 판 그림(논리 1000×600 SVG). 왼쪽: 칸 격자 위의 사진, 오른쪽: 담은 크기 목록(그림) 또는 표.
 * 사진은 가로 w/w0, 세로 h/h0로 늘려 그리므로 비율이 다르면 모양이 찌그러져 보인다(색이 아니라 모양).
 * 처음 모양과 같은지는 "같아요/달라요" 글과 data-distorted로도 알린다.
 */
import type { CSSProperties } from 'react';
import { PANEL, PIC, pictureRect } from './layout';
import { sameShape } from './observe';
import { Picture } from './Picture';
import { E20_STRINGS as S } from './strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type { ResizeState, Size } from './types';

const INK = '#1d2330';

function Grid({ size }: { size: Size }) {
  const rect = pictureRect(size);
  const lines = [];
  for (let i = 1; i < size.w; i += 1) {
    lines.push(
      <line
        key={`v${i}`}
        x1={rect.x + i * rect.cell}
        y1={rect.y}
        x2={rect.x + i * rect.cell}
        y2={rect.y + rect.h}
      />,
    );
  }
  for (let j = 1; j < size.h; j += 1) {
    lines.push(
      <line
        key={`h${j}`}
        x1={rect.x}
        y1={rect.y + j * rect.cell}
        x2={rect.x + rect.w}
        y2={rect.y + j * rect.cell}
      />,
    );
  }
  return (
    <g stroke="#7d8aa3" strokeOpacity={0.55} strokeWidth={1} data-part="grid">
      {lines}
    </g>
  );
}

function SavedList({ state }: { state: ResizeState }) {
  return (
    <g data-part="saved-list">
      <text x={PANEL.x} y={PANEL.y + 22} fontSize={24} fontWeight={800} fill={INK}>
        {S.resize.savedTitle}
      </text>
      {state.saved.length === 0 ? (
        <text x={PANEL.x} y={PANEL.itemTop + 28} fontSize={20} fill="#5b6577">
          {S.resize.savedEmpty}
        </text>
      ) : null}
      {state.saved.map((size, i) => {
        const y = PANEL.itemTop + i * PANEL.itemH;
        const k = Math.min(72 / size.w, 44 / size.h);
        return (
          <g key={`${size.w}x${size.h}`} data-saved={`${size.w}x${size.h}`}>
            <Picture x={PANEL.x} y={y} width={size.w * k} height={size.h * k} base={state.base} />
            <text x={PANEL.x + 90} y={y + 28} fontSize={20} fontWeight={700} fill={INK}>
              {S.resize.sizeText(size.w, size.h)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function SizeTable({ state }: { state: ResizeState }) {
  const rows: { label: string; size: Size }[] = [
    { label: S.resize.tableBase, size: state.base },
    { label: S.resize.tableNow, size: state.size },
    ...state.saved.map((size, i) => ({ label: String(i + 1), size })),
  ];
  const rowH = 38;
  const top = PANEL.y + 40;
  const cols = { name: PANEL.x, w: PANEL.x + 90, h: PANEL.x + 185 };
  return (
    <g data-part="size-table">
      <text x={PANEL.x} y={PANEL.y + 22} fontSize={24} fontWeight={800} fill={INK}>
        {S.resize.tableTitle}
      </text>
      <rect
        x={PANEL.x}
        y={top}
        width={PANEL.w - 10}
        height={rowH * (rows.length + 1)}
        fill="#ffffff"
        stroke={INK}
        strokeWidth={2}
      />
      <text x={cols.w} y={top + 26} fontSize={20} fontWeight={800} fill={INK}>
        {S.resize.tableWidth}
      </text>
      <text x={cols.h} y={top + 26} fontSize={20} fontWeight={800} fill={INK}>
        {S.resize.tableHeight}
      </text>
      {rows.map((row, i) => {
        const y = top + rowH * (i + 1);
        return (
          <g key={`${row.label}-${i}`} data-row={row.label}>
            <line
              x1={PANEL.x}
              y1={y}
              x2={PANEL.x + PANEL.w - 10}
              y2={y}
              stroke="#8b96ab"
              strokeWidth={1.5}
            />
            <text x={cols.name + 8} y={y + 26} fontSize={20} fontWeight={700} fill="#3d485c">
              {row.label}
            </text>
            <text x={cols.w} y={y + 26} fontSize={22} fontWeight={800} fill={INK}>
              {row.size.w}
            </text>
            <text x={cols.h} y={y + 26} fontSize={22} fontWeight={800} fill={INK}>
              {row.size.h}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export interface ResizeBoardProps {
  readonly state: ResizeState;
  readonly svgStyle?: CSSProperties;
  readonly className?: string;
}

export function ResizeBoard({ state, svgStyle, className }: ResizeBoardProps) {
  const { size, base } = state;
  const rect = pictureRect(size);
  const distorted = !sameShape(size, base);
  return (
    <svg
      className={className}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      style={svgStyle}
      role="group"
      aria-label={S.canvasLabel}
      data-testid="ratio-canvas"
      data-mode="resize"
      data-look={state.settings.look}
      data-size={`${size.w}x${size.h}`}
      data-distorted={distorted ? 'true' : 'false'}
    >
      <rect x={0} y={0} width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="#ffffff" />
      <Picture x={rect.x} y={rect.y} width={rect.w} height={rect.h} base={base} />
      <Grid size={size} />
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        fill="none"
        stroke={INK}
        strokeWidth={3}
      />
      <text
        x={rect.x + rect.w / 2}
        y={rect.y + rect.h + 30}
        textAnchor="middle"
        fontSize={22}
        fontWeight={800}
        fill={INK}
        data-part="width-label"
      >
        {S.resize.width(size.w)}
      </text>
      <text
        x={PIC.x0 - 30}
        y={rect.y + rect.h / 2}
        textAnchor="middle"
        fontSize={22}
        fontWeight={800}
        fill={INK}
        transform={`rotate(-90 ${PIC.x0 - 30} ${rect.y + rect.h / 2})`}
        data-part="height-label"
      >
        {S.resize.height(size.h)}
      </text>
      {state.settings.look === 'table' ? <SizeTable state={state} /> : <SavedList state={state} />}
    </svg>
  );
}
