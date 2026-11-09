/**
 * 힌트 ②: 학생 도형에서 일직선 위에 있는 못 구간을 굵게 잇고, 꺾이지 않는 못에
 * 작은 × 표시를 한다(MC-SHAPE-VERTEX-COUNT). 목표 도형은 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { collinear, gp } from '../../../core/math';
import { boardRect, pegPoint } from '../layout';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoConfig, GeoState, Peg } from '../types';

function pointOf(peg: Peg) {
  return gp(peg[0], peg[1]);
}

export function StraightRunOverlay({ state }: OverlayProps<GeoConfig, GeoState>) {
  if (state.mode !== 'geoboard') return null;
  const [cols, rows] = state.settings.grid;
  const rect = boardRect(cols, rows);

  const runs: {
    readonly key: string;
    readonly from: { readonly x: number; readonly y: number };
    readonly to: { readonly x: number; readonly y: number };
    readonly middle: { readonly x: number; readonly y: number };
  }[] = [];

  for (const band of state.bands) {
    if (!band.closed || band.pegs.length < 3) continue;
    band.pegs.forEach((peg, index) => {
      const previous = band.pegs[(index - 1 + band.pegs.length) % band.pegs.length];
      const next = band.pegs[(index + 1) % band.pegs.length];
      if (!previous || !next) return;
      if (!collinear(pointOf(previous), pointOf(peg), pointOf(next))) return;
      runs.push({
        key: `${band.id}-${index}`,
        from: pegPoint(rect, previous),
        to: pegPoint(rect, next),
        middle: pegPoint(rect, peg),
      });
    });
  }

  return (
    <CanvasAlignedOverlay
      testId="straight-run"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      {runs.map((run) => (
        <g key={run.key}>
          <line
            x1={run.from.x}
            y1={run.from.y}
            x2={run.to.x}
            y2={run.to.y}
            stroke="#e8872e"
            strokeWidth={11}
            strokeOpacity={0.8}
            strokeLinecap="round"
          />
          <path
            d={`M ${run.middle.x - 13} ${run.middle.y - 13} L ${run.middle.x + 13} ${run.middle.y + 13} M ${run.middle.x + 13} ${run.middle.y - 13} L ${run.middle.x - 13} ${run.middle.y + 13}`}
            stroke="#c2410c"
            strokeWidth={4}
            strokeLinecap="round"
          />
        </g>
      ))}
    </CanvasAlignedOverlay>
  );
}
