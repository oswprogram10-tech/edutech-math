/**
 * E19 words 판(논리 1000×600 SVG). 0~1 수직선 칸(five 또는 three)에 말 카드·상황 카드를 끌어 놓는다.
 * 한 칸에 여러 장을 놓을 수 있고 아래에서 위로 쌓는다. 끌기는 손을 뗄 때 Action 한 번(place·unplace)만 보낸다.
 * 키보드: Tab으로 카드 → ←→로 칸 → Enter(또는 Space)로 놓기, Delete로 빼기.
 */
import { useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { pointerToLogical, useDrag } from '../../core/engine-sdk';
import {
  WORDS,
  cardPosition,
  slotAtX,
  slotCenterX,
  slotWidth,
  wordsSlotName,
  wrapText,
} from './layout';
import { E19_STRINGS as S } from './strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import type { WordsState } from './types';
import type { ChanceUi } from './useChanceUi';

const INK = '#1d2330';
const ACCENT = '#e8872e';
const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };

interface Props {
  readonly state: WordsState;
  readonly ui: ChanceUi;
  readonly readOnly: boolean;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

export function WordsBoard({ state, ui, readOnly, svgStyle, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const count = state.slotValues.length;
  const sw = slotWidth(count);

  const drag = useDrag({
    disabled: readOnly,
    getPoint: (event) => pointerToLogical(event, svgRef.current, LOGICAL),
    onEnd: (info) => {
      const id = dragRef.current;
      dragRef.current = null;
      setDragId(null);
      if (id === null) return;
      const { x, y } = info.current;
      if (y >= WORDS.slotTop && y < WORDS.trayTop) {
        const slot = slotAtX(count, x);
        const value = slot === null ? undefined : state.slotValues[slot];
        if (value !== undefined) ui.send({ type: 'place', cardId: id, slot: value });
      } else if (y >= WORDS.trayTop) {
        ui.send({ type: 'unplace', cardId: id });
      }
    },
    onCancel: () => {
      dragRef.current = null;
      setDragId(null);
    },
  });

  const startDrag = (id: string, index: number, event: ReactPointerEvent<Element>) => {
    if (readOnly) return;
    dragRef.current = id;
    setDragId(id);
    ui.selectWordsCard(index);
    drag.handlers.onPointerDown(event);
  };

  const onKeyDown = (index: number) => (event: ReactKeyboardEvent<SVGGElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey || readOnly) return;
    if (event.key === 'ArrowLeft') ui.moveWordsSlot(-1);
    else if (event.key === 'ArrowRight') ui.moveWordsSlot(1);
    else if (event.key === 'Enter' || event.key === ' ') {
      ui.selectWordsCard(index);
      ui.placeWords();
    } else if (event.key === 'Delete' || event.key === 'Backspace') ui.unplaceWords();
    else return;
    event.preventDefault();
  };

  const overSlot =
    drag.dragging &&
    drag.current &&
    drag.current.y >= WORDS.slotTop &&
    drag.current.y < WORDS.trayTop
      ? slotAtX(count, drag.current.x)
      : null;
  const showCursor = focused;

  return (
    <svg
      ref={svgRef}
      className={className}
      style={{ ...svgStyle, touchAction: 'none' }}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      role="group"
      aria-label={S.words.boardLabel}
      data-testid="chance-canvas"
      data-mode="words"
      data-placed={state.cards.filter((c) => state.placements[c.id] !== null).length}
      onPointerMove={drag.handlers.onPointerMove}
      onPointerUp={drag.handlers.onPointerUp}
      onPointerCancel={drag.handlers.onPointerCancel}
    >
      <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="#fbfcff" />
      {state.slotValues.map((value, i) => {
        const x = WORDS.left + sw * i;
        const target = overSlot === i || (showCursor && ui.wordsSlot === i);
        const placedCount = state.cards.filter((c) => state.placements[c.id] === value).length;
        const lines = wrapText(wordsSlotName(state, i), 8);
        return (
          <g
            key={value}
            data-part="slot"
            data-slot={value}
            data-index={i}
            role="img"
            aria-label={S.words.slotLabel(wordsSlotName(state, i), placedCount)}
          >
            <rect
              x={x + 3}
              y={WORDS.slotTop}
              width={sw - 6}
              height={WORDS.slotBottom - WORDS.slotTop}
              rx={12}
              fill={i % 2 === 0 ? '#f1f5fd' : '#f7f1e6'}
              stroke={target ? ACCENT : '#b7c2d8'}
              strokeWidth={target ? 5 : 2}
              strokeDasharray={target ? '10 6' : undefined}
            />
            {lines.map((line, k) => (
              <text
                key={k}
                data-part="slot-name"
                x={slotCenterX(count, i)}
                y={WORDS.slotTop + 26 + k * 22}
                textAnchor="middle"
                fontSize={20}
                fontWeight={800}
                fill={INK}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
      <rect
        x={WORDS.left}
        y={WORDS.trayTop}
        width={WORDS.right - WORDS.left}
        height={LOGICAL_HEIGHT - WORDS.trayTop - 20}
        rx={12}
        fill="#ffffff"
        stroke="#b7c2d8"
        strokeWidth={2}
        strokeDasharray="8 6"
      />
      <text
        x={WORDS.left + 14}
        y={WORDS.trayTop + 26}
        fontSize={17}
        fontWeight={700}
        fill="#3d485c"
      >
        {S.words.trayLabel}
      </text>
      {state.cards.map((card, index) => {
        const placed = state.placements[card.id] ?? null;
        const pos = cardPosition(state, index);
        const slotName = pos.slot === null ? null : wordsSlotName(state, pos.slot);
        const lines = wrapText(card.text, 9);
        const lifted = dragId === card.id;
        const current = showCursor && ui.wordsCard === index;
        return (
          <g
            key={card.id}
            data-part="card"
            data-card={card.id}
            data-slot={placed ?? undefined}
            data-x={pos.x.toFixed(2)}
            role="button"
            tabIndex={readOnly ? -1 : 0}
            aria-label={S.words.cardLabel(card.text, slotName)}
            opacity={lifted ? 0.35 : 1}
            style={{ cursor: readOnly ? 'default' : 'grab' }}
            onPointerDown={(event) => startDrag(card.id, index, event)}
            onKeyDown={onKeyDown(index)}
            onFocus={() => {
              setFocused(true);
              ui.selectWordsCard(index);
            }}
            onBlur={() => setFocused(false)}
          >
            <rect
              data-part="card-box"
              x={pos.x}
              y={pos.y}
              width={WORDS.cardW}
              height={WORDS.cardH}
              rx={10}
              fill="#fffdf6"
              stroke={current ? ACCENT : INK}
              strokeWidth={current ? 5 : 2.5}
            />
            {lines.map((line, k) => (
              <text
                key={k}
                x={pos.x + WORDS.cardW / 2}
                y={pos.y + 28 + k * 19 - (lines.length - 1) * 5}
                textAnchor="middle"
                fontSize={16}
                fontWeight={700}
                fill={INK}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
      {drag.dragging && drag.current && dragId !== null ? (
        <g data-part="ghost" pointerEvents="none">
          <rect
            x={drag.current.x - WORDS.cardW / 2}
            y={drag.current.y - WORDS.cardH / 2}
            width={WORDS.cardW}
            height={WORDS.cardH}
            rx={10}
            fill="#fffdf6"
            fillOpacity={0.9}
            stroke={ACCENT}
            strokeWidth={4}
          />
        </g>
      ) : null}
    </svg>
  );
}
