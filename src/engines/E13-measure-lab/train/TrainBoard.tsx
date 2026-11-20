/**
 * E13 unit-train 판(논리 1000×600 SVG). 두 줄짜리 기차: m 칸 줄(1m 칸)과 cm 칸 줄(10cm 막대 + 1cm 블록).
 * 10cm 막대 열 개는 1m 칸과 같은 크기의 정사각형 안에 세로 띠로 모여 있다.
 * sub에서는 위에 "뺄 길이" 표를 둔다(문제 그대로라 글로 써도 된다).
 */
import type { CSSProperties, RefObject } from 'react';
import { E13_STRINGS as S } from '../strings.ko';
import {
  BOARD,
  boardHeight,
  LEFT,
  M_TOP,
  SUBTRAHEND,
  blockAt,
  geoOf,
  groupAt,
  mCellAt,
  rodWidth,
} from './layout';
import type { TrainState } from './types';

const INK = '#1d2330';
const TAPE_FILL = '#ffe9a8';
const TAPE_STROKE = '#9a6b00';
const ROD_FILL = '#d4f0d0';
const ROD_STROKE = '#2a7a2a';

interface Props {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly state: TrainState;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

export function TrainBoard({ svgRef, state, svgStyle, className }: Props) {
  const geo = geoOf(state);
  const rodW = rodWidth(geo);
  const groups = Array.from({ length: geo.groups }, (_, group) => {
    const count = Math.min(10, state.rods - group * 10);
    return { group, count };
  });
  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ ...svgStyle, touchAction: 'none' }}
      viewBox={`0 0 ${BOARD.width} ${boardHeight(state)}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="train-canvas"
      role="group"
      aria-label={S.train.boardLabel}
    >
      {state.op === 'sub' ? (
        <g data-part="subtrahend">
          <rect
            x={SUBTRAHEND.x}
            y={SUBTRAHEND.y}
            width={330}
            height={SUBTRAHEND.height}
            rx={10}
            fill="#fffdf6"
            stroke={INK}
            strokeWidth={3}
          />
          <text
            x={SUBTRAHEND.x + 165}
            y={SUBTRAHEND.y + SUBTRAHEND.height / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={26}
            fontWeight={800}
            fill={INK}
          >
            {S.train.subtrahend(state.bText)}
          </text>
        </g>
      ) : null}

      <g data-part="m-row" role="img" aria-label={S.train.rowMLabel(state.m)}>
        <text
          x={LEFT - 14}
          y={M_TOP + geo.cell / 2}
          textAnchor="end"
          dominantBaseline="central"
          fontSize={24}
          fontWeight={800}
          fill={INK}
        >
          {S.train.rowM}
        </text>
        {Array.from({ length: state.m }, (_, i) => {
          const at = mCellAt(geo, i);
          return (
            <g key={i} data-part="m-cell">
              <rect
                x={at.x}
                y={at.y}
                width={geo.cell}
                height={geo.cell}
                rx={6}
                fill={TAPE_FILL}
                stroke={TAPE_STROKE}
                strokeWidth={3}
              />
              {geo.big ? (
                <text
                  x={at.x + geo.cell / 2}
                  y={at.y + geo.cell / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={24}
                  fontWeight={800}
                  fill={INK}
                >
                  {S.train.meterCell}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>

      <g data-part="cm-row" role="img" aria-label={S.train.rowCmLabel(state.rods, state.blocks)}>
        <text
          x={LEFT - 14}
          y={geo.cmTop + geo.cell / 2}
          textAnchor="end"
          dominantBaseline="central"
          fontSize={24}
          fontWeight={800}
          fill={INK}
        >
          {S.train.rowCm}
        </text>
        {groups.map(({ group, count }) => {
          const at = groupAt(geo, group);
          return (
            <g key={group} data-part="rod-group">
              {Array.from({ length: count }, (_, k) => (
                <rect
                  key={k}
                  data-part="rod"
                  x={at.x + k * rodW}
                  y={at.y}
                  width={rodW}
                  height={geo.cell}
                  fill={ROD_FILL}
                  stroke={ROD_STROKE}
                  strokeWidth={geo.big ? 1.5 : 1}
                />
              ))}
            </g>
          );
        })}
        {Array.from({ length: state.blocks }, (_, i) => {
          const at = blockAt(geo, i);
          return (
            <rect
              key={i}
              data-part="block"
              x={at.x}
              y={at.y}
              width={geo.block}
              height={geo.block}
              rx={3}
              fill={ROD_FILL}
              stroke={ROD_STROKE}
              strokeWidth={2.5}
            />
          );
        })}
      </g>
    </svg>
  );
}
