/**
 * E12 `cylinder-net` 전개도 판(SVG): 맞추기와 접기.
 *
 * - 펼친 모습: 옆면 직사각형 하나와 위·아래 변에 붙은 원 둘. 같은 배율로 줄여 실제 비율을 지킨다.
 *   조각 옆에는 학생이 정한 값을 쓴다.
 * - 접은 모습: 비스듬히 본 원기둥. 옆면이 밑면을 감싼다. 가로가 모자라면 빗금 띠(틈), 남으면 진한 띠(겹침)가
 *   이음선 자리에 보이고, 맞으면 이음선이 실선 하나로 닫힌다. 그림만으로 보여 주고 글은 쓰지 않는다.
 * - 점선 윤곽은 주어진 원기둥(설정의 반지름·높이)이다. 학생 조각과 견주어 볼 수 있다.
 */
import { useId } from 'react';
import { circumference, halves, parsePi, tenths } from '../cylnet/model';
import { BOARD_H, BOARD_W, boardGeometry, foldedGeometry, toPx } from '../cylnet/layout';
import { measureState } from '../cylnet/observe';
import { solid3dStrings as S } from '../strings.ko';
import type { CylinderNetState } from '../types';
import styles from '../View.module.css';

interface CylNetBoardProps {
  readonly state: CylinderNetState;
}

const WALL = '#fed7aa';
const WALL_EDGE = '#c2410c';
const BASE = '#dbeafe';
const BASE_EDGE = '#1d4fa8';
const BAND_MIN_PX = 4;

function Label({
  x,
  y,
  children,
}: {
  readonly x: number;
  readonly y: number;
  readonly children: string;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={16}
      fontWeight={700}
      fill="#1d2330"
      stroke="#ffffff"
      strokeWidth={4}
      paintOrder="stroke"
      strokeLinejoin="round"
    >
      {children}
    </text>
  );
}

function Unfolded({ state }: CylNetBoardProps) {
  const width = tenths(state.widthTenths);
  const radius = halves(state.pieceRadiusHalves);
  const height = halves(state.pieceHeightHalves);
  const geo = boardGeometry(width, radius, height);
  const { rect, topCircle, bottomCircle } = geo;
  return (
    <g data-testid="cn-net">
      <rect
        data-testid="cn-piece-side"
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        fill={WALL}
        stroke={WALL_EDGE}
        strokeWidth={2.5}
      />
      {[topCircle, bottomCircle].map((c, i) => (
        <circle
          key={i}
          data-testid={i === 0 ? 'cn-piece-top' : 'cn-piece-bottom'}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          fill={BASE}
          stroke={BASE_EDGE}
          strokeWidth={2.5}
        />
      ))}
      <Label x={rect.x + rect.w / 2} y={rect.y + rect.h / 2 + 5}>
        {`${S.cylNet.pieceWidth(width.toDecimalString())} · ${S.cylNet.pieceHeight(height.toDecimalString())}`}
      </Label>
      <Label x={topCircle.cx} y={topCircle.cy + 5}>
        {S.cylNet.pieceRadius(radius.toDecimalString())}
      </Label>
      <Label x={bottomCircle.cx} y={bottomCircle.cy + 5}>
        {S.cylNet.pieceRadius(radius.toDecimalString())}
      </Label>
    </g>
  );
}

/** 옆선 둘과 아래 밑면의 앞쪽 반원(열린 선). */
function sidesPath(cx: number, baseY: number, rx: number, ry: number, wallH: number): string {
  const top = baseY - wallH;
  return [
    `M ${cx - rx} ${top}`,
    `L ${cx - rx} ${baseY}`,
    `A ${rx} ${ry} 0 0 0 ${cx + rx} ${baseY}`,
    `L ${cx + rx} ${top}`,
  ].join(' ');
}

function cylinderOutline(cx: number, baseY: number, rx: number, ry: number, wallH: number): string {
  const top = baseY - wallH;
  return [
    `M ${cx - rx} ${top}`,
    `L ${cx - rx} ${baseY}`,
    `A ${rx} ${ry} 0 0 0 ${cx + rx} ${baseY}`,
    `L ${cx + rx} ${top}`,
    'Z',
  ].join(' ');
}

