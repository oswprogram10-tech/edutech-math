/**
 * E12 `prism-pyramid` 모드 주 View.
 *
 * - `.stageRow`/`.sideStack` 규칙과 `data-mode="prism-pyramid"`를 쓴다.
 * - 왼쪽: 입체 이름 + `PrismStage` + 돌리기·엑스레이 단추. 오른쪽: n 고르기, 손잡이 두 개, 표시 도구, 카운터 표.
 * - 학생 화면에 면·모서리·꼭짓점 개수, 표시한 개수, 맞다/틀리다 문구를 쓰지 않는다.
 */
import { useRef, useState } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { clamp } from '../../../core/engine-sdk';
import { prismKind } from '../prism/geometry';
import { solid3dStrings as S } from '../strings.ko';
import type { PrismAction, PrismConfig, PrismState } from '../types';
import { PRISM_MAX_HEIGHT } from '../types';
import styles from '../View.module.css';
import { PrismCounterTable } from './PrismCounterTable';
import { PrismStage } from './PrismStage';

const HANDLE_PX = 48;
const TRACK_PX = 144;

function solidName(state: PrismState): string {
  const kind = prismKind({ n: state.sides, height: state.height, top: state.top });
  if (kind === 'base') return S.prism.baseName(state.sides);
  return kind === 'prism' ? S.prism.prismName(state.sides) : S.prism.pyramidName(state.sides);
}

