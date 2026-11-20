/**
 * E20 화면. 판(SVG)은 남는 칸에 맞춰 줄고 최소 배율 0.6 아래로는 줄이지 않고 스크롤한다.
 * 조작 칸은 스크롤 상자 밖에 있다. 설정 오류면 오류 문구만 보인다.
 */
import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { useRenderedSize } from '../../core/engine-sdk';
import type { EngineViewProps } from '../../core/engine-sdk';
import { BarBoard } from './BarBoard';
import { BarSentence } from './BarSentence';
import { Controls } from './Controls';
import { MixBoard } from './MixBoard';
import { PercentBoard } from './PercentBoard';
import { RateBoard } from './RateBoard';
import { ResizeBoard } from './ResizeBoard';
import { E20_STRINGS as S } from './strings.ko';
import type { RatioAction, RatioConfig, RatioState } from './types';
import { BAR_LOGICAL_HEIGHT, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import { useRatioUi } from './useRatioUi';
import styles from './View.module.css';

/** 판의 최소 배율(논리 1 → 화면 0.6px). 이보다 작아지면 줄이지 않고 판 안에서 스크롤한다. */
export const MIN_SCALE = 0.6;
const MAX_FIT = 1.5;

export function RatioView({
  state,
  dispatch,
  targetSize,
  readOnly = false,
}: EngineViewProps<RatioConfig, RatioState, RatioAction>) {
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useRenderedSize(boardRef);
  const ui = useRatioUi(state, dispatch, readOnly);

  if (state.error !== null) {
    return (
      <div className={styles.wrap} data-target-size={targetSize} data-testid="ratio-error-wrap">
        <div className={styles.errorBoard} role="alert" data-testid="ratio-error">
          <p>{S.configError}</p>
          <p>{S.configErrorBody}</p>
        </div>
      </div>
    );
  }

  const logicalHeight = state.mode === 'bar-model' ? BAR_LOGICAL_HEIGHT : LOGICAL_HEIGHT;
  let svgStyle: CSSProperties | undefined;
  let scroll = false;
  if (board.width > 0 && board.height > 0) {
    const fit = Math.min(board.width / LOGICAL_WIDTH, board.height / logicalHeight, MAX_FIT);
    const scale = Math.max(fit, MIN_SCALE);
    scroll = fit < MIN_SCALE - 0.005;
    svgStyle = {
      width: `${LOGICAL_WIDTH * scale}px`,
      height: `${logicalHeight * scale}px`,
    };
  }

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-mode={state.mode}
      data-look={state.mode === 'percent' ? state.settings.layout : state.settings.look}
      onKeyDown={ui.onKeyDown}
    >
      {state.mode === 'bar-model' ? (
        <BarSentence state={state} ui={ui} readOnly={readOnly} />
      ) : null}
      <div className={styles.stageRow}>
        <div
          ref={boardRef}
          className={styles.boardArea}
          data-scroll={scroll ? 'true' : 'false'}
          data-testid="ratio-board"
        >
          {state.mode === 'mix' ? (
            <MixBoard state={state} svgStyle={svgStyle} className={styles.boardSvg} />
          ) : null}
          {state.mode === 'resize' ? (
            <ResizeBoard state={state} svgStyle={svgStyle} className={styles.boardSvg} />
          ) : null}
          {state.mode === 'rate' ? (
            <RateBoard state={state} svgStyle={svgStyle} className={styles.boardSvg} />
          ) : null}
          {state.mode === 'bar-model' ? (
            <BarBoard state={state} svgStyle={svgStyle} className={styles.boardSvg} />
          ) : null}
          {state.mode === 'percent' ? (
            <PercentBoard
              state={state}
              ui={ui}
              readOnly={readOnly}
              svgStyle={svgStyle}
              className={styles.boardSvg}
            />
          ) : null}
        </div>
        <Controls state={state} dispatch={dispatch} ui={ui} readOnly={readOnly} />
      </div>
    </div>
  );
}
