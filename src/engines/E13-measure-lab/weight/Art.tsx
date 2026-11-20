/**
 * 물건 그림. 아래 가운데가 원점이고 한 변 `size`(논리)인 상자 안에 그린다.
 * 모양으로 물건을 알아볼 수 있게 하고(색만으로 전달하지 않는다) 무게 숫자는 그리지 않는다.
 */
import type { ReactNode } from 'react';
import type { ObjectKind } from './types';

const OUTLINE = '#2d3648';

/** 100×100 상자(가운데 아래가 원점: x -50~50, y -100~0)에 그린 모양. */
function shape(kind: ObjectKind): ReactNode {
  switch (kind) {
    case 'beachball':
      return (
        <>
          <circle cx={0} cy={-50} r={48} fill="#ffffff" stroke={OUTLINE} strokeWidth={4} />
          <path d="M0 -98 C-26 -76 -26 -24 0 -2 C-8 -30 -8 -70 0 -98 Z" fill="#e8503a" />
          <path d="M0 -98 C26 -76 26 -24 0 -2 C8 -30 8 -70 0 -98 Z" fill="#2f6fde" />
          <path d="M-46 -50 H46" stroke="#f2c14e" strokeWidth={8} />
          <circle cx={0} cy={-50} r={48} fill="none" stroke={OUTLINE} strokeWidth={4} />
        </>
      );
    case 'iron-ball':
      return (
        <>
          <circle cx={0} cy={-48} r={46} fill="#4a5362" stroke={OUTLINE} strokeWidth={4} />
          <path d="M-26 -62 C-22 -76 -10 -82 0 -82" stroke="#c4ccd8" strokeWidth={6} fill="none" />
        </>
      );
    case 'book':
      return (
        <>
          <rect
            x={-46}
            y={-84}
            width={92}
            height={82}
            rx={6}
            fill="#4a7fd1"
            stroke={OUTLINE}
            strokeWidth={4}
          />
          <rect
            x={-46}
            y={-84}
            width={16}
            height={82}
            fill="#2f5ea8"
            stroke={OUTLINE}
            strokeWidth={4}
          />
          <rect x={-18} y={-66} width={50} height={22} rx={4} fill="#ffffff" />
        </>
      );
    case 'apple':
      return (
        <>
          <path
            d="M0 -84 C-14 -96 -46 -88 -46 -52 C-46 -22 -26 -2 -10 -2 C-4 -2 -3 -6 0 -6 C3 -6 4 -2 10 -2 C26 -2 46 -22 46 -52 C46 -88 14 -96 0 -84 Z"
            fill="#d64541"
            stroke={OUTLINE}
            strokeWidth={4}
          />
          <path d="M0 -84 C0 -92 4 -98 10 -100" stroke={OUTLINE} strokeWidth={5} fill="none" />
          <path d="M6 -90 C16 -100 30 -96 32 -90 C22 -84 12 -86 6 -90 Z" fill="#4c9a4a" />
        </>
      );
    case 'pencil-case':
      return (
        <>
          <rect
            x={-48}
            y={-50}
            width={96}
            height={48}
            rx={20}
            fill="#8fcf9b"
            stroke={OUTLINE}
            strokeWidth={4}
          />
          <path d="M-32 -38 H32" stroke={OUTLINE} strokeWidth={4} strokeDasharray="6 5" />
          <circle cx={32} cy={-38} r={5} fill="#ffffff" stroke={OUTLINE} strokeWidth={3} />
        </>
      );
    case 'bag':
      return (
        <>
          <path
            d="M-40 -66 H40 L46 -2 H-46 Z"
            fill="#f2b366"
            stroke={OUTLINE}
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <path d="M-22 -66 C-22 -96 22 -96 22 -66" fill="none" stroke={OUTLINE} strokeWidth={5} />
          <rect x={-14} y={-40} width={28} height={16} rx={4} fill="#ffffff" />
        </>
      );
  }
}

export function ObjectArt({ kind, size }: { readonly kind: ObjectKind; readonly size: number }) {
  return <g transform={`scale(${size / 100})`}>{shape(kind)}</g>;
}
