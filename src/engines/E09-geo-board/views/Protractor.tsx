/**
 * 각도기 그림 부품(T102).
 *
 * - 반원판. 기준선 오른쪽 끝 방향이 `rotation`이다.
 * - 바깥 트랙은 오른쪽 끝에서 0 → 반시계로 180, 안쪽 트랙은 왼쪽 끝에서 0 → 시계로 180.
 * - 10° 숫자, 5°·1° 눈금. 판은 반투명.
 * - 트레이에서는 숫자 없는 작은 아이콘으로 그린다(`tray`).
 *
 * 화면 좌표만 number를 쓴다. 각 크기·읽은 값은 정수 도다.
 */
import type { ReactNode } from 'react';
import type { Point } from '../../../core/engine-sdk';
import { normalizeDegrees } from '../modes/angle/observe';
import type { ProtractorScale } from '../modes/angle/observe';

export const ANGLE_VIEW = {
  width: 1000,
  height: 1000,
  vertex: { x: 500, y: 800 },
  protractorRadius: 380,
  armLength: 430,
  launcher: { x: 320, y: 820 },
  floorEnd: { x: 920, y: 820 },
  targetDistance: 300,
  trayCenter: { x: 860, y: 930 },
  trayRadius: 64,
  /** 각도기를 꼭짓점에 붙이는 터치 반경(논리 좌표). */
  placeRadius: 150,
} as const;

/** 방향(도, 0 = 오른쪽, 화면 반시계)과 길이로 화면 점. */
export function pointAtDirection(center: Point, radius: number, direction: number): Point {
  const radians = (direction * Math.PI) / 180;
  return {
    x: center.x + radius * Math.cos(radians),
    y: center.y - radius * Math.sin(radians),
  };
}

/** `center`에서 본 점의 방향(도). 0 = 오른쪽, 화면 반시계. */
export function directionOfPoint(center: Point, point: Point): number {
  const radians = Math.atan2(center.y - point.y, point.x - center.x);
  return normalizeDegrees((radians * 180) / Math.PI);
}

/** 반시계 방향 호. `sweep`은 도. */
export function arcPath(center: Point, radius: number, start: number, sweep = 180): string {
  const from = pointAtDirection(center, radius, start);
  const to = pointAtDirection(center, radius, start + sweep);
  const large = Math.abs(sweep) > 180 ? 1 : 0;
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${large} 0 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}

