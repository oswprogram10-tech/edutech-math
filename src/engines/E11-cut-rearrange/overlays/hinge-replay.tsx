/**
 * 힌트 ② `hinge-replay` (MC-AREA-TRIANGLE-NO-HALF).
 *
 * `lastHinge`가 있으면 그 조각의 경첩 전 모습(점선)에서 지금 모습까지 돌아가는
 * 호 화살표를 그린다. 없으면 학생의 첫 조각 옆에 같은 모양의 점선 사본과 경첩 점
 * 표시만 그린다. 붙인 결과(정답 도형)는 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { pointReflect } from '../../../core/math';
import { fromG, toG } from '../rpoint';
import type { RPoint } from '../rpoint';
import { boardPoint, boardPoints, centroid, curvedArrow, pointsAttribute } from '../layout';
import { cutStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { CutConfig, CutState } from '../types';

const PURPLE = '#7c3aed';

export function HingeReplayOverlay({ state }: OverlayProps<CutConfig, CutState>) {
  if (state.mode !== 'slice' && state.mode !== 'formula-derive') return null;

  const hinged = state.lastHinge
    ? (state.pieces.find((piece) => piece.id === state.lastHinge?.piece) ?? null)
    : null;

  if (state.lastHinge && hinged) {
    const at = toG(state.lastHinge.at);
    const before: RPoint[] = hinged.vertices.map((vertex) => fromG(pointReflect(toG(vertex), at)));
    const beforeScreen = boardPoints(before);
    const currentScreen = boardPoints(hinged.vertices);
    const atScreen = boardPoint(state.lastHinge.at);
    const fromCenter = centroid(beforeScreen);
    const toCenter = centroid(currentScreen);

    return (
      <CanvasAlignedOverlay
        testId="hinge-replay"
        canvasSelector={'svg[data-testid="cut-canvas"]'}
        logicalWidth={LOGICAL_WIDTH}
        logicalHeight={LOGICAL_HEIGHT}
      >
        <defs>
          <marker
            id="hinge-arrow"
            viewBox="0 0 10 10"
            refX={8}
            refY={5}
            markerWidth={7}
            markerHeight={7}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={PURPLE} />
          </marker>
        </defs>
        <polygon
          points={pointsAttribute(beforeScreen)}
          fill={PURPLE}
          fillOpacity={0.08}
          stroke={PURPLE}
          strokeWidth={4}
          strokeDasharray="12 8"
          strokeLinejoin="round"
        />
        <polygon
          points={pointsAttribute(currentScreen)}
          fill="none"
          stroke={PURPLE}
          strokeWidth={3}
          strokeOpacity={0.55}
          strokeLinejoin="round"
        />
        <path
          d={curvedArrow(fromCenter, toCenter, 60)}
          fill="none"
          stroke={PURPLE}
          strokeWidth={4}
          markerEnd="url(#hinge-arrow)"
          data-hinge-arrow="true"
        />
        <circle cx={atScreen.x} cy={atScreen.y} r={10} fill={PURPLE} />
        <circle
          cx={atScreen.x}
          cy={atScreen.y}
          r={18}
          fill="none"
          stroke={PURPLE}
          strokeWidth={3}
          strokeDasharray="5 4"
        />
        <title>{S.overlays.hingeReplay}</title>
      </CanvasAlignedOverlay>
    );
  }

  const first = state.pieces[0];
  if (!first) return null;
  const screen = boardPoints(first.vertices);
  const center = centroid(screen);
  const width =
    Math.max(...screen.map((point) => point.x)) - Math.min(...screen.map((point) => point.x));
  const offset = Math.max(60, width + 40);
  const ghost = screen.map((point) => ({ x: point.x + offset, y: point.y }));
  const ghostFirst = ghost[0];
  const ghostSecond = ghost[1];
  const hinge =
    ghostFirst && ghostSecond
      ? { x: (ghostFirst.x + ghostSecond.x) / 2, y: (ghostFirst.y + ghostSecond.y) / 2 }
      : { x: center.x + offset, y: center.y };

  return (
    <CanvasAlignedOverlay
      testId="hinge-replay"
      canvasSelector={'svg[data-testid="cut-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <polygon
        points={pointsAttribute(screen)}
        fill="none"
        stroke={PURPLE}
        strokeWidth={2.5}
        strokeOpacity={0.45}
        strokeDasharray="8 6"
        strokeLinejoin="round"
      />
      <polygon
        points={pointsAttribute(ghost)}
        fill={PURPLE}
        fillOpacity={0.08}
        stroke={PURPLE}
        strokeWidth={3.5}
        strokeDasharray="12 8"
        strokeLinejoin="round"
      />
      <circle cx={hinge.x} cy={hinge.y} r={9} fill={PURPLE} />
      <circle
        cx={hinge.x}
        cy={hinge.y}
        r={17}
        fill="none"
        stroke={PURPLE}
        strokeWidth={3}
        strokeDasharray="5 4"
      />
      <title>{S.overlays.hingeReplay}</title>
    </CanvasAlignedOverlay>
  );
}
