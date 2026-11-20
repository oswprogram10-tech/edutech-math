/**
 * E14 duration·calendar 공용 틀. 판(SVG)은 남는 칸에 맞춰 줄고 최소 배율 0.6 아래로는 줄이지 않고
 * 판 안에서 스크롤한다. 조작 칸은 스크롤 상자 밖에 있다. 설정 오류면 오류 문구만 보인다.
 * (`clock`의 View와 같은 규칙을 모드별 파일에서 쓰려고 따로 둔 것이다.)
 */
import { useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRenderedSize } from '../../core/engine-sdk';
import { E14_MODE_STRINGS as S } from './strings-modes.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import styles from './View.module.css';

/** 판의 최소 배율(논리 1 → 화면 0.6px). */
const MIN_SCALE = 0.6;
const MAX_FIT = 1.5;

export interface ModeFrameProps {
  readonly mode: 'duration' | 'calendar';
  readonly error: string | null;
  readonly targetSize: number;
  readonly renderBoard: (svgStyle: CSSProperties | undefined, className: string) => ReactNode;
  readonly controls: ReactNode;
}

export function ModeFrame({ mode, error, targetSize, renderBoard, controls }: ModeFrameProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useRenderedSize(boardRef);

  if (error !== null) {
    return (
      <div className={styles.wrap} data-target-size={targetSize} data-testid="clock-error-wrap">
        <div className={styles.errorBoard} role="alert" data-testid="clock-error">
          <p>{S.configError}</p>
          <p>{S.configErrorBody}</p>
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
    svgStyle = { width: `${LOGICAL_WIDTH * scale}px`, height: `${LOGICAL_HEIGHT * scale}px` };
  }

  return (
    <div className={styles.wrap} data-target-size={targetSize} data-mode={mode}>
      <div className={styles.stageRow}>
        <div
          ref={boardRef}
          className={styles.boardArea}
          data-scroll={scroll ? 'true' : 'false'}
          data-testid="clock-board"
        >
          {renderBoard(svgStyle, styles.boardSvg ?? '')}
        </div>
        {controls}
      </div>
    </div>
  );
}
