/**
 * 힌트 ② footprints (MC-RATE-DISTANCE-ONLY).
 * 두 트랙에 1초마다 발자국을 찍은 정지 그림이다. 처음 3초만 그린다. 거리·속력 글은 쓰지 않는다.
 * 같은 1초 동안 어느 쪽 발자국이 더 멀리 가는지 눈으로 비교하게 한다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { LANE, distanceAtSecond, laneY, trackX } from '../layout';
import { CANVAS_SELECTOR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { RatioConfig, RatioState } from '../types';

const SECONDS = [1, 2, 3] as const;
const COLORS = ['#2f6fde', '#c76a12'] as const;

export function FootprintsOverlay({ state }: OverlayProps<RatioConfig, RatioState>) {
  if (state.mode !== 'rate' || state.error !== null) return null;
  const { look, maxDistance } = state.settings;
  return (
    <CanvasAlignedOverlay
      testId="overlay-footprints"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      {state.racers.map((racer, index) => {
        const cy = laneY(look, index);
        const color = COLORS[index] ?? COLORS[0];
        return (
          <g key={racer.id} data-part="footprint-lane" data-racer={racer.id}>
            {SECONDS.map((second) => {
              const distance = distanceAtSecond(racer, second);
              if (distance === null) return null;
              const x = trackX(distance, maxDistance);
              return (
                <g key={second} data-part="footprint" data-second={second} data-x={x}>
                  <line
                    x1={x}
                    y1={cy - LANE.halfH}
                    x2={x}
                    y2={cy + LANE.halfH}
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                  <ellipse cx={x} cy={cy + 16} rx={4.5} ry={5.5} fill={color} stroke="#ffffff" />
                  <circle cx={x - 5} cy={cy + 7} r={2} fill={color} />
                  <circle cx={x} cy={cy + 5} r={2} fill={color} />
                  <circle cx={x + 5} cy={cy + 7} r={2} fill={color} />
                </g>
              );
            })}
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}
