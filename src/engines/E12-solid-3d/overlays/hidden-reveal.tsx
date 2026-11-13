/**
 * 힌트 ② `hidden-reveal`: 현재 방향에서 다른 쌓기나무에 완전히 가려진 쌓기나무만
 * 점선 윤곽 + 빗금으로 그린다(MC-3D-HIDDEN-UNCOUNTED). 학생 모양만 사용한다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { computeStageLayout, cubeFaces, pointsAttr, sortCubesForPainter } from '../layout';
import type { SolidConfig, SolidState } from '../types';
import { findHiddenCubes } from '../voxel';

export function HiddenRevealOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  if (state.mode !== 'cubes') return null;
  const [cols, rows] = state.settings.grid;
  const layout = computeStageLayout(cols, rows, state.settings.maxHeight);
  const hiddenCoords = findHiddenCubes(state.cubes, cols, rows, state.viewTurn);
  const painted = sortCubesForPainter(
    hiddenCoords.map(([x, y, z]) => ({ x, y, z })),
    cols,
    rows,
    state.viewTurn,
  );

  return (
    <CanvasAlignedOverlay
      testId="hidden-reveal"
      canvasSelector={'svg[data-testid="cubes-canvas"]'}
      logicalWidth={layout.viewBox.width}
      logicalHeight={layout.viewBox.height}
    >
      <defs>
        <pattern
          id="e12-hidden-hatch"
          width={8}
          height={8}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={8} stroke="#c2410c" strokeWidth={2.5} />
        </pattern>
      </defs>
      {painted.map(({ cube, rx, ry }) => {
        const faces = cubeFaces(layout, rx, ry, cube.z);
        return (
          <g
            key={`hidden-${cube.x}-${cube.y}-${cube.z}`}
            data-hidden-cube={`${cube.x},${cube.y},${cube.z}`}
          >
            <polygon
              points={pointsAttr(faces.top)}
              fill="url(#e12-hidden-hatch)"
              fillOpacity={0.5}
              stroke="#c2410c"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              strokeLinejoin="round"
            />
            <polygon
              points={pointsAttr(faces.front)}
              fill="url(#e12-hidden-hatch)"
              fillOpacity={0.5}
              stroke="#c2410c"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              strokeLinejoin="round"
            />
            <polygon
              points={pointsAttr(faces.right)}
              fill="url(#e12-hidden-hatch)"
              fillOpacity={0.5}
              stroke="#c2410c"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}
