/**
 * 힌트 ② `views-twins`: 같은 위·앞·옆 투영(`referenceViews`)을 만드는
 * 최소 개수 해와 최대 개수 해를 작은 등각 그림 두 개로 나란히 그린다(MC-VIEWS-UNIQUE).
 *
 * 주의: 최소·최대를 묻는 과제에서는 쓰지 않는다(답 모양이 보이기 때문).
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import {
  computeReferenceLayout,
  computeStageLayout,
  cubeFaces,
  pointsAttr,
  sortCubesForPainter,
} from '../layout';
import { useActiveRenderer } from '../renderer';
import { solid3dStrings as S } from '../strings.ko';
import type { CubeCoord, SolidConfig, SolidState } from '../types';
import { CUBE_INK, CUBE_PALETTE } from '../views/focusMatch';
import { viewsCountSolutions } from '../voxel';
import { HelperDiagramBox } from './HelperDiagramBox';
import { CUBE_CANVAS_SELECTOR, useHelperOverlayMetrics } from './overlayMetrics';

function heightsToCoords(heights: readonly (readonly number[])[]): CubeCoord[] {
  const rows = heights.length;
  const coords: CubeCoord[] = [];
  for (let r = 0; r < rows; r += 1) {
    const row = heights[r];
    if (!row) continue;
    const y = rows - 1 - r;
    for (let x = 0; x < row.length; x += 1) {
      const h = row[x] ?? 0;
      for (let z = 0; z < h; z += 1) {
        coords.push([x, y, z]);
      }
    }
  }
  return coords;
}

function TwinSketch({
  coords,
  cols,
  rows,
  offsetX,
  offsetY,
  boxWidth,
  boxHeight,
  captionY,
}: {
  readonly coords: readonly CubeCoord[];
  readonly cols: number;
  readonly rows: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly boxWidth: number;
  readonly boxHeight: number;
  readonly captionY: number;
}) {
  const refLayout = computeReferenceLayout(coords, 28);
  const scale = Math.min(
    boxWidth / Math.max(1, refLayout.viewBox.width),
    boxHeight / Math.max(1, refLayout.viewBox.height),
  );
  const drawW = refLayout.viewBox.width * scale;
  const drawH = refLayout.viewBox.height * scale;
  const x = offsetX + (boxWidth - drawW) / 2;
  const y = offsetY + (boxHeight - drawH) / 2;
  const painted = sortCubesForPainter(
    coords.map(([cx, cy, cz]) => ({ x: cx, y: cy, z: cz })),
    cols,
    rows,
    0,
  );
  const palette = CUBE_PALETTE.plain;

  return (
    <g>
      <g transform={`translate(${x}, ${y}) scale(${scale})`}>
        {painted.map(({ cube, rx, ry }) => {
          const faces = cubeFaces(refLayout, rx, ry, cube.z);
          return (
            <g key={`twin-cube-${cube.x}-${cube.y}-${cube.z}`}>
              <polygon
                points={pointsAttr(faces.top)}
                fill={palette.top}
                stroke={CUBE_INK}
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
              <polygon
                points={pointsAttr(faces.front)}
                fill={palette.front}
                stroke={CUBE_INK}
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
              <polygon
                points={pointsAttr(faces.right)}
                fill={palette.right}
                stroke={CUBE_INK}
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
            </g>
          );
        })}
      </g>
      <text
        x={offsetX + boxWidth / 2}
        y={captionY}
        textAnchor="middle"
        fontSize={12}
        fontWeight={800}
        fill="#1e40af"
      >
        {S.viewsTwinsCaption}
      </text>
    </g>
  );
}

export function ViewsTwinsOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  const activeRenderer = useActiveRenderer();
  const [cols, rows] = state.settings.grid;
  const layout = computeStageLayout(cols, rows, state.settings.maxHeight);
  const overlayMetrics = useHelperOverlayMetrics(
    activeRenderer,
    layout.viewBox.width,
    layout.viewBox.height,
  );
  if (state.mode !== 'cubes') return null;

  const solutions = viewsCountSolutions(state.settings.referenceViews);
  if (!solutions || solutions.min === solutions.max) return null;

  const minCoords = heightsToCoords(solutions.minHeights);
  const maxCoords = heightsToCoords(solutions.maxHeights);

  const stageW = layout.viewBox.width;
  const cardWidth = Math.min(stageW - 16, 252);
  const cardHeight = 128;
  const cardX = 8;
  const cardY = 8;
  const innerPad = 10;
  const slotGap = 10;
  const slotWidth = (cardWidth - innerPad * 2 - slotGap) / 2;
  const slotHeight = cardHeight - 36;
  const captionY = cardY + cardHeight - 10;

  const diagram = (
    <g data-testid="cubes-views-twins">
      <rect
        x={cardX}
        y={cardY}
        width={cardWidth}
        height={cardHeight}
        rx={12}
        fill="#ffffff"
        fillOpacity={0.96}
        stroke="#2f6fde"
        strokeWidth={2}
      />
      <TwinSketch
        coords={minCoords}
        cols={cols}
        rows={rows}
        offsetX={cardX + innerPad}
        offsetY={cardY + 8}
        boxWidth={slotWidth}
        boxHeight={slotHeight}
        captionY={captionY}
      />
      <TwinSketch
        coords={maxCoords}
        cols={cols}
        rows={rows}
        offsetX={cardX + innerPad + slotWidth + slotGap}
        offsetY={cardY + 8}
        boxWidth={slotWidth}
        boxHeight={slotHeight}
        captionY={captionY}
      />
    </g>
  );

  return (
    <CanvasAlignedOverlay
      testId="views-twins"
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
