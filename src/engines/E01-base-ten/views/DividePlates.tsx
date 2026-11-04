/** divide 모드의 무더기·접시 판(T043). 블록은 View가 그린다. */
import { DIVIDE_PILE, dividePlateRects } from '../layout';
import { baseTenStrings as S } from '../strings.ko';
import type { BaseTenState } from '../types';

export function DividePlates({ state }: { readonly state: BaseTenState }) {
  const plates = state.divide?.plates ?? 0;
  if (plates === 0) return null;
  const rects = dividePlateRects(plates);

  return (
    <g pointerEvents="none" data-testid="divide-plates">
      <rect
        x={DIVIDE_PILE.x}
        y={DIVIDE_PILE.y}
        width={DIVIDE_PILE.width}
        height={DIVIDE_PILE.height}
        rx={18}
        fill="#f1ede2"
        stroke="#c9d3e2"
        strokeWidth={2}
      />
      <text
        x={DIVIDE_PILE.x + 16}
        y={DIVIDE_PILE.y + 28}
        fontSize={20}
        fontWeight={700}
        fill="#1d2330"
      >
        {S.pile}
      </text>
      <text x={DIVIDE_PILE.x + 16} y={DIVIDE_PILE.y + 50} fontSize={14} fill="#5b6577">
        {S.pileHint}
      </text>

      {rects.map((rect, index) => (
        <g key={`plate-${index}`}>
          <rect
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            rx={18}
            fill="#fbfcff"
            stroke="#2f6fde"
            strokeOpacity={0.55}
            strokeWidth={2}
            strokeDasharray="12 8"
          />
          <text x={rect.x + 12} y={rect.y + 24} fontSize={17} fontWeight={700} fill="#1d4fa8">
            {S.plate(index + 1)}
          </text>
        </g>
      ))}
    </g>
  );
}
