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

const CELL = 20;
const PAD = 6;
const FRONT_LABEL_SPACE = 18;

export interface ProjectionGridProps {
  readonly view: ProjectionView;
  readonly matrix: readonly (readonly number[])[];
  readonly title: string;
  readonly testId: string;
  readonly focus?: FocusCell | null;
  readonly onFocusCell?: (cell: FocusCell | null) => void;
  readonly readOnly?: boolean;
}

export function ProjectionGrid({
  view,
  matrix,
  title,
  testId,
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

  const hasFrontLabel = view === 'top' || view === 'side';
  const width = PAD * 2 + cols * CELL;
  const height = PAD * 2 + rows * CELL + (hasFrontLabel ? FRONT_LABEL_SPACE : 0);
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
      <p className={styles.projTitle}>{title}</p>
      <svg
        className={styles.projSvg}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        data-testid={testId}
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? 'application' : 'img'}
        aria-label={title}
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
            const x = PAD + c * CELL;
            const y = PAD + r * CELL;
            return (
              <g key={`${r}-${c}`}>
                <rect
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
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
                    width={CELL}
                    height={CELL}
                    fill={`url(#${patternId})`}
                    fillOpacity={0.55}
                    pointerEvents="none"
                  />
                ) : null}
                {isSelected ? (
                  <rect
                    x={x + 1}
                    y={y + 1}
                    width={CELL - 2}
                    height={CELL - 2}
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
            x={PAD + cursor[1] * CELL + 2}
            y={PAD + cursor[0] * CELL + 2}
            width={CELL - 4}
            height={CELL - 4}
            fill="none"
            stroke="#e8872e"
            strokeWidth={2}
            strokeDasharray="4 2"
            pointerEvents="none"
          />
        ) : null}

        {view === 'top' ? (
          <text
            x={PAD + (cols * CELL) / 2}
            y={PAD + rows * CELL + 14}
            textAnchor="middle"
            fontSize={12}
            fontWeight={700}
            fill="#3d485c"
          >
            {S.front}
          </text>
        ) : null}

        {view === 'side' ? (
          <text
            x={PAD}
            y={PAD + rows * CELL + 14}
            textAnchor="start"
            fontSize={12}
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
