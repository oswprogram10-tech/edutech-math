/**
 * 힌트 ② `side-eye`: 상태 좌표의 +x 쪽(오른쪽에서 보는 시선)에 눈 아이콘과
 * 왼쪽을 향한 화살표, 그리고 그 눈에서 볼 때 왼쪽이 "앞"임을 알리는 큰 "앞" 표시를 그린다.
 * (MC-VIEW-SIDE-MIRROR). 투영은 그리지 않는다.
 */
import { CanvasAlignedOverlay, clamp } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { computeStageLayout, projectPoint, rotateContinuous } from '../layout';
import { useActiveRenderer } from '../renderer';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';
import { HelperDiagramBox } from './HelperDiagramBox';
import { CUBE_CANVAS_SELECTOR, useHelperOverlayMetrics } from './overlayMetrics';

export function SideEyeOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  const activeRenderer = useActiveRenderer();
  const [cols, rows] = state.settings.grid;
  const layout = computeStageLayout(cols, rows, state.settings.maxHeight);
  const overlayMetrics = useHelperOverlayMetrics(
    activeRenderer,
    layout.viewBox.width,
    layout.viewBox.height,
  );
  if (state.mode !== 'cubes') return null;

  const [eyeRx, eyeRy] = rotateContinuous(cols + 0.45, rows / 2, cols, rows, state.viewTurn);
  const [lookRx, lookRy] = rotateContinuous(cols - 0.15, rows / 2, cols, rows, state.viewTurn);
  const [frontRx, frontRy] = rotateContinuous(cols + 0.35, 0.35, cols, rows, state.viewTurn);

  const rawEye = projectPoint(layout, eyeRx, eyeRy, 0.6);
  const rawLook = projectPoint(layout, lookRx, lookRy, 0.6);
  const rawFront = projectPoint(layout, frontRx, frontRy, 0.4);

  const margin = 28;
  const eye = {
    x: clamp(rawEye.x, margin, layout.viewBox.width - margin),
    y: clamp(rawEye.y, margin, layout.viewBox.height - margin),
  };
  const dx = rawLook.x - rawEye.x;
  const dy = rawLook.y - rawEye.y;
  const len = Math.hypot(dx, dy) || 1;
  const arrowStart = { x: eye.x + (dx / len) * 20, y: eye.y + (dy / len) * 20 };
  const arrowTip = { x: eye.x + (dx / len) * 52, y: eye.y + (dy / len) * 52 };
  const front = {
    x: clamp(rawFront.x, margin, layout.viewBox.width - margin),
    y: clamp(rawFront.y, margin, layout.viewBox.height - margin),
  };

  const content = (
    <>
      <g transform={`translate(${eye.x}, ${eye.y})`}>
        <ellipse cx={0} cy={0} rx={18} ry={11} fill="#fff7ed" stroke="#c2410c" strokeWidth={2.5} />
        <circle cx={0} cy={0} r={5.5} fill="#c2410c" />
        <circle cx={-1.5} cy={-1.5} r={1.8} fill="#ffffff" />
      </g>

      <line
        x1={arrowStart.x}
        y1={arrowStart.y}
        x2={arrowTip.x}
        y2={arrowTip.y}
        stroke="#c2410c"
        strokeWidth={3.2}
        strokeLinecap="round"
        markerEnd="url(#e12-eye-arrow)"
      />

      <g transform={`translate(${front.x}, ${front.y})`}>
        <rect
          x={-20}
          y={-15}
          width={40}
          height={30}
          rx={8}
          fill="#ffedd5"
          stroke="#c2410c"
          strokeWidth={2.5}
        />
        <text x={0} y={6} textAnchor="middle" fontSize={18} fontWeight={800} fill="#9a3412">
          {S.front}
        </text>
      </g>
    </>
  );

  return (
    <CanvasAlignedOverlay
      testId="side-eye"
      canvasSelector={CUBE_CANVAS_SELECTOR}
      logicalWidth={overlayMetrics.logicalWidth}
      logicalHeight={overlayMetrics.logicalHeight}
    >
      <defs>
        <marker
          id="e12-eye-arrow"
          viewBox="0 0 10 10"
          refX={8}
          refY={5}
          markerWidth={6}
          markerHeight={6}
          orient="auto"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#c2410c" />
        </marker>
      </defs>
      {activeRenderer === '3d' ? (
        <HelperDiagramBox state={state} overlayMetrics={overlayMetrics}>
          {content}
        </HelperDiagramBox>
      ) : (
        content
      )}
    </CanvasAlignedOverlay>
  );
}
