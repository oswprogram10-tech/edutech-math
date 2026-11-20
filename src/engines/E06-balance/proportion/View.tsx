/**
 * E06 `proportion` 화면. 판(SVG)은 equation과 같은 맞춤 규칙(남는 칸, 최소 배율 0.6, 가로 스크롤)을 쓰고
 * 조작 칸은 스크롤 상자 밖에 있다. 설정 오류면 오류 문구만 보인다.
 * 조작: □ 슬라이더(Pointer Events) + −/+ 단추 + 키보드 ←→, 카드 단추, 항 단추 넷(pairSelect), [처음으로].
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { fitBoard } from '../fit';
import { balanceStrings as S } from '../strings.ko';
import styles from '../View.module.css';
import { ProportionBoard } from './Board';
import { equationText } from './settings';
import type { ProportionAction, ProportionConfig, ProportionState } from './types';

const P = S.proportion;

/** 슬라이더 끝 여백(막대 양쪽 14px)의 두 배 = 손잡이 지름. CSS .sliderThumb와 맞춘다. */
const THUMB = 28;

type Dispatch = (action: ProportionAction) => void;

interface SliderProps {
  readonly state: ProportionState;
  readonly dispatch: Dispatch;
  readonly disabled: boolean;
}

/** □ 슬라이더. 끄는 동안은 지역 값만 바꾸고, 놓을 때·단추·키보드로 바꿀 때 `try`를 기록한다. */
function BoxSlider({ state, dispatch, disabled }: SliderProps) {
  const { min, max } = state.settings.slider;
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const current = state.tryValue === null ? null : Number(state.tryValue);
  const shown = drag ?? current;

  const commit = (value: number) => {
    const clamped = Math.min(max, Math.max(min, value));
    if (String(clamped) !== state.tryValue) dispatch({ type: 'try', value: String(clamped) });
  };
  /** 아직 넣지 않았으면 어느 쪽으로 한 칸 움직여도 첫 값(min)부터 시작한다. */
  const nudge = (delta: number) => {
    if (disabled) return;
    commit(current === null ? min : current + delta);
  };
  const valueAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= THUMB) return min;
    const ratio = Math.min(
      1,
      Math.max(0, (clientX - rect.left - THUMB / 2) / (rect.width - THUMB)),
    );
    return min + Math.round(ratio * (max - min));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 일부 환경은 포인터 캡처를 지원하지 않는다. 끌기는 그래도 동작한다.
    }
    setDrag(valueAt(event.clientX));
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag !== null) setDrag(valueAt(event.clientX));
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    const value = valueAt(event.clientX);
    setDrag(null);
    commit(value);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      nudge(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      nudge(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      commit(min);
    } else if (event.key === 'End') {
      event.preventDefault();
      commit(max);
    }
  };

  const ratio = shown === null || max === min ? 0 : (shown - min) / (max - min);
  return (
    <div className={styles.group} role="group" aria-label={P.slider.group}>
      <span className={styles.fieldHint}>{P.slider.hint}</span>
      <div className={styles.sliderRow}>
        <button
          type="button"
          className={`${styles.button} ${styles.stepButton}`}
          disabled={disabled}
          aria-label={P.slider.minus}
          data-testid="slider-minus"
          onClick={() => nudge(-1)}
        >
          −
        </button>
        <div
          ref={trackRef}
          className={styles.slider}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={P.slider.label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={shown ?? min}
          aria-valuetext={shown === null ? P.slider.none : String(shown)}
          aria-disabled={disabled || undefined}
          data-testid="proportion-slider"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
          onKeyDown={onKeyDown}
        >
          <div className={styles.sliderTrack} />
          <div
            className={styles.sliderThumb}
            data-empty={shown === null ? 'true' : undefined}
            style={{ left: `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${ratio})` }}
          />
        </div>
        <button
          type="button"
          className={`${styles.button} ${styles.stepButton}`}
          disabled={disabled}
          aria-label={P.slider.plus}
          data-testid="slider-plus"
          onClick={() => nudge(1)}
        >
          +
        </button>
      </div>
      <p className={styles.made} data-testid="proportion-value">
        {shown === null ? P.slider.none : P.slider.value(String(shown))}
      </p>
    </div>
  );
}

