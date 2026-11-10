/**
 * E17 venn 모드: 행·열 조건 3×3 표에 카드를 끌어 넣는다.
 *
 * 칸의 맞음/안 맞음은 학생이 놓은 카드에만, 기본은 "맞는지 보기"를 누른 뒤에만
 * 보인다. 어느 칸이 정답인지 엔진이 알려 주지 않는다.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  minTouchRadius,
  pointerToLogical,
  useDrag,
  useRenderedSize,
} from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import { cardNumber, deckCards, deckUnit } from '../deck';
import {
  VENN_CELL_HEIGHT,
  VENN_CELL_WIDTH,
  VENN_TRAY_CELL,
  boxCenter,
  pointInBox,
  vennCardFrame,
  vennCellBox,
  vennTargetAt,
  vennTrayBox,
} from '../layout';
import { cellKey, fitsCell, parseCell } from '../properties';
import { sorterStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type {
  AngleCondition,
  CardId,
  SideCondition,
  SorterAction,
  SorterConfig,
  VennState,
} from '../types';
import { CardShape, SorterDefs } from './CardShape';
import styles from '../View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const PAPER = '#fbfaf6';
const INK = '#1d2330';
const GRID = '#c9d2e2';
const ORANGE = '#e8872e';

type VennViewProps = EngineViewProps<SorterConfig, VennState, SorterAction>;

function fitOf(
  cardId: CardId,
  cell: string,
  rows: readonly AngleCondition[],
  cols: readonly SideCondition[],
): boolean {
  const card = deckCards('triangles-12').find((candidate) => candidate.id === cardId);
  return card ? fitsCell(card, cell, rows, cols) : false;
}

export function VennView({ state, dispatch, cpa, readOnly = false, targetSize }: VennViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const hit = Math.max(10, Math.ceil(minTouchRadius(targetSize, rendered, LOGICAL)));
  const cards = deckCards(state.deck);
  const trayUnit = deckUnit(cards, VENN_TRAY_CELL.width, VENN_TRAY_CELL.height, 14);
  // 한 칸에 12장까지 들어가도록 4×3 슬롯으로 나눈다. 예전 3×2에서는 7장째부터
  // 그려지지 않아 키보드로도 닿지 않았다.
  const cellUnit = deckUnit(cards, VENN_CELL_WIDTH / 4, VENN_CELL_HEIGHT / 3, 6);
  const [held, setHeld] = useState<CardId | null>(null);
  const [impossibleTool, setImpossibleTool] = useState(false);
  const [status, setStatus] = useState('');
  const pressed = useRef<{ readonly card: CardId | null } | null>(null);

  const rows = state.settings.rows;
  const cols = state.settings.cols;
  const marksOn =
    state.settings.marks !== 'hide' && (state.settings.marks === 'show' || cpa !== 'A');

  const cardAt = (point: Point): CardId | null => {
    for (const card of cards) {
      const frame = vennCardFrame(state, card.id);
      if (frame && pointInBox(point, frame.box)) return card.id;
    }
    return null;
  };

  const place = (card: CardId, cell: string | null) => {
    dispatch({ type: 'place', card, cell });
    setHeld(null);
  };

  // 상태 문구는 내부 칸 키(acute|equilateral)가 아니라 학생이 보는 행·열 이름을 쓴다.
  const impossibleMessage = (cell: string, wasMarked: boolean): string => {
    const parsed = parseCell(cell);
    if (!parsed) return '';
    const row = S.angleCondition[parsed.row as AngleCondition] ?? parsed.row;
    const col = S.sideCondition[parsed.col as SideCondition] ?? parsed.col;
    return wasMarked ? S.venn.impossibleOff(row, col) : S.venn.impossibleOn(row, col);
  };

  const feedbackFor = (card: CardId): boolean | null => {
    const cell = state.placements[card];
    if (cell === null || cell === undefined) return null;
    if (state.settings.cellFeedback === 'none') return null;
    if (state.settings.cellFeedback === 'on-check' && state.checked[card] !== cell) return null;
    return fitOf(card, cell, rows, cols);
  };

  const drag = useDrag({
    getPoint: (event) => pointerToLogical(event, svgRef.current, LOGICAL),
    onStart: (info) => {
      if (readOnly) return;
      pressed.current = {
        card: cardAt(info.start),
      };
    },
    onEnd: (info) => {
      if (readOnly) return;
      const pressedInfo = pressed.current;
      pressed.current = null;
      const distance = Math.hypot(info.delta.x, info.delta.y);
      const tap = distance * (rendered.width / LOGICAL.width || 1) < Math.max(8, hit * 0.5);
      const endTarget = vennTargetAt(info.current, rows.length, cols.length);
      const startCard = pressedInfo?.card ?? null;

      if (startCard) {
        if (!tap) {
          if (endTarget?.kind === 'cell') {
            const row = rows[endTarget.row];
            const col = cols[endTarget.col];
            if (row && col) place(startCard, cellKey(row, col));
          } else if (endTarget?.kind === 'tray') {
            place(startCard, null);
          }
          return;
        }
        setHeld((current) => (current === startCard ? null : startCard));
        setStatus('');
        return;
      }

      if (!tap) return;
      if (endTarget?.kind === 'cell') {
        const row = rows[endTarget.row];
        const col = cols[endTarget.col];
        if (!row || !col) return;
        const cell = cellKey(row, col);
        if (impossibleTool) {
          const wasMarked = state.impossible.includes(cell);
          dispatch({ type: 'toggle-impossible', cell });
          setStatus(impossibleMessage(cell, wasMarked));
          return;
        }
        if (held) place(held, cell);
        return;
      }
      if (endTarget?.kind === 'tray' && held) place(held, null);
    },
  });

  const onCardKey = (event: ReactKeyboardEvent<SVGGElement>, card: CardId) => {
    if (readOnly) return;
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    setHeld((current) => (current === card ? null : card));
  };

  const onCellKey = (event: ReactKeyboardEvent<SVGGElement>, cell: string) => {
    if (readOnly) return;
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    if (impossibleTool) {
      const wasMarked = state.impossible.includes(cell);
      dispatch({ type: 'toggle-impossible', cell });
      setStatus(impossibleMessage(cell, wasMarked));
      return;
    }
    if (held) place(held, cell);
  };

  const onTrayKey = (event: ReactKeyboardEvent<SVGGElement>) => {
    if (readOnly) return;
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    if (held) place(held, null);
  };

  const onEscape = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'Escape' && held) {
      event.preventDefault();
      setHeld(null);
    }
  };

  const placedByCell = new Map<string, CardId[]>();
  for (const card of cards) {
    const cell = state.placements[card.id];
    if (cell === null || cell === undefined) continue;
    const list = placedByCell.get(cell) ?? [];
    list.push(card.id);
    placedByCell.set(cell, list);
  }

  // "맞는지 보기"를 누르면 놓인 카드 전체가 한꺼번에 채점되므로,
  // 아직 state.checked가 갱신되기 전에도 놓인 카드 기준으로 센다.
  const placedCards = cards.filter((card) => {
    const cell = state.placements[card.id];
    return cell !== null && cell !== undefined;
  });
  const wrongPlaced = placedCards.filter((card) => {
    const cell = state.placements[card.id];
    return cell !== null && cell !== undefined && !fitOf(card.id, cell, rows, cols);
  }).length;
  const rightPlaced = placedCards.length - wrongPlaced;

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.button}
          aria-pressed={impossibleTool}
          onClick={() => setImpossibleTool((current) => !current)}
          disabled={readOnly}
        >
          {impossibleTool ? S.venn.toolOn : S.venn.toolImpossible}
        </button>
        {state.settings.cellFeedback !== 'none' ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              dispatch({ type: 'check' });
              setStatus(S.venn.checkedStatus(rightPlaced, wrongPlaced));
            }}
            disabled={readOnly}
          >
            {S.venn.check}
          </button>
        ) : null}
        <span className={styles.hint}>{S.venn.hint}</span>
      </div>

      <p className={styles.instructions}>{S.instructions.venn}</p>
      <p className={styles.status} role="status" data-testid="sorter-status">
        {held ? S.venn.heldStatus(S.cardLabel(cardNumber(state.deck, held))) : status}
      </p>

      <div className={styles.canvasArea}>
        <svg
          ref={svgRef}
          className={styles.canvas}
          viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
          role="group"
          aria-label={S.canvasLabel.venn}
          tabIndex={readOnly ? -1 : 0}
          data-testid="sorter-canvas"
          data-mode="venn"
          onKeyDown={onEscape}
          {...drag.handlers}
        >
          <SorterDefs />
          <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />

          <text x={80} y={38} textAnchor="middle" fontSize={17} fontWeight={700} fill={INK}>
            {S.venn.rowHeader} \ {S.venn.colHeader}
          </text>
          {cols.map((col, colIndex) => (
            <text
              key={`col-${col}`}
              x={VENN_CELL_WIDTH / 2 + 160 + colIndex * VENN_CELL_WIDTH}
              y={50}
              textAnchor="middle"
              fontSize={20}
              fontWeight={700}
              fill={INK}
            >
              {S.sideCondition[col]}
            </text>
          ))}
          {rows.map((row, rowIndex) => (
            <text
              key={`row-${row}`}
              x={80}
              y={70 + rowIndex * VENN_CELL_HEIGHT + VENN_CELL_HEIGHT / 2 + 7}
              textAnchor="middle"
              fontSize={20}
              fontWeight={700}
              fill={INK}
            >
              {S.angleCondition[row]}
            </text>
          ))}

          {rows.map((row, rowIndex) =>
            cols.map((col, colIndex) => {
              const cell = cellKey(row, col);
              const box = vennCellBox(rowIndex, colIndex);
              const marked = state.impossible.includes(cell);
              const cellCards = placedByCell.get(cell) ?? [];
              const inside = cellCards.slice(0, 12);
              const shown = inside.map((cardId) => feedbackFor(cardId));
              const hasWrong = shown.includes(false);
              const hasRight = shown.includes(true);
              return (
                <g
                  key={cell}
                  role="button"
                  tabIndex={readOnly ? -1 : 0}
                  aria-label={`${S.angleCondition[row]} · ${S.sideCondition[col]}${marked ? ` · ${S.venn.impossibleText}` : ''}`}
                  data-cell={cell}
                  {...(marked ? { 'data-impossible': 'true' } : {})}
                  onKeyDown={(event) => onCellKey(event, cell)}
                >
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                    fill={
                      hasWrong ? 'url(#sorter-hatch)' : hasRight ? 'url(#sorter-dots)' : '#ffffff'
                    }
                    fillOpacity={hasWrong ? 0.28 : hasRight ? 0.45 : 0.86}
                    stroke={marked ? '#7c3aed' : GRID}
                    strokeWidth={marked ? 4 : 2}
                    strokeDasharray={marked ? '14 8' : undefined}
                    rx={12}
                  />
                  {marked ? (
                    <g pointerEvents="none">
                      <rect
                        x={box.x + 8}
                        y={box.y + 8}
                        width={box.width - 16}
                        height={box.height - 16}
                        fill="url(#sorter-cross)"
                        fillOpacity={0.25}
                        rx={10}
                      />
                      <text
                        x={box.x + box.width - 14}
                        y={box.y + 30}
                        textAnchor="end"
                        fontSize={18}
                        fontWeight={700}
                        fill="#7c3aed"
                      >
                        {S.venn.impossibleText}
                      </text>
                    </g>
                  ) : null}
                  {cellCards.length > 12 ? (
                    <text
                      x={box.x + box.width - 12}
                      y={box.y + box.height - 12}
                      textAnchor="end"
                      fontSize={16}
                      fontWeight={700}
                      fill={INK}
                      pointerEvents="none"
                    >
                      {S.venn.moreCards(cellCards.length - 12)}
                    </text>
                  ) : null}
                </g>
              );
            }),
          )}

          {rows.map((row, rowIndex) =>
            cols.map((col, colIndex) => {
              const cell = cellKey(row, col);
              const box = vennCellBox(rowIndex, colIndex);
              const inside = (placedByCell.get(cell) ?? []).slice(0, 12);
              const slotWidth = box.width / 4;
              const slotHeight = box.height / 3;
              return inside.map((cardId, index) => {
                const card = cards.find((candidate) => candidate.id === cardId);
                if (!card) return null;
                const center = {
                  x: box.x + (index % 4) * slotWidth + slotWidth / 2,
                  y: box.y + Math.floor(index / 4) * slotHeight + slotHeight / 2,
                };
                const feedback = feedbackFor(cardId);
                return (
                  <g
                    key={`placed-${cardId}`}
                    role="button"
                    tabIndex={readOnly ? -1 : 0}
                    aria-label={S.cardLabel(cardNumber(state.deck, cardId))}
                    aria-pressed={held === cardId}
                    data-card={cardId}
                    {...(feedback === null ? {} : { 'data-fit': feedback ? 'true' : 'false' })}
                    onKeyDown={(event) => onCardKey(event, cardId)}
                  >
                    <CardShape
                      card={card}
                      unit={cellUnit}
                      center={center}
                      showMarks={marksOn}
                      tone={held === cardId ? ORANGE : INK}
                    />
                    {feedback === null ? null : (
                      <text
                        x={center.x + slotWidth * 0.32}
                        y={center.y - slotHeight * 0.3}
                        textAnchor="middle"
                        fontSize={20}
                        fontWeight={700}
                        fill={feedback ? '#1c7c54' : '#c2410c'}
                        pointerEvents="none"
                      >
                        {feedback ? S.venn.fitYes : S.venn.fitNo}
                      </text>
                    )}
                  </g>
                );
              });
            }),
          )}

          <g
            role="button"
            tabIndex={readOnly ? -1 : 0}
            aria-label={S.venn.trayLabel}
            data-testid="sorter-tray"
            onKeyDown={onTrayKey}
          >
            <rect
              x={0}
              y={620}
              width={LOGICAL_WIDTH}
              height={380}
              fill="#f1f4fa"
              stroke={GRID}
              strokeWidth={2}
            />
            <text x={20} y={648} fontSize={18} fontWeight={700} fill={INK}>
              {S.venn.trayLabel}
            </text>
          </g>

          {cards.map((card, index) => {
            const cell = state.placements[card.id];
            if (cell !== null && cell !== undefined) return null;
            const box = vennTrayBox(index);
            const feedback = feedbackFor(card.id);
            return (
              <g
                key={`tray-${card.id}`}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-label={S.cardLabel(cardNumber(state.deck, card.id))}
                aria-pressed={held === card.id}
                data-card={card.id}
                {...(feedback === null ? {} : { 'data-fit': feedback ? 'true' : 'false' })}
                onKeyDown={(event) => onCardKey(event, card.id)}
              >
                {held === card.id ? (
                  <rect
                    x={box.x + 4}
                    y={box.y + 4}
                    width={box.width - 8}
                    height={box.height - 8}
                    fill="none"
                    stroke={ORANGE}
                    strokeWidth={3}
                    strokeDasharray="9 6"
                    rx={10}
                  />
                ) : null}
                <CardShape
                  card={card}
                  unit={trayUnit}
                  center={boxCenter(box)}
                  showMarks={marksOn}
                  tone={held === card.id ? ORANGE : INK}
                />
                {feedback === null ? null : (
                  <text
                    x={box.x + box.width - 14}
                    y={box.y + 26}
                    textAnchor="middle"
                    fontSize={20}
                    fontWeight={700}
                    fill={feedback ? '#1c7c54' : '#c2410c'}
                    pointerEvents="none"
                  >
                    {feedback ? S.venn.fitYes : S.venn.fitNo}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
