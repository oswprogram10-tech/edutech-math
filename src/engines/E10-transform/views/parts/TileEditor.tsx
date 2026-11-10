/**
 * 변 깎기 확대 편집판. 칸 하나가 64px 이상이고, 붙은 칸(반대 변으로 옮긴 칸)은
 * 다른 무늬로 보인다. 방향키로 커서를 옮기고 Enter로 깎는다.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { transformStrings as S } from '../../strings.ko';
import type { Cell, Pt, TransformAction } from '../../types';
import { SQUARE_TILE } from '../../tiles';

interface TileEditorProps {
  readonly customCells: readonly Pt[];
  readonly dispatch: (action: TransformAction) => void;
  readonly readOnly: boolean;
}

function has(cells: readonly Pt[], cell: Cell): boolean {
  return cells.some((candidate) => candidate[0] === cell[0] && candidate[1] === cell[1]);
}

export function TileEditor({ customCells, dispatch, readOnly }: TileEditorProps) {
  const [cursor, setCursor] = useState<Cell>([0, 2]);
  const [focused, setFocused] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const key = event.key;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      dispatch({ type: 'toggle-notch', cell: cursor });
      return;
    }
    if (!key.startsWith('Arrow')) return;
    event.preventDefault();
    setCursor((current) => {
      const x =
        key === 'ArrowLeft'
          ? Math.max(0, current[0] - 1)
          : key === 'ArrowRight'
            ? Math.min(SQUARE_TILE - 1, current[0] + 1)
            : current[0];
      const y =
        key === 'ArrowUp'
          ? Math.max(0, current[1] - 1)
          : key === 'ArrowDown'
            ? Math.min(SQUARE_TILE - 1, current[1] + 1)
            : current[1];
      return [x, y];
    });
  };

  const cells: Cell[] = [];
  for (let y = 0; y < SQUARE_TILE; y += 1) {
    for (let x = 0; x < SQUARE_TILE; x += 1) cells.push([x, y]);
  }

  return (
    <section
      ref={boardRef}
      className={undefined}
      data-testid="tile-editor"
      aria-label={S.tessellation.editorTitle}
      tabIndex={readOnly ? -1 : 0}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={onKeyDown}
      style={{ display: 'inline-block', outline: focused ? '3px solid #e8872e' : 'none' }}
    >
      <p style={{ margin: '0 0 0.35rem', color: '#3b4558', fontSize: '0.84rem', fontWeight: 700 }}>
        {S.tessellation.editorTitle}
      </p>
      <div
        role="grid"
        aria-label={S.tessellation.editorTitle}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${SQUARE_TILE}, 64px)`,
          gap: 2,
          background: '#c9d2e2',
          padding: 2,
          borderRadius: 8,
        }}
      >
        {cells.map((cell) => {
          const filled = has(customCells, cell);
          const selected = cell[0] === cursor[0] && cell[1] === cursor[1];
          return (
            <button
              key={`${cell[0]},${cell[1]}`}
              type="button"
              role="gridcell"
              data-cell={`${cell[0]},${cell[1]}`}
              data-filled={filled ? 'true' : 'false'}
              aria-label={`${cell[0] + 1}번째 줄 ${cell[1] + 1}번째 칸`}
              aria-pressed={filled}
              disabled={readOnly}
              onClick={() => {
                setCursor(cell);
                dispatch({ type: 'toggle-notch', cell });
              }}
              style={{
                width: 64,
                height: 64,
                border: selected ? '3px solid #e8872e' : '1px solid #9aa7bd',
                borderRadius: 6,
                background: filled ? '#dbe7ff' : '#ffffff',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
                {filled ? (
                  <rect
                    x="10"
                    y="10"
                    width="44"
                    height="44"
                    fill="none"
                    stroke="#1d4fa8"
                    strokeWidth="3"
                    strokeDasharray="7 5"
                  />
                ) : (
                  <line x1="16" y1="48" x2="48" y2="16" stroke="#b0b9c9" strokeWidth="2" />
                )}
              </svg>
            </button>
          );
        })}
      </div>
      <p style={{ margin: '0.35rem 0 0', color: '#5b6577', fontSize: '0.82rem' }}>
        {S.tessellation.editorHint}
      </p>
    </section>
  );
}
