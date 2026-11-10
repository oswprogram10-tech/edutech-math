/**
 * 힌트 ②: 각도기 0° 선과 가장 가까운 변 사이의 틈을 빨강 빗금 부채꼴로 칠한다.
 * 맞춤이면 아무것도 그리지 않는다.
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
import { ANGLE_VIEW, sectorPath } from '../views/Protractor';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoConfig, GeoState } from '../types';

export function ZeroGapOverlay({ state }: OverlayProps<GeoConfig, GeoState>) {
  if (state.mode !== 'angle' || state.protractor.on === null) return null;
  const launcher = state.protractor.on === 'launcher';
  const alignment = launcher ? launcherAlignment(state.protractor.rotation) : alignmentOf(state);
  if (alignment.aligned) return null;
  const arms = launcher ? [0] : [...armDirections(currentAngle(state))];
  const rotation = state.protractor.rotation;
  let best: { readonly arm: number; readonly gap: number; readonly zero: number } | null = null;
  for (const arm of arms) {
    const candidates = [rotation, normalizeDegrees(rotation + 180)];
    for (const zero of candidates) {
      const raw = normalizeDegrees(arm - zero);
      const gap = Math.min(raw, 360 - raw);
      if (best === null || gap < best.gap) best = { arm, gap, zero };
    }
  }
  if (best === null) return null;
  let sweep = normalizeDegrees(best.arm - best.zero);
  if (sweep > 180) sweep -= 360;
  const center = launcher ? ANGLE_VIEW.launcher : ANGLE_VIEW.vertex;
  const radius = launcher ? 300 : ANGLE_VIEW.protractorRadius;

  return (
    <CanvasAlignedOverlay
      testId="zero-gap"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <pattern
          id="zero-gap-hatch"
          width={16}
          height={16}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={16} stroke="#c2410c" strokeWidth={4} />
        </pattern>
      </defs>
      <path
        d={sectorPath(center, radius * 0.74, best.zero, sweep)}
        fill="url(#zero-gap-hatch)"
        fillOpacity={0.45}
        stroke="#c2410c"
        strokeWidth={3}
      />
    </CanvasAlignedOverlay>
  );
}
