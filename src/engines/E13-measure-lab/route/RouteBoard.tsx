/**
 * E13 map-route 판(논리 1000×480 SVG). 위쪽은 가상 동네 지도(노드 그림과 이름, 길과 구간 길이 글),
 * 아래쪽은 목표 막대다. 막대는 경로 합만큼 칠해지고 목표 자리에 굵은 세로선과 이름표가 있다.
 * 경로 합계는 숫자로 쓰지 않는다(칠한 길이로만 보인다). 길은 눌러서 잇는다.
 */
import type { CSSProperties, RefObject } from 'react';
import { E13_STRINGS as S } from '../strings.ko';
import { MAPS, NODE_R } from './maps';
import { BOARD, GOAL_BAR, boardHeight, fillWidth, overflows, r2, targetX } from './layout';
import { totalOf } from './settings';
import type { RouteState } from './types';
import type { RouteUi } from './useRouteUi';

const INK = '#1d2330';
const ORANGE = '#e8872e';
const ROAD = '#8a94a6';
const BLUE = '#2f6fde';

interface Props {
  readonly svgRef: RefObject<SVGSVGElement>;
  readonly state: RouteState;
  readonly ui: RouteUi;
  readonly locked: boolean;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

/** 노드 그림(원 안, 중심 0,0). 이름 글은 따로 그린다. */
function NodeIcon({ id }: { id: string }) {
  const line = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const };
  switch (id) {
    case 'school':
      return (
        <g {...line} fill="#fff">
          <rect x={-14} y={-2} width={28} height={18} />
          <polygon points="-19,-2 0,-18 19,-2" fill="#ffd9a8" />
          <rect x={-4} y={5} width={8} height={11} fill="#cfe0ff" />
        </g>
      );
    case 'library':
      return (
        <g {...line} fill="#fff">
          <path d="M0,-12 C-8,-17 -16,-16 -20,-13 V13 C-16,10 -8,9 0,14 Z" fill="#cfe0ff" />
          <path d="M0,-12 C8,-17 16,-16 20,-13 V13 C16,10 8,9 0,14 Z" fill="#ffe3c2" />
        </g>
      );
    case 'park':
      return (
        <g {...line} fill="#fff">
          <rect x={-4} y={4} width={8} height={13} fill="#c9a36a" />
          <circle cx={0} cy={-5} r={14} fill="#b9e4b0" />
        </g>
      );
    case 'market':
      return (
        <g {...line} fill="#fff">
          <rect x={-16} y={0} width={32} height={16} />
          <path d="M-19,0 L-14,-14 H14 L19,0 Z" fill="#ffd9a8" />
          <line x1={-6} y1={-14} x2={-8} y2={0} />
          <line x1={6} y1={-14} x2={8} y2={0} />
        </g>
      );
    case 'station':
      return (
        <g {...line} fill="#fff">
          <rect x={-16} y={-14} width={32} height={24} rx={6} fill="#cfe0ff" />
          <rect x={-11} y={-9} width={9} height={8} />
          <rect x={2} y={-9} width={9} height={8} />
          <circle cx={-8} cy={15} r={4} fill={INK} />
          <circle cx={8} cy={15} r={4} fill={INK} />
        </g>
      );
    default:
      return (
        <g {...line} fill="#fff">
          <rect x={-18} y={-12} width={36} height={24} rx={3} fill="#ffe3c2" />
          <polyline points="-18,-12 0,2 18,-12" fill="none" />
        </g>
      );
  }
}

