/**
 * E17 sort 모드 화면: 카드를 상자에 끌어 넣고(또는 눌러 든 뒤 상자를 눌러 넣고) 개수를 센다.
 *
 * 비밀·정답이 없는 모드지만 `valueCounts`(기준 값별 실제 개수)는 화면에 그리지 않는다.
 * 개수표 `student`일 때 DOM에는 학생이 적은 수만 있다.
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
import { BoardFrame } from '../board/BoardFrame';
import { boardStyles } from '../board/styles';
import { deckDefinition } from '../decks';
import type { SorterAction, SorterConfig } from '../types';
import { ArtDefs, CardArt, CriterionIconSvg, IconSvg, ValueIcon } from './art';
import { criterionValues, iconChoices, parseIcon } from './criteria';
import {
  BELT_CARD,
  SORT_TOP,
  SORT_WIDTH,
  binBoxes,
  binHeaderBox,
  sortBoardHeight,
  sortCardSlots,
  sortTargetAt,
} from './layout';
import type { CardSlot } from './layout';
import { binNameOf, cardNameOf } from './names';
import { activeBins, allPlacedOf, currentCard } from './reduce';
import { sortStrings as S } from './strings.ko';
import { COUNT_MAX } from './types';
import type { BinId, SortState } from './types';

const INK = '#1d2330';
const GRID = '#c9d2e2';
const ORANGE = '#e8872e';

type SortViewProps = EngineViewProps<SorterConfig, SortState, SorterAction>;

export function SortView({ state, dispatch, readOnly = false, targetSize }: SortViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const logicalHeight = sortBoardHeight();
  const logical = { width: SORT_WIDTH, height: logicalHeight };
  const rendered = useRenderedSize(svgRef);
  const [held, setHeld] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const pressed = useRef<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);

  const settings = state.settings;
  const definition = deckDefinition(settings.deck);
  const cardsById = new Map(definition.cards.map((card) => [card.id, card]));
  const binIds = activeBins(state);
  const boxes = binBoxes(binIds.length);
  const current = settings.conveyor ? currentCard(state) : null;
  const slots = sortCardSlots(state, current);
  const gray = settings.render === 'gray';
  const allPlaced = allPlacedOf(state);
  const needsCriterion = settings.criterionChoice !== null && state.criterion === null;
  const hit = Math.max(38, Math.min(52, Math.ceil(minTouchRadius(targetSize, rendered, logical))));
  const scale = rendered.width > 0 ? rendered.width / SORT_WIDTH : 0.6;

  const slotAt = (point: Point): CardSlot | null => {
    let best: CardSlot | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const slot of slots) {
      const d = Math.hypot(point.x - slot.center.x, point.y - slot.center.y);
      const radius = Math.max(hit, slot.size / 2);
      if (d <= radius && d < bestDistance) {
        best = slot;
        bestDistance = d;
      }
    }
    return best;
  };

  const moveCard = (card: string, to: BinId | 'tray') => {
    setHeld(null);
    if (to !== 'tray' && needsCriterion) {
      setStatus(S.needCriterion);
      return;
    }
    const index = to === 'tray' ? -1 : binIds.indexOf(to);
    dispatch({ type: 'move', card, to });
    setStatus(to === 'tray' ? S.backStatus : S.placedStatus(binNameOf(state, to, index)));
  };

  const placeHeld = (to: BinId | 'tray') => {
    if (held !== null) moveCard(held, to);
  };

  const dropTarget = (point: Point): BinId | 'tray' | null => {
    const target = sortTargetAt(point, binIds.length);
    if (target === null) return null;
    if (target.kind === 'tray') return 'tray';
    return binIds[target.index] ?? null;
  };

  const drag = useDrag({
    disabled: readOnly,
    getPoint: (event) => pointerToLogical(event, svgRef.current, logical),
    onStart: (info) => {
      pressed.current = slotAt(info.start)?.id ?? null;
      setDragged(pressed.current);
    },
    onEnd: (info) => {
      const card = pressed.current;
      pressed.current = null;
      setDragged(null);
      const moved = Math.hypot(info.delta.x, info.delta.y) * scale;
      const tap = moved < 10;
      const target = dropTarget(info.current);
      if (card !== null) {
        if (!tap) {
          if (target !== null) moveCard(card, target);
          return;
        }
        setHeld((now) => (now === card ? null : card));
        setStatus('');
        return;
      }
      if (tap && held !== null && target !== null) placeHeld(target);
    },
    onCancel: () => {
      pressed.current = null;
      setDragged(null);
    },
  });

  const onCardKey = (event: ReactKeyboardEvent<SVGGElement>, card: string) => {
    if (readOnly) return;
    if (event.key >= '1' && event.key <= '4') {
      const bin = binIds[Number(event.key) - 1];
      if (bin === undefined) return;
      event.preventDefault();
      moveCard(card, bin);
      return;
    }
    if (event.key === '0' || event.key === 'Backspace') {
      event.preventDefault();
      moveCard(card, 'tray');
      return;
    }
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      setHeld((now) => (now === card ? null : card));
      setStatus('');
    }
  };

  const onTargetKey = (event: ReactKeyboardEvent<SVGGElement>, to: BinId | 'tray') => {
    if (readOnly) return;
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    placeHeld(to);
  };

  const hoverTarget = drag.dragging && drag.current ? dropTarget(drag.current) : null;

  const instruction = needsCriterion
    ? S.instructions.pickCriterion
    : settings.countTable === 'student' && allPlaced
      ? S.instructions.counting
      : settings.binLabels === 'student-choice-icon' && !allPlaced
        ? `${S.instructions.nameBins} ${S.instructions.sorting}`
        : settings.conveyor
          ? S.instructions.conveyor
          : S.instructions.sorting;

  const headerOf = (bin: BinId, index: number) => {
    const box = boxes[index];
    if (!box) return null;
    const header = binHeaderBox(box);
    let iconSpec: { attribute: string; value: string } | null = null;
    if (settings.binLabels === 'criterion-values' && state.criterion !== null) {
      const value = criterionValues(settings.deck, state.criterion)[index];
      if (value !== undefined) iconSpec = { attribute: state.criterion, value };
    } else if (settings.binLabels === 'student-choice-icon') {
      const icon = state.icons[bin] ?? null;
      iconSpec = icon === null ? null : parseIcon(icon);
    }
    const label =
      settings.binLabels === 'none' || iconSpec === null
        ? settings.binLabels === 'student-choice-icon'
          ? S.binUnnamed
          : S.binLabel(index + 1)
        : S.valueName(iconSpec.attribute, iconSpec.value);
    const count = settings.cards.filter((id) => state.binOf[id] === bin).length;
    return (
      <g pointerEvents="none">
        {iconSpec ? (
          <g transform={`translate(${header.x + 38},${header.y + 32}) scale(0.34)`}>
            <ValueIcon attribute={iconSpec.attribute} value={iconSpec.value} />
          </g>
        ) : null}
        <text
          x={header.x + (iconSpec ? 66 : 14)}
          y={header.y + 40}
          fontSize={22}
          fontWeight={700}
          fill={INK}
        >
          {label}
        </text>
        {settings.countTable === 'auto' && allPlaced ? (
          <text
            x={header.x + header.width - 14}
            y={header.y + 40}
            fontSize={24}
            fontWeight={700}
            textAnchor="end"
            fill="#1d4fa8"
          >
            {S.binCount(count)}
          </text>
        ) : null}
      </g>
    );
  };

  const renderCard = (slot: CardSlot) => {
    const card = cardsById.get(slot.id);
    if (!card) return null;
    const isHeld = held === slot.id;
    const isDragged = dragged === slot.id;
    const body = (
      <g
        key={slot.id}
        role="button"
        tabIndex={readOnly ? -1 : 0}
        aria-label={cardNameOf(card)}
        aria-pressed={isHeld}
        data-card={slot.id}
        opacity={isDragged ? 0.35 : 1}
        onKeyDown={(event) => onCardKey(event, slot.id)}
      >
        {isHeld ? (
          <rect
            x={slot.center.x - slot.size / 2 - 4}
            y={slot.center.y - slot.size / 2 - 4}
            width={slot.size + 8}
            height={slot.size + 8}
            rx={12}
            fill="none"
            stroke={ORANGE}
            strokeWidth={3.5}
            strokeDasharray="9 6"
          />
        ) : null}
        <CardArt card={card} size={slot.size} x={slot.center.x} y={slot.center.y} gray={gray} />
      </g>
    );
    if (slot.where === 'belt') {
      return (
        <g key={`belt-${slot.id}`} className={boardStyles.beltCard}>
          {body}
        </g>
      );
    }
    return body;
  };

  const criterionRow =
    settings.criterionChoice !== null ? (
      <div className={boardStyles.group} role="group" aria-label={S.criterionTitle}>
        <p className={boardStyles.groupTitle}>{S.criterionTitle}</p>
        <div className={boardStyles.row}>
          {settings.criterionChoice.map((criterion) => (
            <button
              key={criterion}
              type="button"
              className={`${boardStyles.button} ${boardStyles.iconButton}`}
              aria-pressed={state.criterion === criterion}
              aria-label={S.criterionChoose(S.criterionName[criterion] ?? criterion)}
              data-criterion={criterion}
              disabled={readOnly || state.criterion !== null}
              onClick={() => {
                setStatus('');
                dispatch({ type: 'choose-criterion', criterion });
              }}
            >
              <CriterionIconSvg criterion={criterion} size={targetSize >= 64 ? 30 : 26} />
              <span>{S.criterionName[criterion] ?? criterion}</span>
            </button>
          ))}
          {state.criterion !== null ? (
            <button
              type="button"
              className={boardStyles.button}
              disabled={readOnly}
              onClick={() => {
                setHeld(null);
                setStatus('');
                dispatch({ type: 'change-criterion' });
              }}
            >
              {S.changeCriterion}
            </button>
          ) : null}
        </div>
      </div>
    ) : null;

  const labelRows =
    settings.binLabels === 'student-choice-icon'
      ? binIds.map((bin, index) => (
          <div
            key={`label-${bin}`}
            className={boardStyles.group}
            role="group"
            aria-label={S.labelGroup(index + 1)}
          >
            <p className={boardStyles.groupTitle}>{S.labelGroup(index + 1)}</p>
            <div className={boardStyles.row}>
              {iconChoices(settings.deck).map((icon) => {
                const parsed = parseIcon(icon);
                if (parsed === null) return null;
                return (
                  <button
                    key={icon}
                    type="button"
                    className={`${boardStyles.button} ${boardStyles.iconButton}`}
                    aria-pressed={(state.icons[bin] ?? null) === icon}
                    aria-label={S.valueName(parsed.attribute, parsed.value)}
                    data-icon={icon}
                    disabled={readOnly}
                    onClick={() =>
                      dispatch({
                        type: 'label-bin',
                        bin,
                        icon: (state.icons[bin] ?? null) === icon ? null : icon,
                      })
                    }
                  >
                    <IconSvg
                      attribute={parsed.attribute}
                      value={parsed.value}
                      size={targetSize >= 64 ? 44 : 34}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))
      : null;

  const countRows =
    settings.countTable === 'student' && allPlaced ? (
      <div className={boardStyles.group} role="group" aria-label={S.countTitle}>
        <p className={boardStyles.groupTitle}>{S.countTitle}</p>
        {binIds.map((bin, index) => {
          const name = binNameOf(state, bin, index);
          const value = state.counts[bin] ?? null;
          return (
            <div key={`count-${bin}`} className={boardStyles.binRow} data-count-bin={bin}>
              <span className={boardStyles.binName}>{name}</span>
              <button
                type="button"
                className={boardStyles.button}
                aria-label={`${name} ${S.countDecrease}`}
                disabled={readOnly}
                onClick={() =>
                  dispatch({ type: 'count', bin, value: Math.max(0, (value ?? 0) - 1) })
                }
              >
                −
              </button>
              <input
                className={boardStyles.numberInput}
                type="number"
                inputMode="numeric"
                min={0}
                max={COUNT_MAX}
                aria-label={S.countInput(name)}
                value={value === null ? '' : String(value)}
                disabled={readOnly}
                onChange={(event) => {
                  const text = event.target.value.trim();
                  if (text === '') return;
                  const next = Number(text);
                  if (Number.isInteger(next)) dispatch({ type: 'count', bin, value: next });
                }}
              />
              <button
                type="button"
                className={boardStyles.button}
                aria-label={`${name} ${S.countIncrease}`}
                disabled={readOnly}
                onClick={() =>
                  dispatch({ type: 'count', bin, value: Math.min(COUNT_MAX, (value ?? 0) + 1) })
                }
              >
                +
              </button>
            </div>
          );
        })}
      </div>
    ) : null;

  const hasControls = criterionRow !== null || labelRows !== null || countRows !== null;
  const controls = hasControls ? (
    <div className={boardStyles.sideStack} data-testid="sorter-controls">
      {criterionRow}
      {labelRows}
      {countRows}
    </div>
  ) : null;

  const top = (
    <>
      <p className={boardStyles.instructions}>{instruction}</p>
      <p className={boardStyles.status} role="status" data-testid="sorter-status">
        {held !== null ? S.heldStatus : status}
      </p>
    </>
  );

  const dragCard = dragged !== null ? cardsById.get(dragged) : undefined;

  return (
    <BoardFrame
      mode="sort"
      error={settings.error}
      targetSize={targetSize}
      logicalHeight={logicalHeight}
      top={top}
      controls={controls}
      renderBoard={(svgStyle, className) => (
        <svg
          ref={svgRef}
          className={className}
          style={svgStyle}
          viewBox={`0 0 ${SORT_WIDTH} ${logicalHeight}`}
          role="group"
          aria-label={S.canvasLabel}
          data-testid="sorter-canvas"
          data-mode="sort"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && held !== null) {
              event.preventDefault();
              setHeld(null);
            }
          }}
          {...drag.handlers}
        >
          <ArtDefs />
          <rect width={SORT_WIDTH} height={logicalHeight} fill="#fbfaf6" />

          <g
            role="button"
            tabIndex={readOnly ? -1 : 0}
            aria-label={settings.conveyor ? S.belt : S.tray}
            data-testid="sorter-tray"
            onKeyDown={(event) => onTargetKey(event, 'tray')}
          >
            <rect
              x={0}
              y={0}
              width={SORT_WIDTH}
              height={SORT_TOP}
              fill={hoverTarget === 'tray' ? '#e6edfb' : '#f1f4fa'}
              stroke={GRID}
              strokeWidth={2}
            />
            <text x={20} y={26} fontSize={18} fontWeight={700} fill={INK} pointerEvents="none">
              {settings.conveyor ? S.belt : S.tray}
            </text>
            {settings.conveyor ? (
              <g pointerEvents="none">
                <rect
                  x={150}
                  y={52}
                  width={700}
                  height={120}
                  rx={14}
                  fill="#dfe5f1"
                  stroke={GRID}
                  strokeWidth={2}
                />
                {Array.from({ length: 13 }, (_, index) => (
                  <line
                    key={index}
                    x1={170 + index * 55}
                    y1={52}
                    x2={170 + index * 55}
                    y2={172}
                    stroke="#c3ccdc"
                    strokeWidth={3}
                  />
                ))}
                <text x={20} y={110} fontSize={18} fontWeight={700} fill="#3d485c">
                  {current === null
                    ? S.beltEmpty
                    : S.beltRemaining(
                        settings.cards.filter((id) => state.binOf[id] === null).length,
                      )}
                </text>
              </g>
            ) : null}
            {!settings.conveyor && allPlaced ? (
              <text
                x={SORT_WIDTH / 2}
                y={110}
                fontSize={20}
                textAnchor="middle"
                fill="#6b7486"
                pointerEvents="none"
              >
                {S.trayEmpty}
              </text>
            ) : null}
          </g>

          {needsCriterion ? (
            <text
              x={SORT_WIDTH / 2}
              y={SORT_TOP + 150}
              fontSize={26}
              fontWeight={700}
              textAnchor="middle"
              fill="#6b7486"
            >
              {S.noBinsYet}
            </text>
          ) : null}

          {boxes.map((box, index) => {
            const bin = binIds[index];
            if (bin === undefined) return null;
            return (
              <g
                key={bin}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-label={binNameOf(state, bin, index)}
                data-bin={bin}
                onKeyDown={(event) => onTargetKey(event, bin)}
              >
                <rect
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  rx={14}
                  fill={hoverTarget === bin ? '#e6edfb' : '#ffffff'}
                  stroke={hoverTarget === bin ? '#2f6fde' : GRID}
                  strokeWidth={hoverTarget === bin ? 4 : 3}
                />
                <rect
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={64}
                  rx={14}
                  fill="#eef3fe"
                  stroke="none"
                />
                {headerOf(bin, index)}
              </g>
            );
          })}

          {slots.map((slot) => renderCard(slot))}

          {dragged !== null && dragCard && drag.current ? (
            <g pointerEvents="none">
              <CardArt
                card={dragCard}
                size={BELT_CARD * 0.72}
                x={drag.current.x}
                y={drag.current.y}
                gray={gray}
              />
            </g>
          ) : null}
        </svg>
      )}
    />
  );
}
