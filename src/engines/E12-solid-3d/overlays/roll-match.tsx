/**
 * 힌트 ② `roll-match` (MC-CYL-NET-WIDTH-DIAMETER):
 * 밑면 원이 한 바퀴 굴러 바닥에 남긴 선과, 그 아래 나란히 놓은 지름 막대를 그린다.
 * 지름 막대가 한 바퀴 선보다 훨씬 짧은 것이 보이면 된다. 수는 쓰지 않는다.
 *
 * - `roll` 단계: 굴리기 무대 svg와 같은 좌표(바닥선 아래)에 그린다.
 * - `assemble` 단계: 전개도 판 svg와 같은 좌표(판 아래 칸, 옆면 가로 왼쪽 끝부터)에 그린다.
 * - 앵커는 늘 svg다(div를 가리키면 판 전체로 펼쳐진다).
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { circumference, halves, parsePi, tenths } from '../cylnet/model';
import {
  BOARD_BOTTOM,
  BOARD_H,
  BOARD_W,
  barStartX,
  boardGeometry,
  ROLL_H,
  ROLL_W,
  rollGeometry,
  toPx,
} from '../cylnet/layout';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';

const ROUND = '#c2410c';
const DIAMETER = '#1d4fa8';

interface BarsProps {
  readonly x: number;
  readonly roundLen: number;
  readonly diameterLen: number;
  readonly roundY: number;
  readonly diameterY: number;
}

function Bars({ x, roundLen, diameterLen, roundY, diameterY }: BarsProps) {
  return (
    <g data-testid="roll-match-bars">
      <text
        x={x}
        y={roundY - 9}
        fontSize={16}
        fontWeight={800}
        fill={ROUND}
        data-testid="roll-match-round-label"
      >
        {S.cylNet.overlay.rollMatchRound}
      </text>
      <rect
        data-testid="roll-match-round"
        x={x}
        y={roundY - 4}
        width={roundLen}
        height={8}
        rx={4}
        fill={ROUND}
      />
      <text
        x={x}
        y={diameterY - 9}
        fontSize={16}
        fontWeight={800}
        fill={DIAMETER}
        data-testid="roll-match-diameter-label"
      >
        {S.cylNet.overlay.rollMatchDiameter}
      </text>
      <rect
        data-testid="roll-match-diameter"
        x={x}
        y={diameterY - 4}
        width={diameterLen}
        height={8}
        fill={DIAMETER}
        fillOpacity={0.9}
      />
    </g>
  );
}

export function RollMatchOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  if (state.mode !== 'cylinder-net' || state.step === null) return null;

  if (state.step === 'roll') {
    const { settings } = state;
    const g = rollGeometry(
      halves(settings.radiusHalves),
      halves(settings.heightHalves),
      parsePi(settings.pi),
    );
    const roundY = g.ground + 34;
    const diameterY = g.ground + 66;
    return (
      <CanvasAlignedOverlay
        testId="roll-match"
        canvasSelector='svg[data-testid="cn-roll-stage"]'
        logicalWidth={ROLL_W}
        logicalHeight={ROLL_H}
      >
        <g stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4">
          <line x1={g.startX} y1={g.ground + 6} x2={g.startX} y2={diameterY + 8} />
          <line x1={g.endX} y1={g.ground + 6} x2={g.endX} y2={roundY + 8} />
        </g>
        <Bars
          x={g.startX}
          roundLen={g.travel}
          diameterLen={2 * g.r}
          roundY={roundY}
          diameterY={diameterY}
        />
      </CanvasAlignedOverlay>
    );
  }

  const radius = halves(state.pieceRadiusHalves);
  const geo = boardGeometry(tenths(state.widthTenths), radius, halves(state.pieceHeightHalves));
  const pi = parsePi(state.settings.pi);
  const roundLen = toPx(circumference(radius, pi)) * geo.scale;
  const diameterLen = 2 * toPx(radius) * geo.scale;
  const x = barStartX(geo.rect.x, roundLen);
  const stripTop = BOARD_H - BOARD_BOTTOM;
  return (
    <CanvasAlignedOverlay
      testId="roll-match"
      canvasSelector='svg[data-testid="cn-board"]'
      logicalWidth={BOARD_W}
      logicalHeight={BOARD_H}
    >
      <Bars
        x={x}
        roundLen={roundLen}
        diameterLen={diameterLen}
        roundY={stripTop + 28}
        diameterY={stripTop + 60}
      />
    </CanvasAlignedOverlay>
  );
}
