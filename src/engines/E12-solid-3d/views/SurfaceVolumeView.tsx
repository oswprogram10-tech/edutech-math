/**
 * E12 `surface-volume` 모드 주 View.
 *
 * - `.stageRow`/`.sideStack` 규칙과 `data-mode="surface-volume"`을 쓴다.
 * - steps: 위쪽 단계 표시줄 + 단계마다 무대(돌려 보기 / 펼쳐 칠하기 / 쌓기나무 채우기).
 * - fixed-volume: 왼쪽에 상자 그림과 가로·세로 고르기, 오른쪽에 기록표.
 * - 학생 화면에 넓이·부피·개수 결과를 쓰지 않는다. 치수 글자와 학생이 고른 값만 보인다.
 */
import { useRef, useState } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { pairOf, SV_FACE_IDS } from '../sv/geometry';
import { depthChoices, widthChoices } from '../sv/reduce';
import { solid3dStrings as S } from '../strings.ko';
import type { SurfaceVolumeConfig, SvAction, SvState, SvStepId } from '../types';
import styles from '../View.module.css';
import { SvBoxLog } from './SvBoxLog';
import { SvBoxStage } from './SvBoxStage';
import { SvFillStage, SvStackedBox } from './SvFillStage';
import { SvNetPaint } from './SvNetPaint';
import { paintKeyOf, SV_PAINT_STYLES } from './svPaint';

function isTypingTarget(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
  );
}

