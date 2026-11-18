/**
 * E18 학급 투표 화면(1단계: 교사 기기 한 대).
 *
 * 질문 글 → 선택지마다 큰 스탬프 단추 → ○ 그래프와 표. 학생이 한 명씩 나와 스탬프를 누르면
 * ○가 아래부터 쌓이고 표의 수가 함께 바뀐다(학생이 칸을 고르지 않는다).
 * 학생 이름·기기 정보는 받지 않고, 누른 순서대로 선택지만 저장한다.
 */
import type { EngineViewProps } from '../../core/engine-sdk';
import { GraphCanvas } from './GraphCanvas';
import { voteCountOf, voteLimit } from './reduce';
import { graphStrings as S } from './strings.ko';
import type { ClassVoteState, GraphAction, GraphConfig } from './types';
import styles from './View.module.css';
import { voteCounts, voteViewState } from './vote';

type VoteViewProps = Pick<
  EngineViewProps<GraphConfig, ClassVoteState, GraphAction>,
  'state' | 'dispatch' | 'readOnly' | 'targetSize'
>;

export function VoteView({ state, dispatch, readOnly = false, targetSize }: VoteViewProps) {
  const { settings } = state;
  const counts = voteCounts(state);
  const view = voteViewState(state);
  const limit = voteLimit(settings);

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-mode={state.mode}
      data-testid="vote-view"
    >
      {settings.question ? (
        <h3 className={styles.question} data-testid="vote-question">
          {settings.question}
        </h3>
      ) : null}

      <div className={styles.stamps} role="group" aria-label={S.vote.stampGroup}>
        {settings.categories.map((option) => {
          const full = voteCountOf(state.votes, option) >= limit;
          return (
            <button
              key={option}
              type="button"
              className={styles.stamp}
              data-option={option}
              aria-label={S.vote.stamp(option)}
              disabled={readOnly || full}
              onClick={() => dispatch({ type: 'vote', option })}
            >
              {option}
            </button>
          );
        })}
        <button
          type="button"
          className={styles.button}
          data-testid="vote-undo"
          disabled={readOnly || state.votes.length === 0}
          onClick={() => dispatch({ type: 'undo-vote' })}
        >
          {S.vote.undo}
        </button>
      </div>

      <div className={styles.views}>
        {settings.showTable ? (
          <div className={styles.tableBox}>
            <table className={styles.table} data-testid="graph-table">
              <caption>{S.vote.tableLabel}</caption>
              <thead>
                <tr>
                  <th scope="col">{S.table.categoryHeader}</th>
                  <th scope="col">{S.table.valueHeader}</th>
                </tr>
              </thead>
              <tbody>
                {settings.categories.map((option) => (
                  <tr key={option}>
                    <th scope="row">{option}</th>
                    <td data-cat={option}>
                      <span className={styles.number}>{counts[option] ?? 0}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className={styles.boardArea}>
          <GraphCanvas
            state={view}
            dispatch={dispatch}
            readOnly
            targetSize={targetSize}
            tooltipsOn={false}
          />
        </div>
      </div>
    </div>
  );
}
