/**
 * E19 화면(여섯 모드). 판(SVG)은 남는 칸에 맞춰 줄고 최소 배율 0.6 아래로는 줄이지 않고 스크롤한다.
 * 조작 칸은 스크롤 상자 밖에 있다. 설정 오류면 오류 문구만 보인다.
 */
import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { useRenderedSize } from '../../core/engine-sdk';
import type { EngineViewProps } from '../../core/engine-sdk';
import { Controls } from './Controls';
import { LevelingBoard } from './LevelingBoard';
import { OutlierBoard } from './OutlierBoard';
import { SeesawBoard } from './SeesawBoard';
import { SimulateBoard } from './SimulateBoard';
import { SpinnerBoard } from './SpinnerBoard';
import { WordsBoard } from './WordsBoard';
import { E19_STRINGS as S } from './strings.ko';
import type { ChanceAction, ChanceConfig, ChanceState } from './types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import { useChanceUi } from './useChanceUi';
import styles from './View.module.css';

/** 판의 최소 배율(논리 1 → 화면 0.6px). 이보다 작아지면 줄이지 않고 판 안에서 스크롤한다. */
export const MIN_SCALE = 0.6;
const MAX_FIT = 1.5;

export function ChanceView({
  state,
  dispatch,
  targetSize,
  readOnly = false,
}: EngineViewProps<ChanceConfig, ChanceState, ChanceAction>) {
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useRenderedSize(boardRef);
  const ui = useChanceUi(state, dispatch, readOnly);

  if (state.error !== null) {
    return (
      <div className={styles.wrap} data-target-size={targetSize} data-testid="chance-error-wrap">
        <div className={styles.errorBoard} role="alert" data-testid="chance-error">
          <p>{S.configError}</p>
          <p>{state.error === S.configError ? S.configErrorBody : state.error}</p>
        </div>
      </div>
    );
  }

  let svgStyle: CSSProperties | undefined;
  let scroll = false;
  if (board.width > 0 && board.height > 0) {
    const fit = Math.min(board.width / LOGICAL_WIDTH, board.height / LOGICAL_HEIGHT, MAX_FIT);
    const scale = Math.max(fit, MIN_SCALE);
    scroll = fit < MIN_SCALE - 0.005;
    svgStyle = {
      width: `${LOGICAL_WIDTH * scale}px`,
      height: `${LOGICAL_HEIGHT * scale}px`,
    };
  }
  const common = { ui, readOnly, svgStyle, className: styles.boardSvg };

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-mode={state.mode}
      onKeyDown={ui.onWrapKeyDown}
    >
      <div className={styles.stageRow}>
        <div
          ref={boardRef}
          className={styles.boardArea}
          data-scroll={scroll ? 'true' : 'false'}
          data-testid="chance-board"
        >
          {state.mode === 'leveling' ? (
            <LevelingBoard state={state} {...common} />
          ) : state.mode === 'seesaw' ? (
            <SeesawBoard state={state} {...common} />
          ) : state.mode === 'outlier' ? (
            <OutlierBoard state={state} {...common} />
          ) : state.mode === 'words' ? (
            <WordsBoard state={state} {...common} />
          ) : state.mode === 'spinner' ? (
            <SpinnerBoard state={state} {...common} />
          ) : (
            <SimulateBoard state={state} svgStyle={svgStyle} className={styles.boardSvg} />
          )}
        </div>
        <Controls state={state} ui={ui} readOnly={readOnly} />
      </div>
    </div>
  );
}
