/**
 * 3D 무대에서 힌트 ② 오버레이를 그릴 때 쓰는 왼쪽 위 "도움 그림" 상자.
 *
 * 3D 카메라는 학생이 자유 회전해 어긋날 수 있으므로 무대 위에 직접 겹쳐 그리지 않고,
 * viewBox 가로 45% 크기의 흰 바탕 둥근 상자 안에 현재 `viewTurn` 등각 그림과
 * 오버레이 표시를 축소해 넣는다.
 */
import type { ReactNode } from 'react';
import {
  computeStageLayout,
  cubeFaces,
  floorDiamond,
  pointsAttr,
  sortColumnsForPainter,
  sortCubesForPainter,
} from '../layout';
import { solid3dStrings as S } from '../strings.ko';
import type { CubesState } from '../types';

export const CUBE_CANVAS_SELECTOR =
  'svg[data-testid="cubes-canvas"], svg[data-testid="cubes-3d-canvas"]';

interface HelperDiagramBoxProps {
  readonly state: CubesState;
  readonly children: ReactNode;
}

export function HelperDiagramBox({ state, children }: HelperDiagramBoxProps) {
  const [cols, rows] = state.settings.grid;
  const layout = computeStageLayout(cols, rows, state.settings.maxHeight);
  const columns = sortColumnsForPainter(cols, rows, state.viewTurn);
  const paintedCubes = sortCubesForPainter(state.cubes, cols, rows, state.viewTurn);

  const boxX = 12;
  const boxY = 12;
  const boxWidth = layout.viewBox.width * 0.45;
  const headerH = 26;
  const padX = 8;
  const padBottom = 10;
  const innerWidth = boxWidth - padX * 2;
  const scale = innerWidth / layout.viewBox.width;
  const innerHeight = layout.viewBox.height * scale;
  const boxHeight = headerH + innerHeight + padBottom;

  return (
    <g data-testid="cubes-helper-diagram">
      <rect
        x={boxX}
        y={boxY}
        width={boxWidth}
        height={boxHeight}
        rx={12}
        fill="#ffffff"
        fillOpacity={0.96}
        stroke="#2f6fde"
        strokeWidth={2}
      />
      <text x={boxX + 12} y={boxY + 19} fontSize={13} fontWeight={800} fill="#1d4fa8">
        {S.helperDiagramTitle}
      </text>
      <g transform={`translate(${boxX + padX}, ${boxY + headerH}) scale(${scale})`}>
        {columns.map(({ x, y, rx, ry }) => (
          <polygon
            key={`helper-floor-${x}-${y}`}
            points={pointsAttr(floorDiamond(layout, rx, ry))}
            fill="#f1f5f9"
            stroke="#94a3b8"
            strokeWidth={1.2}
          />
        ))}
        {paintedCubes.map(({ cube, rx, ry }) => {
          const faces = cubeFaces(layout, rx, ry, cube.z);
          return (
            <g key={`helper-cube-${cube.x}-${cube.y}-${cube.z}`}>
              <polygon
                points={pointsAttr(faces.top)}
                fill="#f6ebd8"
                fillOpacity={0.35}
                stroke="#64748b"
                strokeWidth={1.2}
              />
              <polygon
                points={pointsAttr(faces.front)}
                fill="#e4cda7"
                fillOpacity={0.35}
                stroke="#64748b"
                strokeWidth={1.2}
              />
              <polygon
                points={pointsAttr(faces.right)}
                fill="#cca978"
                fillOpacity={0.35}
                stroke="#64748b"
                strokeWidth={1.2}
              />
            </g>
          );
        })}
        {children}
      </g>
    </g>
  );
}
