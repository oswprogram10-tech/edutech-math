/**
 * E12 `net-fold` 모드 주 View.
 *
 * - `.stageRow`/`.sideStack` 규칙(T137 중간 폭 포함)을 재사용한다.
 * - 왼쪽: 모눈 `NetGrid`(+ 예측 안내 / `netLog` 썸네일).
 * - 오른쪽: `FoldStage` + 도구 막대 + `NetCardsPanel`.
 */
import { useCallback, useMemo, useState } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { allowedFaceShapes, evaluateNet } from '../net/geometry';
import { canPlaceFace, findFaceAtCell } from '../net/reduce';
import { NET_PLAIN_STYLE } from '../net/visuals';
import { solid3dStrings as S } from '../strings.ko';
import type { NetFoldAction, NetFoldConfig, NetFoldState } from '../types';
import styles from '../View.module.css';
import { FoldStage } from './FoldStage';
import { NetCardsPanel } from './NetCardsPanel';
import { NetGrid } from './NetGrid';

const LOG_THUMB_CELL = 12;

function parseCanonicalRects(
  key: string,
): readonly { readonly x: number; readonly y: number; readonly w: number; readonly h: number }[] {
  if (!key) return [];
  return key
    .split(';')
    .map((part) => {
      const [x, y, w, h] = part.split(',').map((v) => Number(v));
      return { x: x ?? 0, y: y ?? 0, w: w ?? 1, h: h ?? 1 };
    })
    .filter((r) => r.w > 0 && r.h > 0);
}

