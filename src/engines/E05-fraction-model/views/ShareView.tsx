/**
 * T049 `partition` variant=share: 전체를 똑같이 나누어 접시에 나르기.
 *
 * - 조각을 누르고(Enter) 접시를 누르거나 접시 번호 키를 누르면 그 접시에 놓인다.
 * - 접시에는 받은 조각 그림만 둔다. `plateLabel`이 true일 때만 "1/4 조각 3개"처럼
 *   조각 크기와 개수를 쓰고, 합한 값은 쓰지 않는다.
 */
import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from '../../../core/engine-sdk';
import { boundingBox } from '../geometry';
import { gridCell } from '../layout';
import { piecesOf } from '../pieces';
import { fractionModelStrings as S } from '../strings.ko';
import type { ShareState } from '../types';
import { BLUE, CanvasFrame, GREEN, INK, MUTED, ToolbarButton } from './shared';
import { isActivationKey, pathOf } from './helpers';
import type { ModeProps } from './shared';
import styles from '../View.module.css';

const WHOLE_AREA = { x: 40, y: 70, width: 920, height: 290 };
const PLATE_AREA = { x: 40, y: 406, width: 920, height: 166 };
const GAP = 16;
const MAX_EQUAL_PARTS = 12;

export function ShareView({
  config,
  state,
  dispatch,
  readOnly,
  targetSize,
}: ModeProps<ShareState>) {
  const [cutParts, setCutParts] = useState(state.people);
  const wholePieces = useMemo(
    () =>
      state.wholes.map((whole) =>
        piecesOf({ shape: state.shape, outline: state.outline, cuts: whole.cuts }),
      ),
    [state.shape, state.outline, state.wholes],
  );

  const columns = Math.min(3, state.wholes.length);
  const wholeCell = gridCell(state.wholes.length, WHOLE_AREA, columns, GAP);
  const outlineBox = useMemo(() => boundingBox(state.outline), [state.outline]);
  const boxWidth = Math.max(1, outlineBox.maxX - outlineBox.minX);
  const boxHeight = Math.max(1, outlineBox.maxY - outlineBox.minY);
  const plateCell = gridCell(state.people, PLATE_AREA, state.people, 14);

  const selected = state.selected;
  const selectedPlate =
    selected === null
      ? null
      : (state.wholes[selected.whole]?.pieces[selected.piece]?.plate ?? null);

  const dragRef = useRef<{
    readonly whole: number;
    readonly start: Point;
    readonly clientX: number;
    readonly clientY: number;
  } | null>(null);
  const skipClickRef = useRef(false);

  /** 화면 좌표를 그 전체의 도형 좌표로 바꾼다. 칼선은 도형 좌표로 기록한다. */
  const localPoint = (event: ReactPointerEvent<SVGGElement>): Point | null => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return null;
    const inverse = matrix.inverse();
    return {
      x: event.clientX * inverse.a + event.clientY * inverse.c + inverse.e,
      y: event.clientX * inverse.b + event.clientY * inverse.d + inverse.f,
    };
  };

  const pointerDown = (event: ReactPointerEvent<SVGGElement>, whole: number): void => {
    if (readOnly || event.button !== 0) return;
    const point = localPoint(event);
    if (!point) return;
    dragRef.current = {
      whole,
      start: point,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    skipClickRef.current = false;
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const pointerUp = (event: ReactPointerEvent<SVGGElement>, whole: number): void => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.whole !== whole) return;
    // 누르기만 했으면 조각 고르기로 둔다. 끌었을 때만 칼선을 만든다.
    if (Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < 10) return;
    const end = localPoint(event);
    if (!end) return;
    skipClickRef.current = true;
    dispatch({
      type: 'cut',
      tool: 'line',
      points: [drag.start, end],
      whole,
    });
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (state.selected === null) return;
    const numeric = Number(event.key);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > state.people) return;
    event.preventDefault();
    dispatch({
      type: 'deal-piece',
      whole: state.selected.whole,
      piece: state.selected.piece,
      plate: numeric - 1,
    });
  };

  const plateLabels = (plate: number): string[] => {
    const groups = new Map<number, number>();
    state.wholes.forEach((whole, wholeIndex) => {
      const count = wholePieces[wholeIndex]?.length ?? 1;
      whole.pieces.forEach((piece, pieceIndex) => {
        if (pieceIndex >= count || piece.plate !== plate) return;
        groups.set(count, (groups.get(count) ?? 0) + 1);
      });
    });
    return [...groups.entries()].map(([count, pieces]) => S.pieceCountLabel(`1/${count}`, pieces));
  };

  return (
    <div className={styles.wrap} data-target-size={targetSize} onKeyDown={onKeyDown}>
      <div className={styles.toolbar} role="toolbar" aria-label={S.canvasLabel}>
        {state.wholes.map((_whole, wholeIndex) => {
          const parts = Math.max(2, Math.min(MAX_EQUAL_PARTS, Math.round(cutParts)));
          return (
            <ToolbarButton
              key={`cut-equal-${wholeIndex}`}
              disabled={readOnly}
              onClick={() => dispatch({ type: 'cut-equal', whole: wholeIndex, parts })}
            >
              {S.equalCut(wholeIndex, parts)}
            </ToolbarButton>
          );
        })}
        <ToolbarButton
          disabled={readOnly || cutParts <= 2}
          onClick={() => setCutParts((current) => Math.max(2, current - 1))}
        >
          {S.cutPartsDown}
        </ToolbarButton>
        <ToolbarButton
          disabled={readOnly || cutParts >= MAX_EQUAL_PARTS}
          onClick={() => setCutParts((current) => Math.min(MAX_EQUAL_PARTS, current + 1))}
        >
          {S.cutPartsUp}
        </ToolbarButton>
        {selected !== null && selectedPlate !== null ? (
          <ToolbarButton
            disabled={readOnly}
            onClick={() =>
              dispatch({
                type: 'return-piece',
                whole: selected.whole,
                piece: selected.piece,
              })
            }
          >
            {S.returnPiece}
          </ToolbarButton>
        ) : null}
      </div>

      <CanvasFrame label={S.shareCanvasLabel}>
        {state.wholes.map((whole, wholeIndex) => {
          const column = wholeIndex % columns;
          const row = Math.floor(wholeIndex / columns);
          const x = WHOLE_AREA.x + column * (wholeCell.width + GAP);
          const y = WHOLE_AREA.y + row * (wholeCell.height + GAP);
          const scale = Math.min(wholeCell.width / boxWidth, wholeCell.height / boxHeight) * 0.86;
          const tx = x + (wholeCell.width - boxWidth * scale) / 2 - outlineBox.minX * scale;
          const ty = y + (wholeCell.height - boxHeight * scale) / 2 - outlineBox.minY * scale;
          const pieces = wholePieces[wholeIndex] ?? [];
          return (
            <g
              key={`share-whole-${wholeIndex}`}
              data-testid="share-whole"
              data-whole={wholeIndex}
              onPointerDown={(event) => pointerDown(event, wholeIndex)}
              onPointerUp={(event) => pointerUp(event, wholeIndex)}
            >
              <text
                x={x + wholeCell.width / 2}
                y={y - 8}
                textAnchor="middle"
                fontSize={18}
                fill={INK}
              >
                {S.wholeGroup(wholeIndex)}
              </text>
              <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
                <path d={pathOf(state.outline)} fill="#ffffff" stroke={INK} strokeWidth={3} />
                {pieces.map((piece, pieceIndex) => {
                  const isSelected =
                    selected !== null &&
                    selected.whole === wholeIndex &&
                    selected.piece === pieceIndex;
                  const dealt = (whole.pieces[pieceIndex]?.plate ?? null) !== null;
                  const fill = isSelected ? '#cfe0ff' : dealt ? '#e4f2e8' : '#f7f9fc';
                  return (
                    <path
                      key={`share-piece-${wholeIndex}-${pieceIndex}`}
                      d={pathOf(piece.points)}
                      fill={fill}
                      stroke={isSelected ? BLUE : GREEN}
                      strokeWidth={isSelected ? 5 : 2}
                      role="button"
                      tabIndex={0}
                      aria-label={
                        isSelected
                          ? S.pieceSelectedAria(wholeIndex, pieceIndex)
                          : S.pieceAria(wholeIndex, pieceIndex)
                      }
                      data-testid="share-piece"
                      data-whole={wholeIndex}
                      data-piece={pieceIndex}
                      data-dealt={dealt ? 'true' : 'false'}
                      style={{ cursor: readOnly ? 'default' : 'pointer' }}
                      onClick={() => {
                        if (skipClickRef.current) {
                          skipClickRef.current = false;
                          return;
                        }
                        if (readOnly) return;
                        dispatch({
                          type: 'select-piece',
                          whole: wholeIndex,
                          piece: pieceIndex,
                        });
                      }}
                      onKeyDown={(event) => {
                        if (readOnly || !isActivationKey(event)) return;
                        event.preventDefault();
                        dispatch({
                          type: 'select-piece',
                          whole: wholeIndex,
                          piece: pieceIndex,
                        });
                      }}
                    />
                  );
                })}
                <path d={pathOf(state.outline)} fill="none" stroke={INK} strokeWidth={4} />
              </g>
            </g>
          );
        })}

        {Array.from({ length: state.people }, (_, plate) => {
          const x = PLATE_AREA.x + plate * (plateCell.width + 14);
          const y = PLATE_AREA.y;
          const badgeRadius = Math.max(6, Math.min(11, plateCell.width / 16));
          const badges: Array<{ whole: number; piece: number }> = [];
          state.wholes.forEach((whole, wholeIndex) => {
            const count = wholePieces[wholeIndex]?.length ?? 1;
            whole.pieces.forEach((piece, pieceIndex) => {
              if (pieceIndex < count && piece.plate === plate) {
                badges.push({ whole: wholeIndex, piece: pieceIndex });
              }
            });
          });
          const labelLines = config.plateLabel === true ? plateLabels(plate) : [];
          return (
            <g
              key={`share-plate-${plate}`}
              role="button"
              tabIndex={0}
              aria-label={S.plateButton(plate)}
              data-testid="share-plate"
              data-plate={plate}
              style={{ cursor: readOnly || selected === null ? 'default' : 'pointer' }}
              onClick={() => {
                if (readOnly || selected === null) return;
                dispatch({
                  type: 'deal-piece',
                  whole: selected.whole,
                  piece: selected.piece,
                  plate,
                });
              }}
              onKeyDown={(event) => {
                if (readOnly || selected === null || !isActivationKey(event)) return;
                event.preventDefault();
                dispatch({
                  type: 'deal-piece',
                  whole: selected.whole,
                  piece: selected.piece,
                  plate,
                });
              }}
            >
              <rect
                x={x}
                y={y}
                width={plateCell.width}
                height={plateCell.height}
                rx={14}
                fill="#ffffff"
                stroke={selected === null ? MUTED : BLUE}
                strokeWidth={selected === null ? 2 : 3}
              />
              <text x={x + 14} y={y + 26} fontSize={18} fontWeight={700} fill={INK}>
                {S.plateButton(plate)}
              </text>
              {badges.slice(0, 12).map((_badge, index) => (
                <circle
                  key={`plate-badge-${plate}-${index}`}
                  cx={x + 24 + (index % 6) * (badgeRadius * 2 + 8)}
                  cy={y + 54 + Math.floor(index / 6) * (badgeRadius * 2 + 8)}
                  r={badgeRadius}
                  fill="#dbe7ff"
                  stroke={BLUE}
                  strokeWidth={1.5}
                />
              ))}
              {labelLines.map((line, index) => (
                <text
                  key={`plate-label-${plate}-${index}`}
                  x={x + 14}
                  y={y + plateCell.height - 16 - (labelLines.length - 1 - index) * 20}
                  fontSize={15}
                  fill={INK}
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}
      </CanvasFrame>

      <p className={styles.instructions}>
        {readOnly ? S.readOnlyHint : S.instructions.share} {S.shareHint} {S.shareKeyboardHint}
      </p>
    </div>
  );
}
