/**
 * E12 각기둥 전개도 읽기 전용 보기 카드(가·나·다…). 카드마다 전개도를 작게 그린다.
 * 카드가 접히는지는 화면에 쓰지 않는다(관찰의 `cards[].valid`에만 있다).
 */
import { layoutPieces } from '../prismnet/layout';
import { buildPiecesFromSteps } from '../prismnet/model';
import { fitPlaced } from '../prismnet/visuals';
import { solid3dStrings as S } from '../strings.ko';
import type { PrismNetCardSettings, PrismNetState } from '../types';
import styles from '../View.module.css';
import { MiniNet } from './PrismNetMini';

const NORMAL = { w: 150, h: 130, maxCell: 18 } as const;
const LARGE = { w: 260, h: 220, maxCell: 30 } as const;

function CardSvg({
  card,
  state,
  large,
}: {
  readonly card: PrismNetCardSettings;
  readonly state: PrismNetState;
  readonly large: boolean;
}) {
  const dims = large ? LARGE : NORMAL;
  const pieces = buildPiecesFromSteps(card.root, card.steps, card.n) ?? [];
  const placed = layoutPieces(
    pieces.map((p) => ({
      id: p.id,
      type: p.type,
      parent: p.parent,
      parentEdge: p.parentEdge,
      edge: p.edge,
    })),
    card.n,
    state.settings.sideLen,
    state.settings.height,
  );
  const fit = fitPlaced(placed, dims.w, dims.h, 6, dims.maxCell);
  return (
    <svg
      className={large ? styles.prismNetCardSvgLarge : styles.prismNetCardSvg}
      viewBox={`0 0 ${dims.w} ${dims.h}`}
      role={large ? 'img' : undefined}
      aria-label={large ? S.prismNet.cardAria(card.label) : undefined}
      aria-hidden={large ? undefined : 'true'}
    >
      <MiniNet placed={placed} fit={fit} strokeWidth={large ? 2 : 1.4} />
    </svg>
  );
}

export function PrismNetCardsPanel({
  state,
  size = 'normal',
}: {
  readonly state: PrismNetState;
  readonly size?: 'normal' | 'large';
}) {
  const cards = state.settings.netCards;
  if (cards.length === 0) return null;
  const large = size === 'large';
  const compact = cards.length >= 4;

  return (
    <div
      className={large ? styles.netCardsLarge : styles.panelBlock}
      data-testid="prismnet-cards"
      data-compact-cards={compact ? 'true' : undefined}
      data-card-count={cards.length}
      data-card-size={large ? 'large' : undefined}
    >
      {large ? null : (
        <p className={styles.projTitle} style={{ textAlign: 'left' }}>
          {S.referenceCardsTitle}
        </p>
      )}
      <div
        className={large ? styles.cardsRowLarge : styles.cardsGrid}
        data-one-row={large && cards.length <= 3 ? 'true' : undefined}
      >
        {cards.map((card) => (
          <div
            key={card.id}
            className={large ? `${styles.refCard} ${styles.refCardLarge}` : styles.refCard}
            data-testid={`prismnet-card-${card.id}`}
          >
            <p className={large ? styles.refCardLabelLarge : styles.refCardLabel}>{card.label}</p>
            <CardSvg card={card} state={state} large={large} />
          </div>
        ))}
      </div>
    </div>
  );
}
