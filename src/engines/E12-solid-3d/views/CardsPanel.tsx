/**
 * E12 T135 보기 카드(가·나·다…) · 찾은 개수 기록 패널.
 */
import { solid3dStrings as S } from '../strings.ko';
import type { CubesState, ReferenceCardConfig } from '../types';
import styles from '../View.module.css';
import { ProjectionGrid } from './ProjectionGrid';

function CardGraphic({
  card,
  cellSize,
}: {
  readonly card: ReferenceCardConfig;
  readonly cellSize: number;
}) {
  if ((card.kind === 'top' || card.kind === 'front' || card.kind === 'side') && card.cells) {
    return (
      <ProjectionGrid
        view={card.kind}
        matrix={card.cells}
        title=""
        testId={`cubes-cardgrid-${card.id}`}
        cellSize={cellSize}
        readOnly
      />
    );
  }

  if (card.kind === 'layers' && card.layers) {
    return (
      <div className={styles.miniLayersRow}>
        {card.layers.map((layerMat, idx) => {
          const layerCols = layerMat[0]?.length ?? 1;
          return (
            <div key={`card-${card.id}-layer-${idx + 1}`} className={styles.miniLayerBox}>
              <p className={styles.miniLayerTitle}>{S.layerLabel(idx + 1)}</p>
              <div
                className={styles.miniGrid}
                style={{ gridTemplateColumns: `repeat(${layerCols}, auto)` }}
              >
                {layerMat.map((row, r) =>
                  row.map((val, c) => (
                    <div
                      key={`mlc-${r}-${c}`}
                      className={styles.miniLayerCell}
                      data-filled={val > 0 ? 'true' : 'false'}
                    />
                  )),
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (card.kind === 'numbers' && card.cells) {
    const numCols = card.cells[0]?.length ?? 1;
    return (
      <div className={styles.miniGrid} style={{ gridTemplateColumns: `repeat(${numCols}, auto)` }}>
        {card.cells.map((row, r) =>
          row.map((val, c) => (
            <div key={`mnc-${r}-${c}`} className={styles.miniNumCell}>
              {val > 0 ? String(val) : ''}
            </div>
          )),
        )}
      </div>
    );
  }

  return null;
}

export function ReferenceCardsPanel({ state }: { readonly state: CubesState }) {
  const cards = state.settings.referenceCards;
  if (cards.length === 0) return null;
  // 4장 이상일 때 크롬북 두 칸 배치 첫 화면에 들어오도록 격자 칸 크기를 16px로 줄인다.
  const compact = cards.length >= 4;
  const cellSize = compact ? 16 : 24;

  return (
    <div
      className={styles.panelBlock}
      data-testid="cubes-cards"
      data-compact-cards={compact ? 'true' : undefined}
    >
      <p className={styles.projTitle} style={{ textAlign: 'left' }}>
        {S.referenceCardsTitle}
      </p>
      <div className={styles.cardsGrid}>
        {cards.map((card) => (
          <div key={card.id} className={styles.refCard} data-testid={`cubes-card-${card.id}`}>
            <p className={styles.refCardLabel}>{card.label}</p>
            <CardGraphic card={card} cellSize={cellSize} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AttemptLogPanel({ state }: { readonly state: CubesState }) {
  if (!state.settings.attemptLog) return null;
  const { viewsMin, viewsMax } = state.settings;

  return (
    <div className={styles.panelBlock} data-testid="cubes-attempts">
      <p className={styles.projTitle} style={{ textAlign: 'left' }}>
        {S.attemptLogTitle}
      </p>
      <div className={styles.attemptsList}>
        {state.matchedCounts.map((count) => {
          const isMin = viewsMin !== null && count === viewsMin;
          const isMax = viewsMax !== null && count === viewsMax;
          const tags: string[] = [];
          if (isMin) tags.push(S.attemptTagMin);
          if (isMax) tags.push(S.attemptTagMax);
          return (
            <div
              key={`attempt-${count}`}
              className={styles.attemptItem}
              data-attempt={count}
              data-extreme={isMin || isMax ? 'true' : undefined}
            >
              <span>{S.attemptCount(count)}</span>
              {tags.length > 0 ? <span>{tags.join(' · ')}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
