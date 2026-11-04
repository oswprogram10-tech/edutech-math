/**
 * E01 big-number 화면(T043).
 *
 * - 값·읽는 말은 화면에 쓰지 않는다. 숫자 띠는 학생이 자르는 대상이고,
 *   reverse에서는 소리 들은 수(`spoken`)를 절대 그리지 않는다.
 * - 자르기·되돌리기·펼치기·칸 채우기는 모두 버튼과 키보드로 할 수 있다.
 */
import { useRef, useState } from 'react';
import { minTouchRadius, useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps } from '../../../core/engine-sdk';
import {
  BIG_REVERSE_GRID,
  BIG_STRIP,
  bigDigitRects,
  bigGapRects,
  reverseCellRect,
} from '../layout';
import { baseTenStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { BaseTenAction, BaseTenConfig, BaseTenState } from '../types';
import styles from '../View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };

/** 일·만·억·조 기본 색(이름). 설정 `groupColors`가 있으면 그 색을 쓴다. */
const DEFAULT_GROUP_COLORS = ['gray', 'green', 'blue', 'purple'] as const;
const NAMED_COLORS: Readonly<Record<string, string>> = {
  gray: '#5b6577',
  green: '#2f8f4e',
  blue: '#2f6fde',
  purple: '#8a5cc2',
};

function groupColorsOf(config: BaseTenConfig): string[] {
  const source =
    config.groupColors !== undefined && config.groupColors.length > 0
      ? config.groupColors
      : DEFAULT_GROUP_COLORS;
  return Array.from({ length: 4 }, (_, index) => {
    const name = source[index % source.length] ?? 'gray';
    return NAMED_COLORS[name] ?? name;
  });
}

interface Segment {
  readonly start: number;
  readonly end: number;
  readonly group: number;
}

function segmentsOf(value: string, cuts: readonly number[]): Segment[] {
  const length = value.length;
  const bounds = [
    0,
    ...cuts.filter((cut) => cut > 0 && cut < length).sort((a, b) => a - b),
    length,
  ];
  const segments: Segment[] = [];
  for (let index = 0; index < bounds.length - 1; index += 1) {
    const left = bounds[index];
    const right = bounds[index + 1];
    if (left === undefined || right === undefined) continue;
    segments.push({
      start: length - right,
      end: length - left,
      group: bounds.length - 2 - index,
    });
  }
  return segments;
}

function groupOfDigit(segments: readonly Segment[], index: number): number {
  for (const segment of segments) {
    if (index >= segment.start && index < segment.end) return segment.group;
  }
  return 0;
}

function groupName(group: number): string {
  return S.bigGroupNames[group] ?? '';
}

function placeLabelOf(exponent: number): string {
  const group = Math.floor(exponent / 4);
  const place = S.bigPlaceNames[3 - (exponent % 4)] ?? '';
  const unit = groupName(group);
  if (group === 0) return place;
  if (exponent % 4 === 0) return unit;
  return `${place}${unit}`;
}

function PatternDefs({ colors }: { readonly colors: readonly string[] }) {
  return (
    <defs>
      {colors.map((color, group) => (
        <pattern
          key={`pattern-${group}`}
          id={`big-pattern-${group}`}
          width={12}
          height={12}
          patternUnits="userSpaceOnUse"
        >
          {group === 1 ? <circle cx={3} cy={3} r={1.6} fill={color} fillOpacity={0.75} /> : null}
          {group === 2 ? (
            <line
              x1={0}
              y1={12}
              x2={12}
              y2={0}
              stroke={color}
              strokeWidth={2}
              strokeOpacity={0.65}
            />
          ) : null}
          {group === 3 ? (
            <g stroke={color} strokeWidth={1.4} strokeOpacity={0.6}>
              <line x1={0} y1={6} x2={12} y2={6} />
              <line x1={6} y1={0} x2={6} y2={12} />
            </g>
          ) : null}
        </pattern>
      ))}
    </defs>
  );
}

export function BigNumberView({
  config,
  state,
  dispatch,
  cpa,
  readOnly = false,
  scale = 1,
  targetSize,
}: EngineViewProps<BaseTenConfig, BaseTenState, BaseTenAction>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const measured = minTouchRadius(targetSize, rendered, LOGICAL);
  const gapHit = Math.max(12, Math.round(measured));
  const [pendingDigit, setPendingDigit] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);

  const big = state.bigNumber;
  if (!big) return null;
  const reverse = config.reverse !== undefined;
  const groupColors = groupColorsOf(config);

  const toggleCut = (position: number) => {
    if (readOnly) return;
    dispatch({
      type: big.cuts.includes(position) ? 'uncut' : 'cut',
      position,
    });
  };

  const cells = Array.from({ length: 16 }, (_, cell) => cell);
  const segments = segmentsOf(big.value, big.cuts);
  const digitRects = bigDigitRects(big.value.length);
  const gaps = bigGapRects(big.value.length);
  const canExpand = config.expand !== false;

  return (
    <div className={styles.wrap} data-target-size={targetSize} style={{ width: `${100 * scale}%` }}>
      <div className={styles.toolbar}>
        {!reverse ? (
          <p className={styles.hint}>{S.bigNumberStrip}</p>
        ) : (
          <p className={styles.hint}>{S.reverseHint}</p>
        )}
      </div>

      <svg
        ref={svgRef}
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={reverse ? S.reverseCanvasLabel : S.bigNumberCanvasLabel}
        data-testid="base-ten-canvas"
        data-cpa={cpa}
      >
        <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="#fbfaf6" />
        <PatternDefs colors={groupColors} />

        {reverse ? (
          <g role="group" aria-label={S.reverseCanvasLabel}>
            {[0, 1, 2, 3].map((group) => {
              const rect = reverseCellRect(group * 4);
              return (
                <text
                  key={`group-label-${group}`}
                  x={rect.x + rect.width / 2}
                  y={BIG_REVERSE_GRID.y - 12}
                  textAnchor="middle"
                  fontSize={20}
                  fontWeight={700}
                  fill="#5b6577"
                >
                  {groupName(3 - group)}
                </text>
              );
            })}
            {[0, 1, 2, 3].map((place) => {
              const rect = reverseCellRect(place);
              return (
                <text
                  key={`place-label-${place}`}
                  x={BIG_REVERSE_GRID.x - 16}
                  y={rect.y + rect.height / 2 + 7}
                  textAnchor="end"
                  fontSize={18}
                  fill="#5b6577"
                >
                  {S.bigPlaceNames[place]}
                </text>
              );
            })}
            {cells.map((cell) => {
              const rect = reverseCellRect(cell);
              const group = Math.floor(cell / 4);
              const place = cell % 4;
              const digit = big.built[cell] ?? null;
              const selected = selectedCell === cell;
              return (
                <g
                  key={`cell-${cell}`}
                  role="button"
                  tabIndex={readOnly ? -1 : 0}
                  aria-label={S.reverseCell(S.bigPlaceNames[place] ?? '', groupName(3 - group))}
                  aria-pressed={selected}
                  data-reverse-cell={cell}
                  className={styles.block}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    if (readOnly) return;
                    if (pendingDigit !== null) {
                      dispatch({ type: 'place-card', cell, digit: pendingDigit });
                      setSelectedCell(cell);
                      return;
                    }
                    setSelectedCell((current) => (current === cell ? null : cell));
                  }}
                  onKeyDown={(event) => {
                    if (readOnly) return;
                    if (/^[0-9]$/.test(event.key)) {
                      event.preventDefault();
                      dispatch({ type: 'place-card', cell, digit: Number(event.key) });
                      setSelectedCell(cell);
                    } else if (event.key === 'Backspace' || event.key === 'Delete') {
                      event.preventDefault();
                      dispatch({ type: 'clear-cell', cell });
                    } else if (
                      event.key === 'Enter' ||
                      event.key === ' ' ||
                      event.key === 'Spacebar'
                    ) {
                      event.preventDefault();
                      setSelectedCell((current) => (current === cell ? null : cell));
                    }
                  }}
                >
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    rx={10}
                    fill={selected ? '#fff2dc' : '#ffffff'}
                    stroke={selected ? '#e8872e' : '#c9d3e2'}
                    strokeWidth={selected ? 3 : 2}
                  />
                  {digit !== null ? (
                    <text
                      x={rect.x + rect.width / 2}
                      y={rect.y + rect.height / 2 + 11}
                      textAnchor="middle"
                      fontSize={30}
                      fontWeight={700}
                      fill="#1d2330"
                      pointerEvents="none"
                    >
                      {digit}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        ) : (
          <g role="group" aria-label={S.bigNumberStrip}>
            {segments.map((segment) => {
              const color = groupColors[segment.group % groupColors.length] ?? '#5b6577';
              const first = digitRects[segment.start];
              const last = digitRects[segment.end - 1];
              if (!first || !last) return null;
              return (
                <g key={`segment-${segment.group}`}>
                  <rect
                    x={first.x - 4}
                    y={BIG_STRIP.y - 4}
                    width={last.x + last.width - first.x + 8}
                    height={BIG_STRIP.height + 8}
                    rx={14}
                    fill={color}
                    fillOpacity={0.1}
                    stroke={color}
                    strokeOpacity={0.55}
                    strokeWidth={2}
                  />
                  <text
                    x={(first.x + last.x + last.width) / 2}
                    y={BIG_STRIP.y - 18}
                    textAnchor="middle"
                    fontSize={22}
                    fontWeight={700}
                    fill={color}
                    data-group-label={segment.group}
                  >
                    {groupName(segment.group)}
                  </text>
                </g>
              );
            })}

            {big.value.split('').map((digit, index) => {
              const rect = digitRects[index];
              if (!rect) return null;
              const exponent = big.value.length - 1 - index;
              const group = groupOfDigit(segments, index);
              const color = groupColors[group % groupColors.length] ?? '#5b6577';
              const selected = big.selected === exponent;
              const showPlace = big.expanded === group && canExpand;
              return (
                <g
                  key={`digit-${index}`}
                  role="button"
                  tabIndex={readOnly ? -1 : 0}
                  aria-label={S.selectDigit(digit)}
                  aria-pressed={selected}
                  data-big-digit={exponent}
                  className={styles.block}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    if (!readOnly) dispatch({ type: 'select-digit', position: exponent });
                  }}
                  onKeyDown={(event) => {
                    if (readOnly) return;
                    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                      event.preventDefault();
                      dispatch({ type: 'select-digit', position: exponent });
                    }
                  }}
                >
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    rx={10}
                    fill="#ffffff"
                    stroke={selected ? '#e8872e' : '#c9d3e2'}
                    strokeWidth={selected ? 3 : 2}
                  />
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    rx={10}
                    fill={`url(#big-pattern-${group % groupColors.length})`}
                    stroke="none"
                    pointerEvents="none"
                  />
                  <text
                    x={rect.x + rect.width / 2}
                    y={rect.y + rect.height / 2 + 16}
                    textAnchor="middle"
                    fontSize={40}
                    fontWeight={700}
                    fill="#1d2330"
                    pointerEvents="none"
                  >
                    {digit}
                  </text>
                  {showPlace ? (
                    <text
                      x={rect.x + rect.width / 2}
                      y={rect.y - 8}
                      textAnchor="middle"
                      fontSize={16}
                      fill={color}
                      pointerEvents="none"
                    >
                      {S.bigPlaceNames[3 - (exponent % 4)]}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {gaps.map((gap) => {
              const cut = big.cuts.includes(gap.position);
              const center = gap.rect.x + gap.rect.width / 2;
              return (
                <g
                  key={`gap-${gap.position}`}
                  role="button"
                  tabIndex={readOnly ? -1 : 0}
                  aria-label={cut ? S.uncutAt(gap.position) : S.cutAt(gap.position)}
                  aria-pressed={cut}
                  data-cut-position={gap.position}
                  className={styles.tool}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => toggleCut(gap.position)}
                  onKeyDown={(event) => {
                    if (readOnly) return;
                    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                      event.preventDefault();
                      toggleCut(gap.position);
                    }
                  }}
                >
                  <rect
                    x={center - gapHit}
                    y={BIG_STRIP.y}
                    width={gapHit * 2}
                    height={BIG_STRIP.height}
                    fill="transparent"
                    pointerEvents="all"
                  />
                  <line
                    x1={center}
                    y1={BIG_STRIP.y + 2}
                    x2={center}
                    y2={BIG_STRIP.y + BIG_STRIP.height - 2}
                    stroke={cut ? '#e8872e' : '#aab4c6'}
                    strokeWidth={cut ? 4 : 2}
                    strokeDasharray={cut ? undefined : '6 6'}
                    pointerEvents="none"
                  />
                  {cut ? (
                    <circle
                      cx={center}
                      cy={BIG_STRIP.y + 10}
                      r={5}
                      fill="#e8872e"
                      pointerEvents="none"
                    />
                  ) : null}
                </g>
              );
            })}

            {big.selected !== null ? (
              <text
                x={500}
                y={BIG_STRIP.y + BIG_STRIP.height + 34}
                textAnchor="middle"
                fontSize={22}
                fill="#1d4fa8"
              >
                {placeLabelOf(big.selected)}
              </text>
            ) : null}
          </g>
        )}
      </svg>

      {!reverse && canExpand && big.cuts.length > 0 ? (
        <div className={styles.toolbar} role="group" aria-label={S.bigNumberStrip}>
          {segments.map((segment) => {
            const expanded = big.expanded === segment.group;
            const name = groupName(segment.group);
            return (
              <button
                key={`expand-${segment.group}`}
                type="button"
                className={styles.button}
                aria-pressed={expanded}
                disabled={readOnly}
                onClick={() => dispatch({ type: 'expand', group: segment.group })}
              >
                {expanded ? S.collapseGroup(name) : S.expandGroup(name)}
              </button>
            );
          })}
        </div>
      ) : null}

      {reverse ? (
        <>
          <div className={styles.cards} role="group" aria-label={S.digitCards}>
            {Array.from({ length: 10 }, (_, digit) => (
              <button
                key={`digit-card-${digit}`}
                type="button"
                className={styles.card}
                aria-label={S.digitCard(digit)}
                aria-pressed={pendingDigit === digit}
                disabled={readOnly}
                onClick={() => setPendingDigit((current) => (current === digit ? null : digit))}
              >
                {digit}
              </button>
            ))}
          </div>
          <div className={styles.toolbar}>
            <button
              type="button"
              className={styles.button}
              disabled={readOnly || selectedCell === null}
              onClick={() => {
                if (selectedCell !== null) dispatch({ type: 'clear-cell', cell: selectedCell });
              }}
            >
              {S.clearSelectedCell}
            </button>
            <p className={styles.hint}>
              {big.built.some((digit) => digit !== null) ? '' : S.reverseEmpty}
            </p>
          </div>
        </>
      ) : null}

      <p className={styles.instructions}>{S.instructions['big-number']}</p>
    </div>
  );
}
