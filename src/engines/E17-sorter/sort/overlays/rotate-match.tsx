/**
 * 힌트 ② rotate-match (MC-SHAPE-ORIENTATION).
 * o-can-side(눕힌 캔)가 판에 있으면 그 그림을 90도 돌려 o-can-up(세운 캔) 자리에 겹친다(1초).
 * 움직임 줄이기면 돌린 그림만 보인다. o-can-side가 판에 없으면 아무것도 그리지 않는다.
 */
import type { CSSProperties } from 'react';
import type { OverlayProps } from '../../../../core/engine-sdk';
import { sortCardById } from '../../decks';
import type { SorterConfig, SorterState } from '../../types';
import { ObjectArt } from '../art';
import { beltCardCenter, sortGeometry } from '../layout';
import { SortOverlayFrame } from './frame';
import { slotsOf, sortStateOf } from './helpers';
import styles from './Overlays.module.css';

export function RotateMatchOverlay({ state }: OverlayProps<SorterConfig, SorterState>) {
  const sort = sortStateOf(state);
  if (!sort || sort.settings.deck !== 'classroom-objects-12') return null;
  if (!sort.settings.cards.includes('o-can-side')) return null;
  const side = sortCardById('classroom-objects-12', 'o-can-side');
  if (!side) return null;
  const geometry = sortGeometry(sort.settings);
  const slots = slotsOf(sort);
  const sideSlot = slots.find((slot) => slot.id === 'o-can-side');
  const upSlot = slots.find((slot) => slot.id === 'o-can-up');
  const from = sideSlot?.center ?? beltCardCenter(geometry);
  const to = upSlot?.center ?? from;
  const size = upSlot?.size ?? sideSlot?.size ?? geometry.binSize;
  const motion = { '--dx': `${from.x - to.x}px`, '--dy': `${from.y - to.y}px` } as CSSProperties;
  return (
    <SortOverlayFrame testId="rotate-match" settings={sort.settings}>
      <g transform={`translate(${to.x},${to.y})`}>
        <g className={styles.rotateMatch} style={motion} data-rotate-match="true">
          <g transform={`scale(${size / 100})`}>
            <ObjectArt
              id={side.id}
              color={String(side.attrs['color'])}
              size={String(side.attrs['size'])}
              lying={false}
              gray={false}
            />
          </g>
        </g>
      </g>
    </SortOverlayFrame>
  );
}
