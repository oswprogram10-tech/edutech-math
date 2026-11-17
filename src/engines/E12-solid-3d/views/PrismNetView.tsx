/**
 * E12 각기둥 전개도(`net-fold` + `target:'prism'`, 상태 모드 `prism-net`) 주 View.
 *
 * - `.stageRow`/`.sideStack` 규칙(T137 중간 폭 포함)을 재사용하고 `data-mode="prism-net"`을 단다.
 * - 왼쪽: 조각 판 `PrismNetBoard`. 오른쪽: 조각 고르기, 접기·지우기·빼기, 접은 결과, 보기 카드.
 * - 학생 화면에 조각이 가는 자리 이름이나 접히지 않는 이유를 쓰지 않는다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { isPrismNetCardsOnly } from '../prismnet/cards-only';
import { evaluateState } from '../prismnet/observe';
import { problemPieceIndices, type PrismPieceType } from '../prismnet/model';
import { canRemovePiece, remainingCounts } from '../prismnet/reduce';
import { pieceStyle } from '../prismnet/visuals';
import { solid3dStrings as S } from '../strings.ko';
import type { PrismNetAction, PrismNetConfig, PrismNetState } from '../types';
import styles from '../View.module.css';
import { PrismNetBoard } from './PrismNetBoard';
import { PrismNetCardsPanel } from './PrismNetCardsPanel';
import { PrismNetFoldedStage } from './PrismNetFoldedStage';

function TypeIcon({ type, n }: { readonly type: PrismPieceType; readonly n: number }) {
  const style = pieceStyle(type);
  if (type === 'rect') {
    return (
      <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x={5}
          y={3}
          width={14}
          height={18}
          rx={1.5}
          fill={style.fill}
          stroke={style.stroke}
          strokeWidth={2}
        />
      </svg>
    );
  }
  const pts = Array.from({ length: n }, (_, k) => {
    const a = -Math.PI / 2 - Math.PI / n + (2 * Math.PI * k) / n;
    return `${(12 + 10 * Math.cos(a)).toFixed(1)},${(12 - 10 * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true">
      <polygon
        points={pts}
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function isTypingTarget(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
  );
}

export function PrismNetView({
  state,
  dispatch,
  readOnly = false,
}: EngineViewProps<PrismNetConfig, PrismNetState, PrismNetAction>) {
  const { settings } = state;
  const [liveMessage, setLiveMessage] = useState('');
  const [pickedId, setPickedId] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const prevIdsRef = useRef<ReadonlySet<number>>(new Set(state.pieces.map((p) => p.id)));

  const selectedId =
    pickedId !== null && state.pieces.some((p) => p.id === pickedId) ? pickedId : null;
  const evaluation = useMemo(() => evaluateState(state), [state]);
  const remaining = remainingCounts(state);
  const interactive = !readOnly && settings.editable;

  // 조각을 새로 붙이면 그 조각으로 초점을 옮겨, 키보드만으로 이어서 붙일 수 있게 한다.
  useEffect(() => {
    const prev = prevIdsRef.current;
    const added = state.pieces.find((p) => !prev.has(p.id));
    prevIdsRef.current = new Set(state.pieces.map((p) => p.id));
    if (!added) return;
    const el = wrapRef.current?.querySelector(`[data-testid="prismnet-piece-${added.id}"]`);
    if (el instanceof SVGElement) el.focus({ preventScroll: true });
  }, [state.pieces]);

  const problemIndices = useMemo(
    () =>
      state.folded && !evaluation.valid && settings.collisionHighlight
        ? new Set(problemPieceIndices(evaluation))
        : new Set<number>(),
    [state.folded, evaluation, settings.collisionHighlight],
  );

  const selectType = (type: PrismPieceType) => {
    if (!interactive || state.folded) return;
    const label = type === 'base' ? S.prismNet.baseTypeLabel(settings.n) : S.prismNet.rectTypeLabel;
    if (state.selectedType === type) {
      dispatch({ type: 'select-piece-type', pieceType: null });
      setLiveMessage(S.prismNet.live.typeCleared);
      return;
    }
    if (remaining[type] <= 0) return;
    dispatch({ type: 'select-piece-type', pieceType: type });
    setLiveMessage(S.prismNet.live.typeSelected(label));
  };

  const toggleFold = () => {
    if (readOnly || !settings.foldable || state.pieces.length === 0) return;
    dispatch({ type: 'toggle-fold' });
    setLiveMessage(state.folded ? S.prismNet.live.unfolded : S.prismNet.live.folded);
  };

  const removeSelected = () => {
    if (!interactive || selectedId === null || !canRemovePiece(state, selectedId)) return;
    dispatch({ type: 'remove-piece', id: selectedId });
    setPickedId(null);
    setLiveMessage(S.prismNet.live.removed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
    const key = e.key;
    if (key === 'b' || key === 'B') {
      e.preventDefault();
      selectType('base');
    } else if (key === 'r' || key === 'R') {
      e.preventDefault();
      selectType('rect');
    } else if (key === 'f' || key === 'F') {
      if (settings.foldable) {
        e.preventDefault();
        toggleFold();
      }
    } else if (key === 'Delete' || key === 'Backspace') {
      if (selectedId !== null) {
        e.preventDefault();
        removeSelected();
      }
    }
  };

  if (isPrismNetCardsOnly(state)) {
    return (
      <div
        ref={wrapRef}
        className={styles.wrap}
        data-mode="prism-net"
        data-rich-side="true"
        data-net-cards-only="true"
        data-testid="prismnet-view"
      >
        <p className={styles.instructions}>{S.prismNet.instructionsCards}</p>
        <div className={styles.netCardsOnlyArea}>
          <PrismNetCardsPanel state={state} size="large" />
        </div>
      </div>
    );
  }

  const hasRemovableAny = state.pieces.some((p) => !p.locked);
  const typeDisabled = !interactive || state.folded;

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      data-mode="prism-net"
      data-rich-side="true"
      data-testid="prismnet-view"
      onKeyDown={handleKeyDown}
    >
      <p className={styles.instructions}>
        {settings.editable ? S.prismNet.instructionsEditable : S.prismNet.instructionsView}
      </p>
      <div role="status" aria-live="polite" className={styles.srOnly}>
        {liveMessage}
      </div>

      <div className={styles.stageRow}>
        <div className={`${styles.boardArea} ${styles.prismNetBoardArea}`}>
          <PrismNetBoard
            state={state}
            readOnly={readOnly}
            selectedId={selectedId}
            problemIndices={problemIndices}
            dispatch={dispatch}
            onSelect={setPickedId}
            onLiveMessage={setLiveMessage}
          />
        </div>

        <div className={styles.sideStack}>
          {settings.editable ? (
            <div
              className={styles.prismNetTypes}
              role="group"
              aria-label={S.prismNet.typeGroupLabel}
            >
              {(['base', 'rect'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`${styles.button} ${styles.prismNetTypeButton}`}
                  data-testid={`prismnet-type-${type}`}
                  aria-pressed={state.selectedType === type}
                  disabled={typeDisabled || (remaining[type] <= 0 && state.selectedType !== type)}
                  onClick={() => selectType(type)}
                >
                  <TypeIcon type={type} n={settings.n} />
                  <span className={styles.prismNetTypeText}>
                    <span>
                      {type === 'base'
                        ? S.prismNet.baseTypeLabel(settings.n)
                        : S.prismNet.rectTypeLabel}
                    </span>
                    <span
                      className={styles.prismNetRemaining}
                      data-testid={`prismnet-remaining-${type}`}
                    >
                      {S.prismNet.remaining(remaining[type])}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <div className={styles.toolbar} role="toolbar" aria-label={S.name}>
            {settings.foldable ? (
              <button
                type="button"
                className={styles.button}
                data-testid="prismnet-fold"
                aria-pressed={state.folded}
                disabled={readOnly || state.pieces.length === 0}
                onClick={toggleFold}
              >
                <span>{state.folded ? S.prismNet.unfold : S.prismNet.fold}</span>
              </button>
            ) : null}
            {settings.editable ? (
              <>
                <button
                  type="button"
                  className={styles.button}
                  data-testid="prismnet-remove"
                  disabled={readOnly || selectedId === null || !canRemovePiece(state, selectedId)}
                  onClick={removeSelected}
                >
                  <span>{S.prismNet.remove}</span>
                </button>
                <button
                  type="button"
                  className={styles.button}
                  data-testid="prismnet-clear"
                  disabled={readOnly || (!hasRemovableAny && !state.folded)}
                  onClick={() => {
                    dispatch({ type: 'clear' });
                    setPickedId(null);
                    setLiveMessage(S.prismNet.live.cleared);
                  }}
                >
                  <span>{S.prismNet.clear}</span>
                </button>
              </>
            ) : null}
          </div>

          {state.folded ? (
            <div
              className={styles.panelBlock}
              data-testid="prismnet-folded"
              data-valid={evaluation.valid ? 'true' : 'false'}
            >
              {evaluation.valid ? (
                <>
                  <PrismNetFoldedStage
                    n={settings.n}
                    sideLen={settings.sideLen}
                    height={settings.height}
                    readOnly={readOnly}
                    onLiveMessage={setLiveMessage}
                  />
                  <p
                    className={styles.netStatusText}
                    data-valid="true"
                    data-testid="prismnet-fold-status"
                  >
                    {S.prismNet.folded}
                  </p>
                </>
              ) : (
                <p className={styles.netStatusText} data-testid="prismnet-fold-status">
                  {S.prismNet.cannotFold}
                </p>
              )}
            </div>
          ) : null}

          <PrismNetCardsPanel state={state} />

          <p className={styles.hint}>
            {settings.editable ? S.prismNet.keyHint : S.prismNet.keyHintView}
          </p>
        </div>
      </div>
    </div>
  );
}
