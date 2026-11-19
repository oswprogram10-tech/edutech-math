/**
 * 힌트 ② zero-axis (MC-GRAPH-TRUNCATED-AXIS).
 *
 * 지금 막대 옆에 0부터 그린 같은 막대를 낮은 불투명도로 겹쳐 보이고, 세로축 0 자리(맨 아래 선)에 굵은 표시를 둔다.
 * 0부터 그린 막대는 같은 그림판의 키(맨 위 눈금 값)를 가득 쓰는 한 장의 눈금으로 그린다. 값 글자는 쓰지 않는다.
 * 늘어나는 애니메이션은 300ms 이하이고, 동작 줄이기 설정이면 바로 나타난다.
 * 막대 그림판(내 그래프·막대 예시)에서만 그리고 원그래프 예시에서는 그리지 않는다.
 */
import { useId } from 'react';
import type { OverlayProps } from '../../../core/engine-sdk';
import { currentScene } from '../distortion';
import { bandCenter, bandLength, barThickness, valuePosition } from '../layout';
import type { GraphConfig, GraphState } from '../types';
import { CANVAS_SELECTOR } from './helpers';
import { GraphOverlayFrame } from './frame';

const MARK = '#b45309';
const ZERO_BAR = '#b45309';

export function ZeroAxisOverlay({ state }: OverlayProps<GraphConfig, GraphState>) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const grow = `zero-axis-grow-${uid}`;
  const bar = `zero-axis-bar-${uid}`;
  return (
    <GraphOverlayFrame
      testId="zero-axis"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={1000}
      logicalHeight={700}
    >
      {(() => {
        if (state.mode !== 'distortion') return null;
        const scene = currentScene(state);
        if (scene === null || !(scene.topValue > 0)) return null;
        const { frame } = scene;
        const plot = frame.plot;
        const baseline = valuePosition(frame, 0);
        const thickness = barThickness(frame);
        const room = (bandLength(frame) - thickness) / 2 - 10;
        const width = Math.max(8, Math.min(thickness * 0.4, room));
        return (
          <g>
            <style>{`
              @keyframes ${grow} { from { transform: scaleY(0); } to { transform: scaleY(1); } }
              .${bar} { transform-box: fill-box; transform-origin: bottom; animation: ${grow} 280ms ease-out; }
              @media (prefers-reduced-motion: reduce) { .${bar} { animation: none; } }
            `}</style>
            {scene.bars.map((item, index) => {
              const height = Math.min(1, item.value / scene.topValue) * plot.height;
              if (!(height > 0)) return null;
              const x = bandCenter(frame, index) + thickness / 2 + 6;
              return (
                <rect
                  key={item.cat}
                  className={bar}
                  x={x}
                  y={baseline - height}
                  width={width}
                  height={height}
                  fill={ZERO_BAR}
                  fillOpacity={0.35}
                  stroke={ZERO_BAR}
                  strokeWidth={2.5}
                  strokeOpacity={0.7}
                  data-testid="zero-axis-bar"
                  data-cat={item.cat}
                />
              );
            })}
            <line
              x1={plot.x - 12}
              x2={plot.x + plot.width}
              y1={baseline}
              y2={baseline}
              stroke={MARK}
              strokeWidth={8}
              strokeOpacity={0.85}
              data-testid="zero-axis-line"
            />
          </g>
        );
      })()}
    </GraphOverlayFrame>
  );
}
