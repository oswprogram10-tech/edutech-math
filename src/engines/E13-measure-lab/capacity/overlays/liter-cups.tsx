/**
 * 힌트 ② liter-cups (MC-MEAS-UNIT-CONVERT). 1L 병 하나와 100mL 컵 열 개를 나란히 그리고
 * "1L = 100mL 컵 10번 = 1000mL" 글을 단다. 과제 값과 상관없는 고정 그림이다.
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

export function LiterCupsOverlay({ state }: OverlayProps<CapacityConfig, CapacityState>) {
  if (state.error !== null) return null;
  const height = boardHeight(state);
  const panelH = height - PANEL.y * 2;
  const mid = height / 2 - 20;
  return (
    <CanvasAlignedOverlay
      testId="overlay-liter-cups"
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
      <g data-part="liter-bottle">
        <path
          d={`M122,${mid - 110} V${mid - 76} L90,${mid - 60} V${mid + 100} H210 V${mid - 60} L178,${mid - 76} V${mid - 110}`}
          fill={WATER}
          fillOpacity={0.55}
          stroke={INK}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <text x={150} y={mid + 140} textAnchor="middle" fontSize={30} fontWeight={800} fill={INK}>
          {S.overlay.literBottle}
        </text>
      </g>
      <text
        x={262}
        y={mid}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={44}
        fontWeight={800}
        fill={INK}
      >
        =
      </text>
      {Array.from({ length: 10 }, (_, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const x = 320 + col * 124;
        const y = mid - 70 + row * 130;
        return (
          <g key={i} data-part="cup" transform={`translate(${x} ${y})`}>
            <path
              d="M0,0 L10,80 H70 L80,0"
              fill={WATER}
              fillOpacity={0.55}
              stroke={INK}
              strokeWidth={4}
              strokeLinejoin="round"
            />
            <text
              x={40}
              y={50}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={22}
              fontWeight={800}
              fill={INK}
            >
              {i + 1}
            </text>
          </g>
        );
      })}
      <text
        data-part="label"
        x={500}
        y={height - PANEL.y - 28}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={28}
        fontWeight={800}
        fill={INK}
      >
        {S.overlay.literCups}
      </text>
    </CanvasAlignedOverlay>
  );
}
