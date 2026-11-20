/**
 * E14 화면(clock 모드). 판(SVG)은 남는 칸에 맞춰 줄고 최소 배율 0.6 아래로는 줄이지 않고 스크롤한다.
 * 조작 칸은 스크롤 상자 밖에 있다. 설정 오류면 오류 문구만 보인다.
 */
import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { useRenderedSize } from '../../core/engine-sdk';
import type { EngineViewProps } from '../../core/engine-sdk';
import { ClockBoard } from './ClockBoard';
import { Controls } from './Controls';
import { E14_STRINGS as S } from './strings.ko';
import type { ClockAction, ClockConfig, ClockState } from './types';
import { boardSize } from './layout';
import { useClockUi } from './useClockUi';
import styles from './View.module.css';

/** 판의 최소 배율(논리 1 → 화면 0.6px). 이보다 작아지면 줄이지 않고 판 안에서 스크롤한다. */
export const MIN_SCALE = 0.6;
const MAX_FIT = 1.5;

export function ClockView({
  state,
  dispatch,
  targetSize,
  readOnly = false,
}: EngineViewProps<ClockConfig, ClockState, ClockAction>) {
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useRenderedSize(boardRef);
  const ui = useClockUi(state, dispatch, readOnly);

  if (state.error !== null) {
    return (
      <div className={styles.wrap} data-target-size={targetSize} data-testid="clock-error-wrap">
        <div className={styles.errorBoard} role="alert" data-testid="clock-error">
          <p>{S.configError}</p>
          <p>{S.configErrorBody}</p>
        </div>
      </div>
    );
  }

  const logical = boardSize(state.unrolled);
  let svgStyle: CSSProperties | undefined;
  let scroll = false;
  if (board.width > 0 && board.height > 0) {
    const fit = Math.min(board.width / logical.width, board.height / logical.height, MAX_FIT);
    const scale = Math.max(fit, MIN_SCALE);
    scroll = fit < MIN_SCALE - 0.005;
    svgStyle = { width: `${logical.width * scale}px`, height: `${logical.height * scale}px` };
  }

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-mode={state.mode}>
      <div className={styles.stageRow}>
        <div
          ref={boardRef}
          className={styles.boardArea}
          data-scroll={scroll ? 'true' : 'false'}
          data-testid="clock-board"
          style={{ minHeight: `${Math.round(logical.height * MIN_SCALE)}px` }}
        >
          <ClockBoard
            state={state}
            ui={ui}
            readOnly={readOnly}
            svgStyle={svgStyle}
            className={styles.boardSvg}
          />
        </div>
        <Controls state={state} ui={ui} readOnly={readOnly} />
      </div>
    </div>
  );
}
