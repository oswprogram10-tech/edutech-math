/**
 * E18 그림그래프의 그림. 엔진 안 SVG 도형이고 외부 자산은 쓰지 않는다.
 *
 * 큰 그림은 같은 그림을 1.6배로 그리고 테두리를 더 굵게 해서, 작은 그림과 크기·테두리 두 가지로 구별된다
 * (색만으로 구별하지 않는다).
 */
import type { IconKind } from './types';

const FILL = '#fff1d6';
const STROKE = '#7a3e00';

/** 100×100 상자 안의 도형. */
function Shape({ kind }: { readonly kind: IconKind }) {
  switch (kind) {
    case 'apple':
      return (
        <>
          <circle cx={50} cy={58} r={34} />
          <path d="M50 24 Q52 10 66 8" fill="none" />
          <path d="M58 20 Q72 12 80 24 Q66 30 58 20 Z" />
        </>
      );
    case 'person':
      return (
        <>
          <circle cx={50} cy={26} r={17} />
          <path d="M18 92 Q18 52 50 52 Q82 52 82 92 Z" />
        </>
      );
    case 'box':
      return (
        <>
          <rect x={12} y={20} width={76} height={68} rx={4} />
          <path d="M12 44 H88 M50 20 V44" fill="none" />
        </>
      );
    case 'star':
      return <polygon points="50,8 61,38 93,38 67,57 77,90 50,70 23,90 33,57 7,38 39,38" />;
  }
}

export interface PictoIconProps {
  readonly kind: IconKind;
  readonly x: number;
  readonly y: number;
  readonly side: number;
  readonly big?: boolean;
}

/** SVG 안에 그림 하나(왼쪽 위 x,y · 한 변 side). 투명한 상자(`data-art-box`)가 정확히 side 크기다. */
export function PictoIcon({ kind, x, y, side, big = false }: PictoIconProps) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${side / 100})`}
      fill={FILL}
      stroke={STROKE}
      strokeWidth={big ? 9 : 4}
      strokeLinejoin="round"
      strokeLinecap="round"
      data-icon-art={big ? 'big' : 'small'}
    >
      <rect width={100} height={100} fill="none" stroke="none" data-art-box="true" />
      <Shape kind={kind} />
    </g>
  );
}

/** 범례용 작은 인라인 그림(HTML 안에 놓는 독립 SVG). */
export function PictoIconSvg({
  kind,
  side,
  big = false,
}: {
  readonly kind: IconKind;
  readonly side: number;
  readonly big?: boolean;
}) {
  return (
    <svg
      width={side}
      height={side}
      viewBox={`0 0 ${side} ${side}`}
      aria-hidden="true"
      focusable="false"
    >
      <PictoIcon kind={kind} x={0} y={0} side={side} big={big} />
    </svg>
  );
}
