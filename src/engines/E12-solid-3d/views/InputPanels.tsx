/**
 * E12 T134 2D 입력판: 수 쓰기 격자 · 층 슬라이더 · 층별 그림 · 투영 칠하기.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { clamp } from '../../../core/engine-sdk';
import { solid3dStrings as S } from '../strings.ko';
import type { CubesAction, CubesState, ProjectionView } from '../types';
import { heightMap, layerMatrices } from '../voxel';
import styles from '../View.module.css';

interface PanelProps {
  readonly state: CubesState;
  readonly dispatch: (action: CubesAction) => void;
  readonly readOnly: boolean;
}

export function NumberGridPanel({ state, dispatch, readOnly }: PanelProps) {
  const config = state.settings.numberGrid;
  const gridRef = useRef<HTMLDivElement | null>(null);
  if (!config) return null;

  const [cols, rows] = state.settings.grid;
  const { maxHeight, editable } = state.settings;
  const { mode } = config;

  const matrix =
    mode === 'input'
      ? state.numbers
      : mode === 'drive'
        ? heightMap(state.cubes, state.settings.grid)
        : (config.given ?? null);
  if (!matrix) return null;

  const isGiven = mode === 'given';
  const canEdit = !readOnly && (mode === 'input' || (mode === 'drive' && editable));
  const [curRow, curCol] = state.numberCursor;

  const applyValue = (row: number, col: number, value: number) => {
    if (!canEdit) return;
    if (mode === 'input') {
      dispatch({ type: 'set-number', row, col, value });
      return;
    }
    if (mode === 'drive') {
      const x = col;
      const y = rows - 1 - row;
      dispatch({ type: 'set-height', x, y, h: value });
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (isGiven || readOnly) return;
    const key = event.key;
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      const nr =
        key === 'ArrowUp'
          ? clamp(curRow - 1, 0, rows - 1)
          : key === 'ArrowDown'
            ? clamp(curRow + 1, 0, rows - 1)
            : curRow;
      const nc =
        key === 'ArrowLeft'
          ? clamp(curCol - 1, 0, cols - 1)
          : key === 'ArrowRight'
            ? clamp(curCol + 1, 0, cols - 1)
            : curCol;
      dispatch({ type: 'move-number-cursor', to: [nr, nc] });
      gridRef.current?.focus({ preventScroll: true });
      return;
    }
    if (/^[0-9]$/.test(key)) {
      const num = Number(key);
      if (num <= maxHeight) {
        event.preventDefault();
        applyValue(curRow, curCol, num);
      }
      return;
    }
    if (key === 'Backspace' || key === 'Delete') {
      event.preventDefault();
      applyValue(curRow, curCol, 0);
    }
  };

  const digitOptions = Array.from({ length: maxHeight + 1 }, (_, i) => i);

  return (
    <div className={styles.panelBlock}>
      <p className={styles.projTitle} style={{ textAlign: 'left' }}>
        {S.numberGridTitle}
      </p>
      <div
        ref={gridRef}
        className={styles.gridTable}
        style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}
        data-testid="cubes-numbers"
        role="grid"
        aria-label={S.numberGridTitle}
        tabIndex={!isGiven && !readOnly ? 0 : -1}
        onKeyDown={onKeyDown}
      >
        {matrix.map((row, r) =>
          row.map((val, c) => {
            const isSelected = !isGiven && curRow === r && curCol === c;
            const displayText = val > 0 ? String(val) : mode === 'input' && isSelected ? '0' : '';
            if (isGiven) {
              return (
                <div
                  key={`num-${r}-${c}`}
                  className={styles.numCell}
                  data-num-cell={`${r},${c}`}
                  aria-label={S.numberCellAria(r, c, val)}
                >
                  {displayText}
                </div>
              );
            }
            return (
              <button
                key={`num-${r}-${c}`}
                type="button"
                className={styles.numCell}
                data-num-cell={`${r},${c}`}
                data-selected={isSelected ? 'true' : undefined}
                disabled={readOnly}
                aria-label={S.numberCellAria(r, c, val)}
                onClick={() => {
                  dispatch({ type: 'move-number-cursor', to: [r, c] });
                  gridRef.current?.focus({ preventScroll: true });
                }}
              >
                {displayText}
              </button>
            );
          }),
        )}
      </div>

      {!isGiven ? (
        <>
          <div className={styles.numKeyRow} role="group" aria-label={S.numberGridHint}>
            {digitOptions.map((n) => (
              <button
                key={`num-key-${n}`}
                type="button"
                className={styles.numKeyBtn}
                disabled={!canEdit}
                aria-label={S.numberButtonAria(n)}
                onClick={() => applyValue(curRow, curCol, n)}
              >
                {n}
              </button>
            ))}
          </div>
          <p className={styles.hint}>{S.numberGridHint}</p>
        </>
      ) : null}
    </div>
  );
}

export function LayerSliderBar({ state, dispatch, readOnly }: PanelProps) {
  if (!state.settings.layers.slider) return null;
  const { maxHeight } = state.settings;
  const layerNumbers = Array.from({ length: maxHeight }, (_, idx) => idx + 1);

  return (
    <div className={styles.panelBlock}>
      <div className={styles.toolbar} role="group" aria-label={S.layersTitle}>
        <button
          type="button"
          className={styles.button}
          data-testid="cubes-layer-btn-all"
          aria-pressed={state.layerFocus === null}
          disabled={readOnly}
          onClick={() => dispatch({ type: 'focus-layer', layer: null })}
        >
          <span>{S.layerAll}</span>
        </button>
        {layerNumbers.map((k) => (
          <button
            key={`layer-btn-${k}`}
            type="button"
            className={styles.button}
            data-testid={`cubes-layer-btn-${k}`}
            aria-pressed={state.layerFocus === k}
            disabled={readOnly}
            onClick={() => dispatch({ type: 'focus-layer', layer: k })}
          >
            <span>{S.layerLabel(k)}</span>
          </button>
        ))}
      </div>
      <p className={styles.hint}>{S.layersSliderHint}</p>
    </div>
  );
}

export function LayerGridPanel({ state, dispatch, readOnly }: PanelProps) {
  const { layers, grid, maxHeight } = state.settings;
  const [cols, rows] = grid;
  const [cursor, setCursor] = useState<readonly [number, number]>([0, 0]);
  const [focusedLayer, setFocusedLayer] = useState<number | null>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  if (layers.panel === 'off') return null;

  const matrices =
    layers.panel === 'live'
      ? layerMatrices(state.cubes, grid, maxHeight)
      : layers.panel === 'paint'
        ? state.layerPaint
        : (layers.given ?? null);
  if (!matrices) return null;

  const isPaint = layers.panel === 'paint';
  const hasAnyPaint = isPaint && matrices.some((m) => m.some((r) => r.some((c) => c > 0)));

  const onCardKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, layerNum: number) => {
    if (!isPaint || readOnly) return;
    const key = event.key;
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      const nr =
        key === 'ArrowUp'
          ? clamp(cursor[0] - 1, 0, rows - 1)
          : key === 'ArrowDown'
            ? clamp(cursor[0] + 1, 0, rows - 1)
            : cursor[0];
      const nc =
        key === 'ArrowLeft'
          ? clamp(cursor[1] - 1, 0, cols - 1)
          : key === 'ArrowRight'
            ? clamp(cursor[1] + 1, 0, cols - 1)
            : cursor[1];
      setCursor([nr, nc]);
      cardRefs.current[layerNum]?.focus({ preventScroll: true });
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      dispatch({ type: 'toggle-layer-cell', layer: layerNum, row: cursor[0], col: cursor[1] });
      return;
    }
    if (key === 'PageUp' || key === 'PageDown') {
      event.preventDefault();
      const nextLayer =
        key === 'PageUp' ? clamp(layerNum + 1, 1, maxHeight) : clamp(layerNum - 1, 1, maxHeight);
      setFocusedLayer(nextLayer);
      cardRefs.current[nextLayer]?.focus({ preventScroll: true });
    }
  };

  return (
    <div className={styles.panelBlock}>
      <div className={styles.panelHeaderRow}>
        <p className={styles.projTitle}>{S.layersTitle}</p>
        {isPaint ? (
          <button
            type="button"
            className={styles.smallActionBtn}
            disabled={readOnly || !hasAnyPaint}
            onClick={() => dispatch({ type: 'clear-layer-paint' })}
          >
            {S.clearPaint}
          </button>
        ) : null}
      </div>

      <div className={styles.layersWrap}>
        {matrices.map((mat, idx) => {
          const layerNum = idx + 1;
          const highlighted = layers.slider && state.layerFocus === layerNum;
          return (
            <div
              key={`layer-card-${layerNum}`}
              ref={(el) => {
                cardRefs.current[layerNum] = el;
              }}
              className={`${styles.layerCard} ${isPaint ? styles.layerCardPaint : ''}`}
              data-testid={`cubes-layer-${layerNum}`}
              data-layer-active={highlighted ? 'true' : undefined}
              tabIndex={isPaint && !readOnly ? 0 : -1}
              role={isPaint ? 'grid' : undefined}
              aria-label={S.layerLabel(layerNum)}
              onFocus={() => setFocusedLayer(layerNum)}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setFocusedLayer((prev) => (prev === layerNum ? null : prev));
                }
              }}
              onKeyDown={(e) => onCardKeyDown(e, layerNum)}
            >
              <p className={styles.projTitle}>{S.layerLabel(layerNum)}</p>
              <div
                className={styles.layerGrid}
                style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}
              >
                {mat.map((row, r) =>
                  row.map((val, c) => {
                    const filled = val > 0;
                    const isCursor =
                      isPaint && focusedLayer === layerNum && cursor[0] === r && cursor[1] === c;
                    if (!isPaint) {
                      return (
                        <div
                          key={`lc-${layerNum}-${r}-${c}`}
                          className={styles.layerStaticCell}
                          data-layer-cell={`${layerNum},${r},${c}`}
                          data-filled={filled ? 'true' : 'false'}
                          aria-label={S.layerCellAria(layerNum, r, c, filled)}
                        />
                      );
                    }
                    return (
                      <button
                        key={`lc-${layerNum}-${r}-${c}`}
                        type="button"
                        className={styles.paintCell}
                        data-layer-cell={`${layerNum},${r},${c}`}
                        data-filled={filled ? 'true' : 'false'}
                        data-cursor={isCursor ? 'true' : undefined}
                        aria-pressed={filled}
                        aria-label={S.layerCellAria(layerNum, r, c, filled)}
                        disabled={readOnly}
                        onClick={() => {
                          setCursor([r, c]);
                          setFocusedLayer(layerNum);
                          dispatch({ type: 'toggle-layer-cell', layer: layerNum, row: r, col: c });
                          cardRefs.current[layerNum]?.focus({ preventScroll: true });
                        }}
                      />
                    );
                  }),
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isPaint ? <p className={styles.hint}>{S.layersPaintHint}</p> : null}
    </div>
  );
}

export function PaintViewPanel({ state, dispatch, readOnly }: PanelProps) {
  const { paintViews } = state.settings;
  const painted = state.painted;
  const [cursors, setCursors] = useState<
    Partial<Record<ProjectionView, readonly [number, number]>>
  >({});
  const [focusedView, setFocusedView] = useState<ProjectionView | null>(null);
  const gridRefs = useRef<Partial<Record<ProjectionView, HTMLDivElement | null>>>({});

  if (paintViews.length === 0 || !painted) return null;

  const onGridKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    view: ProjectionView,
    vRows: number,
    vCols: number,
  ) => {
    if (readOnly) return;
    const key = event.key;
    const cur = cursors[view] ?? [0, 0];
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      const nr =
        key === 'ArrowUp'
          ? clamp(cur[0] - 1, 0, vRows - 1)
          : key === 'ArrowDown'
            ? clamp(cur[0] + 1, 0, vRows - 1)
            : cur[0];
      const nc =
        key === 'ArrowLeft'
          ? clamp(cur[1] - 1, 0, vCols - 1)
          : key === 'ArrowRight'
            ? clamp(cur[1] + 1, 0, vCols - 1)
            : cur[1];
      setCursors((prev) => ({ ...prev, [view]: [nr, nc] }));
      gridRefs.current[view]?.focus({ preventScroll: true });
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      dispatch({ type: 'toggle-paint-cell', view, row: cur[0], col: cur[1] });
    }
  };

  return (
    <div className={styles.panelBlock}>
      <div className={styles.projRow}>
        {paintViews.map((view) => {
          const matrix = painted[view];
          if (!matrix) return null;
          const vRows = matrix.length;
          const vCols = matrix[0]?.length ?? 0;
          const cur = cursors[view] ?? [0, 0];
          const hasAny = matrix.some((r) => r.some((c) => c > 0));

          return (
            <div key={`paint-view-${view}`} className={styles.paintCard}>
              <div className={styles.panelHeaderRow} style={{ width: '100%' }}>
                <p className={styles.projTitle}>{S.paintViews[view]}</p>
                <button
                  type="button"
                  className={styles.smallActionBtn}
                  disabled={readOnly || !hasAny}
                  onClick={() => dispatch({ type: 'clear-paint', view })}
                >
                  {S.clearPaint}
                </button>
              </div>

              <div
                ref={(el) => {
                  gridRefs.current[view] = el;
                }}
                className={styles.paintGridWrap}
                data-testid={`cubes-paint-${view}`}
                tabIndex={readOnly ? -1 : 0}
                role="grid"
                aria-label={S.paintViews[view]}
                onFocus={() => setFocusedView(view)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setFocusedView((prev) => (prev === view ? null : prev));
                  }
                }}
                onKeyDown={(e) => onGridKeyDown(e, view, vRows, vCols)}
              >
                <div
                  className={styles.gridTable}
                  style={{ gridTemplateColumns: `repeat(${vCols}, auto)` }}
                >
                  {matrix.map((row, r) =>
                    row.map((val, c) => {
                      const filled = val > 0;
                      const isCursor = focusedView === view && cur[0] === r && cur[1] === c;
                      return (
                        <button
                          key={`pc-${view}-${r}-${c}`}
                          type="button"
                          className={styles.paintCell}
                          data-paint-cell={`${view},${r},${c}`}
                          data-filled={filled ? 'true' : 'false'}
                          data-cursor={isCursor ? 'true' : undefined}
                          aria-pressed={filled}
                          aria-label={S.projectionCellAria(view, r, c, filled)}
                          disabled={readOnly}
                          onClick={() => {
                            setCursors((prev) => ({ ...prev, [view]: [r, c] }));
                            setFocusedView(view);
                            dispatch({ type: 'toggle-paint-cell', view, row: r, col: c });
                            gridRefs.current[view]?.focus({ preventScroll: true });
                          }}
                        />
                      );
                    }),
                  )}
                </div>

                {view === 'top' ? <div className={styles.frontCaption}>{S.front}</div> : null}
                {view === 'front' ? (
                  <div className={styles.floorBaseline}>
                    <span>{S.floorLine}</span>
                  </div>
                ) : null}
                {view === 'side' ? (
                  <div className={styles.floorBaseline}>
                    <span>{S.front}</span>
                    <span>{S.floorLine}</span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className={styles.hint}>{S.paintViewHint}</p>
    </div>
  );
}