function PolygonIcon({ n }: { readonly n: number }) {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = ((-90 - 180 / n + (360 * i) / n) * Math.PI) / 180;
    return `${(20 + 15 * Math.cos(a)).toFixed(1)},${(20 + 15 * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return (
    <svg
      width={40}
      height={40}
      viewBox="0 0 40 40"
      aria-hidden="true"
      data-testid="prism-sides-icon"
    >
      <polygon
        points={pts}
        fill="#dbeafe"
        stroke="#1d4ed8"
        strokeWidth={2.2}
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

export function PrismView({
  state,
  dispatch,
  readOnly = false,
}: EngineViewProps<PrismConfig, PrismState, PrismAction>) {
  const { settings } = state;
  const [liveMessage, setLiveMessage] = useState('');
  const [dragFrac, setDragFrac] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<number | null>(null);

  const sidesFixed = settings.sidesMin === settings.sidesMax;
  const hasExtrude = settings.handles.includes('extrude');
  const hasApex = settings.handles.includes('apex');
  const showXrayBtn = settings.xrayToggle;
  const showRotateBtns = settings.rotate;
  const hasTools = settings.tools.length > 0;
  const hasAnyMark =
    state.marked.faces.length > 0 ||
    state.marked.edges.length > 0 ||
    state.marked.vertices.length > 0;
  const kind = prismKind({ n: state.sides, height: state.height, top: state.top });

  const changeSides = (n: number) => {
    if (readOnly) return;
    dispatch({ type: 'set-sides', n });
    setLiveMessage(S.prism.live.sidesChanged);
  };
  const changeHeight = (h: number) => {
    if (readOnly) return;
    dispatch({ type: 'set-height', h });
    setLiveMessage(S.prism.live.extruded);
  };
  const toggleApex = () => {
    if (readOnly) return;
    const next = state.top === 'apex' ? 'flat' : 'apex';
    dispatch({ type: 'set-top', top: next });
    setLiveMessage(next === 'apex' ? S.prism.live.apexOn : S.prism.live.apexOff);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
    const key = e.key;
    if (key === 'q' || key === 'Q') {
      if (settings.rotate) {
        e.preventDefault();
        dispatch({ type: 'rotate-view', dYaw: -15, dPitch: 0 });
        setLiveMessage(S.prism.live.turned);
      }
    } else if (key === 'e' || key === 'E') {
      if (settings.rotate) {
        e.preventDefault();
        dispatch({ type: 'rotate-view', dYaw: 15, dPitch: 0 });
        setLiveMessage(S.prism.live.turned);
      }
    } else if (key === 'w' || key === 'W') {
      if (settings.rotate) {
        e.preventDefault();
        dispatch({ type: 'rotate-view', dYaw: 0, dPitch: 15 });
        setLiveMessage(S.prism.live.turned);
      }
    } else if (key === 's' || key === 'S') {
      if (settings.rotate) {
        e.preventDefault();
        dispatch({ type: 'rotate-view', dYaw: 0, dPitch: -15 });
        setLiveMessage(S.prism.live.turned);
      }
    } else if (key === 'x' || key === 'X') {
      if (showXrayBtn) {
        e.preventDefault();
        const next = !state.xray;
        dispatch({ type: 'toggle-xray' });
        setLiveMessage(next ? S.prism.live.xrayOn : S.prism.live.xrayOff);
      }
    } else if (key === '[' || key === ']') {
      if (!sidesFixed) {
        e.preventDefault();
        changeSides(state.sides + (key === ']' ? 1 : -1));
      }
    } else if (key === 'PageUp' || key === 'PageDown') {
      if (hasExtrude) {
        e.preventDefault();
        changeHeight(state.height + (key === 'PageUp' ? 1 : -1));
      }
    } else if (key === 'a' || key === 'A') {
      if (hasApex) {
        e.preventDefault();
        toggleApex();
      }
    }
  };

  // 밀어 올리기 손잡이: 세로 트랙을 끌어 가장 가까운 칸에 맞춘다.
  const fracFromPointer = (clientY: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.height <= HANDLE_PX) return 0;
    const usable = rect.height - HANDLE_PX;
    // 위쪽이 높이 4, 아래쪽이 높이 0
    return clamp(1 - (clientY - rect.top - HANDLE_PX / 2) / usable, 0, 1);
  };
  const applyDrag = (clientY: number) => {
    const frac = fracFromPointer(clientY);
    setDragFrac(frac);
    const step = Math.round(frac * PRISM_MAX_HEIGHT);
    if (step !== state.height) changeHeight(step);
  };
  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || !hasExtrude) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    draggingRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // 일부 테스트 환경에서는 pointer capture를 지원하지 않는다.
    }
    applyDrag(e.clientY);
  };
  const onTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current !== e.pointerId) return;
    applyDrag(e.clientY);
  };
  const endTrackDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current !== e.pointerId) return;
    draggingRef.current = null;
    setDragFrac(null);
  };
  const onHandleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly) return;
    let next: number | null = null;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = state.height + 1;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = state.height - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = PRISM_MAX_HEIGHT;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    changeHeight(next);
  };

  const handleFrac = dragFrac ?? state.height / PRISM_MAX_HEIGHT;
  const handleTop = (1 - handleFrac) * (TRACK_PX - HANDLE_PX);

  const instructionText =
    !hasTools && !hasExtrude && !hasApex && sidesFixed
      ? S.prism.instructionsViewOnly
      : S.prism.instructions;

  return (
    <div
      className={styles.wrap}
      data-mode="prism-pyramid"
      data-rich-side="true"
      data-testid="prism-view"
      onKeyDown={handleKeyDown}
    >
      <p className={styles.instructions}>{instructionText}</p>
      <div role="status" aria-live="polite" className={styles.srOnly}>
        {liveMessage}
      </div>

      <div className={styles.stageRow} data-prism-row="true">
        <div className={`${styles.boardArea} ${styles.xrayStageBoard}`}>
          {settings.showName ? (
            <p className={styles.prismName} data-testid="prism-name">
              {solidName(state)}
            </p>
          ) : null}
          <PrismStage
            state={state}
            readOnly={readOnly}
            dispatch={dispatch}
            onLiveMessage={setLiveMessage}
          />
          {showRotateBtns || showXrayBtn ? (
            <div className={styles.prismStageTools} role="toolbar" aria-label={S.prism.stageLabel}>
              {showRotateBtns ? (
                <>
                  <button
                    type="button"
                    className={styles.button}
                    data-testid="prism-turn-left"
                    disabled={readOnly}
                    aria-label={S.turnLeft}
                    onClick={() => {
                      dispatch({ type: 'rotate-view', dYaw: -45, dPitch: 0 });
                      setLiveMessage(S.prism.live.turned);
                    }}
                  >
                    <span>↺</span>
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    data-testid="prism-turn-right"
                    disabled={readOnly}
                    aria-label={S.turnRight}
                    onClick={() => {
                      dispatch({ type: 'rotate-view', dYaw: 45, dPitch: 0 });
                      setLiveMessage(S.prism.live.turned);
                    }}
                  >
                    <span>↻</span>
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    data-testid="prism-tilt-up"
                    disabled={readOnly}
                    aria-label={S.prism.tiltUp}
                    onClick={() => {
                      dispatch({ type: 'rotate-view', dYaw: 0, dPitch: 30 });
                      setLiveMessage(S.prism.live.turned);
                    }}
                  >
                    <span>⤒</span>
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    data-testid="prism-tilt-down"
                    disabled={readOnly}
                    aria-label={S.prism.tiltDown}
                    onClick={() => {
                      dispatch({ type: 'rotate-view', dYaw: 0, dPitch: -30 });
                      setLiveMessage(S.prism.live.turned);
                    }}
                  >
                    <span>⤓</span>
                  </button>
                </>
              ) : null}
              {showXrayBtn ? (
                <button
                  type="button"
                  className={styles.button}
                  data-testid="prism-toggle-xray"
                  aria-pressed={state.xray}
                  disabled={readOnly}
                  onClick={() => {
                    const next = !state.xray;
                    dispatch({ type: 'toggle-xray' });
                    setLiveMessage(next ? S.prism.live.xrayOn : S.prism.live.xrayOff);
                  }}
                >
                  <span>{S.prism.xrayToggle}</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={styles.sideStack}>
          {!sidesFixed || hasExtrude || hasApex ? (
            <div className={styles.prismControls} role="group" aria-label={S.prism.controlsLabel}>
              {hasExtrude ? (
                <div className={styles.prismExtrude}>
                  <span className={styles.prismCaption}>{S.prism.extrudeLabel}</span>
                  <div
                    ref={trackRef}
                    className={styles.prismTrack}
                    data-testid="prism-extrude-track"
                    style={{ height: TRACK_PX }}
                    onPointerDown={onTrackPointerDown}
                    onPointerMove={onTrackPointerMove}
                    onPointerUp={endTrackDrag}
                    onPointerCancel={endTrackDrag}
                  >
                    <div className={styles.prismTrackLine} aria-hidden="true" />
                    {Array.from({ length: PRISM_MAX_HEIGHT + 1 }, (_, i) => (
                      <span
                        key={i}
                        className={styles.prismTick}
                        aria-hidden="true"
                        style={{
                          top: `${(1 - i / PRISM_MAX_HEIGHT) * (TRACK_PX - HANDLE_PX) + HANDLE_PX / 2 - 3}px`,
                        }}
                      />
                    ))}
                    <div
                      className={styles.prismHandle}
                      data-testid="prism-extrude"
                      role="slider"
                      tabIndex={readOnly ? -1 : 0}
                      aria-label={S.prism.extrudeAria}
                      aria-orientation="vertical"
                      aria-valuemin={0}
                      aria-valuemax={PRISM_MAX_HEIGHT}
                      aria-valuenow={state.height}
                      aria-disabled={readOnly || undefined}
                      style={{ top: handleTop, height: HANDLE_PX, width: HANDLE_PX }}
                      onKeyDown={onHandleKeyDown}
                    >
                      <span aria-hidden="true">⇕</span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className={styles.prismControlsRight}>
                {!sidesFixed ? (
                  <div className={styles.prismSides}>
                    <span className={styles.prismCaption}>{S.prism.sidesLabel}</span>
                    <div className={styles.prismSidesRow}>
                      <button
                        type="button"
                        className={styles.button}
                        data-testid="prism-sides-dec"
                        aria-label={S.prism.sidesDec}
                        disabled={readOnly || state.sides <= settings.sidesMin}
                        onClick={() => changeSides(state.sides - 1)}
                      >
                        <span aria-hidden="true">−</span>
                      </button>
                      <PolygonIcon n={state.sides} />
                      <button
                        type="button"
                        className={styles.button}
                        data-testid="prism-sides-inc"
                        aria-label={S.prism.sidesInc}
                        disabled={readOnly || state.sides >= settings.sidesMax}
                        onClick={() => changeSides(state.sides + 1)}
                      >
                        <span aria-hidden="true">＋</span>
                      </button>
                    </div>
                    <span className={styles.prismSidesValue} data-testid="prism-sides-value">
                      {S.prism.sidesValue(state.sides)}
                    </span>
                  </div>
                ) : null}

                {hasApex ? (
                  <div className={styles.prismApex}>
                    <span className={styles.prismCaption}>{S.prism.apexLabel}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={state.top === 'apex'}
                      aria-label={S.prism.apexLabel}
                      className={styles.prismSwitch}
                      data-testid="prism-apex"
                      data-on={state.top === 'apex' ? 'true' : 'false'}
                      disabled={readOnly}
                      onClick={toggleApex}
                    >
                      <span data-active={state.top === 'flat' ? 'true' : 'false'}>
                        {S.prism.apexOff}
                      </span>
                      <span data-active={state.top === 'apex' ? 'true' : 'false'}>
                        {S.prism.apexOn}
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {hasTools ? (
            <div
              className={`${styles.toolbar} ${styles.prismMarkTools}`}
              role="toolbar"
              aria-label={S.prism.markToolsLabel}
            >
              {settings.tools.map((toolId) => (
                <button
                  key={toolId}
                  type="button"
                  className={styles.button}
                  data-testid={`prism-tool-${toolId}`}
                  aria-pressed={state.tool === toolId}
                  disabled={readOnly || kind === 'base'}
                  onClick={() => {
                    dispatch({ type: 'set-tool', tool: toolId });
                    setLiveMessage(S.prism.live.toolChanged(S.prism.toolLabels[toolId]));
                  }}
                >
                  <span>{S.prism.toolLabels[toolId]}</span>
                </button>
              ))}
              <button
                type="button"
                className={styles.button}
                data-testid="prism-clear-marks"
                disabled={readOnly || !hasAnyMark}
                onClick={() => {
                  dispatch({ type: 'clear-marks' });
                  setLiveMessage(S.prism.live.marksCleared);
                }}
              >
                <span>{S.prism.clearMarks}</span>
              </button>
            </div>
          ) : null}

          {settings.counterTable ? (
            <PrismCounterTable
              state={state}
              readOnly={readOnly}
              dispatch={dispatch}
              onLiveMessage={setLiveMessage}
            />
          ) : null}

          <p className={styles.hint}>{S.prism.keyHint}</p>
        </div>
      </div>
    </div>
  );
}
