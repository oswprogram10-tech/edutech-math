/**
 * 힌트 ②(MC-GEO-DIAGONAL-COUNT-DOUBLE): 학생이 그은 대각선마다 양 끝에서
 * 가운데로 오는 화살표 두 개를 그려 "한 선분"임을 보여 준다.
 * 중복으로 거절한 대각선이면 그 선을 강조하고 "같은 선분 하나" 글자를 붙인다.
 * 전체 대각선 수는 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { currentPolygon, drawnPairs } from '../modes/diagonal/reduce';
import { vertexPoint } from '../modes/diagonal/observe';
import type { DiagonalPair } from '../modes/diagonal/types';
import { geoBoardStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoConfig, GeoState } from '../types';

function lerp(
  a: { readonly x: number; readonly y: number },
  b: { readonly x: number; readonly y: number },
  t: number,
): { readonly x: number; readonly y: number } {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function pairKey(pair: DiagonalPair): string {
  return `${pair[0]}-${pair[1]}`;
}

export function MergeBeamsOverlay({ state }: OverlayProps<GeoConfig, GeoState>) {
  if (state.mode !== 'diagonal') return null;
  const n = currentPolygon(state);
  const drawn = drawnPairs(state, n);
  const rejected = state.lastRejected;
  const duplicate =
    rejected && rejected.reason === 'duplicate' && rejected.n === n ? rejected.pair : null;

  if (drawn.length === 0 && duplicate === null) return null;

  const beam = (pair: DiagonalPair, highlight: boolean) => {
    const from = vertexPoint(n, pair[0]);
    const to = vertexPoint(n, pair[1]);
    const middle = lerp(from, to, 0.5);
    const arrows = [lerp(from, middle, 0.28), lerp(to, middle, 0.28)];
    return (
      <g key={`beam-${pairKey(pair)}${highlight ? '-duplicate' : ''}`} pointerEvents="none">
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={highlight ? '#c2410c' : '#2f6fde'}
          strokeWidth={highlight ? 8 : 4}
          strokeOpacity={highlight ? 0.85 : 0.3}
          strokeLinecap="round"
          strokeDasharray={highlight ? '14 8' : undefined}
        />
        {arrows.map((end, index) => {
          const start = lerp(index === 0 ? from : to, middle, 0.06);
          return (
            <line
              key={`arrow-${index}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke={highlight ? '#c2410c' : '#2f6fde'}
              strokeWidth={highlight ? 7 : 5}
              strokeLinecap="round"
              markerEnd={highlight ? 'url(#merge-beams-arrow-red)' : 'url(#merge-beams-arrow)'}
            />
          );
        })}
        {highlight ? (
          <text
            x={middle.x}
            y={middle.y - 20}
            textAnchor="middle"
            fontSize={22}
            fontWeight={800}
            fill="#c2410c"
          >
            {S.diagonal.mergeText}
          </text>
        ) : null}
      </g>
    );
  };

  return (
    <CanvasAlignedOverlay
      testId="merge-beams"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <marker
          id="merge-beams-arrow"
          viewBox="0 0 10 10"
          refX={8}
          refY={5}
          markerWidth={6}
          markerHeight={6}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 Z" fill="#2f6fde" />
        </marker>
        <marker
          id="merge-beams-arrow-red"
          viewBox="0 0 10 10"
          refX={8}
          refY={5}
          markerWidth={6}
          markerHeight={6}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 Z" fill="#c2410c" />
        </marker>
      </defs>
      {drawn.map((pair) => beam(pair, duplicate !== null && pairKey(pair) === pairKey(duplicate)))}
      {duplicate && !drawn.some((pair) => pairKey(pair) === pairKey(duplicate))
        ? beam(duplicate, true)
        : null}
    </CanvasAlignedOverlay>
  );
}
