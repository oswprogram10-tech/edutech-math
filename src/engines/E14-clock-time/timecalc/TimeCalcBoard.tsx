/**
 * E14 time-calc 판(논리 1000 × `boardHeight` SVG). 왼쪽 큰 단위 칸(큰 블록 하나가 1), 오른쪽 작은 단위 칸
 * (10개 막대 + 낱개 칸). 막대 6개가 큰 블록 하나와 같은 크기라 60칸 묶음이 눈에 보인다.
 * sub에서는 위에 "뺄 시간" 표를 둔다(문제 그대로라 글로 써도 된다). 지금 값은 글로 쓰지 않는다.
 * 묶기를 누르면 처음 60칸 둘레에 올가미(점선 테두리)가 400ms 동안 그려진다.
 */
import type { CSSProperties, RefObject } from 'react';
import { E14_MODE_STRINGS } from '../strings-modes.ko';
import styles from '../View.module.css';
import {
  BIG,
  BOARD_WIDTH,
  GROUP_W,
  ROD,
  SMALL,
  TABLE,
  bigAt,
  boardHeight,
  geoOf,
  groupAt,
  singleAt,
} from './layout';
import { splitSmall } from './settings';
import type { TimeCalcState } from './types';

const S = E14_MODE_STRINGS.timeCalc;
const INK = '#1d2330';
const BIG_FILL = '#ffe9a8';
const BIG_STROKE = '#9a6b00';
const SMALL_FILL = '#d4f0d0';
const SMALL_STROKE = '#2a7a2a';

interface Props {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly state: TimeCalcState;
  /** 묶기 올가미를 그리는 중인가. */
  readonly lasso: boolean;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

export function TimeCalcBoard({ svgRef, state, lasso, svgStyle, className }: Props) {
  const geo = geoOf(state);
  const names = S.units[state.units];
  const { rods, singles } = splitSmall(state.small);
  const groups = Math.ceil(rods / ROD.perGroup);
  return (
    <svg
      ref={svgRef}
      className={`${className ?? ''} ${styles.flatBoard ?? ''}`}
      style={{ ...svgStyle, touchAction: 'none' }}
      viewBox={`0 0 ${BOARD_WIDTH} ${boardHeight(state)}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="timecalc-canvas"
      role="group"
      aria-label={S.boardLabel}
    >
      {state.op === 'sub' && geo.tableTop !== null ? (
        <g data-part="subtrahend">
          <rect
            x={TABLE.x}
            y={geo.tableTop}
            width={TABLE.width}
            height={TABLE.height}
            rx={10}
            fill="#fffdf6"
            stroke={INK}
            strokeWidth={3}
          />
          <text
            x={TABLE.x + TABLE.width / 2}
            y={geo.tableTop + TABLE.height / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={26}
            fontWeight={800}
            fill={INK}
          >
            {S.subtrahend(state.bText)}
          </text>
        </g>
      ) : null}

      <line
        x1={(BIG.left + 3 * (BIG.w + BIG.gap) + SMALL.left) / 2 - 20}
        y1={geo.titleY - 16}
        x2={(BIG.left + 3 * (BIG.w + BIG.gap) + SMALL.left) / 2 - 20}
        y2={boardHeight(state) - 24}
        stroke="#c7cfdd"
        strokeWidth={3}
        strokeDasharray="8 8"
      />

      <g data-part="big-row" role="img" aria-label={names.bigTitle}>
        <text
          x={BIG.left}
          y={geo.titleY}
          dominantBaseline="central"
          fontSize={24}
          fontWeight={800}
          fill={INK}
        >
          {names.bigTitle}
        </text>
        {Array.from({ length: state.big }, (_, i) => {
          const at = bigAt(geo, i);
          return (
            <g key={i} data-part="big-block">
              <rect
                x={at.x}
                y={at.y}
                width={BIG.w}
                height={BIG.h}
                rx={8}
                fill={BIG_FILL}
                stroke={BIG_STROKE}
                strokeWidth={3}
              />
              <text
                x={at.x + BIG.w / 2}
                y={at.y + BIG.h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={24}
                fontWeight={800}
                fill={INK}
              >
                {names.bigCell}
              </text>
            </g>
          );
        })}
      </g>

      <g data-part="small-row" role="img" aria-label={names.smallTitle}>
        <text
          x={SMALL.left}
          y={geo.titleY}
          dominantBaseline="central"
          fontSize={24}
          fontWeight={800}
          fill={INK}
        >
          {names.smallTitle}
        </text>
        {Array.from({ length: groups }, (_, group) => {
          const at = groupAt(geo, group);
          const count = Math.min(ROD.perGroup, rods - group * ROD.perGroup);
          return (
            <g key={group} data-part="rod-group">
              {Array.from({ length: count }, (_, k) => (
                <g key={k} data-part="rod">
                  <rect
                    x={at.x + k * ROD.w}
                    y={at.y}
                    width={ROD.w}
                    height={ROD.h}
                    fill={SMALL_FILL}
                    stroke={SMALL_STROKE}
                    strokeWidth={1.5}
                  />
                  {/* 막대 안의 10칸 눈금 */}
                  {Array.from({ length: 9 }, (_, line) => (
                    <line
                      key={line}
                      x1={at.x + k * ROD.w}
                      y1={at.y + ((line + 1) * ROD.h) / 10}
                      x2={at.x + (k + 1) * ROD.w}
                      y2={at.y + ((line + 1) * ROD.h) / 10}
                      stroke={SMALL_STROKE}
                      strokeWidth={1}
                      strokeOpacity={0.55}
                    />
                  ))}
                </g>
              ))}
            </g>
          );
        })}
        {Array.from({ length: singles }, (_, i) => {
          const at = singleAt(geo, i);
          return (
            <rect
              key={i}
              data-part="single"
              x={at.x}
              y={at.y}
              width={SMALL.single}
              height={SMALL.single}
              rx={3}
              fill={SMALL_FILL}
              stroke={SMALL_STROKE}
              strokeWidth={2.5}
            />
          );
        })}
      </g>

      {lasso ? (
        <rect
          data-part="lasso"
          className={styles.lasso}
          x={groupAt(geo, 0).x - 8}
          y={groupAt(geo, 0).y - 8}
          width={GROUP_W + 16}
          height={ROD.h + 16}
          rx={14}
          fill="rgba(47,111,222,0.08)"
          stroke="#2f6fde"
          strokeWidth={6}
          strokeDasharray="14 8"
        />
      ) : null}
    </svg>
  );
}
