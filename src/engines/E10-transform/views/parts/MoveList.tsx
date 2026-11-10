/** E10 이동 기록 목록. 학생이 한 이동만 차례로 쓴다. */
import { applySquareMove } from '../../square';
import { transformStrings as S } from '../../strings.ko';
import type { Move, SquareFigure } from '../../types';
import styles from '../../View.module.css';
import { moveText } from './move-text';

interface MoveListProps {
  readonly start: SquareFigure;
  readonly moves: readonly Move[];
  readonly emptyLabel?: string;
}

interface MoveEntry {
  readonly key: string;
  readonly text: string;
}

export function MoveList({ start, moves, emptyLabel }: MoveListProps) {
  const items = moves.reduce<{
    readonly figure: SquareFigure;
    readonly items: readonly MoveEntry[];
  }>(
    (state, move, index) => ({
      figure: applySquareMove(state.figure, move),
      items: [...state.items, { key: `move-${index}`, text: moveText(move, state.figure) }],
    }),
    { figure: start, items: [] },
  ).items;
  return (
    <ol className={styles.moveList} data-testid="move-list">
      {items.length === 0 ? (
        <li className={styles.moveEmpty}>{emptyLabel ?? S.panel.noMoves}</li>
      ) : (
        items.map((item) => (
          <li key={item.key} className={styles.moveItem}>
            {item.text}
          </li>
        ))
      )}
    </ol>
  );
}
