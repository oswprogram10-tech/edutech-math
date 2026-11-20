/**
 * 물건 그림. 아래 가운데가 원점이고 한 변 `size`(논리)인 상자 안에 그린다.
 * 모양으로 물건을 알아볼 수 있게 하고(색만으로 전달하지 않는다) 무게 숫자는 그리지 않는다.
 */
import type { ReactNode } from 'react';
import type { CompareKind } from './types';

const OUTLINE = '#2d3648';

/** 100×100 상자(가운데 아래가 원점: x -50~50, y -100~0)에 그린 모양. */
function shape(kind: CompareKind): ReactNode {
  switch (kind) {
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
    case 'feather':
      return (
        <>
          <path
            d="M-36 -6 C-50 -52 -10 -96 40 -96 C42 -48 14 -8 -36 -6 Z"
            fill="#bfe3f5"
            stroke={OUTLINE}
            strokeWidth={4}
          />
          <path d="M-40 -2 L30 -80" stroke={OUTLINE} strokeWidth={4} fill="none" />
          <path
            d="M-14 -30 L4 -26 M0 -46 L20 -42 M12 -62 L28 -60"
            stroke="#6aa9c9"
            strokeWidth={3}
          />
        </>
      );
    case 'balloon':
      return (
        <>
          <path
            d="M0 -96 C-34 -96 -42 -68 -38 -50 C-34 -30 -14 -20 0 -18 C14 -20 34 -30 38 -50 C42 -68 34 -96 0 -96 Z"
            fill="#f0719b"
            stroke={OUTLINE}
            strokeWidth={4}
          />
          <path d="M-6 -18 L6 -18 L0 -10 Z" fill="#f0719b" stroke={OUTLINE} strokeWidth={3} />
          <path d="M0 -10 C-8 -6 8 -4 0 0" stroke={OUTLINE} strokeWidth={3} fill="none" />
        </>
      );
    case 'stone':
      return (
        <path
          d="M-46 -4 L-40 -40 L-16 -66 L18 -70 L42 -46 L48 -4 Z"
          fill="#9aa1ad"
          stroke={OUTLINE}
          strokeWidth={4}
          strokeLinejoin="round"
        />
      );
    case 'sponge':
      return (
        <>
          <rect
            x={-48}
            y={-80}
            width={96}
            height={78}
            rx={12}
            fill="#f2d24b"
            stroke={OUTLINE}
            strokeWidth={4}
          />
          <circle cx={-26} cy={-58} r={7} fill="#c9a920" />
          <circle cx={8} cy={-62} r={5} fill="#c9a920" />
          <circle cx={28} cy={-40} r={8} fill="#c9a920" />
          <circle cx={-12} cy={-26} r={6} fill="#c9a920" />
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
    case 'eraser':
      return (
        <>
          <rect
            x={-48}
            y={-66}
            width={96}
            height={62}
            rx={10}
            fill="#f7c6d0"
            stroke={OUTLINE}
            strokeWidth={4}
          />
          <rect
            x={-48}
            y={-66}
            width={36}
            height={62}
            rx={10}
            fill="#4a7fd1"
            stroke={OUTLINE}
            strokeWidth={4}
          />
        </>
      );
  }
}

export function ItemArt({ kind, size }: { readonly kind: CompareKind; readonly size: number }) {
  return <g transform={`scale(${size / 100})`}>{shape(kind)}</g>;
}
