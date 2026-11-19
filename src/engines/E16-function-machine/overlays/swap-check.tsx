/**
 * 힌트 ② swap-check (MC-CORR-SWAP-VARS).
 * 표 첫 줄의 ○ 값을 학생 식의 ○에 넣어 푼 □를 "○ = 2일 때 내 식의 □ = 1/2"로 쓰고,
 * 같은 줄에 표에 보이는 □와 나란히 둔다. 장면이 의자와 다리면 다리 반 개 그림을 덧붙인다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { pairsOf, safeSolve } from '../relation-check';
import { functionStrings as S } from '../strings.ko';
import { gemsOf, pointX, pointY, shooterLayout } from '../shooter';
import { colX, footTop, row0Top } from '../table-layout';
import type { FunctionConfig, FunctionState } from '../types';
import { RELATION_CANVAS, SHOOTER_CANVAS, onGrid, overlayData } from './helpers';

export function SwapCheckOverlay({ state }: OverlayProps<FunctionConfig, FunctionState>) {
  const { columns, layout, rel } = overlayData(state);
  if (rel === null) return null;
  const index = columns.findIndex((column) => pairsOf([column]).length === 1);
  const column = columns[index];
  if (column === undefined) return null;
  const pair = pairsOf([column])[0];
  if (pair === undefined) return null;
  const mine = safeSolve(rel, pair[0]);
  if (onGrid(state) && state.mode === 'rule-shooter') {
    // 격자에서는 본 캔버스가 shooter-canvas다. 첫 보석에 같은 설명을 단다.
    const grid = shooterLayout(state.settings.grid);
    const gem = gemsOf(state.settings)[index];
    if (gem === undefined) return null;
    const gx = pointX(grid, gem.x);
    const gy = pointY(grid, gem.y);
    const left = grid.left + 6;
    return (
      <CanvasAlignedOverlay
        testId="swap-check"
        canvasSelector={SHOOTER_CANVAS}
        logicalWidth={grid.width}
        logicalHeight={grid.height}
      >
        <rect
          x={gx - 22}
          y={gy - 22}
          width={44}
          height={44}
          fill="none"
          stroke="#2f6fde"
          strokeWidth={5}
          rx={6}
          data-testid="swap-check-col"
        />
        <rect
          x={left - 4}
          y={grid.top + 2}
          width={Math.min(grid.plotW - 4, 330)}
          height={50}
          rx={6}
          fill="#fbfaf6"
          opacity={0.92}
        />
        <text
          x={left}
          y={grid.top + 18}
          fontSize={14}
          fontWeight={800}
          fill="#1d4fa8"
          data-testid="swap-check-mine"
        >
          {S.overlay.swapLine(pair[0].toString(), mine === null ? '?' : mine.toString())}
        </text>
        <text
          x={left}
          y={grid.top + 40}
          fontSize={14}
          fontWeight={700}
          fill="#3d485c"
          data-testid="swap-check-actual"
        >
          {S.overlay.swapActualGem(pair[1].toString())}
        </text>
      </CanvasAlignedOverlay>
    );
  }
  const top = footTop(layout) + 4;
  const chairs = state.mode === 'covary' && state.settings.scene === 'chairs-legs';
  const iconX = layout.width - 92;

  return (
    <CanvasAlignedOverlay
      testId="swap-check"
      canvasSelector={RELATION_CANVAS}
      logicalWidth={layout.width}
      logicalHeight={layout.height}
    >
      <rect
        x={colX(layout, index) - 3}
        y={row0Top(layout) - 3}
        width={layout.cellW + 6}
        height={2 * layout.cellH + 6}
        fill="none"
        stroke="#2f6fde"
        strokeWidth={5}
        rx={4}
        data-testid="swap-check-col"
      />
      <text
        x={8}
        y={top + 12}
        fontSize={16}
        fontWeight={800}
        fill="#1d4fa8"
        data-testid="swap-check-mine"
      >
        {S.overlay.swapLine(pair[0].toString(), mine === null ? '?' : mine.toString())}
      </text>
      <text
        x={8}
        y={top + 38}
        fontSize={16}
        fontWeight={700}
        fill="#3d485c"
        data-testid="swap-check-actual"
      >
        {S.overlay.swapActual(pair[1].toString())}
      </text>
      {chairs ? (
        <g data-testid="swap-check-chair">
          <rect
            x={iconX + 4}
            y={top - 2}
            width={8}
            height={30}
            rx={3}
            fill="#c9a06a"
            stroke="#7a5a30"
            strokeWidth={2}
          />
          <rect
            x={iconX + 4}
            y={top + 20}
            width={46}
            height={9}
            rx={3}
            fill="#d9b27c"
            stroke="#7a5a30"
            strokeWidth={2}
          />
          <path
            d={`M${iconX + 9} ${top + 29} L${iconX + 9} ${top + 48}`}
            stroke="#9a7040"
            strokeWidth={4}
          />
          <path
            d={`M${iconX + 45} ${top + 29} L${iconX + 45} ${top + 48}`}
            stroke="#9a7040"
            strokeWidth={4}
          />
          <path
            d={`M${iconX + 22} ${top + 29} L${iconX + 22} ${top + 48}`}
            stroke="#9a7040"
            strokeWidth={4}
            strokeDasharray="4 3"
            opacity={0.45}
          />
          <path
            d={`M${iconX + 33} ${top + 29} L${iconX + 33} ${top + 48}`}
            stroke="#9a7040"
            strokeWidth={4}
            strokeDasharray="4 3"
            opacity={0.45}
          />
          <text x={iconX + 56} y={top + 40} fontSize={14} fontWeight={700} fill="#3d485c">
            {S.overlay.halfLeg}
          </text>
        </g>
      ) : null}
    </CanvasAlignedOverlay>
  );
}
