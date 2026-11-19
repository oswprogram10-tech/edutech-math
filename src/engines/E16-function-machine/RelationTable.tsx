/**
 * 대응표(가로 표: 첫 줄 ○, 둘째 줄 □, 한 열 = 한 쌍). 오버레이 기준 SVG(`relation-canvas`)다.
 *
 * 빈칸 DOM에는 학생이 쓴 수만 있다(정답은 어디에도 없다). 식을 시험한 뒤에는
 * 열 아래에 ✓(둥근 초록)·✕(네모 빨강) 표시를 그린다. 모양과 색을 함께 쓴다.
 */
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Column, ColumnCell } from './relation-check';
import { functionStrings as S } from './strings.ko';
import { colX, markTop, row0Top, row1Top, tableLayout } from './table-layout';
import styles from './View.module.css';

export interface RelationTableProps {
  readonly columns: readonly Column[];
  readonly xLabel: string;
  readonly yLabel: string;
  readonly active: string | null;
  /** 강조할 열(마지막으로 넣은 ○의 열 id). */
  readonly highlight: string | null;
  /** 열마다 식이 성립하는지. null이면 표시를 그리지 않는다. */
  readonly holds: readonly (boolean | null)[] | null;
  readonly readOnly: boolean;
  /** 화면 px 배율(1 이상). */
  readonly scale: number;
  readonly onActivate: (cell: string) => void;
}

function valueFont(text: string): number {
  return text.length <= 4 ? 24 : text.length <= 6 ? 18 : 14;
}

export function RelationTable({
  columns,
  xLabel,
  yLabel,
  active,
  highlight,
  holds,
  readOnly,
  scale,
  onActivate,
}: RelationTableProps) {
  const layout = tableLayout(columns.length, xLabel, yLabel);
  const { cellW, cellH, labelW } = layout;
  const rowTop = [row0Top(layout), row1Top(layout)];

  const renderCell = (cell: ColumnCell, x: number, y: number, label: string) => {
    const text = cell.value ?? '';
    if (!cell.blank) {
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={cellW}
            height={cellH}
            fill="#ffffff"
            stroke="#8b96ab"
            strokeWidth={2}
          />
          <text
            x={x + cellW / 2}
            y={y + cellH / 2}
            fontSize={valueFont(text)}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#1d2330"
          >
            {text}
          </text>
        </g>
      );
    }
    const key = cell.key ?? '';
    const isActive = active === key;
    const onKey = (event: ReactKeyboardEvent<SVGGElement>) => {
      if (readOnly) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onActivate(key);
      }
    };
    return (
      <g
        role="button"
        tabIndex={readOnly ? -1 : 0}
        data-cell={key}
        data-active={isActive ? 'true' : undefined}
        aria-label={
          text === '' ? `${label} ${S.relTable.blank}` : `${label} ${S.relTable.blankEntered(text)}`
        }
        style={{ cursor: readOnly ? 'default' : 'pointer' }}
        onClick={() => {
          if (!readOnly) onActivate(key);
        }}
        onFocus={() => {
          if (!readOnly && !isActive) onActivate(key);
        }}
        onKeyDown={onKey}
      >
        <rect
          x={x}
          y={y}
          width={cellW}
          height={cellH}
          fill="#eaf6ec"
          stroke={isActive ? '#e8872e' : '#2e7d46'}
          strokeWidth={isActive ? 5 : 2}
          strokeDasharray={isActive ? undefined : '6 4'}
        />
        <text
          x={x + cellW / 2}
          y={y + cellH / 2}
          fontSize={text === '' ? 26 : valueFont(text)}
          fontWeight={800}
          textAnchor="middle"
          dominantBaseline="central"
          fill={text === '' ? '#5b6577' : '#1d2330'}
        >
          {text === '' ? '?' : text}
        </text>
      </g>
    );
  };

  return (
    <div className={styles.tableScroll} data-testid="relation-scroll">
      <svg
        data-testid="relation-canvas"
        className={styles.tableSvg}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width={layout.width * scale}
        height={layout.height * scale}
        role="group"
        aria-label={S.relTable.tableLabel}
      >
        <title>{S.relTable.canvasLabel}</title>
        {[xLabel, yLabel].map((label, row) => (
          <g key={row}>
            <rect
              x={0}
              y={rowTop[row] ?? 0}
              width={labelW}
              height={cellH}
              fill="#e9eefb"
              stroke="#8b96ab"
              strokeWidth={2}
            />
            <text
              x={labelW / 2}
              y={(rowTop[row] ?? 0) + cellH / 2}
              fontSize={[...label].length > 4 ? 16 : 24}
              fontWeight={800}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#1d2330"
            >
              {label}
            </text>
          </g>
        ))}
        {Array.from({ length: layout.slots }, (_, index) => {
          const column = columns[index];
          const x = colX(layout, index);
          if (column === undefined) {
            return (
              <g key={`empty-${index}`} data-empty="true" aria-hidden="true">
                {rowTop.map((top, row) => (
                  <rect
                    key={row}
                    x={x}
                    y={top}
                    width={cellW}
                    height={cellH}
                    fill="#f7f8fb"
                    stroke="#c7cfdd"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                ))}
              </g>
            );
          }
          const mark = holds?.[index] ?? null;
          const cx = x + cellW / 2;
          const cy = markTop(layout) + layout.markH / 2;
          return (
            <g
              key={column.id}
              data-col={index}
              data-highlight={highlight === column.id ? 'true' : undefined}
            >
              {highlight === column.id ? (
                <rect
                  x={x - 3}
                  y={row0Top(layout) - 3}
                  width={cellW + 6}
                  height={2 * cellH + 6}
                  fill="none"
                  stroke="#2f6fde"
                  strokeWidth={4}
                  rx={4}
                />
              ) : null}
              {renderCell(column.x, x, row0Top(layout), xLabel)}
              {renderCell(column.y, x, row1Top(layout), yLabel)}
              {mark === true ? (
                <g data-mark="ok" role="img" aria-label={S.relTable.markOk}>
                  <circle cx={cx} cy={cy} r={15} fill="#dff3e4" stroke="#2e7d46" strokeWidth={3} />
                  <path
                    d={`M${cx - 7} ${cy} L${cx - 2} ${cy + 6} L${cx + 8} ${cy - 6}`}
                    fill="none"
                    stroke="#2e7d46"
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              ) : null}
              {mark === false ? (
                <g data-mark="bad" role="img" aria-label={S.relTable.markBad}>
                  <rect
                    x={cx - 15}
                    y={cy - 15}
                    width={30}
                    height={30}
                    rx={5}
                    fill="#fde4e4"
                    stroke="#c0392b"
                    strokeWidth={3}
                  />
                  <path
                    d={`M${cx - 7} ${cy - 7} L${cx + 7} ${cy + 7} M${cx + 7} ${cy - 7} L${cx - 7} ${cy + 7}`}
                    stroke="#c0392b"
                    strokeWidth={4}
                    strokeLinecap="round"
                  />
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
