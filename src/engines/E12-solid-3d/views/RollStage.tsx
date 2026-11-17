/**
 * E12 `cylinder-net` 굴리기 무대(SVG).
 *
 * - 물감을 바른 원기둥이 바닥에 누워 있고, 밑면 원이 보인다. 길이 방향은 비스듬히 그린다.
 * - 굴린 만큼 원기둥이 오른쪽으로 가고, 지나간 자리에 직사각형 자국(비스듬한 평행사변형)이 찍힌다.
 * - 밑면 원 위의 표시점은 색(주황)과 모양(채운 삼각형)으로 구별한다.
 * - 한 바퀴를 다 굴리면 표시점이 닿은 자리와 자국 끝 점선을 굵게 강조한다.
 * - 원주·자국 길이 수는 쓰지 않는다. 주어진 반지름·높이만 `showDims`일 때 쓴다.
 */
import { halves, parsePi, ROLL_FULL } from '../cylnet/model';
import { ROLL_H, ROLL_W, rollGeometry } from '../cylnet/layout';
import { solid3dStrings as S } from '../strings.ko';
import type { CylinderNetState } from '../types';
import styles from '../View.module.css';

interface RollStageProps {
  readonly state: CylinderNetState;
  /** 화면에 그리는 굴린 양(연출 중에는 상태 값과 다를 수 있다). 1/8바퀴 단위, 소수 허용. */
  readonly eighths: number;
}

const PAINT = '#fdba74';
const PAINT_EDGE = '#c2410c';
const MARK = '#c2410c';

function triangle(tipX: number, tipY: number, dirX: number, dirY: number, size: number): string {
  // 꼭짓점(tip)에서 (dir 반대 방향으로) size만큼 들어간 밑변을 가진 이등변삼각형.
  const bx = tipX - dirX * size * 1.5;
  const by = tipY - dirY * size * 1.5;
  const nx = -dirY;
  const ny = dirX;
  return [
    `${tipX.toFixed(1)},${tipY.toFixed(1)}`,
    `${(bx + nx * size).toFixed(1)},${(by + ny * size).toFixed(1)}`,
    `${(bx - nx * size).toFixed(1)},${(by - ny * size).toFixed(1)}`,
  ].join(' ');
}

