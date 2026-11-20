/**
 * E20 bar-model 문장 줄과 형광펜 도구(SVG 밖). 토큰마다 누를 수 있는 단추(높이 48px 이상)다.
 * 칠한 토큰은 배경색 + 테두리 모양(전체 = 굵은 실선, 비 = 점선) + "전체"/"비" 꼬리표로 구별한다(색만으로 전달하지 않는다).
 * 형광펜 목표 글자는 이 화면 어디에도 쓰지 않는다.
 */
import { ActionButton } from './ActionButton';
import { shortcutsOf } from './shortcuts';
import { E20_STRINGS as S } from './strings.ko';
import type { BarMark, BarState } from './types';
import type { RatioUi } from './useRatioUi';
import styles from './View.module.css';

export interface BarSentenceProps {
  readonly state: BarState;
  readonly ui: RatioUi;
  readonly readOnly: boolean;
}

const TAG: Record<BarMark, string> = {
  total: S.bar.tokenMarkTotal,
  ratio: S.bar.tokenMarkRatio,
};

export function BarSentence({ state, ui, readOnly }: BarSentenceProps) {
  const { settings } = state;
  const shortcuts = shortcutsOf(state);
  const common = { shortcuts, ui, readOnly };
  let next = 0;
  return (
    <div className={styles.barSentence} data-testid="bar-sentence">
      <div className={styles.tokenFlow} role="group" aria-label={S.bar.sentenceLabel}>
        {settings.chunkSizes.map((size, chunk) => {
          const indexes = Array.from({ length: size }, () => next++);
          return (
            <span key={chunk} className={styles.tokenChunk}>
              {indexes.map((index) => {
                const mark = state.marks[index];
                const text = settings.tokens[index] ?? '';
                const tag = mark === undefined ? null : TAG[mark];
                return (
                  <button
                    key={index}
                    type="button"
                    className={styles.token}
                    aria-label={S.bar.tokenLabel(text, tag)}
                    data-token-index={index}
                    data-mark={mark ?? 'none'}
                    disabled={readOnly}
                    onClick={() => ui.send({ type: 'mark', index })}
                  >
                    {tag === null ? null : (
                      <span className={styles.tokenTag} aria-hidden="true">
                        {tag}
                      </span>
                    )}
                    <span aria-hidden="true">{text}</span>
                  </button>
                );
              })}
            </span>
          );
        })}
      </div>
      <div className={styles.row} role="group" aria-label={S.bar.toolsLabel}>
        <ActionButton
          id="tool-total"
          label={S.bar.tools.total}
          pressed={state.tool === 'total'}
          {...common}
        />
        <ActionButton
          id="tool-ratio"
          label={S.bar.tools.ratio}
          pressed={state.tool === 'ratio'}
          {...common}
        />
        <ActionButton
          id="tool-erase"
          label={S.bar.tools.erase}
          pressed={state.tool === 'erase'}
          {...common}
        />
      </div>
    </div>
  );
}
