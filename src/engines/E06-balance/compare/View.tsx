/**
 * E06 `compare` 화면. 판(SVG)은 equation과 같은 맞춤 규칙(남는 칸, 최소 배율 0.6)을 쓰고
 * 조작 칸은 스크롤 상자 밖에 있다. 설정 오류면 오류 문구만 보인다.
 * 조작: 물건 끌기(Pointer Events) / 키보드(물건 고르기 → L·R·Backspace) / 같은 일을 하는 단추 / [처음으로].
 * 끄는 동안의 좌표는 지역 상태에만 두고, 놓을 때 `place` Action 한 번만 보낸다.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { clientToLogical, useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { fitBoard } from '../fit';
import { balanceStrings as S } from '../strings.ko';
import styles from '../View.module.css';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import { CompareBoard } from './Board';
import type { DragPoint, ItemHandlers } from './Board';
import itemStyles from './compare.module.css';
import { targetAt } from './layout';
import { itemOf, placeReason, readCompare } from './reduce';
import { compareStrings as C } from './strings.ko';
import type { CompareAction, CompareConfig, CompareState, CompareTarget } from './types';

/** 눌렀다 이만큼(화면 px) 넘게 움직여야 끌기로 본다. */
const DRAG_THRESHOLD = 8;

function resultText(state: CompareState): string {
  const reading = readCompare(state);
  if (state.left.length === 0 && state.right.length === 0) return C.empty;
  if (reading.tilt === 'left') return S.result.left;
  if (reading.tilt === 'right') return S.result.right;
  return S.result.level;
}

interface PressRecord {
  readonly id: string;
  readonly clientX: number;
  readonly clientY: number;
  moved: boolean;
}

export function CompareView({
  state,
  dispatch,
  targetSize,
  readOnly = false,
}: EngineViewProps<CompareConfig, CompareState, CompareAction>) {
  const boardRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const board = useRenderedSize(boardRef);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragPoint | null>(null);
  const [status, setStatus] = useState('');
  const press = useRef<PressRecord | null>(null);

  if (state.error !== null) {
    return (
      <div className={styles.wrap} data-target-size={targetSize} data-testid="balance-error-wrap">
        <div className={styles.errorBoard} role="alert" data-testid="balance-error">
          <p>{S.configError}</p>
          <p>{S.configErrorBody}</p>
        </div>
      </div>
    );
  }

  const { svgStyle, scroll } = fitBoard(board);
  const selected = selectedId === null ? undefined : itemOf(state, selectedId);

  const attempt = (id: string, pan: CompareTarget) => {
    if (readOnly) return;
    const reason = placeReason(state, id, pan);
    setStatus(reason === 'full' ? C.full : '');
    if (reason === 'ok') dispatch({ type: 'place', id, pan });
  };

  const logicalPoint = (event: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return clientToLogical(event.clientX, event.clientY, rect, {
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
    });
  };

  const handlers: ItemHandlers = {
    onPointerDown: (id, event: ReactPointerEvent<SVGGElement>) => {
      if (readOnly) return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // 일부 환경은 포인터 캡처를 지원하지 않는다. 끌기는 그래도 동작한다.
      }
      setSelectedId(id);
      press.current = { id, clientX: event.clientX, clientY: event.clientY, moved: false };
    },
    onPointerMove: (id, event) => {
      const current = press.current;
      if (current === null || current.id !== id) return;
      if (!current.moved) {
        const dist = Math.hypot(event.clientX - current.clientX, event.clientY - current.clientY);
        if (dist < DRAG_THRESHOLD) return;
        current.moved = true;
      }
      setDrag({ id, ...logicalPoint(event) });
    },
    onPointerUp: (id, event) => {
      const current = press.current;
      press.current = null;
      if (current === null || current.id !== id) return;
      setDrag(null);
      if (!current.moved) return;
      const point = logicalPoint(event);
      attempt(id, targetAt(point.x, point.y));
    },
    onPointerCancel: () => {
      press.current = null;
      setDrag(null);
    },
    onFocus: (id) => setSelectedId(id),
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (readOnly || selectedId === null) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'l' || event.key === 'L' || event.code === 'KeyL') {
      event.preventDefault();
      attempt(selectedId, 'left');
    } else if (event.key === 'r' || event.key === 'R' || event.code === 'KeyR') {
      event.preventDefault();
      attempt(selectedId, 'right');
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      attempt(selectedId, 'shelf');
    }
  };

  const noPick = readOnly || selected === undefined;
  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-mode="compare"
      onKeyDown={onKeyDown}
    >
      <div className={styles.stageRow}>
        <div
          ref={boardRef}
          className={styles.boardArea}
          data-scroll={scroll ? 'true' : 'false'}
          data-testid="balance-board"
        >
          <CompareBoard
            state={state}
            svgStyle={svgStyle}
            className={styles.boardSvg}
            svgRef={svgRef}
            selectedId={selectedId}
            drag={drag}
            handlers={handlers}
            resultText={resultText(state)}
          />
        </div>
        <div className={styles.sideStack} data-testid="balance-controls">
          <p className={styles.instructions}>{C.instructions}</p>
          <p className={styles.made} data-testid="compare-selected">
            {selected === undefined ? C.noneSelected : C.selected(C.names[selected.kind])}
          </p>
          <p className={itemStyles.fullHint} role="status" data-testid="compare-status">
            {status}
          </p>
          <div className={styles.group} role="group" aria-label={C.buttons.group}>
            <div className={styles.row}>
              <button
                type="button"
                className={styles.button}
                disabled={noPick}
                data-testid="compare-left"
                onClick={() => selectedId !== null && attempt(selectedId, 'left')}
              >
                {C.buttons.left}
              </button>
              <button
                type="button"
                className={styles.button}
                disabled={noPick}
                data-testid="compare-right"
                onClick={() => selectedId !== null && attempt(selectedId, 'right')}
              >
                {C.buttons.right}
              </button>
              <button
                type="button"
                className={styles.button}
                disabled={noPick}
                data-testid="compare-shelf"
                onClick={() => selectedId !== null && attempt(selectedId, 'shelf')}
              >
                {C.buttons.shelf}
              </button>
            </div>
          </div>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.button}
              disabled={readOnly}
              onClick={() => {
                setStatus('');
                dispatch({ type: 'reset' });
              }}
            >
              {S.reset}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
