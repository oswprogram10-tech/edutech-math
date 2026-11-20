/**
 * E13 모드 공용 틀. 판(SVG)은 남는 칸에 맞춰 줄고 최소 배율 0.6 아래로는 줄이지 않고 판 안에서 스크롤한다.
 * 조작 칸은 스크롤 상자 밖에 있다. 설정 오류면 오류 문구만 보인다.
 */
import { useRef } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { useRenderedSize } from '../../core/engine-sdk';
import { E13_STRINGS as S } from './strings.ko';
import styles from './View.module.css';

/** 판의 논리 크기(모든 모드가 같다). */
const LOGICAL = { width: 1000, height: 600 } as const;
/** 판의 최소 배율(논리 1 → 화면 0.6px). */
const MIN_SCALE = 0.6;
const MAX_FIT = 1.5;

export interface FrameProps {
  readonly mode: 'compare-direct' | 'length' | 'estimate';
  readonly error: string | null;
  readonly targetSize: number;
  readonly renderBoard: (svgStyle: CSSProperties | undefined, className: string) => ReactNode;
  readonly controls: ReactNode;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export function Frame({ mode, error, targetSize, renderBoard, controls, onKeyDown }: FrameProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useRenderedSize(boardRef);

  if (error !== null) {
    return (
      <div className={styles.wrap} data-target-size={targetSize} data-testid="measure-error-wrap">
        <div className={styles.errorBoard} role="alert" data-testid="measure-error">
          <p>{S.configError}</p>
          <p>{S.configErrorBody}</p>
        </div>
      </div>
    );
  }

  let svgStyle: CSSProperties | undefined;
  let scroll = false;
  if (board.width > 0 && board.height > 0) {
    const fit = Math.min(board.width / LOGICAL.width, board.height / LOGICAL.height, MAX_FIT);
    const scale = Math.max(fit, MIN_SCALE);
    scroll = fit < MIN_SCALE - 0.005;
    svgStyle = { width: `${LOGICAL.width * scale}px`, height: `${LOGICAL.height * scale}px` };
  }

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-mode={mode}
      onKeyDown={onKeyDown}
    >
      <div className={styles.stageRow}>
        <div
          ref={boardRef}
          className={styles.boardArea}
          data-scroll={scroll ? 'true' : 'false'}
          data-testid="measure-board"
          style={{ minHeight: `${Math.round(LOGICAL.height * MIN_SCALE)}px` }}
        >
          {renderBoard(svgStyle, styles.boardSvg ?? '')}
        </div>
        {controls}
      </div>
    </div>
  );
}