export function RollStage({ state, eighths }: RollStageProps) {
  const { settings } = state;
  const radius = halves(settings.radiusHalves);
  const height = halves(settings.heightHalves);
  const g = rollGeometry(radius, height, parsePi(settings.pi));
  const e = Math.max(0, Math.min(ROLL_FULL, eighths));
  const full = e >= ROLL_FULL;
  const paint = settings.rollPaint;

  const rolled = (g.travel * e) / ROLL_FULL;
  const cx = g.startX + rolled;
  const cy = g.ground - g.r;
  const theta = (2 * Math.PI * e) / ROLL_FULL;
  // 오른쪽으로 굴러가면 화면에서 시계 방향으로 돈다. 처음 표시점은 바닥에 닿아 있다.
  const mx = cx - g.r * Math.sin(theta);
  const my = cy + g.r * Math.cos(theta);
  const outX = (mx - cx) / g.r;
  const outY = (my - cy) / g.r;

  const dx = g.depthX;
  const dy = -g.depthY;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy * g.r;
  const ny = ux * g.r;

  const trackEnd = g.startX + rolled;
  const trackPoints = [
    `${g.startX.toFixed(1)},${g.ground.toFixed(1)}`,
    `${trackEnd.toFixed(1)},${g.ground.toFixed(1)}`,
    `${(trackEnd + dx).toFixed(1)},${(g.ground + dy).toFixed(1)}`,
    `${(g.startX + dx).toFixed(1)},${(g.ground + dy).toFixed(1)}`,
  ].join(' ');

  const bodyFill = paint ? '#ffedd5' : '#e2e8f0';
  const edgeColor = paint ? '#7c2d12' : '#475569';
  const showTrack = paint && e > 0;

  return (
    <svg
      className={styles.xrayStageSvg}
      data-testid="cn-roll-stage"
      data-eighths={Number.isInteger(e) ? e : Number(e.toFixed(2))}
      data-full={full ? 'true' : 'false'}
      viewBox={`0 0 ${ROLL_W} ${ROLL_H}`}
      width={ROLL_W}
      height={ROLL_H}
      tabIndex={0}
      role="img"
      aria-label={S.cylNet.stageLabel}
    >
      <line
        x1={10}
        y1={g.ground}
        x2={ROLL_W - 10}
        y2={g.ground}
        stroke="#94a3b8"
        strokeWidth={3}
        strokeLinecap="round"
      />

      {settings.showDims ? (
        <g fontSize={17} fontWeight={700} fill="#1d2330">
          <text x={20} y={24} data-testid="cn-dim-radius">
            {S.cylNet.radiusDim(radius.toDecimalString())}
          </text>
          <text x={150} y={24} data-testid="cn-dim-height">
            {S.cylNet.heightDim(height.toDecimalString())}
          </text>
        </g>
      ) : null}

      {showTrack ? (
        <g data-testid="cn-track">
          <polygon
            points={trackPoints}
            fill={PAINT}
            fillOpacity={0.6}
            stroke={PAINT_EDGE}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <polygon
            points={triangle(g.startX, g.ground, 0, -1, 7)}
            fill={MARK}
            stroke="#ffffff"
            strokeWidth={1.5}
          />
          <line
            data-testid="cn-track-end"
            x1={trackEnd}
            y1={g.ground + 4}
            x2={trackEnd + dx}
            y2={g.ground + dy - 4}
            stroke={PAINT_EDGE}
            strokeWidth={full ? 6 : 2.5}
            strokeDasharray={full ? undefined : '6 5'}
            strokeLinecap="round"
          />
        </g>
      ) : null}

      <g data-testid="cn-cylinder">
        <circle
          cx={cx + dx}
          cy={cy + dy}
          r={g.r}
          fill={bodyFill}
          stroke={edgeColor}
          strokeWidth={2}
        />
        <polygon
          points={[
            `${(cx + nx).toFixed(1)},${(cy + ny).toFixed(1)}`,
            `${(cx + dx + nx).toFixed(1)},${(cy + dy + ny).toFixed(1)}`,
            `${(cx + dx - nx).toFixed(1)},${(cy + dy - ny).toFixed(1)}`,
            `${(cx - nx).toFixed(1)},${(cy - ny).toFixed(1)}`,
          ].join(' ')}
          fill={bodyFill}
        />
        <line
          x1={cx + nx}
          y1={cy + ny}
          x2={cx + dx + nx}
          y2={cy + dy + ny}
          stroke={edgeColor}
          strokeWidth={2}
        />
        <line
          x1={cx - nx}
          y1={cy - ny}
          x2={cx + dx - nx}
          y2={cy + dy - ny}
          stroke={edgeColor}
          strokeWidth={2}
        />
      </g>
      <g data-testid="cn-front">
        <circle cx={cx} cy={cy} r={g.r} fill="#fff7ed" stroke={edgeColor} strokeWidth={2.5} />
        <line x1={cx} y1={cy} x2={mx} y2={my} stroke={MARK} strokeWidth={2} strokeDasharray="4 4" />
        <polygon
          data-testid="cn-mark"
          points={triangle(mx, my, outX, outY, 8)}
          fill={MARK}
          stroke="#ffffff"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </g>

      {full ? (
        <g data-testid="cn-roll-match">
          <circle cx={mx} cy={my} r={18} fill="none" stroke={MARK} strokeWidth={4} />
          <rect
            x={ROLL_W - 130}
            y={6}
            width={116}
            height={30}
            rx={15}
            fill="#ffffff"
            stroke={MARK}
            strokeWidth={3}
          />
          <text
            x={ROLL_W - 72}
            y={28}
            textAnchor="middle"
            fontSize={18}
            fontWeight={800}
            fill="#7c2d12"
          >
            {S.cylNet.fullBadge}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
