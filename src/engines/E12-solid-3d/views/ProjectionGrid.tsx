/**
 * E12 투영 뷰 & 보기 투영 격자(위·앞·오른쪽 옆).
 *
 * - 채운 칸은 진한 색 + 빗금 무늬로 구분한다(색만으로 구분 금지).
 * - 숫자(높이·개수)는 그리지 않는다.
 * - `data-testid`가 `-canvas`로 끝나면 안 된다(T122 판 맞춤 규칙).
 */
import { useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { clamp } from '../../../core/engine-sdk';
import { solid3dStrings as S } from '../strings.ko';
import type { FocusCell, ProjectionView } from '../types';
import styles from '../View.module.css';

const DEFAULT_CELL = 20;

export interface ProjectionGridProps {
  readonly view: ProjectionView;
  readonly matrix: readonly (readonly number[])[];
  readonly title: string;
  readonly testId: string;
  readonly cellSize?: number;
  readonly focus?: FocusCell | null;
  readonly onFocusCell?: (cell: FocusCell | null) => void;
  readonly readOnly?: boolean;
}

export function ProjectionGrid({
  view,
  matrix,
  title,
  testId,
  cellSize = DEFAULT_CELL,
  focus = null,
  onFocusCell,
  readOnly = false,
}: ProjectionGridProps) {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const interactive = typeof onFocusCell === 'function' && !readOnly;
  const [cursor, setCursor] = useState<readonly [number, number]>([0, 0]);
  const [svgFocused, setSvgFocused] = useState(false);

  if (rows === 0 || cols === 0) return null;

  const cell = cellSize;
  const scale = cell / DEFAULT_CELL;
  const pad = Math.round(6 * scale);
  const frontLabelSpace = Math.round(18 * scale);
  const frontLabelOffset = Math.round(14 * scale);
  const frontLabelFontSize = Math.round(12 * scale);

  const hasFrontLabel = view === 'top' || view === 'side';
  const width = pad * 2 + cols * cell;
  const height = pad * 2 + rows * cell + (hasFrontLabel ? frontLabelSpace : 0);
  const patternId = `e12-proj-hatch-${testId}`;

  const toggleCell = (row: number, col: number) => {
    if (!onFocusCell || readOnly) return;
    const same = focus !== null && focus.view === view && focus.row === row && focus.col === col;
    onFocusCell(same ? null : { view, row, col });
  };

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const key = event.key;
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      const nr =
        key === 'ArrowUp'
          ? clamp(cursor[0] - 1, 0, rows - 1)
          : key === 'ArrowDown'
            ? clamp(cursor[0] + 1, 0, rows - 1)
            : cursor[0];
      const nc =
        key === 'ArrowLeft'
          ? clamp(cursor[1] - 1, 0, cols - 1)
          : key === 'ArrowRight'
            ? clamp(cursor[1] + 1, 0, cols - 1)
            : cursor[1];
      setCursor([nr, nc]);
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      toggleCell(cursor[0], cursor[1]);
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      onFocusCell?.(null);
    }
  };

  return (
    <div className={styles.projCard}>
      {title ? <p className={styles.projTitle}>{title}</p> : null}
      <svg
        className={styles.projSvg}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        data-testid={testId}
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? 'application' : 'img'}
        aria-label={title || S.views[view]}
        onFocus={() => setSvgFocused(true)}
        onBlur={() => setSvgFocused(false)}
        onKeyDown={onKeyDown}
      >
        <defs>
          <pattern
            id={patternId}
            width={6}
            height={6}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1={0} y1={0} x2={0} y2={6} stroke="#dbeafe" strokeWidth={2} />
          </pattern>
        </defs>

        {matrix.map((rowVals, r) =>
          rowVals.map((val, c) => {
            const filled = val > 0;
            const isSelected =
              focus !== null && focus.view === view && focus.row === r && focus.col === c;
            const x = pad + c * cell;
            const y = pad + r * cell;
            return (
              <g key={`${r}-${c}`}>
                <rect
                  x={x}
                  y={y}
                  width={cell}
                  height={cell}
                  fill={filled ? '#1d4fa8' : '#ffffff'}
                  stroke="#94a3b8"
                  strokeWidth={1}
                  data-cell={`${r},${c}`}
                  data-filled={filled ? 'true' : 'false'}
                  data-focused={isSelected ? 'true' : undefined}
                  style={interactive ? { cursor: 'pointer' } : undefined}
                  aria-label={S.projectionCellAria(view, r, c, filled)}
                  onClick={() => {
                    if (!interactive) return;
                    setCursor([r, c]);
                    toggleCell(r, c);
                  }}
                />
                {filled ? (
                  <rect
                    x={x}
                    y={y}
                    width={cell}
                    height={cell}
                    fill={`url(#${patternId})`}
                    fillOpacity={0.55}
                    pointerEvents="none"
                  />
                ) : null}
                {isSelected ? (
                  <rect
                    x={x + 1}
                    y={y + 1}
                    width={cell - 2}
                    height={cell - 2}
                    fill="none"
                    stroke="#e8872e"
                    strokeWidth={3}
                    pointerEvents="none"
                  />
                ) : null}
              </g>
            );
          }),
        )}

        {interactive && svgFocused ? (
          <rect
            x={pad + cursor[1] * cell + 2}
            y={pad + cursor[0] * cell + 2}
            width={cell - 4}
            height={cell - 4}
            fill="none"
            stroke="#e8872e"
            strokeWidth={2}
            strokeDasharray="4 2"
            pointerEvents="none"
          />
        ) : null}

        {view === 'top' ? (
          <text
            x={pad + (cols * cell) / 2}
            y={pad + rows * cell + frontLabelOffset}
            textAnchor="middle"
            fontSize={frontLabelFontSize}
            fontWeight={700}
            fill="#3d485c"
          >
            {S.front}
          </text>
        ) : null}

        {view === 'side' ? (
          <text
            x={pad}
            y={pad + rows * cell + frontLabelOffset}
            textAnchor="start"
            fontSize={frontLabelFontSize}
            fontWeight={700}
            fill="#3d485c"
          >
            {S.front}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
