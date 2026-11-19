/**
 * 힌트 ② band-frame (MC-GRAPH-PERCENT-AS-COUNT).
 *
 * 100칸 띠 틀을 굵게 강조한다. 칸이 모자라면 남은 칸을 점선 빈칸으로, 넘치면 틀 밖의 넘친 칸을
 * 빨간 빗금과 ✕로 보인다. 색만으로 구별하지 않고(점선·빗금·✕), 글자와 숫자는 쓰지 않는다.
 * 지금 띠(말기 정도 포함)와 같은 모양을 그리므로 그래프 SVG와 1px 안에서 맞는다.
 */
import { useId } from 'react';
import type { OverlayProps } from '../../../core/engine-sdk';
import { BAND_CELLS, bandFrameOf, pointAt, regionPath } from '../band-circle';
import { bandCellsOf } from '../observe';
import type { GraphConfig, GraphState } from '../types';
import { CANVAS_SELECTOR } from './helpers';
import { GraphOverlayFrame } from './frame';

const FRAME = '#b45309';
const OVER = '#c62828';

export function BandFrameOverlay({ state }: OverlayProps<GraphConfig, GraphState>) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const hatchId = `band-frame-hatch-${uid}`;
  return (
    <GraphOverlayFrame
      testId="band-frame"
      canvasSelector={CANVAS_SELECTOR}
      logicalWidth={1000}
      logicalHeight={760}
    >
      {(info) => {
        if (state.mode !== 'band-circle') return null;
        const frame = bandFrameOf(
          state.settings.bandCircle?.compare != null,
          info.height > info.width,
        );
        const curl = state.curl;
        const cells = bandCellsOf(state);
        const sum = state.settings.categories.reduce((total, cat) => total + (cells[cat] ?? 0), 0);
        const missing = sum < BAND_CELLS ? regionPath(frame, curl, sum / BAND_CELLS, 1) : '';
        const over = sum > BAND_CELLS ? regionPath(frame, curl, 1, sum / BAND_CELLS) : '';
        // 곧은 띠에서 넘친 칸이 그림 밖으로 길게 나가면 ✕는 보이는 부분의 가운데에 둔다.
        const visibleEnd =
          curl === 0 ? (frame.width - 20 - frame.band.x) / frame.band.length : Infinity;
        const crossU = (1 + Math.min(sum / BAND_CELLS, Math.max(1, visibleEnd))) / 2;
        const cross = sum > BAND_CELLS ? pointAt(frame, curl, crossU, 0.5) : null;
        return (
          <g>
            <defs>
              <pattern
                id={hatchId}
                patternUnits="userSpaceOnUse"
                width={10}
                height={10}
                patternTransform="rotate(45)"
              >
                <rect width={4} height={10} fill={OVER} />
              </pattern>
            </defs>
            <path
              d={regionPath(frame, curl, 0, 1)}
              fill="none"
              stroke={FRAME}
              strokeWidth={9}
              strokeLinejoin="round"
              data-testid="band-frame-line"
            />
            {missing !== '' ? (
              <path
                d={missing}
                fill="none"
                stroke={FRAME}
                strokeWidth={4}
                strokeDasharray="10 8"
                strokeLinejoin="round"
                data-testid="band-frame-missing"
              />
            ) : null}
            {over !== '' ? (
              <path
                d={over}
                fill={`url(#${hatchId})`}
                stroke={OVER}
                strokeWidth={4}
                strokeLinejoin="round"
                data-testid="band-frame-over"
              />
            ) : null}
            {cross !== null ? (
              <g data-testid="band-frame-cross" stroke={OVER} strokeWidth={7} strokeLinecap="round">
                <line x1={cross.x - 14} y1={cross.y - 14} x2={cross.x + 14} y2={cross.y + 14} />
                <line x1={cross.x - 14} y1={cross.y + 14} x2={cross.x + 14} y2={cross.y - 14} />
              </g>
            ) : null}
          </g>
        );
      }}
    </GraphOverlayFrame>
  );
}
