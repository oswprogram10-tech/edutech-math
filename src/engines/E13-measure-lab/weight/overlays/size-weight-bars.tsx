/**
 * 힌트 ② size-weight-bars (MC-MEAS-WEIGHT-SIZE). 저울에 올린 두 물건 사이에 "크기" 막대(그림 크기)와
 * "무게" 막대(저울이 기운 방향만: 무거운 쪽이 길다)를 그린다. 숫자는 쓰지 않는다.
 * 두 접시에 물건이 하나씩 있어야 그린다.
 */
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../core/engine-sdk';
import { E13_STRINGS as S } from '../../strings.ko';
import { BOARD, SIZE_RANK, boardHeight, geoOf, r2 } from '../layout';
import { objectOf, readWeight } from '../settings';
import { WEIGHT_CANVAS_SELECTOR } from '../types';
import type { WeightConfig, WeightState } from '../types';

const INK = '#1d2330';
const COLORS = { left: '#2f6fde', right: '#e8872e' } as const;
const BAR_H = 18;

function Bar({
  y,
  x,
  length,
  side,
  kind,
}: {
  readonly y: number;
  readonly x: number;
  readonly length: number;
  readonly side: 'left' | 'right';
  readonly kind: 'size' | 'weight';
}) {
  return (
    <rect
      data-bar={`${kind}-${side}`}
      x={r2(x)}
      y={r2(y)}
      width={r2(length)}
      height={BAR_H}
      rx={4}
      fill={COLORS[side]}
      fillOpacity={kind === 'size' ? 0.45 : 1}
      stroke={COLORS[side]}
      strokeWidth={3}
      strokeDasharray={kind === 'size' ? '8 5' : undefined}
    />
  );
}

export function SizeWeightBarsOverlay({ state }: OverlayProps<WeightConfig, WeightState>) {
  if (state.error !== null || state.left === null || state.right === null) return null;
  const geo = geoOf(state);
  const balance = geo.balance;
  const leftItem = objectOf(state, state.left);
  const rightItem = objectOf(state, state.right);
  if (balance === null || leftItem === undefined || rightItem === undefined) return null;
  const panelW = 2 * (balance.beamHalf - balance.panHalf) - 24;
  const panelX = balance.cx - panelW / 2;
  const top = balance.pivotY + 40;
  const barX = panelX + 12;
  const max = panelW - 24;
  const sizes = {
    left: SIZE_RANK[leftItem.visualSize],
    right: SIZE_RANK[rightItem.visualSize],
  };
  const biggest = Math.max(sizes.left, sizes.right);
  const tilt = readWeight(state).tilt;
  const weights =
    tilt === 'left'
      ? { left: max, right: max * 0.5 }
      : tilt === 'right'
        ? { left: max * 0.5, right: max }
        : { left: max, right: max };
  return (
    <CanvasAlignedOverlay
      testId="overlay-size-weight-bars"
      canvasSelector={WEIGHT_CANVAS_SELECTOR}
      logicalWidth={BOARD.width}
      logicalHeight={boardHeight(state)}
    >
      <rect
        data-part="panel"
        x={r2(panelX)}
        y={r2(top)}
        width={r2(panelW)}
        height={156}
        rx={12}
        fill="#fffdf6"
        fillOpacity={0.96}
        stroke={INK}
        strokeWidth={2}
      />
      <text x={r2(barX)} y={r2(top + 22)} fontSize={18} fontWeight={800} fill={INK}>
        {S.overlay.sizeBar}
      </text>
      <Bar x={barX} y={top + 30} length={(sizes.left / biggest) * max} side="left" kind="size" />
      <Bar x={barX} y={top + 54} length={(sizes.right / biggest) * max} side="right" kind="size" />
      <text x={r2(barX)} y={r2(top + 104)} fontSize={18} fontWeight={800} fill={INK}>
        {S.overlay.weightBar}
      </text>
      <Bar x={barX} y={top + 112} length={weights.left} side="left" kind="weight" />
      <Bar x={barX} y={top + 134 - 2} length={weights.right} side="right" kind="weight" />
    </CanvasAlignedOverlay>
  );
}
