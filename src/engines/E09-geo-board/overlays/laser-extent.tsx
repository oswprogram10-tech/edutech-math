/**
 * 힌트 ②: 학생이 그린 객체마다 끝이 없는 쪽에 화살표 레이저, 끝이 있는 쪽에
 * 끝점 점을 그린다(MC-GEO-RAY-LINE-CONFUSE). 새 도형을 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { boardRect, extensionSegment, pegPoint } from '../layout';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoConfig, GeoState } from '../types';

export function LaserExtentOverlay({ state }: OverlayProps<GeoConfig, GeoState>) {
  if (state.mode !== 'construct') return null;
  const { grid } = state.settings;
  const rect = boardRect(grid, grid);

  return (
    <CanvasAlignedOverlay
      testId="laser-extent"
      canvasSelector={'svg[data-testid="geo-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <defs>
        <marker
          id="e09-laser-extent-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 Z" fill="#e8872e" />
        </marker>
      </defs>
      {state.objects.map((object) => {
        const from = pegPoint(rect, object.from);
        const to = pegPoint(rect, object.to);
        const extension =
          object.kind === 'segment' ? null : extensionSegment(from, to, object.kind);
        const ends: { readonly x: number; readonly y: number }[] = [];
        if (object.kind === 'segment') ends.push(from, to);
        if (object.kind === 'ray') ends.push(from);
        return (
          <g key={object.id}>
            {extension ? (
              <line
                x1={extension.start.x}
                y1={extension.start.y}
                x2={extension.end.x}
                y2={extension.end.y}
                stroke="#e8872e"
                strokeWidth={6}
                strokeOpacity={0.5}
                strokeDasharray="16 10"
                markerEnd="url(#e09-laser-extent-arrow)"
                markerStart={object.kind === 'line' ? 'url(#e09-laser-extent-arrow)' : undefined}
              />
            ) : null}
            {ends.map((point, index) => (
              <circle
                key={`${object.id}-end-${index}`}
                cx={point.x}
                cy={point.y}
                r={9}
                fill="#ffffff"
                stroke="#1d2330"
                strokeWidth={3}
              />
            ))}
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}
