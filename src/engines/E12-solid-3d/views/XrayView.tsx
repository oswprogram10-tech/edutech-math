/**
 * E12 `xray` 모드 주 View.
 *
 * - `.stageRow`/`.sideStack` 규칙과 `data-mode="xray"`를 사용한다.
 * - `sketch` 없음: 왼쪽 `XrayStage`, 오른쪽 도구 막대.
 * - `sketch` 있음: 왼쪽 `SketchGrid`, 오른쪽 축소 `XrayStage` + 실선/점선 + 도구 막대.
 * - 학생 화면에 표시 개수나 맞다/틀리다 문구를 쓰지 않는다.
 */
import { useState } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { solid3dStrings as S } from '../strings.ko';
import type { XrayAction, XrayActiveTool, XrayConfig, XrayState } from '../types';
import styles from '../View.module.css';
import { SketchGrid } from './SketchGrid';
import { XrayStage } from './XrayStage';

function LineStyleIcon({ dashed }: { readonly dashed: boolean }) {
  return (
    <svg width={24} height={14} viewBox="0 0 24 14" aria-hidden="true">
      <line
        x1={2}
        y1={7}
        x2={22}
        y2={7}
        stroke="currentColor"
        strokeWidth={2.5}
        strokeDasharray={dashed ? '5 4' : undefined}
        strokeLinecap="round"
      />
    </svg>
  );
}

function HighlightSwatch() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true">
      <defs>
        <pattern
          id="e12-xray-legend-hatch"
          width={5}
          height={5}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={5} stroke="#ca8a04" strokeWidth={1.6} />
        </pattern>
      </defs>
      <rect x={1} y={1} width={12} height={12} rx={2} fill="#fef08a" stroke="#ca8a04" />
      <rect x={1} y={1} width={12} height={12} rx={2} fill="url(#e12-xray-legend-hatch)" />
    </svg>
  );
}