export function SurfaceVolumeView({
  state,
  dispatch,
  readOnly = false,
}: EngineViewProps<SurfaceVolumeConfig, SvState, SvAction>) {
  const { settings } = state;
  const [liveMessage, setLiveMessage] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [w, d, h] = state.dims;
  const fixed = settings.variant === 'fixed-volume';
  const showSteps = !fixed && settings.steps.length > 1;
  const onNet = state.step === 'unfold' || state.step === 'paint';

  /** 키보드로 단계·펼치기를 바꾸면 무대가 바뀌어 초점이 사라지므로, 남아 있는 단추로 초점을 옮긴다. */
  const focusTestId = (testId: string) => {
    wrapRef.current?.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
  };

  const goStep = (step: SvStepId) => {
    if (readOnly) return;
    dispatch({ type: 'go-step', step });
    setLiveMessage(S.sv.live.stepChanged(S.sv.stepNames[step]));
  };
  const turn = (dYaw: number, dPitch: number) => {
    if (readOnly) return;
    dispatch({ type: 'rotate-view', dYaw, dPitch });
    setLiveMessage(S.sv.live.turned);
  };
  const toggleUnfold = () => {
    if (readOnly) return;
    dispatch({ type: 'toggle-unfold' });
    setLiveMessage(state.unfolded ? S.sv.live.folded : S.sv.live.unfolded);
  };
  const setLayer = (layer: number) => {
    if (readOnly) return;
    dispatch({ type: 'set-layer', layer });
    setLiveMessage(S.sv.live.layerChanged(layer + 1));
  };
  const fillLayer = () => {
    if (readOnly || !settings.layerFill) return;
    dispatch({ type: 'fill-layer' });
    setLiveMessage(S.sv.live.layerFilled);
  };
  const pickWidth = (nextW: number) => {
    if (readOnly) return;
    const rest = settings.volume / nextW;
    dispatch({ type: 'set-dims', w: nextW, d: rest % d === 0 ? d : 1 });
    setLiveMessage(S.sv.live.dimsChanged);
  };
  const pickDepth = (nextD: number) => {
    if (readOnly) return;
    dispatch({ type: 'set-dims', w, d: nextD });
    setLiveMessage(S.sv.live.dimsChanged);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
    const key = e.key;
    if (!fixed && /^[1-9]$/.test(key)) {
      const step = settings.steps[Number(key) - 1];
      if (step) {
        e.preventDefault();
        goStep(step);
        focusTestId(`sv-step-${step}`);
      }
      return;
    }
    if (!fixed && state.step === 'rotate') {
      const k = key.toLowerCase();
      if (k === 'q') {
        e.preventDefault();
        turn(-15, 0);
      } else if (k === 'e') {
        e.preventDefault();
        turn(15, 0);
      } else if (k === 'w') {
        e.preventDefault();
        turn(0, 15);
      } else if (k === 's') {
        e.preventDefault();
        turn(0, -15);
      }
      return;
    }
    if (!fixed && onNet && (key === 'u' || key === 'U')) {
      e.preventDefault();
      toggleUnfold();
      focusTestId('sv-unfold');
      return;
    }
    if (!fixed && state.step === 'fill-voxels') {
      if (key === 'PageUp') {
        e.preventDefault();
        setLayer(state.layer + 1);
      } else if (key === 'PageDown') {
        e.preventDefault();
        setLayer(state.layer - 1);
      } else if (key === 'l' || key === 'L') {
        e.preventDefault();
        fillLayer();
      }
    }
  };

  const instruction = fixed ? S.sv.instructions.fixed : S.sv.instructions[state.step];

  const turnButtons = (
    <div className={styles.svTurnGrid} role="toolbar" aria-label={S.sv.stageLabel}>
      <button
        type="button"
        className={styles.button}
        data-testid="sv-turn-left"
        disabled={readOnly}
        aria-label={S.sv.turnLeft}
        onClick={() => turn(-45, 0)}
      >
        <span aria-hidden="true">↺</span>
      </button>
      <button
        type="button"
        className={styles.button}
        data-testid="sv-turn-right"
        disabled={readOnly}
        aria-label={S.sv.turnRight}
        onClick={() => turn(45, 0)}
      >
        <span aria-hidden="true">↻</span>
      </button>
      <button
        type="button"
        className={styles.button}
        data-testid="sv-tilt-up"
        disabled={readOnly}
        aria-label={S.sv.tiltUp}
        onClick={() => turn(0, 30)}
      >
        <span aria-hidden="true">⤒</span>
      </button>
      <button
        type="button"
        className={styles.button}
        data-testid="sv-tilt-down"
        disabled={readOnly}
        aria-label={S.sv.tiltDown}
        onClick={() => turn(0, -30)}
      >
        <span aria-hidden="true">⤓</span>
      </button>
    </div>
  );

  const stage = fixed ? (
    <SvStackedBox state={state} />
  ) : state.step === 'rotate' ? (
    <SvBoxStage
      state={state}
      readOnly={readOnly}
      dispatch={dispatch}
      onLiveMessage={setLiveMessage}
    />
  ) : onNet ? (
    <SvNetPaint
      state={state}
      readOnly={readOnly}
      dispatch={dispatch}
      onLiveMessage={setLiveMessage}
    />
  ) : (
    <SvFillStage
      state={state}
      readOnly={readOnly}
      dispatch={dispatch}
      onLiveMessage={setLiveMessage}
    />
  );

  const picker = fixed ? (
    <div className={styles.svPickers} data-testid="sv-pickers">
      <div className={styles.svPickRow} role="group" aria-label={S.sv.widthLabel}>
        <span className={styles.svPickLabel}>{S.sv.widthLabel}</span>
        {widthChoices(settings.volume).map((n) => (
          <button
            key={n}
            type="button"
            className={`${styles.button} ${styles.svPickBtn}`}
            data-testid={`sv-w-${n}`}
            aria-pressed={n === w}
            aria-label={S.sv.pickWidth(n)}
            disabled={readOnly}
            onClick={() => pickWidth(n)}
          >
            <span>{n}</span>
          </button>
        ))}
      </div>
      <div className={styles.svPickRow} role="group" aria-label={S.sv.depthLabel}>
        <span className={styles.svPickLabel}>{S.sv.depthLabel}</span>
        {depthChoices(settings.volume, w).map((n) => (
          <button
            key={n}
            type="button"
            className={`${styles.button} ${styles.svPickBtn}`}
            data-testid={`sv-d-${n}`}
            aria-pressed={n === d}
            aria-label={S.sv.pickDepth(n)}
            disabled={readOnly}
            onClick={() => pickDepth(n)}
          >
            <span>{n}</span>
          </button>
        ))}
        <span className={styles.svHeightText} data-testid="sv-height">
          {S.sv.heightValue(h)}
        </span>
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      data-mode="surface-volume"
      data-rich-side="true"
      data-variant={settings.variant}
      data-step={fixed ? undefined : state.step}
      data-testid="sv-view"
      onKeyDown={handleKeyDown}
    >
      <p className={styles.instructions}>{instruction}</p>
      <div role="status" aria-live="polite" className={styles.srOnly}>
        {liveMessage}
      </div>

      {showSteps ? (
        <nav className={styles.svStepBar} aria-label={S.sv.stepsLabel} data-testid="sv-steps">
          {settings.steps.map((step, i) => (
            <button
              key={step}
              type="button"
              className={styles.svStepBtn}
              data-testid={`sv-step-${step}`}
              aria-current={state.step === step ? 'step' : undefined}
              disabled={readOnly}
              onClick={() => goStep(step)}
            >
              <span className={styles.svStepNo} aria-hidden="true">
                {i + 1}
              </span>
              <span>{S.sv.stepNames[step]}</span>
            </button>
          ))}
        </nav>
      ) : null}

      <div className={styles.stageRow} data-sv-row="true">
        <div className={`${styles.boardArea} ${styles.xrayStageBoard}`} data-testid="sv-board">
          {stage}
          {picker}
        </div>

        <div className={styles.sideStack}>
          {!fixed && state.step === 'rotate' ? turnButtons : null}

          {!fixed && onNet ? (
            <div className={styles.svControls} role="group" aria-label={S.sv.netLabel}>
              <button
                type="button"
                className={styles.button}
                data-testid="sv-unfold"
                aria-pressed={state.unfolded}
                disabled={readOnly}
                onClick={toggleUnfold}
              >
                <span>{state.unfolded ? S.sv.fold : S.sv.unfold}</span>
              </button>
              {state.step === 'paint' ? (
                <>
                  <div className={styles.svLegend} data-testid="sv-legend">
                    <p className={styles.svLegendTitle}>{S.sv.paintLegendTitle}</p>
                    {(['fb', 'lr', 'tb'] as const).map((pair) => {
                      const face = SV_FACE_IDS.find((f) => pairOf(f) === pair) ?? 'front';
                      const key = settings.pairColors ? paintKeyOf(face, true) : 'one';
                      return (
                        <span key={pair} className={styles.svLegendItem}>
                          <span
                            className={styles.svSwatch}
                            data-pattern={key}
                            style={{
                              background: SV_PAINT_STYLES[key].bg,
                              borderColor: SV_PAINT_STYLES[key].fg,
                            }}
                            aria-hidden="true"
                          />
                          {S.sv.pairNames[pair]}
                        </span>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className={styles.button}
                    data-testid="sv-clear-paint"
                    disabled={readOnly || state.painted.length === 0}
                    onClick={() => {
                      dispatch({ type: 'clear-paint' });
                      setLiveMessage(S.sv.live.paintCleared);
                    }}
                  >
                    <span>{S.sv.clearPaint}</span>
                  </button>
                </>
              ) : null}
            </div>
          ) : null}

          {!fixed && state.step === 'fill-voxels' ? (
            <div className={styles.svControls} role="group" aria-label={S.sv.layersLabel}>
              <div className={styles.svLayerRow}>
                <button
                  type="button"
                  className={styles.button}
                  data-testid="sv-layer-up"
                  aria-label={S.sv.layerUp}
                  disabled={readOnly || state.layer >= h - 1}
                  onClick={() => setLayer(state.layer + 1)}
                >
                  <span aria-hidden="true">▲</span>
                </button>
                <button
                  type="button"
                  className={styles.button}
                  data-testid="sv-layer-down"
                  aria-label={S.sv.layerDown}
                  disabled={readOnly || state.layer <= 0}
                  onClick={() => setLayer(state.layer - 1)}
                >
                  <span aria-hidden="true">▼</span>
                </button>
                {Array.from({ length: h }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={styles.button}
                    data-testid={`sv-layer-${i + 1}`}
                    aria-pressed={state.layer === i}
                    aria-label={S.sv.layerAria(i + 1)}
                    disabled={readOnly}
                    onClick={() => setLayer(i)}
                  >
                    <span>{S.sv.layerName(i + 1)}</span>
                  </button>
                ))}
              </div>
              {settings.layerFill ? (
                <button
                  type="button"
                  className={styles.button}
                  data-testid="sv-fill-layer"
                  disabled={readOnly}
                  onClick={fillLayer}
                >
                  <span>{S.sv.fillLayer}</span>
                </button>
              ) : null}
              <button
                type="button"
                className={styles.button}
                data-testid="sv-clear-cubes"
                disabled={readOnly || state.filled.length === 0}
                onClick={() => {
                  dispatch({ type: 'clear-cubes' });
                  setLiveMessage(S.sv.live.cubesCleared);
                }}
              >
                <span>{S.sv.clearCubes}</span>
              </button>
            </div>
          ) : null}

          {fixed && settings.log ? (
            <SvBoxLog
              state={state}
              readOnly={readOnly}
              dispatch={dispatch}
              onLiveMessage={setLiveMessage}
            />
          ) : null}

          <p className={styles.hint}>{fixed ? S.sv.keyHintFixed : S.sv.keyHint}</p>
        </div>
      </div>
    </div>
  );
}
