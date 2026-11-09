/**
 * 힌트 ②: area-model에서 학생이 아직 나누지 않은(빠뜨린) 자리를 빗금으로 보여 준다.
 * 그 조각의 곱은 쓰지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import { areaPieceRects, areaRect } from '../layout';
import type { ArrayAreaConfig, ArrayAreaState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';

function chosenIndex(args: unknown, count: number): number {
  if (args !== null && typeof args === 'object' && 'index' in args) {
    const index = (args as { readonly index?: unknown }).index;
    if (typeof index === 'number' && Number.isInteger(index) && index >= 0) return index;
  }
  return Math.max(0, count - 1);
}

export function MissingStripOverlay({
  state,
  args,
}: OverlayProps<ArrayAreaConfig, ArrayAreaState>) {
  if (state.mode !== 'area-model') return null;
  const rect = areaRect(state.settings.a, state.settings.b);
  const pieces = areaPieceRects(
    rect,
    state.settings.a,
    state.settings.b,
    state.areaSplitsA,
    state.areaSplitsB,
  );
  const piece = pieces[chosenIndex(args, pieces.length) % Math.max(1, pieces.length)];
  if (!piece) return null;

  return (
    <CanvasAlignedOverlay
      canvasSelector={'svg[data-testid="array-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <pattern
          id="e04-missing-hatch"
          width={10}
          height={10}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={10} stroke="#c2410c" strokeWidth={3} />
        </pattern>
      </defs>
      <rect
        x={piece.x}
        y={piece.y}
        width={piece.width}
        height={piece.height}
        fill="url(#e04-missing-hatch)"
        fillOpacity={0.28}
        stroke="#c2410c"
        strokeWidth={3}
        strokeDasharray="9 6"
      />
    </CanvasAlignedOverlay>
  );
}
