/**
 * 힌트 ② size-vs-weight (MC-SIZE-IS-WEIGHT).
 * 저울에 올린 두 물건 옆에 두 줄을 그린다: "크기" 막대(visualSize 상대 길이)와
 * "무게" 막대(지금 저울 결과 방향만: 무거운 쪽을 길게, 같으면 같게). 숫자는 쓰지 않는다.
 * 두 접시에 물건이 하나씩 없으면 그리지 않는다. 한 접시에 여럿이면 크기는 합친 상대 길이를 쓴다.
 */
import { CanvasAlignedOverlay } from '../../../../core/engine-sdk';
import type { OverlayProps } from '../../../../core/engine-sdk';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../../types';
import type { E06Config, E06State } from '../../unions';
import { SIZE_RANK } from '../layout';
import { itemOf, readCompare } from '../reduce';
import { compareStrings as C } from '../strings.ko';
import type { CompareState } from '../types';

const PANEL = { x: 345, y: 222, width: 310, height: 176 } as const;
const BAR_X = 440;
const BAR_MAX = 190;
const BAR_H = 20;
const COLORS = { left: '#2f6fde', right: '#e8872e' } as const;
const INK = '#1d2330';

function sizeOf(state: CompareState, ids: readonly string[]): number {
  return ids.reduce((total, id) => total + SIZE_RANK[itemOf(state, id)?.size ?? 'small'], 0);
}

function Row({
  y,
  side,
  length,
  label,
  kind,
}: {
  readonly y: number;
  readonly side: 'left' | 'right';
  readonly length: number;
  readonly label: string;
  readonly kind: 'size' | 'weight';
}) {
  return (
    <g data-bar={`${kind}-${side}`}>
      <text
        x={BAR_X - 8}
        y={y + BAR_H / 2}
        textAnchor="end"
        dominantBaseline="central"
        fontSize={18}
        fill={INK}
      >
        {label}
      </text>
      <rect
        x={BAR_X}
        y={y}
        width={length}
        height={BAR_H}
        rx={4}
        fill={COLORS[side]}
        fillOpacity={kind === 'size' ? 0.45 : 1}
        stroke={COLORS[side]}
        strokeWidth={3}
        strokeDasharray={kind === 'size' ? '8 5' : undefined}
      />
    </g>
  );
}

export function SizeVsWeightOverlay({ state }: OverlayProps<E06Config, E06State>) {
  if (state.mode !== 'compare' || state.error !== null) return null;
  if (state.left.length === 0 || state.right.length === 0) return null;
  const reading = readCompare(state);
  const leftSize = sizeOf(state, state.left);
  const rightSize = sizeOf(state, state.right);
  const biggest = Math.max(leftSize, rightSize);
  const sizeBar = (rank: number) => Math.max(24, (rank / biggest) * BAR_MAX);
  const weightBars =
    reading.tilt === 'left'
      ? { left: BAR_MAX, right: 80 }
      : reading.tilt === 'right'
        ? { left: 80, right: BAR_MAX }
        : { left: 140, right: 140 };
  return (
    <CanvasAlignedOverlay
      testId="overlay-size-vs-weight"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <g role="img" aria-label={C.overlay.label} data-part="size-vs-weight">
        <rect
          x={PANEL.x}
          y={PANEL.y}
          width={PANEL.width}
          height={PANEL.height}
          rx={14}
          fill="#ffffff"
          fillOpacity={0.95}
          stroke="#8b96ab"
          strokeWidth={3}
        />
        <text x={PANEL.x + 14} y={PANEL.y + 22} fontSize={20} fontWeight={800} fill={INK}>
          {C.overlay.size}
        </text>
        <Row
          y={PANEL.y + 36}
          side="left"
          length={sizeBar(leftSize)}
          label={C.overlay.left}
          kind="size"
        />
        <Row
          y={PANEL.y + 64}
          side="right"
          length={sizeBar(rightSize)}
          label={C.overlay.right}
          kind="size"
        />
        <text x={PANEL.x + 14} y={PANEL.y + 112} fontSize={20} fontWeight={800} fill={INK}>
          {C.overlay.weight}
        </text>
        <Row
          y={PANEL.y + 124}
          side="left"
          length={weightBars.left}
          label={C.overlay.left}
          kind="weight"
        />
        <Row
          y={PANEL.y + 150}
          side="right"
          length={weightBars.right}
          label={C.overlay.right}
          kind="weight"
        />
      </g>
    </CanvasAlignedOverlay>
  );
}
