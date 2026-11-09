/**
 * 힌트 ②: tiling에서 남는 자리를 깜빡이는 점선으로 보여 준다.
 * 덮이는지 여부·남는 칸 수는 쓰지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import { tilingRoomRects } from '../layout';
import type { TileRoomRect } from '../layout';
import type { ArrayAreaConfig, ArrayAreaState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';

function leftovers(
  rect: TileRoomRect,
  width: number,
  height: number,
  tileSize: number | null,
): { x: number; y: number; width: number; height: number }[] {
  if (tileSize === null) return [];
  const fullCols = Math.floor(width / tileSize);
  const fullRows = Math.floor(height / tileSize);
  const coveredWidth = fullCols * tileSize;
  const coveredHeight = fullRows * tileSize;
  const cellWidth = rect.width / Math.max(1, width);
  const cellHeight = rect.height / Math.max(1, height);
  const result: { x: number; y: number; width: number; height: number }[] = [];
  if (coveredWidth < width) {
    result.push({
      x: rect.x + coveredWidth * cellWidth,
      y: rect.y,
      width: (width - coveredWidth) * cellWidth,
      height: rect.height,
    });
  }
  if (coveredHeight < height) {
    result.push({
      x: rect.x,
      y: rect.y + coveredHeight * cellHeight,
      width: coveredWidth * cellWidth,
      height: (height - coveredHeight) * cellHeight,
    });
  }
  return result;
}

export function LeftoverStripOverlay({ state }: OverlayProps<ArrayAreaConfig, ArrayAreaState>) {
  if (state.mode !== 'tiling') return null;
  const rooms = tilingRoomRects(
    state.settings.width,
    state.settings.height,
    state.settings.compare,
  );
  const strips = [
    ...leftovers(rooms.a, state.settings.width, state.settings.height, state.tileSize),
    ...(rooms.b !== null && state.settings.compare !== null
      ? leftovers(
          rooms.b,
          state.settings.compare.width,
          state.settings.compare.height,
          state.tileSize,
        )
      : []),
  ];
  if (strips.length === 0) return null;

  return (
    <CanvasAlignedOverlay
      canvasSelector={'svg[data-testid="array-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <pattern
          id="e04-leftover-hint"
          width={10}
          height={10}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={10} stroke="#c2410c" strokeWidth={3} />
        </pattern>
      </defs>
      {strips.map((strip, index) => (
        <rect
          key={`leftover-${index}`}
          x={strip.x}
          y={strip.y}
          width={strip.width}
          height={strip.height}
          fill="url(#e04-leftover-hint)"
          fillOpacity={0.3}
          stroke="#c2410c"
          strokeWidth={3}
          strokeDasharray="9 6"
        >
          <animate
            attributeName="stroke-opacity"
            values="1;0.25;1"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </rect>
      ))}
    </CanvasAlignedOverlay>
  );
}