function CardButtons({
  state,
  dispatch,
  disabled,
}: {
  readonly state: ProportionState;
  readonly dispatch: Dispatch;
  readonly disabled: boolean;
}) {
  return (
    <div className={styles.group} role="group" aria-label={P.cards.group}>
      <span className={styles.fieldHint}>{P.cards.hint}</span>
      <div className={styles.row}>
        {state.cards.map((card, index) => (
          <button
            key={index}
            type="button"
            className={styles.button}
            disabled={disabled}
            aria-pressed={state.cardIndex === index}
            data-testid={`card-${index}`}
            onClick={() => dispatch({ type: 'select-card', index })}
          >
            {equationText(card)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 항 단추 넷: 둘을 고르면 왼쪽 격자가 만들어진다(고른 순서가 가로·세로). */
function PairButtons({
  state,
  dispatch,
  disabled,
}: {
  readonly state: ProportionState;
  readonly dispatch: Dispatch;
  readonly disabled: boolean;
}) {
  const [pending, setPending] = useState<number | null>(null);
  const noTerms = state.terms.length !== 4;
  const off = disabled || noTerms;
  const labelOf = (index: number): string => {
    const term = state.terms[index];
    if (term === undefined) return '·';
    return term ?? state.tryValue ?? '□';
  };
  const pick = (index: number) => {
    if (off) return;
    if (pending === null) {
      setPending(index);
    } else if (pending === index) {
      setPending(null);
    } else {
      dispatch({ type: 'pick-pair', indices: [pending, index] });
      setPending(null);
    }
  };
  const chosen = state.pair;
  return (
    <div className={styles.group} role="group" aria-label={P.pair.group}>
      <span className={styles.fieldHint}>{P.pair.hint}</span>
      <div className={styles.row}>
        {[0, 1, 2, 3].map((index) => {
          const selected =
            pending === index || (pending === null && chosen !== null && chosen.includes(index));
          return (
            <button
              key={index}
              type="button"
              className={styles.button}
              disabled={off}
              aria-pressed={selected}
              aria-label={P.termLabel(P.ordinal[index] ?? '', labelOf(index))}
              data-testid={`term-${index}`}
              onClick={() => pick(index)}
            >
              {labelOf(index)}
            </button>
          );
        })}
      </div>
      <p className={styles.made} data-testid="pair-message">
        {noTerms
          ? P.pair.waitCard
          : pending !== null
            ? P.pair.more
            : chosen !== null
              ? P.pair.made(P.ordinal[chosen[0]] ?? '', P.ordinal[chosen[1]] ?? '')
              : ''}
      </p>
    </div>
  );
}

export function ProportionView({
  state,
  dispatch,
  targetSize,
  readOnly = false,
}: EngineViewProps<ProportionConfig, ProportionState, ProportionAction>) {
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useRenderedSize(boardRef);

  if (state.error !== null) {
    return (
      <div className={styles.wrap} data-target-size={targetSize} data-testid="balance-error-wrap">
        <div className={styles.errorBoard} role="alert" data-testid="balance-error">
          <p>{S.configError}</p>
          <p>{S.configErrorBody}</p>
        </div>
      </div>
    );
  }

  const { svgStyle, scroll } = fitBoard(board);
  const cardMode = state.cards.length > 0;
  const instruction = state.settings.pairSelect
    ? P.instructions.pair
    : cardMode
      ? P.instructions.cards
      : state.boxIndex !== null
        ? P.instructions.slider
        : P.instructions.fixed;

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-look={state.settings.look}
      data-mode="proportion"
    >
      <div className={styles.stageRow}>
        <div
          ref={boardRef}
          className={styles.boardArea}
          data-scroll={scroll ? 'true' : 'false'}
          data-testid="balance-board"
        >
          <ProportionBoard state={state} svgStyle={svgStyle} className={styles.boardSvg} />
        </div>
        <div className={styles.sideStack} data-testid="balance-controls">
          <p className={styles.instructions}>{instruction}</p>
          {cardMode ? <CardButtons state={state} dispatch={dispatch} disabled={readOnly} /> : null}
          {state.settings.pairSelect ? (
            <PairButtons state={state} dispatch={dispatch} disabled={readOnly} />
          ) : null}
          {state.boxIndex !== null ? (
            <BoxSlider state={state} dispatch={dispatch} disabled={readOnly} />
          ) : null}
          <div className={styles.row}>
            <button
              type="button"
              className={styles.button}
              disabled={readOnly}
              onClick={() => dispatch({ type: 'reset' })}
            >
              {S.reset}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
