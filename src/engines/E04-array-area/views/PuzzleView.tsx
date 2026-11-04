/**
 * T045 area-model `puzzle`: 섞인 넓이 조각을 직사각형으로 조립한다.
 *
 * - 조각 넓이·가로×세로는 문제에 주어진 재료라 보여도 된다(설정 `label`).
 * - 조립이 끝나도 전체 곱·변 길이 합은 화면에 쓰지 않는다.
 * - 조각 선택 + 슬롯 누르기, Tab·방향키·Enter로 끌기 없이 조작한다.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { puzzleRects } from '../layout';
import { arrayAreaStrings as S } from '../strings.ko';
import type { ArrayAreaAction, ArrayAreaConfig, ArrayAreaState } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const BLUE = '#2f6fde';
const MUTED = '#5b6577';
const PIECE_FILLS = ['#dbe7ff', '#e2f3e5', '#fdeedd', '#f3e8ff'];

function uniqueSorted(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

export function PuzzleView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  scale = 1,
  targetSize,
}: EngineViewProps<ArrayAreaConfig, ArrayAreaState, ArrayAreaAction>) {
  const puzzle = state.puzzle;
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  if (puzzle === null) return null;
  const { settings } = state;
  const config = settings.puzzle;
  if (config === null) return null;

  const pieces = puzzle.pieces;
  const widths = uniqueSorted(pieces.map((piece) => piece.w));
  const heights = uniqueSorted(pieces.map((piece) => piece.h));
  const cols = Math.max(1, widths.length);
  const rows = Math.max(1, heights.length);
  const rects = puzzleRects();
  const a = settings.a;
  const b = settings.b;
  const boardScale = Math.min(
    rects.board.width / Math.max(1, a),
    rects.board.height / Math.max(1, b),
  );

  const columnWidths = Array.from({ length: cols }, (_, col) => {
    const placedPiece = pieces.find((piece) => puzzle.placed[piece.id]?.col === col);
    return placedPiece?.w ?? a / cols;
  });
  const rowHeights = Array.from({ length: rows }, (_, row) => {
    const placedPiece = pieces.find((piece) => puzzle.placed[piece.id]?.row === row);
    return placedPiece?.h ?? b / rows;
  });
  const columnX: number[] = [rects.board.x];
  for (let col = 0; col < cols; col += 1) {
    columnX.push((columnX[col] ?? rects.board.x) + (columnWidths[col] ?? 0) * boardScale);
  }
  const rowY: number[] = [rects.board.y];
  for (let row = 0; row < rows; row += 1) {
    rowY.push((rowY[row] ?? rects.board.y) + (rowHeights[row] ?? 0) * boardScale);
  }

  const selectedPiece =
    selected === null ? null : (pieces.find((piece) => piece.id === selected) ?? null);
  const focusSlot = (col: number, row: number) => {
    const nextCol = Math.max(0, Math.min(cols - 1, col));
    const nextRow = Math.max(0, Math.min(rows - 1, row));
    const element = svgRef.current?.querySelector<SVGGElement>(
      `[data-slot="${nextCol},${nextRow}"]`,
    );
    element?.focus();
  };

  const pieceLabel = (piece: { readonly w: number; readonly h: number }, index: number) => {
    if (config.label === 'none') return S.puzzle.pieceLabel(index);
    if (config.label === 'dims')
      return `${S.puzzle.pieceLabel(index)} ${S.puzzle.pieceDims(piece.w, piece.h)}`;
    return `${S.puzzle.pieceLabel(index)} ${S.puzzle.pieceArea(piece.w * piece.h)}`;
  };

  const togglePiece = (id: string) => {
    if (readOnly) return;
    setSelected((current) => (current === id ? null : id));
  };

  return (
    <div className={styles.wrap} data-target-size={targetSize} style={{ width: `${100 * scale}%` }}>
      <div className={styles.toolbar}>
        <span className={styles.groupLabel}>{S.puzzle.box}</span>
        <span className={styles.hint}>{S.instructions['area-model']}</span>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            if (selected === null) return;
            dispatch({ type: 'unplace-piece', id: selected });
            setSelected(null);
          }}
          disabled={
            readOnly || selectedPiece === null || puzzle.placed[selectedPiece.id] === undefined
          }
        >
          {S.puzzle.putBack}
        </button>
      </div>

      <svg
        ref={svgRef}
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={S.puzzle.canvasLabel}
        data-testid="array-canvas"
        data-cpa={cpa}
      >
        <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />

        <rect
          x={rects.box.x}
          y={rects.box.y}
          width={rects.box.width}
          height={rects.box.height}
          fill="#f7f9fd"
          stroke={MUTED}
          strokeWidth={2}
          strokeDasharray="8 5"
        />
        <text x={rects.box.x + 8} y={rects.box.y - 14} fontSize={18} fontWeight={700} fill={INK}>
          {S.puzzle.box}
        </text>

        {pieces.map((piece, index) => {
          const placed = puzzle.placed[piece.id];
          if (placed) return null;
          const cellX = rects.box.x + 12 + (index % 2) * 142;
          const cellY = rects.box.y + 12 + Math.floor(index / 2) * 92;
          const localScale = Math.min(120 / Math.max(1, piece.w), 58 / Math.max(1, piece.h));
          const width = piece.w * localScale;
          const height = piece.h * localScale;
          const fill = PIECE_FILLS[index % PIECE_FILLS.length] ?? '#dbe7ff';
          return (
            <g
              key={`box-${piece.id}`}
              role="button"
              tabIndex={readOnly ? -1 : 0}
              aria-label={pieceLabel(piece, index)}
              aria-pressed={selected === piece.id}
              data-piece={piece.id}
              onClick={() => togglePiece(piece.id)}
              onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  togglePiece(piece.id);
                }
              }}
            >
              <rect
                x={cellX}
                y={cellY}
                width={Math.max(24, width)}
                height={Math.max(18, height)}
                rx={4}
                fill={fill}
                stroke={selected === piece.id ? '#e8872e' : BLUE}
                strokeWidth={selected === piece.id ? 4 : 2}
              />
              {config.label === 'none' ? null : (
                <text
                  x={cellX + Math.max(24, width) / 2}
                  y={cellY + Math.max(18, height) / 2 + 5}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={700}
                  fill={INK}
                  pointerEvents="none"
                >
                  {config.label === 'dims'
                    ? S.puzzle.pieceDims(piece.w, piece.h)
                    : piece.w * piece.h}
                </text>
              )}
            </g>
          );
        })}

        <text x={rects.board.x} y={rects.board.y - 14} fontSize={18} fontWeight={700} fill={INK}>
          {S.puzzle.board}
        </text>

        {Array.from({ length: rows }, (_, row) =>
          Array.from({ length: cols }, (_, col) => {
            const x = columnX[col] ?? rects.board.x;
            const y = rowY[row] ?? rects.board.y;
            const width = (columnX[col + 1] ?? x) - x;
            const height = (rowY[row + 1] ?? y) - y;
            return (
              <g
                key={`slot-${col}-${row}`}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-label={S.puzzle.slotLabel(col, row)}
                data-slot={`${col},${row}`}
                onClick={() => {
                  if (selected === null) return;
                  dispatch({ type: 'place-piece', id: selected, col, row });
                  setSelected(null);
                }}
                onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => {
                  if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    focusSlot(col + 1, row);
                  } else if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    focusSlot(col - 1, row);
                  } else if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    focusSlot(col, row + 1);
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    focusSlot(col, row - 1);
                  } else if ((event.key === 'Enter' || event.key === ' ') && selected !== null) {
                    event.preventDefault();
                    dispatch({ type: 'place-piece', id: selected, col, row });
                    setSelected(null);
                  }
                }}
              >
                <rect
                  x={x + 1}
                  y={y + 1}
                  width={Math.max(2, width - 2)}
                  height={Math.max(2, height - 2)}
                  fill="#ffffff"
                  stroke={MUTED}
                  strokeWidth={1.6}
                  strokeDasharray="7 5"
                />
              </g>
            );
          }),
        )}

        {pieces.map((piece, index) => {
          const placed = puzzle.placed[piece.id];
          if (!placed) return null;
          const x = columnX[placed.col] ?? rects.board.x;
          const y = rowY[placed.row] ?? rects.board.y;
          const width = piece.w * boardScale;
          const height = piece.h * boardScale;
          const fill = PIECE_FILLS[index % PIECE_FILLS.length] ?? '#dbe7ff';
          return (
            <g
              key={`placed-${piece.id}`}
              role="button"
              tabIndex={readOnly ? -1 : 0}
              aria-label={pieceLabel(piece, index)}
              aria-pressed={selected === piece.id}
              data-placed={piece.id}
              onClick={() => togglePiece(piece.id)}
              onKeyDown={(event: ReactKeyboardEvent<SVGGElement>) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  togglePiece(piece.id);
                }
              }}
            >
              <rect
                x={x + 1}
                y={y + 1}
                width={Math.max(2, width - 2)}
                height={Math.max(2, height - 2)}
                fill={fill}
                stroke={selected === piece.id ? '#e8872e' : BLUE}
                strokeWidth={selected === piece.id ? 4 : 2}
              />
              {config.label === 'none' ? null : (
                <text
                  x={x + width / 2}
                  y={y + height / 2 + 5}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={700}
                  fill={INK}
                  pointerEvents="none"
                >
                  {config.label === 'dims'
                    ? S.puzzle.pieceDims(piece.w, piece.h)
                    : piece.w * piece.h}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