/** 중심에서 두 방향 사이의 부채꼴. */
export function sectorPath(center: Point, radius: number, start: number, sweep: number): string {
  const from = pointAtDirection(center, radius, start);
  const to = pointAtDirection(center, radius, start + sweep);
  const large = Math.abs(sweep) > 180 ? 1 : 0;
  return [
    `M ${center.x.toFixed(2)} ${center.y.toFixed(2)}`,
    `L ${from.x.toFixed(2)} ${from.y.toFixed(2)}`,
    `A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${large} 0 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

/** 4° 안이면 그 변 방향으로 붙인다(화면 편의). */
export function snapRotation(rotation: number, arms: readonly number[]): number {
  const value = normalizeDegrees(rotation);
  for (const arm of arms) {
    const diff = Math.abs(normalizeDegrees(value - arm + 180) - 180);
    if (diff <= 4) return normalizeDegrees(arm);
  }
  return value;
}

function trackTicks(
  center: Point,
  radius: number,
  rotation: number,
  side: 'outer' | 'inner',
  showNumbers: boolean,
  active: boolean,
  tray: boolean,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const outer = side === 'outer';
  const tickBase = outer ? radius * 1.0 : radius * 0.82;
  const step = tray ? 5 : 1;
  for (let value = 0; value <= 180; value += step) {
    const direction = outer ? rotation + value : rotation + 180 - value;
    const major = value % 10 === 0;
    const medium = value % 5 === 0;
    const length = major ? radius * 0.11 : medium ? radius * 0.07 : radius * 0.035;
    const from = pointAtDirection(center, tickBase, direction);
    const to = pointAtDirection(center, tickBase - length, direction);
    nodes.push(
      <line
        key={`${side}-tick-${value}`}
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={active ? '#1d4fa8' : '#5b6577'}
        strokeWidth={active && major ? 2.4 : major ? 1.6 : 1}
        strokeLinecap="round"
      />,
    );
  }
  if (!showNumbers) return nodes;
  for (let value = 0; value <= 180; value += 10) {
    const direction = outer ? rotation + value : rotation + 180 - value;
    const label = pointAtDirection(center, radius * (outer ? 0.83 : 0.64), direction);
    nodes.push(
      <text
        key={`${side}-label-${value}`}
        x={label.x}
        y={label.y + 4}
        textAnchor="middle"
        fontSize={active ? 16 : 13}
        fontWeight={active ? 800 : 600}
        fill={active ? '#1d4fa8' : '#5b6577'}
      >
        {value}
      </text>,
    );
  }
  return nodes;
}

export interface ProtractorProps {
  readonly center: Point;
  readonly radius: number;
  readonly rotation: number;
  readonly showNumbers?: boolean;
  readonly highlightActiveScale?: boolean;
  readonly activeScale?: ProtractorScale | null;
  readonly tray?: boolean;
}

export function Protractor({
  center,
  radius,
  rotation,
  showNumbers = true,
  highlightActiveScale = false,
  activeScale = null,
  tray = false,
}: ProtractorProps) {
  const outerActive = highlightActiveScale && activeScale === 'outer';
  const innerActive = highlightActiveScale && activeScale === 'inner';
  const highlight = highlightActiveScale && activeScale !== null;
  const discOpacity = tray ? 0.8 : 0.55;
  const body = [
    `M ${pointAtDirection(center, radius, rotation).x.toFixed(2)} ${pointAtDirection(center, radius, rotation).y.toFixed(2)}`,
    `A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 0 ${pointAtDirection(center, radius, rotation + 180).x.toFixed(2)} ${pointAtDirection(center, radius, rotation + 180).y.toFixed(2)}`,
    'Z',
  ].join(' ');
  const zeroRight = pointAtDirection(center, radius, rotation);
  const zeroLeft = pointAtDirection(center, radius, rotation + 180);

  return (
    <g data-testid={tray ? 'protractor-tray-icon' : 'protractor'}>
      <path d={body} fill="#eef4ff" fillOpacity={discOpacity} stroke="#5b6577" strokeWidth={2} />
      <line
        x1={zeroLeft.x}
        y1={zeroLeft.y}
        x2={zeroRight.x}
        y2={zeroRight.y}
        stroke="#1d2330"
        strokeWidth={2}
      />
      {highlight && activeScale === 'outer' ? (
        <path
          d={arcPath(center, radius * 0.94, rotation)}
          fill="none"
          stroke="#ffe3a3"
          strokeWidth={26}
          strokeOpacity={0.7}
        />
      ) : null}
      {highlight && activeScale === 'inner' ? (
        <path
          d={arcPath(center, radius * 0.755, rotation)}
          fill="none"
          stroke="#ffe3a3"
          strokeWidth={22}
          strokeOpacity={0.7}
        />
      ) : null}
      <g opacity={highlight && activeScale === 'inner' ? 0.3 : 1}>
        {trackTicks(center, radius, rotation, 'outer', showNumbers, outerActive, tray)}
      </g>
      <g opacity={highlight && activeScale === 'outer' ? 0.3 : 1}>
        {trackTicks(center, radius, rotation, 'inner', showNumbers, innerActive, tray)}
      </g>
      <circle cx={center.x} cy={center.y} r={tray ? 5 : 8} fill="#1d2330" />
      {tray ? null : (
        <circle
          cx={zeroRight.x}
          cy={zeroRight.y}
          r={13}
          fill="#ffffff"
          stroke="#e8872e"
          strokeWidth={3}
          data-testid="protractor-handle"
        />
      )}
    </g>
  );
}
