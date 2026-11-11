/**
 * E17 secret-rule / twenty-questions: 컴퓨터가 seed로 고른 비밀 카드를 질문으로 찾는다.
 *
 * - 비밀 카드는 `solved` 전에는 DOM 어디에도 드러나지 않는다.
 * - 학생이 지운 카드는 직접 뒤집은 것이고, 자동 지우기는 기본이 아니다.
 * - 역할 바꾸기에서는 학생 카드에 대해서만, 방금 답한 질문 하나의 사실을 말한다.
 */
import { useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { cardNumber, deckCards, deckUnit } from '../deck';
import { boxCenter, secretCardBox } from '../layout';
import { sorterStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { CardId, QuestionId, SecretRuleState, SorterAction, SorterConfig } from '../types';
import { CardShape, SorterDefs } from './CardShape';
import styles from '../View.module.css';

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const ORANGE = '#b45309';

type SecretViewProps = EngineViewProps<SorterConfig, SecretRuleState, SorterAction>;

export function TwentyQuestionsView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
}: SecretViewProps) {
  const cards = deckCards(state.deck);
  const unit = deckUnit(cards, 230, 230, 22);
  const [guessTool, setGuessTool] = useState(false);
  const marksOn =
    state.settings.marks !== 'hide' && (state.settings.marks === 'show' || cpa !== 'A');
  const bank = state.settings.questionBank;

  const lastSwap = state.swap.log[state.swap.log.length - 1];
  const evidence =
    lastSwap && lastSwap.answer !== lastSwap.truth
      ? S.secret.evidence[lastSwap.question][lastSwap.truth ? 'yes' : 'no']
      : lastSwap
        ? S.secret.youAreRight
        : '';

  const pressCard = (cardId: CardId) => {
    if (readOnly) return;
    if (state.role === 'answerer') {
      if (state.swap.secret === null && !state.swap.done) {
        dispatch({ type: 'swap-pick', card: cardId });
      }
      return;
    }
    if (state.solved) return;
    if (guessTool) {
      dispatch({ type: 'guess', card: cardId });
      setGuessTool(false);
      return;
    }
    if (state.eliminated.includes(cardId)) dispatch({ type: 'restore', card: cardId });
    else dispatch({ type: 'eliminate', card: cardId });
  };

  const onCardKey = (event: ReactKeyboardEvent<SVGGElement>, cardId: CardId) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    pressCard(cardId);
  };

  const ask = (question: QuestionId) => {
    if (readOnly) return;
    dispatch({ type: 'ask', question });
  };

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.split}>
        <div className={styles.boardArea}>
          <svg
            className={styles.canvasSquare}
            viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
            role="group"
            aria-label={S.canvasLabel['secret-rule']}
            tabIndex={readOnly ? -1 : 0}
            data-testid="sorter-canvas"
            data-mode="questions"
          >
            <SorterDefs />
            <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
            {cards.map((card, index) => {
              const box = secretCardBox(index);
              // 답하는 역할에서는 학생이 고른 카드와 컴퓨터가 지운 카드만 쓴다.
              // state.eliminated는 맞히는 역할의 기록이라 여기서 쓰지 않는다.
              const eliminated =
                state.role === 'answerer'
                  ? state.swap.secret !== null && !state.swap.candidates.includes(card.id)
                  : state.eliminated.includes(card.id);
              const mine = state.role === 'answerer' && state.swap.secret === card.id;
              const isSecret = state.solved && state.secret === card.id;
              const candidate =
                state.role === 'answerer' &&
                state.swap.done &&
                state.swap.candidates.includes(card.id);
              const wrongGuess = state.solved ? false : state.guesses.includes(card.id);
              const tone = mine || isSecret || candidate ? ORANGE : INK;
              return (
                <g
                  key={card.id}
                  role="button"
                  tabIndex={readOnly ? -1 : 0}
                  aria-label={S.cardLabel(cardNumber(state.deck, card.id))}
                  data-card={card.id}
                  aria-pressed={mine}
                  onClick={() => pressCard(card.id)}
                  onKeyDown={(event) => onCardKey(event, card.id)}
                >
                  <rect
                    x={box.x + 3}
                    y={box.y + 3}
                    width={box.width - 6}
                    height={box.height - 6}
                    rx={14}
                    fill={
                      mine || candidate || isSecret ? '#fff5e6' : eliminated ? '#eef1f7' : '#ffffff'
                    }
                    stroke={tone}
                    strokeWidth={mine || isSecret ? 5 : candidate ? 4 : 2}
                    strokeDasharray={candidate && !isSecret ? '10 6' : undefined}
                  />
                  <CardShape
                    card={card}
                    unit={unit}
                    center={boxCenter(box)}
                    showMarks={marksOn}
                    erased={eliminated}
                    tone={tone}
                  />
                  {mine ? (
                    <text
                      x={box.x + box.width / 2}
                      y={box.y + box.height - 14}
                      textAnchor="middle"
                      fontSize={19}
                      fontWeight={700}
                      fill={ORANGE}
                      pointerEvents="none"
                    >
                      {S.secret.mine}
                    </text>
                  ) : null}
                  {isSecret ? (
                    <text
                      x={box.x + box.width / 2}
                      y={box.y + 28}
                      textAnchor="middle"
                      fontSize={19}
                      fontWeight={700}
                      fill={ORANGE}
                      pointerEvents="none"
                    >
                      {S.secret.secretCard}
                    </text>
                  ) : null}
                  {candidate && !isSecret && !mine ? (
                    <text
                      x={box.x + box.width / 2}
                      y={box.y + box.height - 14}
                      textAnchor="middle"
                      fontSize={16}
                      fontWeight={700}
                      fill={ORANGE}
                      pointerEvents="none"
                    >
                      {S.secret.candidate}
                    </text>
                  ) : null}
                  {wrongGuess && !eliminated ? (
                    <text
                      x={box.x + box.width / 2}
                      y={box.y + box.height - 14}
                      textAnchor="middle"
                      fontSize={17}
                      fontWeight={700}
                      fill="#c2410c"
                      pointerEvents="none"
                    >
                      {S.secret.wrongGuess}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>

        <div className={styles.panel}>
          {state.role === 'guesser' ? (
            <>
              <div className={styles.panelBlock}>
                <p className={styles.panelTitle}>{S.secret.questionTitle}</p>
                <div className={styles.buttonList}>
                  {bank.map((question) => {
                    const asked = state.asked.some((entry) => entry.question === question);
                    return (
                      <button
                        key={question}
                        type="button"
                        className={styles.buttonWide}
                        data-question={question}
                        onClick={() => ask(question)}
                        disabled={readOnly || asked || state.solved}
                      >
                        {S.question[question]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.panelBlock}>
                <p className={styles.panelTitle}>{S.secret.logTitle}</p>
                {state.asked.length === 0 ? (
                  <p className={styles.muted}>{S.secret.logEmpty}</p>
                ) : (
                  <ol className={styles.log} data-testid="question-log">
                    {state.asked.map((entry) => (
                      <li key={entry.question}>
                        <span>{S.questionShort[entry.question]}</span>
                        <strong>{entry.answer ? S.secret.yes : S.secret.no}</strong>
                      </li>
                    ))}
                  </ol>
                )}
                <p className={styles.badge}>{S.secret.questionCount(state.asked.length)}</p>
                <p className={styles.badge}>
                  {S.secret.remaining(cards.length - state.eliminated.length)}
                </p>
              </div>

              <div className={styles.row}>
                <button
                  type="button"
                  className={styles.button}
                  aria-pressed={guessTool}
                  onClick={() => setGuessTool((current) => !current)}
                  disabled={readOnly || state.solved}
                >
                  {S.secret.toolGuess}
                </button>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => {
                    setGuessTool(false);
                    dispatch({ type: 'new-round' });
                  }}
                  disabled={readOnly}
                >
                  {S.secret.newGame}
                </button>
              </div>
            </>
          ) : (
            <>
              {state.swap.secret === null && !state.swap.done ? (
                <p className={styles.instructions}>{S.secret.pickMine}</p>
              ) : null}
              <div className={styles.panelBlock}>
                <p className={styles.panelTitle}>{S.secret.computerQuestion}</p>
                {state.swap.pending ? (
                  <p
                    className={styles.computer}
                    data-testid="computer-question"
                    data-question={state.swap.pending}
                  >
                    {S.question[state.swap.pending]}
                  </p>
                ) : (
                  <p className={styles.computer} data-testid="computer-question">
                    {state.swap.done ? S.secret.swapDone : '—'}
                  </p>
                )}
                {state.swap.pending ? (
                  <div className={styles.row}>
                    <button
                      type="button"
                      className={styles.button}
                      onClick={() => dispatch({ type: 'swap-answer', answer: true })}
                      disabled={readOnly}
                    >
                      {S.secret.answerYes}
                    </button>
                    <button
                      type="button"
                      className={styles.button}
                      onClick={() => dispatch({ type: 'swap-answer', answer: false })}
                      disabled={readOnly}
                    >
                      {S.secret.answerNo}
                    </button>
                  </div>
                ) : null}
              </div>
              <p className={styles.status} role="status" data-testid="swap-evidence">
                {evidence}
              </p>
              {state.swap.done ? (
                <p className={styles.badge}>
                  {S.secret.swapCandidates(state.swap.candidates.length)}
                </p>
              ) : null}
            </>
          )}

          <p className={styles.status} role="status" data-testid="sorter-status">
            {state.role === 'guesser' && state.solved ? S.secret.solved : ''}
          </p>

          {state.settings.roleSwap ? (
            <button
              type="button"
              className={styles.button}
              onClick={() =>
                dispatch({
                  type: 'switch-role',
                  role: state.role === 'guesser' ? 'answerer' : 'guesser',
                })
              }
              disabled={readOnly}
            >
              {state.role === 'guesser' ? S.secret.roleAnswerer : S.secret.roleGuesser}
            </button>
          ) : null}
          <p className={styles.hint}>{S.secret.hint}</p>
        </div>
      </div>
    </div>
  );
}
