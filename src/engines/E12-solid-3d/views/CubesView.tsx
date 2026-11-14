/**
 * E12 cubes 모드: 렌더러 선택(자동/3D/등각 2D) + 실시간 위·앞·옆 투영 + 보기 그림.
 *
 * - `three`·`@react-three/fiber`는 `React.lazy(() => import('../three/Stage3D'))`로만 지연 로딩한다.
 * - 렌더러 종류는 기기 사정이므로 엔진 상태(CubesState)·Observation에 넣지 않는다.
 * - 화면에 높이·전체 개수 숫자를 절대 표시하지 않는다(정답 노출 금지).
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { computeReferenceLayout, cubeFaces, pointsAttr, sortCubesForPainter } from '../layout';
import {
  decideRenderer,
  detectWebGL,
  readStoredRenderer,
  setActiveRenderer,
  writeStoredRenderer,
} from '../renderer';
import type { RendererDecision, RendererKind } from '../renderer';
import { solid3dStrings as S } from '../strings.ko';
import type { CameraPreset, CameraRequest } from '../three/Stage3D';
import type { CubeCoord, CubesAction, CubesConfig, CubesState } from '../types';
import { columnHeight, frontView, matchesAllReferenceViews, sideView, topView } from '../voxel';
import styles from '../View.module.css';
import { AttemptLogPanel, ReferenceCardsPanel } from './CardsPanel';
import { CUBE_INK, CUBE_PALETTE } from './focusMatch';
import { LayerGridPanel, LayerSliderBar, NumberGridPanel, PaintViewPanel } from './InputPanels';
import { IsoStage } from './IsoStage';
import { ProjectionGrid } from './ProjectionGrid';
import { useCubesKeyboard } from './useCubesKeyboard';
import { usePressGesture } from './usePressGesture';

const Stage3D = lazy(() => import('../three/Stage3D'));

type CubesViewProps = EngineViewProps<CubesConfig, CubesState, CubesAction>;

function ToolIcon({
  kind,
}: {
  readonly kind: 'add' | 'remove' | 'left' | 'right' | 'translucent' | 'clear';
}) {
  switch (kind) {
    case 'add':
      return (
        <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
          <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
        </svg>
      );
    case 'remove':
      return (
        <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
          <path d="M3 9h12" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
        </svg>
      );
    case 'left':
      return (
        <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
          <path
            d="M7 5L3.5 8.5 7 12M4 8.5h6.5a4 4 0 0 1 0 8"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'right':
      return (
        <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
          <path
            d="M11 5l3.5 3.5L11 12M14 8.5H7.5a4 4 0 0 0 0 8"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'translucent':
      return (
        <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
          <rect
            x={3}
            y={3}
            width={12}
            height={12}
            rx={2}
            fill="currentColor"
            fillOpacity={0.25}
            stroke="currentColor"
            strokeWidth={1.8}
            strokeDasharray="3 2"
          />
        </svg>
      );
    case 'clear':
      return (
        <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
          <path
            d="M4 4l10 10M14 4L4 14"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

function ReferenceShapeSvg({ cubes }: { readonly cubes: readonly CubeCoord[] }) {
  const layout = computeReferenceLayout(cubes, 30);
  const maxX = Math.max(1, ...cubes.map(([x]) => x + 1));
  const maxY = Math.max(1, ...cubes.map(([, y]) => y + 1));
  const painted = sortCubesForPainter(
    cubes.map(([x, y, z]) => ({ x, y, z })),
    maxX,
    maxY,
    0,
  );
  const palette = CUBE_PALETTE.plain;

  return (
    <div className={styles.projCard}>
      <p className={styles.projTitle}>{S.referenceTitle}</p>
      <svg
        className={styles.refSvg}
        width={Math.min(180, layout.viewBox.width)}
        height={Math.min(180, layout.viewBox.height)}
        viewBox={`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`}
        data-testid="cubes-reference"
        role="img"
        aria-label={S.referenceAria}
      >
        {painted.map(({ cube, rx, ry }) => {
          const faces = cubeFaces(layout, rx, ry, cube.z);
          return (
            <g key={`ref-${cube.x}-${cube.y}-${cube.z}`}>
              <polygon
                points={pointsAttr(faces.top)}
                fill={palette.top}
                stroke={CUBE_INK}
                strokeWidth={1.3}
                strokeLinejoin="round"
              />
              <polygon
                points={pointsAttr(faces.front)}
                fill={palette.front}
                stroke={CUBE_INK}
                strokeWidth={1.3}
                strokeLinejoin="round"
              />
              <polygon
                points={pointsAttr(faces.right)}
                fill={palette.right}
                stroke={CUBE_INK}
                strokeWidth={1.3}
                strokeLinejoin="round"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const PRESET_LIST: readonly { readonly id: CameraPreset; readonly label: string }[] = [
  { id: 'top', label: S.cameraPresets.top },
  { id: 'front', label: S.cameraPresets.front },
  { id: 'side', label: S.cameraPresets.side },
  { id: 'iso', label: S.cameraPresets.iso },
];

export function CubesView({ state, dispatch, cpa, readOnly = false, targetSize }: CubesViewProps) {
  const { settings } = state;
  const [cols, rows] = settings.grid;
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const [blockedAdd, setBlockedAdd] = useState(false);

  const webgl = useMemo(
    () => (settings.stageHidden ? false : detectWebGL()),
    [settings.stageHidden],
  );
  const [storedRenderer, setStoredRenderer] = useState<RendererKind | null>(() =>
    readStoredRenderer(),
  );
  const [probeFps, setProbeFps] = useState<number | null>(null);
  const [studentOverride, setStudentOverride] = useState<RendererKind | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [unitPx, setUnitPx] = useState<number | null>(null);
  const [cameraRequest, setCameraRequest] = useState<CameraRequest>({ preset: 'iso', seq: 0 });

  const baseDecision: RendererDecision = useMemo(
    () =>
      settings.stageHidden
        ? 'isometric'
        : decideRenderer({
            configStage: settings.stage,
            webgl,
            stored: storedRenderer,
            probeFps,
          }),
    [settings.stageHidden, settings.stage, webgl, storedRenderer, probeFps],
  );

  const rendererDecision: RendererDecision = useMemo(() => {
    if (settings.stageHidden || !webgl || contextLost || settings.stage === 'isometric') {
      return 'isometric';
    }
    if (studentOverride) return studentOverride;
    return baseDecision;
  }, [settings.stageHidden, webgl, contextLost, settings.stage, studentOverride, baseDecision]);

  const visibleRenderer: RendererKind = rendererDecision === '3d' ? '3d' : 'isometric';

  useEffect(() => {
    setActiveRenderer(settings.stageHidden ? 'isometric' : visibleRenderer);
    return () => {
      setActiveRenderer('isometric');
    };
  }, [settings.stageHidden, visibleRenderer]);

  const canAddAt = useCallback(
    (x: number, y: number): boolean => {
      if (state.cubes.length >= settings.maxCubes) return false;
      return columnHeight(state.cubes, x, y) < settings.maxHeight;
    },
    [state.cubes, settings.maxCubes, settings.maxHeight],
  );

  const canRemoveAt = useCallback(
    (x: number, y: number): boolean => {
      const h = columnHeight(state.cubes, x, y);
      if (h <= 0) return false;
      const top = state.cubes.find((c) => c.x === x && c.y === y && c.z === h - 1);
      return Boolean(top && !top.locked);
    },
    [state.cubes],
  );

  const performAdd = useCallback(
    (x: number, y: number) => {
      if (readOnly) return;
      if (!canAddAt(x, y)) {
        setBlockedAdd(true);
        setLiveMessage(S.live.maxReached);
        return;
      }
      setBlockedAdd(false);
      dispatch({ type: 'add', x, y });
      setLiveMessage(S.live.added);
    },
    [readOnly, canAddAt, dispatch],
  );

  const performRemove = useCallback(
    (x: number, y: number) => {
      if (readOnly) return;
      setBlockedAdd(false);
      if (canRemoveAt(x, y)) {
        dispatch({ type: 'remove', x, y });
        setLiveMessage(S.live.removed);
      }
    },
    [readOnly, canRemoveAt, dispatch],
  );

  const press = usePressGesture({
    disabled: readOnly || !settings.editable,
    onTap: (x, y) => {
      if (state.tool === 'add') {
        performAdd(x, y);
      } else {
        performRemove(x, y);
      }
    },
    onLongPress: (x, y) => {
      performRemove(x, y);
    },
  });

  const onStageKeyDown = useCubesKeyboard({
    readOnly,
    editable: settings.editable,
    cols,
    rows,
    cursor: state.cursor,
    viewTurn: state.viewTurn,
    rotationLocked: settings.rotationLocked,
    translucentToggle: settings.translucentToggle,
    onMoveCursor: (next) => {
      dispatch({ type: 'move-cursor', to: next });
      setLiveMessage(S.live.cursorAt(next[0], next[1]));
    },
    onAdd: performAdd,
    onRemove: performRemove,
    onTurn: (dir) => {
      dispatch({ type: 'turn', dir });
      setLiveMessage(S.live.turned);
    },
    onToggleTranslucent: () => {
      const next = !state.translucent;
      dispatch({ type: 'set-translucent', on: next });
      setLiveMessage(next ? S.live.translucentOn : S.live.translucentOff);
    },
  });

  const handleProbeComplete = useCallback((fps: number) => {
    const chosen: RendererKind = fps >= 30 ? '3d' : 'isometric';
    writeStoredRenderer(chosen);
    setStoredRenderer(chosen);
    setProbeFps(fps);
  }, []);

  const handleContextLost = useCallback(() => {
    writeStoredRenderer('isometric');
    setStoredRenderer('isometric');
    setContextLost(true);
    setStudentOverride(null);
  }, []);

  const isViewsMatch =
    settings.attemptLog &&
    matchesAllReferenceViews(
      state.cubes,
      settings.grid,
      settings.maxHeight,
      settings.referenceViews,
    );
  const maxReached = state.cubes.length >= settings.maxCubes;
  const statusText = isViewsMatch
    ? S.viewsMatch
    : !settings.stageHidden && settings.editable && (maxReached || blockedAdd)
      ? S.maxReached
      : '';
  const instructionText = settings.stageHidden
    ? S.instructionsStageHidden
    : settings.editable
      ? S.instructions
      : settings.rotationLocked
        ? S.instructionsViewLocked
        : S.instructionsView;

  const overlapViews = useMemo(
    () => settings.views.filter((v) => settings.paintViews.includes(v)),
    [settings.views, settings.paintViews],
  );

  useEffect(() => {
    if (overlapViews.length > 0) {
      console.warn(
        `E12 views와 paintViews에 같은 보기(${overlapViews.join(', ')})가 함께 켜져 있어 실시간 투영을 그리지 않습니다.`,
      );
    }
  }, [overlapViews]);

  const topMatrix =
    settings.views.includes('top') && !settings.paintViews.includes('top')
      ? topView(state.cubes, settings.grid)
      : null;
  const frontMatrix =
    settings.views.includes('front') && !settings.paintViews.includes('front')
      ? frontView(state.cubes, settings.grid, settings.maxHeight)
      : null;
  const sideMatrix =
    settings.views.includes('side') && !settings.paintViews.includes('side')
      ? sideView(state.cubes, settings.grid, settings.maxHeight)
      : null;
  const hasLiveViews = Boolean(topMatrix || frontMatrix || sideMatrix);

  const hasRemovable = state.cubes.some((c) => !c.locked);
  const refViews = settings.referenceViews;
  const hasRefViews = Boolean(refViews && (refViews.top || refViews.front || refViews.side));
  const showRendererSwitch =
    !settings.stageHidden && webgl && !contextLost && settings.stage !== 'isometric';
  const hasToolbarButtons =
    !settings.stageHidden &&
    (settings.editable ||
      !settings.rotationLocked ||
      settings.translucentToggle ||
      showRendererSwitch);
  const baseKeyHint = settings.stageHidden
    ? ''
    : settings.editable
      ? settings.rotationLocked
        ? S.keyHintLocked
        : S.keyHint
      : settings.rotationLocked
        ? S.keyHintViewLocked
        : S.keyHintView;
  const keyHintText =
    !settings.stageHidden && visibleRenderer === '3d' && !settings.rotationLocked
      ? `${baseKeyHint} · ${S.keyHint3d}`
      : baseKeyHint;

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-cpa={cpa}
      data-stage-hidden={settings.stageHidden ? 'true' : undefined}
    >
      <p className={styles.instructions}>{instructionText}</p>
      <p
        className={styles.status}
        role="status"
        data-testid="cubes-status"
        data-views-match={isViewsMatch ? 'true' : undefined}
      >
        {statusText}
      </p>
      <div className={styles.srOnly} aria-live="polite" data-testid="cubes-live">
        {liveMessage}
      </div>

      <div className={styles.stageRow}>
        {!settings.stageHidden ? (
          <div className={styles.boardArea}>
            <div
              ref={stageRef}
              className={styles.stageHost}
              role="application"
              aria-label={S.canvasLabel}
              tabIndex={readOnly ? -1 : 0}
              data-testid="cubes-stage"
              data-renderer={rendererDecision}
              data-views-match={isViewsMatch ? 'true' : undefined}
              data-probe-fps={probeFps !== null ? String(Math.round(probeFps)) : undefined}
              data-unit-px={
                visibleRenderer === '3d' && unitPx !== null ? String(unitPx) : undefined
              }
              onKeyDown={onStageKeyDown}
              onPointerDown={() => {
                if (!readOnly && visibleRenderer === '3d') {
                  stageRef.current?.focus({ preventScroll: true });
                }
              }}
            >
              {rendererDecision === '3d' ? (
                <Suspense
                  fallback={
                    <>
                      <IsoStage
                        state={state}
                        cpa={cpa}
                        readOnly={readOnly}
                        editable={settings.editable}
                        press={press}
                        hiddenFromFocus
                      />
                      <div className={styles.preparingNote} role="status">
                        {S.preparing3d}
                      </div>
                    </>
                  }
                >
                  <Stage3D
                    state={state}
                    readOnly={readOnly}
                    editable={settings.editable}
                    press={press}
                    cameraRequest={cameraRequest}
                    onContextLost={handleContextLost}
                    onUnitPxChange={setUnitPx}
                  />
                </Suspense>
              ) : (
                <>
                  <IsoStage
                    state={state}
                    cpa={cpa}
                    readOnly={readOnly}
                    editable={settings.editable}
                    press={press}
                  />
                  {rendererDecision === 'probe' ? (
                    <Suspense fallback={null}>
                      <Stage3D
                        state={state}
                        readOnly
                        editable={false}
                        press={press}
                        cameraRequest={cameraRequest}
                        onContextLost={handleContextLost}
                        probe
                        onProbeComplete={handleProbeComplete}
                      />
                    </Suspense>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : null}

        <div className={styles.sideStack}>
          {settings.reference || hasRefViews ? (
            <div className={styles.panelBlock}>
              <div className={styles.projRow}>
                {settings.reference ? <ReferenceShapeSvg cubes={settings.reference.cubes} /> : null}
                {refViews?.top ? (
                  <ProjectionGrid
                    view="top"
                    matrix={refViews.top}
                    title={S.referenceViewTitle('top')}
                    testId="cubes-reference-top"
                    cellSize={settings.referenceCards.length >= 4 ? 22 : 32}
                  />
                ) : null}
                {refViews?.front ? (
                  <ProjectionGrid
                    view="front"
                    matrix={refViews.front}
                    title={S.referenceViewTitle('front')}
                    testId="cubes-reference-front"
                    cellSize={settings.referenceCards.length >= 4 ? 22 : 32}
                  />
                ) : null}
                {refViews?.side ? (
                  <ProjectionGrid
                    view="side"
                    matrix={refViews.side}
                    title={S.referenceViewTitle('side')}
                    testId="cubes-reference-side"
                    cellSize={settings.referenceCards.length >= 4 ? 22 : 32}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <ReferenceCardsPanel state={state} />
          <NumberGridPanel state={state} dispatch={dispatch} readOnly={readOnly} />
          <LayerSliderBar state={state} dispatch={dispatch} readOnly={readOnly} />
          <LayerGridPanel state={state} dispatch={dispatch} readOnly={readOnly} />
          <PaintViewPanel state={state} dispatch={dispatch} readOnly={readOnly} />
          <AttemptLogPanel state={state} />

          {hasToolbarButtons ? (
            <div className={styles.toolbar} role="toolbar" aria-label={S.name}>
              {settings.editable ? (
                <>
                  <button
                    type="button"
                    className={styles.button}
                    aria-pressed={state.tool === 'add'}
                    disabled={readOnly}
                    onClick={() => dispatch({ type: 'select-tool', tool: 'add' })}
                  >
                    <ToolIcon kind="add" />
                    <span>{S.tools.add}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    aria-pressed={state.tool === 'remove'}
                    disabled={readOnly}
                    onClick={() => dispatch({ type: 'select-tool', tool: 'remove' })}
                  >
                    <ToolIcon kind="remove" />
                    <span>{S.tools.remove}</span>
                  </button>
                </>
              ) : null}

              {!settings.rotationLocked ? (
                <>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={readOnly}
                    onClick={() => {
                      dispatch({ type: 'turn', dir: 'left' });
                      setLiveMessage(S.live.turned);
                    }}
                  >
                    <ToolIcon kind="left" />
                    <span>{S.turnLeft}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={readOnly}
                    onClick={() => {
                      dispatch({ type: 'turn', dir: 'right' });
                      setLiveMessage(S.live.turned);
                    }}
                  >
                    <ToolIcon kind="right" />
                    <span>{S.turnRight}</span>
                  </button>
                </>
              ) : null}

              {settings.translucentToggle ? (
                <button
                  type="button"
                  className={styles.button}
                  aria-pressed={state.translucent}
                  disabled={readOnly}
                  onClick={() => {
                    const next = !state.translucent;
                    dispatch({ type: 'set-translucent', on: next });
                    setLiveMessage(next ? S.live.translucentOn : S.live.translucentOff);
                  }}
                >
                  <ToolIcon kind="translucent" />
                  <span>{S.translucent}</span>
                </button>
              ) : null}

              {settings.editable ? (
                <button
                  type="button"
                  className={styles.button}
                  disabled={readOnly || !hasRemovable}
                  onClick={() => {
                    setBlockedAdd(false);
                    dispatch({ type: 'clear' });
                    setLiveMessage(S.live.cleared);
                  }}
                >
                  <ToolIcon kind="clear" />
                  <span>{S.clear}</span>
                </button>
              ) : null}

              {showRendererSwitch ? (
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => setStudentOverride(visibleRenderer === '3d' ? 'isometric' : '3d')}
                >
                  <span>{visibleRenderer === '3d' ? S.switchToIso : S.switchTo3d}</span>
                </button>
              ) : null}
            </div>
          ) : null}

          {!settings.stageHidden && visibleRenderer === '3d' && !settings.rotationLocked ? (
            <div className={styles.toolbar} role="group" aria-label={S.cameraPresets.iso}>
              {PRESET_LIST.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={styles.button}
                  onClick={() =>
                    setCameraRequest((prev) => ({ preset: preset.id, seq: prev.seq + 1 }))
                  }
                >
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          ) : null}

          {hasLiveViews ? (
            <div className={styles.panelBlock}>
              <div className={styles.projRow}>
                {topMatrix ? (
                  <ProjectionGrid
                    view="top"
                    matrix={topMatrix}
                    title={S.views.top}
                    testId="cubes-view-top"
                    focus={state.focus}
                    onFocusCell={(cell) => dispatch({ type: 'focus-cell', cell })}
                    readOnly={readOnly}
                  />
                ) : null}
                {frontMatrix ? (
                  <ProjectionGrid
                    view="front"
                    matrix={frontMatrix}
                    title={S.views.front}
                    testId="cubes-view-front"
                    focus={state.focus}
                    onFocusCell={(cell) => dispatch({ type: 'focus-cell', cell })}
                    readOnly={readOnly}
                  />
                ) : null}
                {sideMatrix ? (
                  <ProjectionGrid
                    view="side"
                    matrix={sideMatrix}
                    title={S.views.side}
                    testId="cubes-view-side"
                    focus={state.focus}
                    onFocusCell={(cell) => dispatch({ type: 'focus-cell', cell })}
                    readOnly={readOnly}
                  />
                ) : null}
              </div>
              <p className={styles.hint}>{S.projectionHint}</p>
            </div>
          ) : null}

          {keyHintText ? <p className={styles.hint}>{keyHintText}</p> : null}
        </div>
      </div>
    </div>
  );
}
