/**
 * 힌트 ② ten-step (MC-CHART-ROW-COL).
 *
 * 오개념이 난 가린 칸의 바로 위 칸 수를 10 막대와 낱개 점으로 칸 옆에 그리고,
 * 그 아래에 "10 막대 1개 더"를 화살표로 그린다. 아래 칸 수 자체는 쓰지 않는다.
 * `args: {cell}`이 범위 안의 정수면 가린 칸이 아니어도(칸 고르기 과제) 그 칸을 쓴다.
 * 없으면 Observation과 같은 규칙으로 첫 오개념 칸을 쓴다.
 * 위 칸이 범위 밖이거나 그 칸도 가려져 있으면 아무것도 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { CHART_COLS, inRange, rowColCells } from '../chart';
import { chartLayout } from '../layout';
import type { Box } from '../layout';
import { patternStrings as S } from '../strings.ko';
import { chartRangeOf } from '../types';
import type { PatternConfig, PatternState } from '../types';
import { CHART_CANVAS, argsOf, chartOf } from './helpers';

const PANEL_H = 124;

interface Placement {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/** 칸 옆(오른쪽·왼쪽·아래·위) 가운데 패널이 가장 크게 들어가는 자리. */
function placePanel(box: Box, width: number, height: number, pw: number, ph: number): Placement {
  const gap = 6;
  const options: Placement[] = [
    {
      x: box.x + box.size + gap,
      y: Math.min(Math.max(2, box.y + box.size / 2 - ph / 2), height - ph - 2),
      scale: Math.min(1, (width - (box.x + box.size + gap) - 2) / pw, (height - 4) / ph),
    },
    {
      x: 2,
      y: Math.min(Math.max(2, box.y + box.size / 2 - ph / 2), height - ph - 2),
      scale: Math.min(1, (box.x - gap - 2) / pw, (height - 4) / ph),
    },
    {
      x: Math.min(Math.max(2, box.x + box.size / 2 - pw / 2), width - pw - 2),
      y: box.y + box.size + gap,
      scale: Math.min(1, (width - 4) / pw, (height - (box.y + box.size + gap) - 2) / ph),
    },
    {
      x: Math.min(Math.max(2, box.x + box.size / 2 - pw / 2), width - pw - 2),
      y: 2,
      scale: Math.min(1, (width - 4) / pw, (box.y - gap - 2) / ph),
    },
  ];
  let best = options[0] as Placement;
  for (const option of options) {
    if (option.scale > best.scale + 0.001) best = option;
  }
  const scale = Math.max(0.2, best.scale);
  // 자리를 줄인 만큼 칸 쪽으로 붙인다.
  return { ...best, scale };
}

export function TenStepOverlay({ state, args }: OverlayProps<PatternConfig, PatternState>) {
  const chart = chartOf(state);
  if (!chart) return null;
  const range = chartRangeOf(chart.settings);
  const requested = argsOf(args)['cell'];
  const cell =
    typeof requested === 'number' && Number.isInteger(requested) && inRange(range, requested)
      ? requested
      : rowColCells(range, chart.hidden, chart.entries)[0];
  if (cell === undefined) return null;
  const above = cell - CHART_COLS;
  if (!inRange(range, above) || chart.hidden.includes(above)) return null;

  const layout = chartLayout(chart.settings);
  const box = layout.boxes.get(cell);
  if (!box) return null;

  const tens = Math.floor(above / 10);
  const ones = above % 10;
  const rodsEnd = 14 + tens * 14;
  const pw = Math.max(200, rodsEnd + (ones > 0 ? 80 : 14));
  const put = placePanel(box, layout.width, layout.height, pw, PANEL_H);

  return (
    <CanvasAlignedOverlay
      testId="ten-step"
      canvasSelector={CHART_CANVAS}
      logicalWidth={layout.width}
      logicalHeight={layout.height}
    >
      <g transform={`translate(${put.x} ${put.y}) scale(${put.scale})`}>
        <rect
          x={0}
          y={0}
          width={pw}
          height={PANEL_H}
          rx={12}
          fill="#ffffff"
          fillOpacity={0.96}
          stroke="#2f6fde"
          strokeWidth={3}
        />
        <text
          x={10}
          y={14}
          fontSize={12}
          fontWeight={700}
          fill="#3d485c"
          dominantBaseline="central"
        >
          {S.overlay.tenStepAbove}
        </text>
        {Array.from({ length: tens }, (_, index) => (
          <g key={index} data-testid="ten-step-rod">
            <rect
              x={10 + index * 14}
              y={24}
              width={10}
              height={40}
              fill="#9dbcff"
              stroke="#1d4fa8"
              strokeWidth={1.5}
            />
            <path
              d={`M${10 + index * 14} 34 H${20 + index * 14} M${10 + index * 14} 44 H${20 + index * 14} M${10 + index * 14} 54 H${20 + index * 14}`}
              stroke="#1d4fa8"
              strokeWidth={1}
            />
          </g>
        ))}
        {Array.from({ length: ones }, (_, index) => (
          <circle
            key={index}
            cx={rodsEnd + 12 + (index % 5) * 12}
            cy={34 + Math.floor(index / 5) * 14}
            r={5}
            fill="#e8a13a"
            stroke="#8a4b00"
            strokeWidth={1.5}
            data-testid="ten-step-dot"
          />
        ))}
        <path d={`M${pw / 2} 68 V86`} stroke="#1d2330" strokeWidth={3} fill="none" />
        <polygon points={`${pw / 2 - 7},84 ${pw / 2 + 7},84 ${pw / 2},95`} fill="#1d2330" />
        <rect
          x={10}
          y={90}
          width={10}
          height={26}
          fill="none"
          stroke="#1d4fa8"
          strokeWidth={2}
          strokeDasharray="4 3"
        />
        <text
          x={28}
          y={104}
          fontSize={16}
          fontWeight={800}
          fill="#1d2330"
          dominantBaseline="central"
        >
          {S.overlay.tenStep}
        </text>
      </g>
    </CanvasAlignedOverlay>
  );
}
