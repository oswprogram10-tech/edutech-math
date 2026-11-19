/**
 * table 모드 화면: 대응표의 빈칸을 채우고 관계식을 쓴다.
 * 빈칸 DOM에는 학생이 쓴 수만 있다. 맞았는지는 표시하지 않는다(식 시험의 ✓/✕만 있다).
 * 표는 판 영역에 크게 그린다. 칸이 targetSize보다 작아지면 줄이지 않고 판 안에서 스크롤한다.
 */
import { useRef } from 'react';
import { useRenderedSize } from '../../core/engine-sdk';
import type { EngineViewProps } from '../../core/engine-sdk';
import { Frame } from './Frame';
import { RelationTable } from './RelationTable';
import { columnsOf, visibleMarks } from './relation-check';
import { functionStrings as S } from './strings.ko';
import { tableLayout } from './table-layout';
import type { FunctionAction, FunctionConfig, TableState } from './types';

type TableViewProps = Omit<EngineViewProps<FunctionConfig, TableState, FunctionAction>, 'state'> & {
  readonly state: TableState;
};

const MAX_SCALE = 2.2;

export function TableView({ state, dispatch, targetSize, readOnly = false }: TableViewProps) {
  const { settings } = state;
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useRenderedSize(boardRef);
  const columns = columnsOf(state);
  const layout = tableLayout(columns.length, settings.xLabel, settings.yLabel);

  // 배율: 판에 맞추되 1 이상 MAX_SCALE 이하. 칸이 targetSize보다 작아질 만큼 좁으면
  // 칸을 targetSize로 두고 판 안에서 스크롤한다.
  const minScale = targetSize / Math.min(layout.cellW, layout.cellH);
  let scale = 1;
  let scroll = false;
  if (board.width > 0 && board.height > 0) {
    const fit = Math.min(board.width / layout.width, board.height / layout.height);
    if (fit >= minScale) scale = Math.min(MAX_SCALE, Math.max(1, fit));
    else {
      scale = minScale;
      scroll = true;
    }
  }

  return (
    <Frame
      state={state}
      dispatch={dispatch}
      targetSize={targetSize}
      readOnly={readOnly}
      instruction={S.table.instructions}
      boardRef={boardRef}
      boardScroll={scroll}
      boardTall
      board={
        <RelationTable
          columns={columns}
          xLabel={settings.xLabel}
          yLabel={settings.yLabel}
          active={state.active}
          highlight={null}
          holds={visibleMarks(state, columns)}
          readOnly={readOnly}
          scale={scale}
          onActivate={(cell) => dispatch({ type: 'activate', cell })}
        />
      }
      side={null}
    />
  );
}
