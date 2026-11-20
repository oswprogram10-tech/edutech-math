/**
 * 힌트 ② gray-shapes (MC-SHAPE-BY-COLOR-SIZE).
 * 상자 안 카드 위에 같은 그림을 회색으로 덮어 생김새만 보이게 한다. 색·무늬·무게감을 지운 그림이다.
 */
import type { OverlayProps } from '../../../../core/engine-sdk';
import { deckDefinition } from '../../decks';
import type { SorterConfig, SorterState } from '../../types';
import { CardArt } from '../art';
import { SortOverlayFrame } from './frame';
import { slotsOf, sortStateOf } from './helpers';

export function GrayShapesOverlay({ state }: OverlayProps<SorterConfig, SorterState>) {
  const sort = sortStateOf(state);
  if (!sort) return null;
  const cards = new Map(deckDefinition(sort.settings.deck).cards.map((card) => [card.id, card]));
  const slots = slotsOf(sort).filter((slot) => slot.where !== 'tray' && slot.where !== 'belt');
  return (
    <SortOverlayFrame testId="gray-shapes" settings={sort.settings}>
      {slots.map((slot) => {
        const card = cards.get(slot.id);
        if (!card) return null;
        return (
          <g key={slot.id} data-gray={slot.id}>
            <CardArt card={card} size={slot.size} x={slot.center.x} y={slot.center.y} gray />
          </g>
        );
      })}
    </SortOverlayFrame>
  );
}
