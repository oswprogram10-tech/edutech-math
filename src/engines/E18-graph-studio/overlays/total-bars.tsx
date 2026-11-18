/**
 * 힌트 ② total-bars (MC-GRAPH-AREA-AS-AMOUNT).
 *
 * 전체 수가 다른 두 원그래프(`compare`)가 모두 보일 때, 두 원 아래에 전체 수에 비례하는 가로 막대를 놓는다.
 * 숫자는 쓰지 않는다. `compare`가 없거나 원그래프가 아니면 그리지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { bandFrameOf } from '../band-circle';
import type { GraphConfig, GraphState } from '../types';
import { CANVAS_SELECTOR } from './helpers';
import { GraphOverlayFrame } from './frame';

const BAR = '#1d4fa8';
const BAR_HEIGHT = 24;
const GAP = 28;

export function TotalBarsOverlay({ state }: OverlayProps<GraphConfig, GraphState>) {
  return (
    <GraphOverlayFrame
      testId="total-bars"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={1000}
      logicalHeight={730}
    >
      {(info) => {
        if (state.mode !== 'band-circle' || state.curl < 100) return null;
        const compare = state.settings.bandCircle?.compare ?? null;
        if (compare === null) return null;
        const frame = bandFrameOf(true, info.height > info.width);
        if (frame.compare === null) return null;
        const totals = [
          {
            key: 'main',
            total: state.settings.bandCircle?.total ?? 0,
            cx: frame.pie.cx,
            cy: frame.pie.cy,
          },
          { key: 'compare', total: compare.total, cx: frame.compare.cx, cy: frame.compare.cy },
        ];
        const most = Math.max(1, ...totals.map((item) => item.total));
        const longest = frame.pie.r * 1.8;
        return (
          <g>
            {totals.map((item) => {
              const width = (longest * item.total) / most;
              const y = item.cy + frame.pie.r + GAP;
              return (
                <rect
                  key={item.key}
                  x={item.cx - width / 2}
                  y={y}
                  width={width}
                  height={BAR_HEIGHT}
                  rx={6}
                  fill={BAR}
                  stroke="#ffffff"
                  strokeWidth={2}
                  data-testid="total-bar"
                  data-bar={item.key}
                  data-total={item.total}
                />
              );
            })}
          </g>
        );
      }}
    </GraphOverlayFrame>
  );
}
