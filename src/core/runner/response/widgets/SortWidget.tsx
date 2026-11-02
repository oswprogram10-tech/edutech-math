/**
 * 카드 분류 위젯.
 * 카드를 골라 상자에 놓거나, 끌어서(Pointer Events) 놓는다. 키보드만으로도 된다.
 */
import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { TargetSize } from '../../../engine-sdk';
import type { ResponseAction, SortField, SortFieldState } from '../types';
import { responseStrings as S } from '../strings.ko';
import styles from '../ResponseView.module.css';

interface SortWidgetProps {
  readonly field: SortField;
  readonly state: SortFieldState;
  readonly dispatch: (action: ResponseAction) => void;
  readonly readOnly: boolean;
  readonly targetSize: TargetSize;
}

export function SortWidget({ field, state, dispatch, readOnly, targetSize }: SortWidgetProps) {
  const dragging = useRef<string | null>(null);
  const cardById = new Map(field.cards.map((card) => [card.id, card]));

  const startDrag = (event: ReactPointerEvent<HTMLElement>, card: string) => {
    if (readOnly) return;
    if ((event.target as HTMLElement).closest('button')) return;
    dragging.current = card;
  };

  const dropAt = (bin: string) => {
    const card = dragging.current;
    dragging.current = null;
    if (!card) return;
    dispatch({ type: 'sort-place-card', field: field.id, card, bin });
  };

  const cardButton = (cardId: string, where: string) => {
    const card = cardById.get(cardId);
    const label = card?.label ?? cardId;
    const picked = state.picked === cardId;
    return (
      <button
        key={`${where}-${cardId}`}
        type="button"
        className={`${styles.sortCard} ${picked ? styles.sortCardPicked : ''}`}
        style={{ minHeight: targetSize }}
        aria-pressed={picked}
        aria-label={`${label} ${S.sortPick}`}
        disabled={readOnly}
        data-sort-card={cardId}
        onPointerDown={(event) => startDrag(event, cardId)}
        onClick={() => dispatch({ type: 'sort-pick', field: field.id, card: cardId })}
      >
        {label}
        {picked ? (
          <span className={styles.check} aria-hidden="true">
            ✓
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div
      className={styles.sort}
      role="group"
      aria-label={S.sortGroup}
      data-response-kind="sort"
      data-response-field={field.id}
    >
      <section
        className={styles.sortSource}
        aria-label={S.sortUnsorted}
        onPointerUp={() => {
          const card = dragging.current;
          dragging.current = null;
          if (card) dispatch({ type: 'sort-remove', field: field.id, card });
        }}
      >
        <h5 className={styles.sortHeading}>{S.sortUnsorted}</h5>
        <div className={styles.sortCards}>
          {state.unsorted.map((card) => cardButton(card, 'unsorted'))}
        </div>
      </section>

      <div className={styles.sortBins}>
        {field.bins.map((bin) => {
          const placed = state.bins[bin.id] ?? [];
          return (
            <section
              key={bin.id}
              className={styles.sortBin}
              aria-label={bin.label}
              data-sort-bin={bin.id}
              onPointerUp={() => dropAt(bin.id)}
            >
              <h5 className={styles.sortHeading}>{bin.label}</h5>
              <button
                type="button"
                className={styles.sortPlace}
                style={{ minHeight: targetSize }}
                aria-label={`${bin.label} ${S.sortPlace}`}
                disabled={readOnly || state.picked === null}
                onClick={() => dispatch({ type: 'sort-place', field: field.id, bin: bin.id })}
              >
                {S.sortPlace}
              </button>
              <div className={styles.sortCards}>
                {placed.map((cardId) => (
                  <span key={`${bin.id}-${cardId}`} className={styles.sortPlaced}>
                    {cardButton(cardId, bin.id)}
                    <button
                      type="button"
                      className={styles.sortRemove}
                      style={{ minWidth: targetSize, minHeight: targetSize }}
                      aria-label={`${cardById.get(cardId)?.label ?? cardId} ${S.sortRemove}`}
                      disabled={readOnly}
                      onClick={() =>
                        dispatch({ type: 'sort-remove', field: field.id, card: cardId })
                      }
                    >
                      <span aria-hidden="true">↩</span>
                    </button>
                  </span>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
