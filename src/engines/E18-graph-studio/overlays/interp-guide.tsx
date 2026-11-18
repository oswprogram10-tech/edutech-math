/**
 * 힌트 ② interp-guide (MC-GRAPH-NO-INTERPOLATE).
 *
 * 인덱스 `a`와 `a+1` 사이, 비율 `t`(0~1) 자리에 세로 점선을 긋고, 선분과 만나는 곳에 깜빡이는 표시를 둔다.
 * 동작 줄이기 설정이면 깜빡이지 않는다. 값은 쓰지 않는다.
 */
import { GraphOverlayFrame } from './frame';
import type { OverlayProps } from '../../../core/engine-sdk';
import { laneCenter, plotBottom, yOfValue } from '../line';
import type { GraphConfig, GraphState } from '../types';
import { CANVAS_SELECTOR } from './helpers';
import { argOf, lineScene, useReducedMotion } from './line-helpers';

const GUIDE = '#b45309';

export function InterpGuideOverlay({ state, args }: OverlayProps<GraphConfig, GraphState>) {
  const reduced = useReducedMotion();
  const rawA = argOf(args, 'a');
  const rawT = argOf(args, 't');
  return (
    <GraphOverlayFrame
      testId="interp-guide"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={1000}
      logicalHeight={700}
    >
      {(info) => {
        const scene = lineScene(state, info.width);
        if (!scene) return null;
        const { g, values } = scene;
        const a = typeof rawA === 'number' && Number.isInteger(rawA) ? rawA : -1;
        if (a < 0 || a + 1 >= scene.line.xs.length) return null;
        const t =
          typeof rawT === 'number' && Number.isFinite(rawT) ? Math.min(1, Math.max(0, rawT)) : 0.5;
        const x0 = laneCenter(g, a);
        const x1 = laneCenter(g, a + 1);
        const x = x0 + (x1 - x0) * t;
        const from = values[a];
        const to = values[a + 1];
        const y = from && to ? yOfValue(g, from) + (yOfValue(g, to) - yOfValue(g, from)) * t : null;
        return (
          <g>
            <line
              data-testid="interp-guide-line"
              x1={x}
              x2={x}
              y1={g.plot.y}
              y2={plotBottom(g)}
              stroke={GUIDE}
              strokeWidth={3}
              strokeDasharray="8 7"
            />
            {y !== null ? (
              <g data-testid="interp-guide-mark" data-blink={reduced ? 'off' : 'on'}>
                <circle cx={x} cy={y} r={14} fill="none" stroke={GUIDE} strokeWidth={4}>
                  {reduced ? null : (
                    <animate
                      attributeName="opacity"
                      values="1;0.2;1"
                      dur="1.2s"
                      repeatCount="indefinite"
                    />
                  )}
                </circle>
              </g>
            ) : null}
          </g>
        );
      }}
    </GraphOverlayFrame>
  );
}
