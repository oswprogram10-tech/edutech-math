/**
 * 3D 무대에서 힌트 ② 오버레이를 그릴 때 쓰는 왼쪽 위 "도움 그림" 상자.
 *
 * 3D 무대는 `cubes-3d-canvas`가 무대 크기(`width × height`)를 1:1로 채우므로,
 * 3D 오버레이도 실제 무대 픽셀 크기와 같은 논리 좌표로 그려 왼쪽 위에 바로 붙고,
 * 화면에서 무대 짧은 변의 40%를 넘지 않으며 제목 글자가 14px 이상 되도록 맞춘다.
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
import type { HelperOverlayMetrics } from './overlayMetrics';

const MIN_TITLE_PX = 14.5;

interface HelperDiagramBoxProps {
  readonly state: CubesState;
  readonly overlayMetrics: HelperOverlayMetrics;
  readonly children: ReactNode;
}

export function HelperDiagramBox({ state, overlayMetrics, children }: HelperDiagramBoxProps) {
  const [cols, rows] = state.settings.grid;
  const layout = computeStageLayout(cols, rows, state.settings.maxHeight);
  const columns = sortColumnsForPainter(cols, rows, state.viewTurn);
  const paintedCubes = sortCubesForPainter(state.cubes, cols, rows, state.viewTurn);

  // `overlayMetrics`가 실제 무대 px 크기일 때는 stageScale = 1, 폴백 viewBox일 때는 비율로 나눈다.
  const stageScale =
    typeof document !== 'undefined'
      ? (() => {
          const el = document.querySelector('svg[data-testid="cubes-3d-canvas"]');
          if (!(el instanceof SVGSVGElement)) return 1;
          const rect = el.getBoundingClientRect();
          if (rect.width < 1 || rect.height < 1) return 1;
          return Math.min(
            rect.width / overlayMetrics.logicalWidth,
            rect.height / overlayMetrics.logicalHeight,
          );
        })()
      : 1;

  const shortSide = Math.min(overlayMetrics.logicalWidth, overlayMetrics.logicalHeight);
  const strokeWidth = 2 / stageScale;
  const maxBoxSize = Math.max(40, shortSide * 0.4 - strokeWidth);
  const boxX = 12 / stageScale;
  const boxY = 12 / stageScale;
  const titleFontSize = MIN_TITLE_PX / stageScale;
  const headerH = Math.ceil(titleFontSize * 1.45) + 6 / stageScale;
  const padX = 8 / stageScale;
  const padBottom = 8 / stageScale;

  const maxInnerW = Math.max(24, maxBoxSize - padX * 2);
  const maxInnerH = Math.max(24, maxBoxSize - headerH - padBottom);
  const scale = Math.min(maxInnerW / layout.viewBox.width, maxInnerH / layout.viewBox.height);
  const innerWidth = layout.viewBox.width * scale;
  const innerHeight = layout.viewBox.height * scale;

  const minLabelWidth = Math.min(maxBoxSize, 108 / stageScale);
  const boxWidth = Math.min(maxBoxSize, Math.max(innerWidth + padX * 2, minLabelWidth));
  const boxHeight = Math.min(maxBoxSize, headerH + innerHeight + padBottom);
  const diagramOffsetX = boxX + (boxWidth - innerWidth) / 2;

  return (
    <g data-testid="cubes-helper-diagram">
      <rect
        x={boxX}
        y={boxY}
        width={boxWidth}
        height={boxHeight}
        rx={12 / stageScale}
        fill="#ffffff"
        fillOpacity={0.92}
        stroke="#2f6fde"
        strokeWidth={strokeWidth}
      />
      <text
        x={boxX + 10 / stageScale}
        y={boxY + titleFontSize + 5 / stageScale}
        fontSize={titleFontSize}
        fontWeight={800}
        fill="#1d4fa8"
        data-testid="cubes-helper-title"
      >
        {S.helperDiagramTitle}
      </text>
      <g transform={`translate(${diagramOffsetX}, ${boxY + headerH}) scale(${scale})`}>
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
