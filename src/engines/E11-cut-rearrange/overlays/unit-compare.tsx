/**
 * 힌트 ② `unit-compare` (MC-AREA-UNIT-CONFUSION).
 *
 * 캔버스 오른쪽 아래에 1칸 선분과 1칸 정사각형을 나란히 그린다. 개수 숫자는 쓰지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import { unitComparePlacement } from '../layout';
import { cutStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';

const ORANGE = '#e8872e';

export function UnitCompareOverlay() {
  const placement = unitComparePlacement();
  return (
    <CanvasAlignedOverlay
      testId="unit-compare"
      canvasSelector={'svg[data-testid="cut-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <line
        x1={placement.segment.x1}
        y1={placement.segment.y1}
        x2={placement.segment.x2}
        y2={placement.segment.y2}
        stroke={ORANGE}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <rect
        x={placement.square.x}
        y={placement.square.y}
        width={placement.square.size}
        height={placement.square.size}
        fill={ORANGE}
        fillOpacity={0.14}
        stroke={ORANGE}
        strokeWidth={5}
      />
      <title>{S.overlays.unitCompare}</title>
    </CanvasAlignedOverlay>
  );
}
