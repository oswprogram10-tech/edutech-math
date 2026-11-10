/**
 * 힌트 ② `radius-height`: 원의 반지름 하나와, 배열한 줄의 세로 길이를 같은
 * 무늬로 표시한다. 배열 전이면 반지름만 그린다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import {
  CIRCLE_CENTER,
  CIRCLE_RADIUS,
  rowScreenTop,
  SLOT_BASELINE,
  SLOT_X0,
} from '../circle-sectors/layout';
import { arranged, currentDivisions } from '../circle-sectors/reduce';
import { cutStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { CutConfig, CutState } from '../types';

const ORANGE = '#e8872e';

export function RadiusHeightOverlay({ state }: OverlayProps<CutConfig, CutState>) {
  if (state.mode !== 'circle-sectors') {
    return (
      <CanvasAlignedOverlay
        testId="radius-height"
        canvasSelector={'svg[data-testid="cut-canvas"]'}
        logicalWidth={LOGICAL_WIDTH}
        logicalHeight={LOGICAL_HEIGHT}
      >
        <title>{S.overlays.radiusHeight}</title>
      </CanvasAlignedOverlay>
    );
  }

  const done = arranged(state);
  const n = currentDivisions(state);
  const top = rowScreenTop(n);

  return (
    <CanvasAlignedOverlay
      testId="radius-height"
      canvasSelector={'svg[data-testid="cut-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="none" stroke="none" />
      <line
        x1={CIRCLE_CENTER.x}
        y1={CIRCLE_CENTER.y}
        x2={CIRCLE_CENTER.x + CIRCLE_RADIUS}
        y2={CIRCLE_CENTER.y}
        stroke={ORANGE}
        strokeWidth={6}
        strokeDasharray="14 9"
        strokeLinecap="round"
      />
      <circle cx={CIRCLE_CENTER.x} cy={CIRCLE_CENTER.y} r={5} fill={ORANGE} />
      <circle cx={CIRCLE_CENTER.x + CIRCLE_RADIUS} cy={CIRCLE_CENTER.y} r={5} fill={ORANGE} />
      {done ? (
        <>
          <line
            x1={SLOT_X0}
            y1={SLOT_BASELINE}
            x2={SLOT_X0}
            y2={top}
            stroke={ORANGE}
            strokeWidth={6}
            strokeDasharray="14 9"
            strokeLinecap="round"
          />
          <circle cx={SLOT_X0} cy={SLOT_BASELINE} r={5} fill={ORANGE} />
          <circle cx={SLOT_X0} cy={top} r={5} fill={ORANGE} />
        </>
      ) : null}
      <title>{S.overlays.radiusHeight}</title>
    </CanvasAlignedOverlay>
  );
}
