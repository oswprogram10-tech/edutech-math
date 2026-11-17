/**
 * E12 `net-fold` 읽기 전용 전개도 보기 카드(가·나·다…).
 */
import { NET_PLAIN_STYLE } from '../net/visuals';
import { solid3dStrings as S } from '../strings.ko';
import type { NetCardConfig, NetFoldState } from '../types';
import styles from '../View.module.css';

const CARD_CELL = 18;
const CARD_CELL_LARGE = 30;
const CARD_PAD = 3;

function NetCardMiniSvg({
  card,
  cell,
  ariaLabel,
}: {
  readonly card: NetCardConfig;
  readonly cell: number;
  readonly ariaLabel?: string;
}) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of card.faces) {
    if (f.at[0] < minX) minX = f.at[0];
    if (f.at[1] < minY) minY = f.at[1];
    if (f.at[0] + f.w > maxX) maxX = f.at[0] + f.w;
    if (f.at[1] + f.h > maxY) maxY = f.at[1] + f.h;
  }
  const cols = Math.max(1, maxX - minX);
  const rows = Math.max(1, maxY - minY);
  const w = cols * cell + CARD_PAD * 2;
  const h = rows * cell + CARD_PAD * 2;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden={ariaLabel ? undefined : 'true'}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
    >
      {card.faces.map((f, i) => {
        const fx = CARD_PAD + (f.at[0] - minX) * cell;
        const fy = CARD_PAD + (f.at[1] - minY) * cell;
        const fw = f.w * cell;
        const fh = f.h * cell;
        return (
          <g key={`card-face-${i}`}>
            <rect
              x={fx + 0.5}
              y={fy + 0.5}
              width={Math.max(1, fw - 1)}
              height={Math.max(1, fh - 1)}
              rx={2}
              fill={NET_PLAIN_STYLE.fill}
              stroke={NET_PLAIN_STYLE.stroke}
              strokeWidth={1.2}
            />
            {f.label ? (
              <text
                x={fx + fw / 2}
                y={fy + fh / 2 + 3.5}
                textAnchor="middle"
                fontSize={10}
                fontWeight={800}
                fill="#1d2330"
              >
                {f.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function NetCardsPanel({
  state,
  size = 'normal',
}: {
  readonly state: NetFoldState;
  readonly size?: 'normal' | 'large';
}) {
  const cards = state.settings.netCards;
  if (cards.length === 0) return null;
  const compact = cards.length >= 4;
  const large = size === 'large';
  const cell = large ? CARD_CELL_LARGE : CARD_CELL;

  return (
    <div
      className={large ? styles.netCardsLarge : styles.panelBlock}
      data-testid="net-cards"
      data-compact-cards={compact ? 'true' : undefined}
      data-card-count={cards.length}
      data-card-size={large ? 'large' : undefined}
    >
      {large ? null : (
        <p className={styles.projTitle} style={{ textAlign: 'left' }}>
          {S.referenceCardsTitle}
        </p>
      )}
      <div className={large ? styles.cardsRowLarge : styles.cardsGrid}>
        {cards.map((card) => (
          <div
            key={card.id}
            className={large ? `${styles.refCard} ${styles.refCardLarge}` : styles.refCard}
            data-testid={`net-card-${card.id}`}
          >
            <p className={large ? styles.refCardLabelLarge : styles.refCardLabel}>{card.label}</p>
            <NetCardMiniSvg
              card={card}
              cell={cell}
              ariaLabel={large ? S.net.cardAria(card.label) : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
