/**
 * E17 secret-rule predict 화면: "예"·"아니요" 상자에 예시 카드가 있고 위에 새 카드가 하나 있다.
 * 새 카드를 끌어 놓거나 [예 상자]·[아니요 상자] 단추로 예측한다.
 *
 * 비밀 기준(`rule`)은 맞히기 전에 DOM·aria·data-에 없다. 카드의 aria는 보이는 색·모양·구멍 수만 말한다.
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
import { ArtDefs, CardArt } from '../sort/art';
import { cardNameOf } from '../sort/names';
import type { SorterAction, SorterConfig } from '../types';
import { currentOf } from './reduce';
import {
  NEW_CARD,
  PREDICT_CARD,
  PREDICT_HEIGHT,
  PREDICT_TOP,
  PREDICT_WIDTH,
  newCardCenter,
  predictBinBox,
  predictCardSlots,
  predictHeaderBox,
  predictTargetAt,
} from './layout';
import { predictStrings as S } from './strings.ko';
import type { PredictBin, PredictState } from './types';

const INK = '#1d2330';
const GRID = '#c9d2e2';
const ORANGE = '#e8872e';
const LOGICAL = { width: PREDICT_WIDTH, height: PREDICT_HEIGHT };

type PredictViewProps = EngineViewProps<SorterConfig, PredictState, SorterAction>;

export function PredictView({ state, dispatch, readOnly = false, targetSize }: PredictViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const [held, setHeld] = useState(false);
  const pressed = useRef(false);
  const [grabbing, setGrabbing] = useState(false);

  const settings = state.settings;
  const cards = deckDefinition('buttons-12').cards;
  const byId = new Map(cards.map((card) => [card.id, card]));
  const currentId = state.guessedRight ? null : currentOf(state);
  const current = currentId === null ? null : (byId.get(currentId) ?? null);
  const slots = predictCardSlots(state);
  const scale = rendered.width > 0 ? rendered.width / PREDICT_WIDTH : 0.6;
  const hit = Math.max(
    NEW_CARD / 2,
    Math.min(70, Math.ceil(minTouchRadius(targetSize, rendered, LOGICAL))),
  );

  const predict = (bin: PredictBin) => {
    setHeld(false);
    dispatch({ type: 'predict', bin });
  };

  const drag = useDrag({
    disabled: readOnly || current === null,
    getPoint: (event) => pointerToLogical(event, svgRef.current, LOGICAL),
    onStart: (info) => {
      const center = newCardCenter();
      pressed.current = Math.hypot(info.start.x - center.x, info.start.y - center.y) <= hit;
      setGrabbing(pressed.current);
    },
    onEnd: (info) => {
      const grabbed = pressed.current;
      pressed.current = false;
      setGrabbing(false);
      const moved = Math.hypot(info.delta.x, info.delta.y) * scale;
      const target = predictTargetAt(info.current);
      if (grabbed) {
        if (moved >= 10) {
          if (target !== null) predict(target);
          return;
        }
        setHeld((now) => !now);
        return;
      }
      if (moved < 10 && held && target !== null) predict(target);
    },
    onCancel: () => {
      pressed.current = false;
      setGrabbing(false);
    },
  });

  const onCardKey = (event: ReactKeyboardEvent<SVGGElement>) => {
    if (readOnly) return;
    if (event.key === '1' || event.key === '2') {
      event.preventDefault();
      predict(event.key === '1' ? 'yes' : 'no');
      return;
    }
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      setHeld((now) => !now);
    }
  };

  const onBinKey = (event: ReactKeyboardEvent<SVGGElement>, bin: PredictBin) => {
    if (readOnly) return;
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    if (held) predict(bin);
  };

  const hoverTarget =
    drag.dragging && grabbing && drag.current ? predictTargetAt(drag.current) : null;
  const dragging = drag.dragging && grabbing && drag.current !== null;

  const resultText =
    state.lastResult === null ? '' : state.lastResult === 'right' ? S.right : S.wrong;
  const statusText = held
    ? S.heldStatus
    : state.guessedRight
      ? S.allDone
      : state.lastGuessWrong
        ? S.guessWrong
        : resultText === ''
          ? ''
          : `${resultText} · ${S.streak(state.streak)}`;

  const rightOption = state.guessedRight
    ? settings.guessOptions.find((option) =>
        cards.every(
          (card) =>
            (String(card.attrs[option.attribute]) === option.value) ===
            (String(card.attrs[settings.rule.attribute]) === settings.rule.value),
        ),
      )
    : undefined;

  const controls = (
    <div className={boardStyles.sideStack} data-testid="sorter-controls">
      {!state.guessedRight ? (
        <div className={boardStyles.group} role="group" aria-label={S.predictTitle}>
          <p className={boardStyles.groupTitle}>{S.predictTitle}</p>
          <div className={boardStyles.row}>
            <button
              type="button"
              className={boardStyles.button}
              data-predict="yes"
              disabled={readOnly || current === null}
              onClick={() => predict('yes')}
            >
              {S.yesBin}
            </button>
            <button
              type="button"
              className={boardStyles.button}
              data-predict="no"
              disabled={readOnly || current === null}
              onClick={() => predict('no')}
            >
              {S.noBin}
            </button>
          </div>
        </div>
      ) : null}
      {state.unlocked && !state.guessedRight ? (
        <div
          className={boardStyles.group}
          role="group"
          aria-label={S.guessTitle}
          data-testid="guess-panel"
        >
          <p className={boardStyles.groupTitle}>{S.guessTitle}</p>
          <div className={boardStyles.row}>
            {settings.guessOptions.map((option) => (
              <button
                key={`${option.attribute}:${option.value}`}
                type="button"
                className={boardStyles.button}
                disabled={readOnly}
                onClick={() =>
                  dispatch({ type: 'guess', attribute: option.attribute, value: option.value })
                }
              >
                {S.optionName(option.attribute, option.value)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {state.guessedRight && rightOption ? (
        <p className={boardStyles.result} data-testid="guess-result">
          {S.guessRight(S.optionName(rightOption.attribute, rightOption.value))}
        </p>
      ) : null}
    </div>
  );

  const top = (
    <>
      <p className={boardStyles.instructions}>{S.instructions}</p>
      <p className={boardStyles.status} role="status" data-testid="sorter-status">
        {statusText}
      </p>
    </>
  );

  const center = newCardCenter();
  const dragPoint: Point | null = dragging ? drag.current : null;

  return (
    <BoardFrame
      mode="predict"
      error={settings.error}
      targetSize={targetSize}
      logicalHeight={PREDICT_HEIGHT}
      top={top}
      controls={controls}
      renderBoard={(svgStyle, className) => (
        <svg
          ref={svgRef}
          className={className}
          style={svgStyle}
          viewBox={`0 0 ${PREDICT_WIDTH} ${PREDICT_HEIGHT}`}
          role="group"
          aria-label={S.canvasLabel}
          data-testid="sorter-canvas"
          data-mode="predict"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && held) {
              event.preventDefault();
              setHeld(false);
            }
          }}
          {...drag.handlers}
        >
          <ArtDefs />
          <rect width={PREDICT_WIDTH} height={PREDICT_HEIGHT} fill="#fbfaf6" />

          <rect
            x={0}
            y={0}
            width={PREDICT_WIDTH}
            height={PREDICT_TOP}
            fill="#f1f4fa"
            stroke={GRID}
            strokeWidth={2}
          />
          <text x={20} y={28} fontSize={18} fontWeight={700} fill={INK}>
            {S.newCard}
          </text>

          {(['yes', 'no'] as const).map((bin) => {
            const box = predictBinBox(bin);
            const header = predictHeaderBox(bin);
            return (
              <g
                key={bin}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-label={bin === 'yes' ? S.yesBin : S.noBin}
                data-bin={bin}
                onKeyDown={(event) => onBinKey(event, bin)}
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
                  x={header.x}
                  y={header.y}
                  width={header.width}
                  height={header.height}
                  rx={14}
                  fill="#eef3fe"
                />
                <text
                  x={header.x + header.width / 2}
                  y={header.y + 36}
                  fontSize={26}
                  fontWeight={700}
                  textAnchor="middle"
                  fill={INK}
                  pointerEvents="none"
                >
                  {bin === 'yes' ? S.yesName : S.noName}
                </text>
              </g>
            );
          })}

          {slots.map((slot) => {
            const card = byId.get(slot.id);
            if (!card) return null;
            return (
              <g key={slot.id} role="img" aria-label={cardNameOf(card)} data-card={slot.id}>
                <CardArt card={card} size={PREDICT_CARD} x={slot.center.x} y={slot.center.y} />
              </g>
            );
          })}

          {current !== null ? (
            <g
              key={`new-${current.id}`}
              role="button"
              tabIndex={readOnly ? -1 : 0}
              aria-label={`${S.newCard}: ${cardNameOf(current)}`}
              aria-pressed={held}
              data-card={current.id}
              data-new-card="true"
              opacity={dragging ? 0.35 : 1}
              onKeyDown={onCardKey}
            >
              {held ? (
                <rect
                  x={center.x - NEW_CARD / 2 - 6}
                  y={center.y - NEW_CARD / 2 - 6}
                  width={NEW_CARD + 12}
                  height={NEW_CARD + 12}
                  rx={14}
                  fill="none"
                  stroke={ORANGE}
                  strokeWidth={3.5}
                  strokeDasharray="9 6"
                />
              ) : null}
              <CardArt card={current} size={NEW_CARD} x={center.x} y={center.y} />
            </g>
          ) : null}

          {dragPoint !== null && current !== null ? (
            <g pointerEvents="none">
              <CardArt card={current} size={NEW_CARD * 0.8} x={dragPoint.x} y={dragPoint.y} />
            </g>
          ) : null}
        </svg>
      )}
    />
  );
}
