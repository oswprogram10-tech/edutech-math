/**
 * 힌트 ② bin-attributes (MC-SORT-INCONSISTENT).
 * 상자마다 든 카드의 속성 아이콘 줄을 늘어놓고, 그 줄에서 다른 값 아이콘에 굵은 테두리를 두른다.
 * 어느 속성으로 나눠야 한다고 알려 주지 않는다(줄마다 다른 값만 표시).
 */
import type { OverlayProps } from '../../../../core/engine-sdk';
import { deckAttributes, deckDefinition, valueKey } from '../../decks';
import type { SorterConfig, SorterState } from '../../types';
import { ValueIcon } from '../art';
import { binBoxes, binHeaderBox } from '../layout';
import { activeBins } from '../reduce';
import { sortStrings as S } from '../strings.ko';
import { SortOverlayFrame } from './frame';
import { sortStateOf } from './helpers';

const ORANGE = '#e8872e';

function majority(values: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const value of values) {
    const count = counts.get(value) ?? 0;
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export function BinAttributesOverlay({ state }: OverlayProps<SorterConfig, SorterState>) {
  const sort = sortStateOf(state);
  if (!sort) return null;
  const binIds = activeBins(sort);
  const boxes = binBoxes(binIds.length);
  const definition = deckDefinition(sort.settings.deck);
  const attributes = deckAttributes(sort.settings.deck);

  return (
    <SortOverlayFrame testId="bin-attributes">
      {boxes.map((box, index) => {
        const bin = binIds[index];
        if (bin === undefined) return null;
        const cards = sort.settings.cards
          .filter((id) => sort.binOf[id] === bin)
          .map((id) => definition.cards.find((card) => card.id === id))
          .filter((card): card is NonNullable<typeof card> => card !== undefined);
        if (cards.length === 0) return null;
        const header = binHeaderBox(box);
        const top = header.y + header.height + 4;
        const width = box.width - 8;
        const rowHeight = (box.height - header.height - 12) / attributes.length;
        const pitch = Math.min(30, (width - 20) / cards.length);
        const iconSize = Math.min(26, pitch * 0.8);
        return (
          <g key={bin} data-overlay-bin={bin}>
            <rect
              x={box.x + 4}
              y={top}
              width={width}
              height={box.height - header.height - 8}
              rx={10}
              fill="#ffffff"
              fillOpacity={0.95}
              stroke="#c9d2e2"
              strokeWidth={2}
            />
            {attributes.map((attribute, row) => {
              const values = cards.map((card) => valueKey(card, attribute) ?? '');
              const common = majority(values);
              const y = top + row * rowHeight;
              return (
                <g key={attribute}>
                  <text x={box.x + 14} y={y + 20} fontSize={15} fontWeight={700} fill="#3d485c">
                    {S.overlay.attrRow[attribute] ?? attribute}
                  </text>
                  {cards.map((card, cardIndex) => {
                    const value = values[cardIndex] ?? '';
                    const cx = box.x + 14 + pitch * cardIndex + pitch / 2;
                    const cy = y + 20 + rowHeight / 2;
                    const odd = value !== common;
                    return (
                      <g key={card.id} data-odd={odd ? 'true' : undefined}>
                        {odd ? (
                          <rect
                            x={cx - pitch / 2 + 1}
                            y={cy - iconSize / 2 - 3}
                            width={pitch - 2}
                            height={iconSize + 6}
                            rx={6}
                            fill="none"
                            stroke={ORANGE}
                            strokeWidth={4}
                          />
                        ) : null}
                        <g transform={`translate(${cx},${cy}) scale(${iconSize / 100})`}>
                          <ValueIcon attribute={attribute} value={value} />
                        </g>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>
        );
      })}
    </SortOverlayFrame>
  );
}
