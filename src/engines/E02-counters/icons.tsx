/**
 * E02 인라인 SVG 셈돌 아이콘 8종.
 *
 * 색만으로 정보를 전달하지 않는다(AGENTS 규칙): 빨강은 속이 찬 모양,
 * 파랑은 가운데 점이 뚫린 모양으로 그린다.
 */
import type { ReactElement } from 'react';
import type { CounterColor, CounterIcon } from './types';

const RED = '#d64545';
const RED_DARK = '#a52f2f';
const BLUE = '#2f6fde';
const BLUE_DARK = '#1d4fa8';
const LEAF = '#2f9e6b';

export interface CounterIconProps {
  readonly icon: CounterIcon;
  readonly color: CounterColor;
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

function starPoints(x: number, y: number, outer: number, inner: number): string {
  const points: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    points.push(
      `${(x + radius * Math.cos(angle)).toFixed(2)},${(y + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return points.join(' ');
}

export function CounterIconShape({ icon, color, x, y, r }: CounterIconProps) {
  const fill = color === 'red' ? RED : BLUE;
  const dark = color === 'red' ? RED_DARK : BLUE_DARK;
  const hole = <circle cx={x} cy={y} r={r * 0.34} fill="#ffffff" />;

  let shape: ReactElement;
  switch (icon) {
    case 'apple':
      shape = (
        <g>
          <circle
            cx={x}
            cy={y + r * 0.08}
            r={r * 0.9}
            fill={fill}
            stroke={dark}
            strokeWidth={r * 0.08}
          />
          <rect
            x={x - r * 0.05}
            y={y - r}
            width={r * 0.1}
            height={r * 0.32}
            rx={r * 0.04}
            fill={dark}
          />
          <ellipse cx={x + r * 0.26} cy={y - r * 0.78} rx={r * 0.26} ry={r * 0.13} fill={LEAF} />
        </g>
      );
      break;
    case 'fish':
      shape = (
        <g>
          <ellipse
            cx={x - r * 0.14}
            cy={y}
            rx={r * 0.86}
            ry={r * 0.62}
            fill={fill}
            stroke={dark}
            strokeWidth={r * 0.08}
          />
          <polygon
            points={`${x + r * 0.55},${y} ${x + r * 0.98},${y - r * 0.5} ${x + r * 0.98},${y + r * 0.5}`}
            fill={fill}
            stroke={dark}
            strokeWidth={r * 0.06}
          />
        </g>
      );
      break;
    case 'bird':
      shape = (
        <g>
          <circle
            cx={x - r * 0.1}
            cy={y}
            r={r * 0.82}
            fill={fill}
            stroke={dark}
            strokeWidth={r * 0.08}
          />
          <polygon
            points={`${x + r * 0.6},${y - r * 0.1} ${x + r * 1.02},${y} ${x + r * 0.6},${y + r * 0.2}`}
            fill="#e8872e"
          />
          <ellipse
            cx={x - r * 0.24}
            cy={y + r * 0.12}
            rx={r * 0.42}
            ry={r * 0.26}
            fill={dark}
            opacity={0.5}
          />
        </g>
      );
      break;
    case 'balloon':
      shape = (
        <g>
          <ellipse
            cx={x}
            cy={y - r * 0.16}
            rx={r * 0.72}
            ry={r * 0.82}
            fill={fill}
            stroke={dark}
            strokeWidth={r * 0.08}
          />
          <polygon
            points={`${x - r * 0.14},${y + r * 0.6} ${x + r * 0.14},${y + r * 0.6} ${x},${y + r * 0.78}`}
            fill={dark}
          />
          <path
            d={`M ${x} ${y + r * 0.78} q ${r * 0.2} ${r * 0.16} 0 ${r * 0.3}`}
            fill="none"
            stroke={dark}
            strokeWidth={r * 0.06}
          />
        </g>
      );
      break;
    case 'candy':
      shape = (
        <g>
          <circle cx={x} cy={y} r={r * 0.62} fill={fill} stroke={dark} strokeWidth={r * 0.08} />
          <polygon
            points={`${x - r * 0.55},${y} ${x - r * 1.02},${y - r * 0.42} ${x - r * 1.02},${y + r * 0.42}`}
            fill={fill}
            stroke={dark}
            strokeWidth={r * 0.06}
          />
          <polygon
            points={`${x + r * 0.55},${y} ${x + r * 1.02},${y - r * 0.42} ${x + r * 1.02},${y + r * 0.42}`}
            fill={fill}
            stroke={dark}
            strokeWidth={r * 0.06}
          />
        </g>
      );
      break;
    case 'strawberry':
      shape = (
        <g>
          <polygon
            points={`${x},${y + r * 0.95} ${x - r * 0.9},${y - r * 0.2} ${x - r * 0.55},${y - r * 0.78} ${x + r * 0.55},${y - r * 0.78} ${x + r * 0.9},${y - r * 0.2}`}
            fill={fill}
            stroke={dark}
            strokeWidth={r * 0.08}
            strokeLinejoin="round"
          />
          <polygon
            points={`${x - r * 0.5},${y - r * 0.76} ${x},${y - r * 1.1} ${x + r * 0.5},${y - r * 0.76}`}
            fill={LEAF}
          />
        </g>
      );
      break;
    case 'star':
      shape = (
        <polygon
          points={starPoints(x, y, r, r * 0.45)}
          fill={fill}
          stroke={dark}
          strokeWidth={r * 0.08}
          strokeLinejoin="round"
        />
      );
      break;
    case 'dot':
    default:
      shape = (
        <circle cx={x} cy={y} r={r * 0.85} fill={fill} stroke={dark} strokeWidth={r * 0.08} />
      );
      break;
  }

  return (
    <g pointerEvents="none" data-icon={icon} data-color={color}>
      {shape}
      {color === 'blue' ? hole : null}
    </g>
  );
}
