/**
 * sort·predict 공용 틀. 판(SVG)은 남는 칸에 맞춰 줄고 최소 배율 0.6 아래로는 줄이지 않고 판 안에서 스크롤한다.
 * 조작 칸(`sorter-controls`)은 스크롤 상자 밖에 있다. 설정 오류면 오류 문구만 보인다.
 */
import { useRef } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { useRenderedSize } from '../../../core/engine-sdk';
import { sortStrings as S } from '../sort/strings.ko';
import styles from './Board.module.css';

const LOGICAL_WIDTH = 1000;
const MIN_SCALE = 0.6;
const MAX_FIT = 1.5;

export interface BoardFrameProps {
  readonly mode: 'sort' | 'predict';
  readonly error: string | null;
  readonly targetSize: number;
  /** 이 판의 논리 높이(700 이하). 판 최소 높이는 0.6 × 이 값이다. */
  readonly logicalHeight: number;
  readonly renderBoard: (svgStyle: CSSProperties | undefined, className: string) => ReactNode;
  readonly top?: ReactNode;
  readonly controls: ReactNode;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export function BoardFrame({
  mode,
  error,
  targetSize,
  logicalHeight,
  renderBoard,
  top,
  controls,
  onKeyDown,
}: BoardFrameProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useRenderedSize(boardRef);

  if (error !== null) {
    return (
      <div className={styles.wrap} data-target-size={targetSize} data-testid="sorter-error-wrap">
        <div className={styles.errorBoard} role="alert" data-testid="sorter-error">
          <p>{S.configError}</p>
          <p>{S.configErrorBody}</p>
        </div>
      </div>
    );
  }

  let svgStyle: CSSProperties | undefined;
  let scroll = false;
  if (board.width > 0 && board.height > 0) {
    const fit = Math.min(board.width / LOGICAL_WIDTH, board.height / logicalHeight, MAX_FIT);
    const scale = Math.max(fit, MIN_SCALE);
    scroll = fit < MIN_SCALE - 0.005;
    svgStyle = { width: `${LOGICAL_WIDTH * scale}px`, height: `${logicalHeight * scale}px` };
  }

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-mode={mode}
      style={{ ['--board-min' as string]: `${Math.round(logicalHeight * MIN_SCALE)}px` }}
      onKeyDown={onKeyDown}
    >
      {top}
      <div className={styles.stageRow}>
        <div
          ref={boardRef}
          className={styles.boardArea}
          data-scroll={scroll ? 'true' : 'false'}
          data-testid="sorter-board"
          style={{ minHeight: `${Math.round(logicalHeight * MIN_SCALE)}px` }}
        >
          {renderBoard(svgStyle, styles.boardSvg ?? '')}
        </div>
        {controls}
      </div>
    </div>
  );
}
