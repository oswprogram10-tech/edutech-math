/**
 * 힌트 ② `row-lineup`: `args: { x }`가 가리키는 열의 기둥들을 앞 줄(y = 0)부터
 * 무대 옆에 나란히 세운 단면 막대로 그린다(MC-VIEW-DEPTH-IGNORED).
 * `args`가 없거나 잘못되면 아무것도 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { computeStageLayout } from '../layout';
import { useActiveRenderer } from '../renderer';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';
import { columnHeight } from '../voxel';
import { HelperDiagramBox } from './HelperDiagramBox';
import { CUBE_CANVAS_SELECTOR, useHelperOverlayMetrics } from './overlayMetrics';

function parseColumnArg(args: unknown, cols: number): number | null {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return null;
  const x = (args as Readonly<Record<string, unknown>>)['x'];
  if (typeof x !== 'number' || !Number.isInteger(x) || x < 0 || x >= cols) return null;
  return x;
}

export function RowLineupOverlay({ state, args }: OverlayProps<SolidConfig, SolidState>) {
  const activeRenderer = useActiveRenderer();
  const [cols, rows] = state.settings.grid;
  const layout = computeStageLayout(cols, rows, state.settings.maxHeight);
  const overlayMetrics = useHelperOverlayMetrics(
    activeRenderer,
    layout.viewBox.width,
    layout.viewBox.height,
  );
  if (state.mode !== 'cubes') return null;

  const targetX = parseColumnArg(args, cols);
  if (targetX === null) return null;
  const heights = Array.from({ length: rows }, (_, y) => columnHeight(state.cubes, targetX, y));

  const barWidth = 22;
  const barGap = 6;
  const blockHeight = 20;
  const panelWidth = rows * barWidth + (rows - 1) * barGap + 24;
  const panelHeight = state.settings.maxHeight * blockHeight + 38;
  const panelX = Math.max(8, layout.viewBox.width - panelWidth - 10);
  const panelY = 10;
  const baselineY = panelY + state.settings.maxHeight * blockHeight + 12;

  const diagram = (
    <g data-row-lineup-x={targetX}>
      <rect
        x={panelX}
        y={panelY}
        width={panelWidth}
        height={panelHeight}
        rx={10}
        fill="#ffffff"
        fillOpacity={0.94}
        stroke="#c2410c"
        strokeWidth={2}
      />
      <line
        x1={panelX + 10}
        y1={baselineY}
        x2={panelX + panelWidth - 10}
        y2={baselineY}
        stroke="#475569"
        strokeWidth={2}
      />
      {heights.map((h, y) => {
        const x = panelX + 12 + y * (barWidth + barGap);
        return (
          <g key={`lineup-${y}`} data-lineup-col={y}>
            {Array.from({ length: h }, (_, z) => (
              <rect
                key={`block-${y}-${z}`}
                x={x}
                y={baselineY - (z + 1) * blockHeight}
                width={barWidth}
                height={blockHeight}
                fill="#fb923c"
                stroke="#9a3412"
                strokeWidth={1.6}
              />
            ))}
            {y === 0 ? (
              <text
                x={x + barWidth / 2}
                y={baselineY + 18}
                textAnchor="middle"
                fontSize={13}
                fontWeight={800}
                fill="#9a3412"
              >
                {S.front}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );

  return (
    <CanvasAlignedOverlay
      testId="row-lineup"
      canvasSelector={CUBE_CANVAS_SELECTOR}
      logicalWidth={overlayMetrics.logicalWidth}
      logicalHeight={overlayMetrics.logicalHeight}
    >
      {activeRenderer === '3d' ? (
        <HelperDiagramBox state={state} overlayMetrics={overlayMetrics}>
          {diagram}
        </HelperDiagramBox>
      ) : (
        diagram
      )}
    </CanvasAlignedOverlay>
  );
}
