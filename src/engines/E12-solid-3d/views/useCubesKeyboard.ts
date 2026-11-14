/**
 * E12 2D·3D 공용 키보드 조작 훅(방향키·Enter/Space·Backspace/Delete·Q/E·T).
 *
 * 방향키는 현재 `viewTurn` 기준의 화면 방향으로 커서를 옮긴다(자유 궤도 회전은 반영하지 않는다).
 */
import { useCallback } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { stepCursorInScreen } from '../layout';
import type { GridCoord, ViewTurn } from '../types';

export interface UseCubesKeyboardOptions {
  readonly readOnly: boolean;
  readonly editable?: boolean;
  readonly cols: number;
  readonly rows: number;
  readonly cursor: GridCoord;
  readonly viewTurn: ViewTurn;
  readonly rotationLocked: boolean;
  readonly translucentToggle: boolean;
  readonly onMoveCursor: (to: GridCoord) => void;
  readonly onAdd: (x: number, y: number) => void;
  readonly onRemove: (x: number, y: number) => void;
  readonly onTurn: (dir: 'left' | 'right') => void;
  readonly onToggleTranslucent: () => void;
}

export function useCubesKeyboard({
  readOnly,
  editable = true,
  cols,
  rows,
  cursor,
  viewTurn,
  rotationLocked,
  translucentToggle,
  onMoveCursor,
  onAdd,
  onRemove,
  onTurn,
  onToggleTranslucent,
}: UseCubesKeyboardOptions) {
  return useCallback(
    (event: ReactKeyboardEvent<HTMLElement | SVGElement>) => {
      if (readOnly) return;
      const key = event.key;
      if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
        if (!editable) return;
        event.preventDefault();
        const next = stepCursorInScreen(cursor, cols, rows, viewTurn, key);
        onMoveCursor(next);
        return;
      }
      if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
        if (!editable) return;
        event.preventDefault();
        onAdd(cursor[0], cursor[1]);
        return;
      }
      if (key === 'Backspace' || key === 'Delete') {
        if (!editable) return;
        event.preventDefault();
        onRemove(cursor[0], cursor[1]);
        return;
      }
      const lower = key.toLowerCase();
      if (lower === 'q' && !rotationLocked) {
        event.preventDefault();
        onTurn('left');
        return;
      }
      if (lower === 'e' && !rotationLocked) {
        event.preventDefault();
        onTurn('right');
        return;
      }
      if (lower === 't' && translucentToggle) {
        event.preventDefault();
        onToggleTranslucent();
      }
    },
    [
      readOnly,
      editable,
      cols,
      rows,
      cursor,
      viewTurn,
      rotationLocked,
      translucentToggle,
      onMoveCursor,
      onAdd,
      onRemove,
      onTurn,
      onToggleTranslucent,
    ],
  );
}