export function RouteBoard({ svgRef, state, ui, locked, svgStyle, className }: Props) {
  const nodes = MAPS[state.map]?.nodes ?? {};
  const names = S.route.nodeNames;
  const total = totalOf(state);
  const filled = fillWidth(total, state.targetM);
  const targetAt = targetX();
  const canStart = state.from === null && state.path.length === 0 && !locked;
  const start = state.path[0];
  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ ...svgStyle, touchAction: 'manipulation' }}
      viewBox={`0 0 ${BOARD.width} ${boardHeight()}`}
      preserveAspectRatio="xMidYMid meet"
      data-testid="route-canvas"
      role="group"
      aria-label={S.route.boardLabel}
    >
      <g data-part="roads">
        {state.segments.map((seg) => {
          const a = nodes[seg.a];
          const b = nodes[seg.b];
          if (a === undefined || b === undefined) return null;
          const used = state.used.includes(seg.key);
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy);
          // 구간 길이 글은 길 옆(위쪽)에 쓴다. 길과 겹치지 않게 법선 방향으로 띄운다.
          let nx = -dy / len;
          let ny = dx / len;
          if (ny > 0) {
            nx = -nx;
            ny = -ny;
          }
          const mx = (a.x + b.x) / 2 + nx * 24;
          const my = (a.y + b.y) / 2 + ny * 24;
          return (
            <g
              key={seg.key}
              data-part="road"
              data-used={used ? 'true' : 'false'}
              role="img"
              aria-label={S.route.roadLabel(names[seg.a] ?? seg.a, names[seg.b] ?? seg.b)}
            >
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={used ? ORANGE : ROAD}
                strokeWidth={used ? 12 : 7}
                strokeLinecap="round"
              />
              <line
                data-part="road-hit"
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="transparent"
                strokeWidth={64}
                strokeLinecap="round"
                style={{ pointerEvents: 'stroke', cursor: locked ? 'default' : 'pointer' }}
                onClick={() => ui.send({ type: 'add-segment', key: seg.key })}
              />
              <text
                x={r2(mx)}
                y={r2(my)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={24}
                fontWeight={800}
                fill={INK}
                stroke="#ffffff"
                strokeWidth={6}
                paintOrder="stroke"
                style={{ pointerEvents: 'none' }}
              >
                {S.route.segmentLength(seg.m)}
              </text>
            </g>
          );
        })}
      </g>
      <g data-part="nodes">
        {Object.entries(nodes).map(([id, at]) => {
          const used = state.segments.some((seg) => seg.a === id || seg.b === id);
          if (!used) return null;
          const onPath = state.path.includes(id);
          return (
            <g
              key={id}
              data-part="node"
              data-node={id}
              data-on-path={onPath ? 'true' : 'false'}
              transform={`translate(${at.x} ${at.y})`}
              onClick={canStart ? () => ui.send({ type: 'start', node: id }) : undefined}
              style={{ cursor: canStart ? 'pointer' : 'default' }}
            >
              <circle
                r={NODE_R}
                fill={onPath ? '#fff4e3' : '#ffffff'}
                stroke={onPath ? ORANGE : INK}
                strokeWidth={onPath ? 6 : 3}
              />
              <NodeIcon id={id} />
              <text
                y={at.nameAbove ? -NODE_R - 22 : NODE_R + 22}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={24}
                fontWeight={800}
                fill={INK}
                stroke="#ffffff"
                strokeWidth={5}
                paintOrder="stroke"
              >
                {names[id] ?? id}
              </text>
              {id === start ? (
                <text
                  y={at.nameAbove ? NODE_R + 16 : -NODE_R - 14}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={20}
                  fontWeight={800}
                  fill="#8a4b00"
                  stroke="#ffffff"
                  strokeWidth={5}
                  paintOrder="stroke"
                >
                  {S.route.startMark}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
      <g data-part="goal-bar" role="img" aria-label={S.route.goalBar}>
        <rect
          data-part="goal-track"
          x={GOAL_BAR.x}
          y={GOAL_BAR.top}
          width={GOAL_BAR.width}
          height={GOAL_BAR.height}
          rx={6}
          fill="#ffffff"
          stroke={INK}
          strokeWidth={3}
        />
        {filled > 0 ? (
          <rect
            data-part="goal-fill"
            x={GOAL_BAR.x}
            y={GOAL_BAR.top}
            width={r2(filled)}
            height={GOAL_BAR.height}
            rx={6}
            fill={BLUE}
            fillOpacity={0.75}
          />
        ) : null}
        {overflows(state, total) ? (
          <polygon
            points={`${GOAL_BAR.x + GOAL_BAR.width + 4},${GOAL_BAR.top - 4} ${GOAL_BAR.x + GOAL_BAR.width + 26},${GOAL_BAR.top + GOAL_BAR.height / 2} ${GOAL_BAR.x + GOAL_BAR.width + 4},${GOAL_BAR.top + GOAL_BAR.height + 4}`}
            fill={ORANGE}
          />
        ) : null}
        <line
          data-part="goal-mark"
          x1={r2(targetAt)}
          y1={GOAL_BAR.top - 12}
          x2={r2(targetAt)}
          y2={GOAL_BAR.top + GOAL_BAR.height + 12}
          stroke={INK}
          strokeWidth={8}
        />
        <text
          data-part="goal-label"
          x={r2(targetAt)}
          y={GOAL_BAR.top + GOAL_BAR.height + 34}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={26}
          fontWeight={800}
          fill={INK}
        >
          {S.route.goalLabel(state.targetM)}
        </text>
      </g>
    </svg>
  );
}
