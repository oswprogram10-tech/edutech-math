/**
 * 힌트 ② same-time.
 * 두 캐릭터 중 시간이 짧은 쪽의 시간 t에서 두 캐릭터가 있을 위치에 세로 점선을 긋고 "같은 시간"이라고 쓴다.
 * 점선 사이가 곧 같은 시간 동안 간 거리의 차이다. 값(거리·속력)은 쓰지 않는다.
 */
import { Rational } from '../../../core/math';
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { LANE, laneY, trackX } from '../layout';
import { E20_STRINGS as S } from '../strings.ko';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { RatioConfig, RatioState } from '../types';

const INK = '#1d2330';
const COLORS = ['#2f6fde', '#c76a12'] as const;

export function SameTimeOverlay({ state }: OverlayProps<RatioConfig, RatioState>) {
  if (state.mode !== 'rate' || state.error !== null) return null;
  const [first, second] = state.racers;
  if (!first || !second) return null;
  if (first.distance === null || first.time === null) return null;
  if (second.distance === null || second.time === null) return null;
  const t = Math.min(first.time, second.time);
  const { look, maxDistance } = state.settings;
  const xs = [first, second].map((racer) =>
    trackX(Rational.of((racer.distance ?? 0) * t, racer.time ?? 1), maxDistance),
  );
  const top = laneY(look, 0) - LANE.halfH - 6;
  const bottom = laneY(look, 1) + LANE.halfH + 6;
  const labelY = top - 38;
  const mid = ((xs[0] ?? 0) + (xs[1] ?? 0)) / 2;
  return (
    <CanvasAlignedOverlay
      testId="overlay-same-time"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      {xs.map((x, index) => (
        <line
          key={index}
          x1={x}
          y1={top}
          x2={x}
          y2={bottom}
          stroke={COLORS[index] ?? INK}
          strokeWidth={4}
          strokeDasharray="10 6"
          data-part="time-line"
          data-racer={state.racers[index]?.id}
          data-x={x}
        />
      ))}
      <rect
        x={mid - 62}
        y={labelY - 24}
        width={124}
        height={32}
        rx={8}
        fill="#ffffff"
        stroke={INK}
        strokeWidth={2}
      />
      <text
        x={mid}
        y={labelY}
        textAnchor="middle"
        fontSize={22}
        fontWeight={800}
        fill={INK}
        data-part="same-time-label"
      >
        {S.rate.overlay.sameTime}
      </text>
    </CanvasAlignedOverlay>
  );
}
