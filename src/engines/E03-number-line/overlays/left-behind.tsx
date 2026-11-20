/**
 * 힌트 ②: rounding 상황 장면에서 마지막 묶음의 나머지만 단독으로 보여 준다(MC-ROUND-CONTEXT-BLIND).
 * 버스면 정류장에 남은 학생, 봉지면 덜 찬 봉지. 학생이 지금 고른 방법과 상관없다.
 * 전체 버스·봉지 수는 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { leftBehindRest } from '../scenario';
import { numberLineStrings } from '../strings.ko';
import type { NumberLineConfig, NumberLineState } from '../types';
import { BagArt, SCENE_TOP, StopArt } from '../views/rounding-scene/Art';

const S = numberLineStrings.rounding.scene;

export function LeftBehindOverlay({ state }: OverlayProps<NumberLineConfig, NumberLineState>) {
  const rest = leftBehindRest(state);
  if (!rest) return null;
  const top = SCENE_TOP + 40;
  return (
    <CanvasAlignedOverlay
      testId="overlay-left-behind"
      canvasSelector={'svg[data-testid="number-line-canvas"]'}
      logicalWidth={1000}
      logicalHeight={600}
    >
      <rect
        x={0}
        y={SCENE_TOP - 6}
        width={1000}
        height={600 - SCENE_TOP + 6}
        fill="#f7f9ff"
        opacity={0.96}
      />
      <g data-scenario={rest.scenario} data-rest-drawn={rest.rest}>
        {rest.scenario === 'bus-seats' ? (
          <StopArt x={400} y={top + 90} count={rest.rest} />
        ) : (
          <BagArt x={330} y={top} size={rest.size} filled={rest.rest} label={S.bagLabel} />
        )}
      </g>
    </CanvasAlignedOverlay>
  );
}