function NetLogThumb({
  netKey,
  highlighted,
}: {
  readonly netKey: string;
  readonly highlighted: boolean;
}) {
  const rects = parseCanonicalRects(netKey);
  let maxX = 1;
  let maxY = 1;
  for (const r of rects) {
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  const pad = 2;
  const w = maxX * LOG_THUMB_CELL + pad * 2;
  const h = maxY * LOG_THUMB_CELL + pad * 2;
  return (
    <div
      className={styles.netLogThumb}
      data-testid="net-log-thumb"
      data-highlighted={highlighted ? 'true' : undefined}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        {rects.map((r, i) => (
          <rect
            key={`t-${i}`}
            x={pad + r.x * LOG_THUMB_CELL + 0.5}
            y={pad + r.y * LOG_THUMB_CELL + 0.5}
            width={Math.max(1, r.w * LOG_THUMB_CELL - 1)}
            height={Math.max(1, r.h * LOG_THUMB_CELL - 1)}
            rx={1.5}
            fill={NET_PLAIN_STYLE.fill}
            stroke={NET_PLAIN_STYLE.stroke}
            strokeWidth={1}
          />
        ))}
      </svg>
    </div>
  );
}

function ShapeIcon({ w, h }: { readonly w: number; readonly h: number }) {
  const maxDim = Math.max(w, h, 1);
  const scale = 22 / maxDim;
  const rw = Math.max(6, Math.round(w * scale));
  const rh = Math.max(6, Math.round(h * scale));
  return (
    <svg width={26} height={26} viewBox="0 0 26 26" aria-hidden="true">
      <rect
        x={(26 - rw) / 2}
        y={(26 - rh) / 2}
        width={rw}
        height={rh}
        rx={2}
        fill={NET_PLAIN_STYLE.fill}
        stroke={NET_PLAIN_STYLE.stroke}
        strokeWidth={1.6}
      />
    </svg>
  );
}

export function NetFoldView({
  state,
  dispatch,
  readOnly = false,
}: EngineViewProps<NetFoldConfig, NetFoldState, NetFoldAction>) {
  const { settings } = state;
  const [cols, rows] = settings.grid;
  const [liveMessage, setLiveMessage] = useState('');
  const [duplicateKey, setDuplicateKey] = useState<string | null>(null);

  const evaluation = useMemo(() => evaluateNet(state.faces, settings), [state.faces, settings]);
  const shapes = useMemo(() => allowedFaceShapes(settings), [settings]);
  const activeDuplicateKey = state.folded ? duplicateKey : null;

  const isPredictMode = settings.predict !== null;
  const needsPredictionFirst = isPredictMode && !state.folded && state.prediction === null;

  const triggerFoldToggle = useCallback(() => {
    if (readOnly || !settings.foldable) return;
    if (state.folded) {
      setDuplicateKey(null);
      dispatch({ type: 'unfold' });
      setLiveMessage(S.net.live.unfolded);
      return;
    }
    if (needsPredictionFirst) return;
    if (
      settings.netLog &&
      evaluation.valid &&
      evaluation.netKey &&
      state.foundNets.includes(evaluation.netKey)
    ) {
      setDuplicateKey(evaluation.netKey);
    } else {
      setDuplicateKey(null);
    }
    dispatch({ type: 'fold' });
    setLiveMessage(S.net.live.folded);
  }, [
    readOnly,
    settings.foldable,
    settings.netLog,
    state.folded,
    state.foundNets,
    needsPredictionFirst,
    evaluation.valid,
    evaluation.netKey,
    dispatch,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const target = e.target;
    const inButton =
      target instanceof Element &&
      Boolean(target.closest('button, [role="button"][data-testid^="net-predict-"]'));

    if (e.key === 'r' || e.key === 'R') {
      if (settings.target === 'cuboid' && settings.editable && !state.folded) {
        e.preventDefault();
        dispatch({ type: 'rotate-shape' });
        setLiveMessage(S.net.live.shapeRotated);
      }
      return;
    }
    if (e.key === 'f' || e.key === 'F') {
      if (settings.foldable && !needsPredictionFirst) {
        e.preventDefault();
        triggerFoldToggle();
      }
      return;
    }
    if (e.key === '[' && state.folded) {
      e.preventDefault();
      dispatch({ type: 'turn', dir: 'left' });
      setLiveMessage(S.live.turned);
      return;
    }
    if (e.key === ']' && state.folded) {
      e.preventDefault();
      dispatch({ type: 'turn', dir: 'right' });
      setLiveMessage(S.live.turned);
      return;
    }

    if (inButton || isPredictMode || !settings.editable || state.folded) return;

    const [cx, cy] = state.cursor;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      dispatch({ type: 'move-cursor', to: [Math.max(0, cx - 1), cy] });
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      dispatch({ type: 'move-cursor', to: [Math.min(cols - 1, cx + 1), cy] });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      dispatch({ type: 'move-cursor', to: [cx, Math.max(0, cy - 1)] });
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      dispatch({ type: 'move-cursor', to: [cx, Math.min(rows - 1, cy + 1)] });
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const hit = findFaceAtCell(state.faces, cx, cy);
      if (hit) {
        if (!hit.locked) {
          dispatch({ type: 'remove-face', x: cx, y: cy });
          setLiveMessage(S.net.live.removed);
        }
      } else if (canPlaceFace(state, cx, cy)) {
        dispatch({ type: 'place-face', x: cx, y: cy });
        setLiveMessage(S.net.live.placed);
      } else {
        setLiveMessage(S.net.live.cannotPlace);
      }
    }
  };

  const hasRemovable =
    state.faces.some((f) => !f.locked) || state.folded || state.prediction !== null;
  const instructionText = isPredictMode
    ? S.net.instructionsPredict
    : settings.editable
      ? S.net.instructionsEditable
      : S.net.instructionsView;
  const keyHintText = isPredictMode
    ? S.net.keyHintPredict
    : settings.editable
      ? S.net.keyHint
      : S.net.keyHintView;

  return (
    <div
      className={styles.wrap}
      data-mode="net-fold"
      data-rich-side="true"
      data-testid="net-view"
      onKeyDown={handleKeyDown}
    >
      <p className={styles.instructions}>{instructionText}</p>
      <div role="status" aria-live="polite" className={styles.srOnly}>
        {liveMessage}
      </div>

      <div className={styles.stageRow}>
        <div className={`${styles.boardArea} ${styles.netBoardArea}`}>
          {settings.predict ? (
            <p className={styles.netPredictBanner} data-testid="net-predict-prompt">
              {S.net.predictPrompt(settings.predict.of)}
            </p>
          ) : null}

          <NetGrid
            state={state}
            evaluation={evaluation}
            readOnly={readOnly}
            dispatch={dispatch}
            onLiveMessage={setLiveMessage}
          />

          {settings.netLog ? (
            <div className={styles.netLogBox} data-testid="net-log-panel">
              <div className={styles.panelHeaderRow}>
                <span className={styles.projTitle}>
                  {S.net.netLogCount(state.foundNets.length)}
                </span>
                {activeDuplicateKey ? (
                  <span className={styles.netDuplicateMsg} data-testid="net-log-duplicate">
                    {S.net.netLogDuplicate}
                  </span>
                ) : null}
              </div>
              {state.foundNets.length > 0 ? (
                <div className={styles.netLogRow}>
                  {state.foundNets.map((k) => (
                    <NetLogThumb key={k} netKey={k} highlighted={k === activeDuplicateKey} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={styles.sideStack}>
          <FoldStage
            state={state}
            evaluation={evaluation}
            readOnly={readOnly}
            dispatch={dispatch}
            onLiveMessage={setLiveMessage}
          />

          <div className={styles.toolbar} role="toolbar" aria-label={S.name}>
            {settings.foldable ? (
              <>
                <button
                  type="button"
                  className={styles.button}
                  data-testid="net-fold-toggle"
                  aria-pressed={state.folded}
                  disabled={readOnly || needsPredictionFirst}
                  onClick={triggerFoldToggle}
                >
                  <span>{state.folded ? S.net.unfold : S.net.fold}</span>
                </button>
                {needsPredictionFirst ? (
                  <span className={styles.hint} data-testid="net-pick-first">
                    {S.net.pickFirst}
                  </span>
                ) : null}
              </>
            ) : null}

            {settings.editable ? (
              <button
                type="button"
                className={styles.button}
                data-testid="net-clear"
                disabled={readOnly || !hasRemovable}
                onClick={() => {
                  setDuplicateKey(null);
                  dispatch({ type: 'clear' });
                  setLiveMessage(S.net.live.cleared);
                }}
              >
                <span>{S.net.clear}</span>
              </button>
            ) : null}
          </div>

          {settings.target === 'cuboid' && settings.editable ? (
            <div className={styles.panelBlock}>
              <div className={styles.toolbar} role="group" aria-label={S.net.rotateShape}>
                {shapes.map(([sw, sh]) => {
                  const selected = state.shape[0] === sw && state.shape[1] === sh;
                  return (
                    <button
                      key={`shape-${sw}x${sh}`}
                      type="button"
                      className={styles.button}
                      data-testid={`net-shape-${sw}x${sh}`}
                      aria-pressed={selected}
                      aria-label={S.net.shapeAria(sw, sh)}
                      disabled={readOnly || state.folded}
                      onClick={() => {
                        dispatch({ type: 'select-shape', w: sw, h: sh });
                        setLiveMessage(S.net.live.shapeSelected(sw, sh));
                      }}
                    >
                      <ShapeIcon w={sw} h={sh} />
                      <span>
                        {sw}×{sh}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={styles.button}
                  data-testid="net-rotate-shape"
                  disabled={readOnly || state.folded || state.shape[0] === state.shape[1]}
                  onClick={() => {
                    dispatch({ type: 'rotate-shape' });
                    setLiveMessage(S.net.live.shapeRotated);
                  }}
                >
                  <span>{S.net.rotateShape}</span>
                </button>
              </div>
            </div>
          ) : null}

          <NetCardsPanel state={state} />

          <p className={styles.hint}>{keyHintText}</p>
        </div>
      </div>
    </div>
  );
}
