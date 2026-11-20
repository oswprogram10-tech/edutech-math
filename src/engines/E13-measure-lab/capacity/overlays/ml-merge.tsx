/**
 * 힌트 ② ml-merge (MC-MEAS-MIXED-UNIT-CALC). 1000칸 mL 막대(100칸 단위 열 묶음)가 1L 병 하나로 바뀌는 그림을
 * 화살표 하나로 그린다. 과제 값과 상관없는 고정 그림이다.
 */
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../core/engine-sdk';
import { E13_STRINGS as S } from '../../strings.ko';
import { BOARD, boardHeight } from '../layout';
import { CAPACITY_CANVAS_SELECTOR } from '../types';
import type { CapacityConfig, CapacityState } from '../types';

const INK = '#1d2330';
const ORANGE = '#e8872e';
const WATER = '#7ab8ff';
const PANEL = { x: 40, y: 10, w: 920 } as const;
const BAR = { x: 80, w: 560, h: 56, group: 56 } as const;

export function MlMergeOverlay({ state }: OverlayProps<CapacityConfig, CapacityState>) {
  if (state.error !== null) return null;
  const height = boardHeight(state);
  const panelH = height - PANEL.y * 2;
  const mid = height / 2 - 20;
  const barTop = mid - BAR.h / 2;
  return (
    <CanvasAlignedOverlay
      testId="overlay-ml-merge"
      canvasSelector={CAPACITY_CANVAS_SELECTOR}
      logicalWidth={BOARD.width}
      logicalHeight={height}
    >
      <rect
        data-part="panel"
        x={PANEL.x}
        y={PANEL.y}
        width={PANEL.w}
        height={panelH}
        rx={16}
        fill="#fffdf6"
        fillOpacity={0.96}
        stroke={ORANGE}
        strokeWidth={4}
      />
      <g data-part="ml-bar">
        {Array.from({ length: 10 }, (_, i) => (
          <rect
            key={i}
            data-part="ml-group"
            x={BAR.x + i * BAR.group}
            y={barTop}
            width={BAR.group}
            height={BAR.h}
            fill={i % 2 === 0 ? '#cfe0ff' : '#b3cdf7'}
            stroke={INK}
            strokeWidth={3}
          />
        ))}
        <text
          x={BAR.x + BAR.group / 2}
          y={barTop - 18}
          textAnchor="middle"
          fontSize={20}
          fontWeight={800}
          fill={INK}
        >
          {S.overlay.mlGroup}
        </text>
        <text
          x={BAR.x + BAR.w / 2}
          y={barTop + BAR.h + 34}
          textAnchor="middle"
          fontSize={28}
          fontWeight={800}
          fill={INK}
        >
          {S.overlay.mlMerge}
        </text>
      </g>
      <g data-part="arrow">
        <line x1={660} y1={mid} x2={756} y2={mid} stroke={ORANGE} strokeWidth={8} />
        <polygon points={`${756},${mid - 18} ${790},${mid} ${756},${mid + 18}`} fill={ORANGE} />
      </g>
      <g data-part="liter-bottle">
        <path
          d={`M862,${mid - 90} V${mid - 60} L834,${mid - 46} V${mid + 80} H930 V${mid - 46} L902,${mid - 60} V${mid - 90}`}
          fill={WATER}
          fillOpacity={0.55}
          stroke={INK}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <text x={882} y={mid + 118} textAnchor="middle" fontSize={30} fontWeight={800} fill={INK}>
          {S.overlay.mlBottle}
        </text>
      </g>
    </CanvasAlignedOverlay>
  );
}
