/**
 * 힌트 ② `top-arcs`: 배열했으면 줄 위쪽 호들을 굵게 칠하고 괄호를 친다.
 * 아직 배열하지 않았으면 원 둘레의 위쪽 절반을 칠한다. 개수·수 값은 쓰지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import {
  circleTopHalfPath,
  rowScale,
  rowScreenRight,
  rowScreenTop,
  SLOT_BASELINE,
  SLOT_X0,
  slotArcPath,
} from '../circle-sectors/layout';
import { arranged, currentDivisions, isManual } from '../circle-sectors/reduce';
import { cutStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { CutConfig, CutState } from '../types';

const ORANGE = '#e8872e';

export function TopArcsOverlay({ state }: OverlayProps<CutConfig, CutState>) {
  if (state.mode !== 'circle-sectors') {
    return (
      <CanvasAlignedOverlay
        testId="top-arcs"
        canvasSelector={'svg[data-testid="cut-canvas"]'}
        logicalWidth={LOGICAL_WIDTH}
        logicalHeight={LOGICAL_HEIGHT}
      >
        <title>{S.overlays.topArcs}</title>
      </CanvasAlignedOverlay>
    );
  }

  const n = currentDivisions(state);
  const manual = isManual(state);
  const done = arranged(state);
  const scale = rowScale(n);
  const rowTransform = `translate(${SLOT_X0} ${SLOT_BASELINE}) scale(${scale.toFixed(4)}) translate(${-SLOT_X0} ${-SLOT_BASELINE})`;
  const arcs: { readonly slot: number; readonly arcUp: boolean }[] = [];
  if (done) {
    if (manual) {
      state.slots.forEach((slot, index) => {
        if (slot?.arcUp) arcs.push({ slot: index, arcUp: true });
      });
    } else {
      for (let slot = 0; slot < n; slot += 1) {
        if (slot % 2 === 0) arcs.push({ slot, arcUp: true });
      }
    }
  }

  const top = rowScreenTop(n);
  const right = rowScreenRight(n);

  return (
    <CanvasAlignedOverlay
      testId="top-arcs"
      canvasSelector={'svg[data-testid="cut-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="none" stroke="none" />
      {done ? (
        <>
          <g transform={rowTransform}>
            {arcs.map((arc) => (
              <path
                key={`top-arc-${arc.slot}`}
                d={slotArcPath(arc.slot, n, arc.arcUp)}
                fill="none"
                stroke={ORANGE}
                strokeWidth={7 / Math.max(scale, 0.2)}
                strokeOpacity={0.75}
                strokeLinecap="round"
              />
            ))}
          </g>
          <path
            d={`M ${SLOT_X0} ${top - 14} Q ${(SLOT_X0 + right) / 2} ${top - 34} ${right} ${top - 14}`}
            fill="none"
            stroke={ORANGE}
            strokeWidth={4}
            strokeLinecap="round"
          />
        </>
      ) : (
        <path
          d={circleTopHalfPath()}
          fill="none"
          stroke={ORANGE}
          strokeWidth={9}
          strokeOpacity={0.8}
          strokeLinecap="round"
        />
      )}
      <title>{S.overlays.topArcs}</title>
    </CanvasAlignedOverlay>
  );
}