function Folded({ state }: CylNetBoardProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^A-Za-z0-9_-]/g, '');
  const { settings } = state;
  const measure = measureState(state);
  const g = foldedGeometry(
    measure.radius,
    measure.height,
    halves(settings.radiusHalves),
    halves(settings.heightHalves),
  );
  const { cx, baseY, rx, ry, wallH } = g;
  const top = baseY - wallH;

  const phi = (state.viewYaw * Math.PI) / 180;
  const facing = Math.cos(phi);
  const seamVisible = facing > 0.05;
  const seamX = cx + rx * Math.sin(phi);
  const diff = toPx(measure.width.sub(circumference(measure.radius, parsePi(settings.pi))).abs());
  const bandW = Math.max(BAND_MIN_PX, Math.min(diff * g.scale, rx * 1.2));
  const seamTop = top + ry * facing;
  const seamBottom = baseY + ry * facing;

  return (
    <g data-testid="cn-folded" data-seam-visible={seamVisible ? 'true' : 'false'}>
      <defs>
        <clipPath id={`cn-wall-${uid}`}>
          <path d={cylinderOutline(cx, baseY, rx, ry, wallH)} />
        </clipPath>
        <pattern
          id={`cn-hatch-${uid}`}
          width={8}
          height={8}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={8} height={8} fill="#ffffff" />
          <line x1={0} y1={0} x2={0} y2={8} stroke="#334155" strokeWidth={3} />
        </pattern>
      </defs>

      <g data-testid="cn-ref-cylinder" fill="none" stroke="#64748b" strokeWidth={2.5}>
        <path d={sidesPath(cx, baseY, g.refRx, g.refRy, g.refH)} strokeDasharray="7 6" />
        <ellipse cx={cx} cy={baseY - g.refH} rx={g.refRx} ry={g.refRy} strokeDasharray="7 6" />
      </g>

      <path d={cylinderOutline(cx, baseY, rx, ry, wallH)} fill={WALL} />
      {seamVisible ? (
        <g clipPath={`url(#cn-wall-${uid})`}>
          {measure.seam === 'gap' ? (
            <rect
              data-testid="cn-seam-gap"
              x={seamX - bandW / 2}
              y={seamTop - ry - 2}
              width={bandW}
              height={seamBottom - seamTop + ry * 2 + 4}
              fill={`url(#cn-hatch-${uid})`}
              stroke="#334155"
              strokeWidth={1.5}
            />
          ) : null}
          {measure.seam === 'overlap' ? (
            <rect
              data-testid="cn-seam-overlap"
              x={seamX - bandW / 2}
              y={seamTop - ry - 2}
              width={bandW}
              height={seamBottom - seamTop + ry * 2 + 4}
              fill="#7c2d12"
              fillOpacity={0.9}
              stroke="#431407"
              strokeWidth={1.5}
            />
          ) : null}
          {measure.seam === 'closed' ? (
            <rect
              data-testid="cn-seam-closed"
              x={seamX - 1.5}
              y={seamTop}
              width={3}
              height={seamBottom - seamTop}
              rx={1.5}
              fill="#431407"
            />
          ) : null}
        </g>
      ) : null}
      <path
        d={sidesPath(cx, baseY, rx, ry, wallH)}
        fill="none"
        stroke={WALL_EDGE}
        strokeWidth={2.5}
      />
      <ellipse
        data-testid="cn-folded-top"
        cx={cx}
        cy={top}
        rx={rx}
        ry={ry}
        fill={BASE}
        stroke={BASE_EDGE}
        strokeWidth={2.5}
      />
    </g>
  );
}

export function CylNetBoard({ state }: CylNetBoardProps) {
  return (
    <svg
      className={styles.xrayStageSvg}
      data-testid="cn-board"
      data-folded={state.folded ? 'true' : 'false'}
      viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
      width={BOARD_W}
      height={BOARD_H}
      tabIndex={0}
      role="img"
      aria-label={state.folded ? S.cylNet.foldedLabel : S.cylNet.boardLabel}
    >
      {state.folded ? <Folded state={state} /> : <Unfolded state={state} />}
    </svg>
  );
}
