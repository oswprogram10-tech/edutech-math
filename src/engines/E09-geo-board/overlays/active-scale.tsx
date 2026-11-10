/**
 * 힌트 ②: 각도기에서 0°로 시작하는 트랙만 남기고 다른 트랙을 흐리게 덮는다.
 * 읽을 값 자리는 표시하지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import {
  alignmentOf,
  armDirections,
  currentAngle,
  launcherAlignment,
  normalizeDegrees,
} from '../modes/angle/observe';
import { ANGLE_VIEW, arcPath } from '../views/Protractor';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoConfig, GeoState } from '../types';

function nearestZero(
  arm: number,
  rotation: number,
): { readonly side: 'outer' | 'inner'; readonly gap: number } {
  const outer = Math.abs(normalizeDegrees(arm - rotation + 180) - 180);
  const inner = Math.abs(normalizeDegrees(arm - (rotation + 180) + 180) - 180);
  return outer <= inner ? { side: 'outer', gap: outer } : { side: 'inner', gap: inner };
}

export function ActiveScaleOverlay({ state }: OverlayProps<GeoConfig, GeoState>) {
  if (state.mode !== 'angle' || state.protractor.on === null) return null;
  const launcher = state.protractor.on === 'launcher';
  const alignment = launcher ? launcherAlignment(state.protractor.rotation) : alignmentOf(state);
  const arms = launcher ? [0] : [...armDirections(currentAngle(state))];
  let side = alignment.scale;
  if (side === null) {
    let best = { side: 'outer' as 'outer' | 'inner', gap: Number.POSITIVE_INFINITY };
    for (const arm of arms) {
      const found = nearestZero(arm, state.protractor.rotation);
      if (found.gap < best.gap) best = found;
    }
    side = best.side;
  }
  const center = launcher ? ANGLE_VIEW.launcher : ANGLE_VIEW.vertex;
  const radius = launcher ? 300 : ANGLE_VIEW.protractorRadius;
  const dimmedRadius = side === 'outer' ? radius * 0.755 : radius * 0.94;

  return (
    <CanvasAlignedOverlay
      testId="active-scale"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <path
        d={arcPath(center, dimmedRadius, state.protractor.rotation)}
        fill="none"
        stroke="#5b6577"
        strokeWidth={30}
        strokeOpacity={0.55}
      />
      <path
        d={arcPath(center, dimmedRadius, state.protractor.rotation)}
        fill="none"
        stroke="#ffffff"
        strokeWidth={30}
        strokeOpacity={0.18}
        strokeDasharray="4 8"
      />
      {side === 'outer' ? (
        <path
          d={arcPath(center, radius * 0.94, state.protractor.rotation)}
          fill="none"
          stroke="#1d4fa8"
          strokeWidth={26}
          strokeOpacity={0.18}
        />
      ) : (
        <path
          d={arcPath(center, radius * 0.755, state.protractor.rotation)}
          fill="none"
          stroke="#1d4fa8"
          strokeWidth={22}
          strokeOpacity={0.18}
        />
      )}
    </CanvasAlignedOverlay>
  );
}
