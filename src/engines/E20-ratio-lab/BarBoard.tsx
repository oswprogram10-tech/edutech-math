/**
 * E20 bar-model 막대 그림(논리 1000×600 SVG). 위에 전체 막대와 괄호, 아래에 사람마다 한 줄.
 * 모든 줄이 같은 칸 크기이고 비의 항만큼 칸이 있다. 칸 안에는 학생이 쓴 한 칸 크기, 줄 끝에는 학생이 쓴 몫이 나온다.
 * 정답은 이 그림 어디에도 쓰지 않는다. 전체 글은 알려진 전체이면 그 수, 아니면 "?"다.
 * 형광펜 단계가 있으면 목표를 맞히기 전에는 막대를 흐리게 둔다. symbols look에서는 막대를 숨긴다.
 */
import type { CSSProperties } from 'react';
import { barLayout, BAR_W, BAR_X, ROW_H } from './barLayout';
import { barOpen } from './bar';
import { E20_STRINGS as S } from './strings.ko';
import { BAR_LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type { BarState } from './types';

/** 흐린 막대 위에 얹는 안내 상자의 위쪽 y(논리 좌표). */
const NOTICE_Y = 200;
const INK = '#1d2330';
const CELL = '#e8f0ff';
const TOTAL = '#fff3d6';

export interface BarBoardProps {
  readonly state: BarState;
  readonly svgStyle?: CSSProperties;
  readonly className?: string;
}

function fit(text: string, width: number, max: number): number {
  return Math.min(max, (width - 8) / Math.max(1, text.length * 0.62));
}

export function BarBoard({ state, svgStyle, className }: BarBoardProps) {
  const { settings } = state;
  const layout = barLayout(settings);
  const open = barOpen(state);
  const symbols = settings.look === 'symbols';
  const totalText = settings.total === null ? S.bar.unknown : String(settings.total);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${BAR_LOGICAL_HEIGHT}`}
      style={svgStyle}
      role="group"
      aria-label={symbols ? S.bar.symbolsLabel : S.bar.boardLabel}
      data-testid="ratio-canvas"
      data-mode="bar-model"
      data-look={settings.look}
      data-open={open ? 'true' : 'false'}
    >
      <rect x={0} y={0} width={LOGICAL_WIDTH} height={BAR_LOGICAL_HEIGHT} fill="#ffffff" />
      <g opacity={open ? 1 : 0.28} data-part="bars" data-dim={open ? 'false' : 'true'}>
        <text
          x={BAR_X - 16}
          y={layout.total.y + layout.total.h / 2 + 11}
          textAnchor="end"
          fontSize={32}
          fontWeight={800}
          fill={INK}
          data-part="total-label"
        >
          {S.bar.totalWord} {totalText}
        </text>
        {symbols ? (
          <>
            <rect
              x={layout.total.x}
              y={layout.total.y}
              width={BAR_W}
              height={layout.total.h}
              rx={10}
              fill={TOTAL}
              stroke={INK}
              strokeWidth={2.5}
              data-part="expr-box"
            />
            {state.expr === null ? null : (
              <text
                x={layout.total.x + 16}
                y={layout.total.y + layout.total.h / 2 + 11}
                fontSize={fit(state.expr, BAR_W, 32)}
                fontWeight={800}
                fill={INK}
                data-part="expr-text"
              >
                {state.expr}
              </text>
            )}
          </>
        ) : (
          <>
            <path
              d={`M ${layout.total.x} ${layout.total.y - 6} v -12 h ${layout.total.w} v 12`}
              fill="none"
              stroke={INK}
              strokeWidth={4}
              data-part="total-bracket"
            />
            {layout.totalCells.map((cell, i) => (
              <rect
                key={`t-${i}`}
                x={cell.x}
                y={cell.y}
                width={cell.w}
                height={cell.h}
                fill={TOTAL}
                stroke={INK}
                strokeWidth={2.5}
                data-part="total-cell"
              />
            ))}
          </>
        )}
        {layout.rows.map((row) => {
          const value = state.partValues[row.part] ?? null;
          return (
            <g key={row.part} data-row={row.part}>
              <text
                x={BAR_X - 16}
                y={row.y + ROW_H / 2 + 11}
                textAnchor="end"
                fontSize={32}
                fontWeight={800}
                fill={INK}
                data-part="row-name"
              >
                {row.name}
              </text>
              {symbols
                ? null
                : row.cells.map((cell, i) => (
                    <g key={i}>
                      <rect
                        x={cell.x}
                        y={cell.y}
                        width={cell.w}
                        height={cell.h}
                        fill={CELL}
                        stroke={INK}
                        strokeWidth={2.5}
                        data-part="cell"
                        data-row={row.part}
                      />
                      {state.unit === null ? null : (
                        <text
                          x={cell.x + cell.w / 2}
                          y={cell.y + cell.h / 2 + 11}
                          textAnchor="middle"
                          fontSize={fit(state.unit, cell.w, 34)}
                          fontWeight={800}
                          fill={INK}
                          data-part="unit-text"
                        >
                          {state.unit}
                        </text>
                      )}
                    </g>
                  ))}
              <text
                x={symbols ? BAR_X : row.end + 16}
                y={row.y + ROW_H / 2 + 11}
                fontSize={34}
                fontWeight={800}
                fill={INK}
                data-part="share-text"
                data-row={row.part}
              >
                {symbols ? '= ' : ''}
                {value ?? S.bar.unknown}
              </text>
            </g>
          );
        })}
      </g>
      {open ? null : (
        <g data-part="dim-notice" role="status">
          <rect
            x={150}
            y={NOTICE_Y}
            width={700}
            height={56}
            rx={14}
            fill="#ffffff"
            stroke={INK}
            strokeWidth={3}
          />
          <text
            x={500}
            y={NOTICE_Y + 38}
            textAnchor="middle"
            fontSize={30}
            fontWeight={800}
            fill={INK}
          >
            {S.bar.dimNotice}
          </text>
        </g>
      )}
    </svg>
  );
}