export function XrayView({
  state,
  dispatch,
  readOnly = false,
}: EngineViewProps<XrayConfig, XrayState, XrayAction>) {
  const { settings } = state;
  const [liveMessage, setLiveMessage] = useState('');
  const [sketchStacked, setSketchStacked] = useState(false);

  const isSketchTask = settings.sketch !== false;
  const showXrayBtn = settings.xrayToggle && settings.display !== 'sketch';
  const showRotateBtns = settings.rotate;

  const toolButtons: readonly XrayActiveTool[] = [
    ...settings.tools,
    ...(settings.faceQuery ? (['query'] as const) : []),
  ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'q' || e.key === 'Q') {
      if (settings.rotate) {
        e.preventDefault();
        dispatch({ type: 'rotate-view', dYaw: -15, dPitch: 0 });
        setLiveMessage(S.xray.live.turned);
      }
      return;
    }
    if (e.key === 'e' || e.key === 'E') {
      if (settings.rotate) {
        e.preventDefault();
        dispatch({ type: 'rotate-view', dYaw: 15, dPitch: 0 });
        setLiveMessage(S.xray.live.turned);
      }
      return;
    }
    if (e.key === 'w' || e.key === 'W') {
      if (settings.rotate) {
        e.preventDefault();
        dispatch({ type: 'rotate-view', dYaw: 0, dPitch: 15 });
        setLiveMessage(S.xray.live.turned);
      }
      return;
    }
    if (e.key === 's' || e.key === 'S') {
      if (settings.rotate) {
        e.preventDefault();
        dispatch({ type: 'rotate-view', dYaw: 0, dPitch: -15 });
        setLiveMessage(S.xray.live.turned);
      }
      return;
    }
    if (e.key === 'x' || e.key === 'X') {
      if (showXrayBtn) {
        e.preventDefault();
        const next = !state.xray;
        dispatch({ type: 'toggle-xray' });
        setLiveMessage(next ? S.xray.live.xrayOn : S.xray.live.xrayOff);
      }
    }
  };

  const hasAnyMark =
    state.marked.faces.length > 0 ||
    state.marked.edges.length > 0 ||
    state.marked.vertices.length > 0 ||
    state.queryFace !== null;

  const hasStudentSegs = state.segments.some((s) => !s.locked);

  const instructionText = isSketchTask
    ? S.xray.instructionsSketch
    : settings.tools.length === 0 && !settings.faceQuery
      ? S.xray.instructionsViewOnly
      : S.xray.instructionsSolid;

  const keyHintText = isSketchTask ? S.xray.keyHintSketch : S.xray.keyHintSolid;

  return (
    <div
      className={styles.wrap}
      data-mode="xray"
      data-rich-side="true"
      data-has-sketch={isSketchTask ? 'true' : undefined}
      data-sketch-stacked={isSketchTask && sketchStacked ? 'true' : undefined}
      data-testid="xray-view"
      onKeyDown={handleKeyDown}
    >
      <p className={styles.instructions}>{instructionText}</p>
      <div role="status" aria-live="polite" className={styles.srOnly}>
        {liveMessage}
      </div>

      <div className={styles.stageRow} data-xray-row="true">
        <div
          className={`${styles.boardArea} ${isSketchTask ? styles.netBoardArea : styles.xrayStageBoard}`}
        >
          {isSketchTask ? (
            <SketchGrid
              state={state}
              readOnly={readOnly}
              dispatch={dispatch}
              onLiveMessage={setLiveMessage}
              onNarrowChange={setSketchStacked}
            />
          ) : (
            <XrayStage
              state={state}
              readOnly={readOnly}
              dispatch={dispatch}
              onLiveMessage={setLiveMessage}
            />
          )}

          {settings.highlightFace !== null || settings.faceQuery ? (
            <div className={styles.xrayLegendRow}>
              {settings.highlightFace !== null ? (
                <span className={styles.xrayLegendItem} data-testid="xray-highlight-legend">
                  <HighlightSwatch />
                  <span>{S.xray.highlightLegend}</span>
                </span>
              ) : null}
              {settings.faceQuery ? (
                <span className={styles.xrayLegendItem} data-testid="xray-query-legend">
                  <span>{S.xray.queryLegend}</span>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={styles.sideStack}>
          {isSketchTask ? (
            <div className={styles.panelBlock}>
              <div className={styles.netStageWrap}>
                <XrayStage
                  state={state}
                  compact
                  readOnly={readOnly}
                  dispatch={dispatch}
                  onLiveMessage={setLiveMessage}
                />
              </div>
            </div>
          ) : null}

          {isSketchTask ? (
            <div className={styles.toolbar} role="group" aria-label={S.xray.sketchLabel}>
              <button
                type="button"
                className={styles.button}
                data-testid="xray-style-solid"
                aria-pressed={state.lineStyle === 'solid'}
                disabled={readOnly}
                onClick={() => {
                  dispatch({ type: 'set-line-style', style: 'solid' });
                  setLiveMessage(S.xray.live.styleChanged(S.xray.solidLine));
                }}
              >
                <LineStyleIcon dashed={false} />
                <span>{S.xray.solidLine}</span>
              </button>
              <button
                type="button"
                className={styles.button}
                data-testid="xray-style-dashed"
                aria-pressed={state.lineStyle === 'dashed'}
                disabled={readOnly}
                onClick={() => {
                  dispatch({ type: 'set-line-style', style: 'dashed' });
                  setLiveMessage(S.xray.live.styleChanged(S.xray.dashedLine));
                }}
              >
                <LineStyleIcon dashed />
                <span>{S.xray.dashedLine}</span>
              </button>
              <button
                type="button"
                className={styles.button}
                data-testid="xray-sketch-clear"
                disabled={readOnly || !hasStudentSegs}
                onClick={() => {
                  dispatch({ type: 'clear-sketch' });
                  setLiveMessage(S.xray.live.sketchCleared);
                }}
              >
                <span>{S.xray.clearSketch}</span>
              </button>
            </div>
          ) : null}

          {showRotateBtns || showXrayBtn ? (
            <div className={styles.toolbar} role="toolbar" aria-label={S.xray.stageLabel}>
              {showRotateBtns ? (
                <>
                  <button
                    type="button"
                    className={styles.button}
                    data-testid="xray-turn-left"
                    disabled={readOnly}
                    aria-label={S.turnLeft}
                    onClick={() => {
                      dispatch({ type: 'rotate-view', dYaw: -45, dPitch: 0 });
                      setLiveMessage(S.xray.live.turned);
                    }}
                  >
                    <span>↺</span>
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    data-testid="xray-turn-right"
                    disabled={readOnly}
                    aria-label={S.turnRight}
                    onClick={() => {
                      dispatch({ type: 'rotate-view', dYaw: 45, dPitch: 0 });
                      setLiveMessage(S.xray.live.turned);
                    }}
                  >
                    <span>↻</span>
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    data-testid="xray-tilt-up"
                    disabled={readOnly}
                    aria-label={S.xray.tiltUp}
                    onClick={() => {
                      dispatch({ type: 'rotate-view', dYaw: 0, dPitch: 30 });
                      setLiveMessage(S.xray.live.turned);
                    }}
                  >
                    <span>⤒</span>
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    data-testid="xray-tilt-down"
                    disabled={readOnly}
                    aria-label={S.xray.tiltDown}
                    onClick={() => {
                      dispatch({ type: 'rotate-view', dYaw: 0, dPitch: -30 });
                      setLiveMessage(S.xray.live.turned);
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
                  data-testid="xray-toggle"
                  aria-pressed={state.xray}
                  disabled={readOnly}
                  onClick={() => {
                    const next = !state.xray;
                    dispatch({ type: 'toggle-xray' });
                    setLiveMessage(next ? S.xray.live.xrayOn : S.xray.live.xrayOff);
                  }}
                >
                  <span>{S.xray.xrayToggle}</span>
                </button>
              ) : null}
            </div>
          ) : null}

          {toolButtons.length > 0 ? (
            <div className={styles.toolbar} role="toolbar" aria-label={S.name}>
              {toolButtons.map((toolId) => (
                <button
                  key={toolId}
                  type="button"
                  className={styles.button}
                  data-testid={`xray-tool-${toolId}`}
                  aria-pressed={state.tool === toolId}
                  disabled={readOnly}
                  onClick={() => {
                    dispatch({ type: 'set-tool', tool: toolId });
                    setLiveMessage(S.xray.live.toolChanged(S.xray.toolLabels[toolId]));
                  }}
                >
                  <span>{S.xray.toolLabels[toolId]}</span>
                </button>
              ))}
              <button
                type="button"
                className={styles.button}
                data-testid="xray-clear-marks"
                disabled={readOnly || !hasAnyMark}
                onClick={() => {
                  dispatch({ type: 'clear-marks' });
                  setLiveMessage(S.xray.live.marksCleared);
                }}
              >
                <span>{S.xray.clearMarks}</span>
              </button>
            </div>
          ) : null}

          <p className={styles.hint}>{keyHintText}</p>
        </div>
      </div>
    </div>
  );
}
