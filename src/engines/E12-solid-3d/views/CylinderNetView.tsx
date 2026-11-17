/**
 * E12 원기둥 전개도(`net-fold` + `target:'cylinder'`, 상태 모드 `cylinder-net`) 주 View(6학년).
 *
 * - ① 굴려 보기: 물감 바른 원기둥을 굴려 자국을 찍는다(`RollStage`).
 * - ② 전개도 맞추기: 옆면 가로·세로와 밑면 반지름을 단추로 바꿔 전개도를 만들고 접는다(`CylNetBoard`).
 * - 원주·자국 길이 수와 틈·겹침·맞음 글은 쓰지 않는다. 그림(빗금 띠, 진한 띠, 닫힌 이음선)으로만 보인다.
 * - 키보드: → ← 굴리기·되돌리기, Space 한 바퀴, 1 2 단계, A D 가로 ±0.1, Shift+A D 가로 ±1,
 *   W S 세로, R F 반지름, Enter 접기·펴기, Q E 돌려 보기.
 */
import { useState } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import {
  PIECE_HEIGHT_MAX_HALVES,
  PIECE_HEIGHT_MIN_HALVES,
  PIECE_RADIUS_MAX_HALVES,
  PIECE_RADIUS_MIN_HALVES,
  ROLL_FULL,
  WIDTH_MAX_TENTHS,
  WIDTH_MIN_TENTHS,
} from '../cylnet/model';
import { solid3dStrings as S } from '../strings.ko';
import type {
  CylinderNetAction,
  CylinderNetConfig,
  CylinderNetState,
  CylinderNetStep,
} from '../types';
import styles from '../View.module.css';
import { CylNetBoard } from './CylNetBoard';
import { RollStage } from './RollStage';
import { prefersReducedMotion, useScriptedProgress, easeOut } from './shapesMotion';

const ROLL_MS_PER_EIGHTH = 220;

function isTypingTarget(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
  );
}

const STEP_LABEL: Readonly<Record<CylinderNetStep, string>> = {
  roll: S.cylNet.stepRoll,
  assemble: S.cylNet.stepAssemble,
};

interface AdjustButton {
  readonly id: string;
  readonly text: string;
  readonly by: number;
  readonly disabled: boolean;
}

export function CylinderNetView({
  state,
  dispatch,
  readOnly = false,
  targetSize,
}: EngineViewProps<CylinderNetConfig, CylinderNetState, CylinderNetAction>) {
  const { settings, step } = state;
  const [liveMessage, setLiveMessage] = useState('');

  // 굴리기 연출: 이전 목표 → 새 목표로 간다. 움직임 줄이기 설정이면 바로 끝 위치다.
  const [seen, setSeen] = useState(state.rollEighths);
  const [from, setFrom] = useState(state.rollEighths);
  if (seen !== state.rollEighths) {
    setFrom(seen);
    setSeen(state.rollEighths);
  }
  const distance = Math.abs(state.rollEighths - from);
  const motion = useScriptedProgress(
    state.rollEighths,
    true,
    Math.max(ROLL_MS_PER_EIGHTH, ROLL_MS_PER_EIGHTH * distance),
  );
  const displayEighths = from + (state.rollEighths - from) * easeOut(motion.progress);
  const motionOff = prefersReducedMotion();

  const interactive = !readOnly;

  const setStep = (next: CylinderNetStep) => {
    if (!interactive || !settings.steps.includes(next)) return;
    dispatch({ type: 'cn-set-step', step: next });
    setLiveMessage(S.cylNet.live.step(STEP_LABEL[next]));
  };
  const roll = (by: 1 | -1) => {
    if (!interactive || step !== 'roll') return;
    dispatch({ type: 'cn-roll', by });
    setLiveMessage(by === 1 ? S.cylNet.live.rolled : S.cylNet.live.rolledBack);
  };
  const rollFull = () => {
    if (!interactive || step !== 'roll') return;
    dispatch({ type: 'cn-roll-full' });
    setLiveMessage(S.cylNet.live.rolledFull);
  };
  const rollReset = () => {
    if (!interactive) return;
    dispatch({ type: 'cn-roll-reset' });
    setLiveMessage(S.cylNet.live.reset);
  };
  const adjust = (type: 'cn-width' | 'cn-radius' | 'cn-height', by: number) => {
    if (!interactive || step !== 'assemble' || state.folded) return;
    dispatch({ type, by });
    setLiveMessage(S.cylNet.live.resized);
  };
  const toggleFold = () => {
    if (!interactive || step !== 'assemble') return;
    dispatch({ type: state.folded ? 'cn-unfold' : 'cn-fold' });
    setLiveMessage(state.folded ? S.cylNet.live.unfolded : S.cylNet.live.folded);
  };
  const turnView = (by: number) => {
    if (!interactive || step !== 'assemble' || !state.folded) return;
    dispatch({ type: 'cn-rotate-view', by });
    setLiveMessage(S.cylNet.live.turned);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
    const key = e.key;
    const onButton = e.target instanceof HTMLElement && e.target.tagName === 'BUTTON';
    if (key === ' ' || key === 'Spacebar') {
      if (step !== 'roll') return;
      // 단추에서 눌러도 한 번만 굴리도록 단추 누름 기본 동작은 막는다(keyup에서도 막는다).
      e.preventDefault();
      if (!e.repeat) rollFull();
      return;
    }
    if (key === '1' || key === '2') {
      const target = key === '1' ? 'roll' : 'assemble';
      if (settings.steps.includes(target)) {
        e.preventDefault();
        setStep(target);
      }
      return;
    }
    if (step === 'roll') {
      if (key === 'ArrowRight' || key === 'ArrowLeft') {
        e.preventDefault();
        roll(key === 'ArrowRight' ? 1 : -1);
      }
      return;
    }
    if (step !== 'assemble') return;
    if (key === 'Enter') {
      if (onButton) return;
      e.preventDefault();
      toggleFold();
      return;
    }
    const lower = key.toLowerCase();
    if (lower === 'q' || lower === 'e') {
      e.preventDefault();
      turnView(lower === 'q' ? -15 : 15);
    } else if (lower === 'a' || lower === 'd') {
      e.preventDefault();
      const unit = e.shiftKey ? 10 : 1;
      adjust('cn-width', lower === 'd' ? unit : -unit);
    } else if (lower === 'w' || lower === 's') {
      e.preventDefault();
      adjust('cn-height', lower === 'w' ? 1 : -1);
    } else if (lower === 'r' || lower === 'f') {
      e.preventDefault();
      adjust('cn-radius', lower === 'r' ? 1 : -1);
    }
  };
  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ' || e.key === 'Spacebar') e.preventDefault();
  };

  const widthButtons: readonly AdjustButton[] = [
    { id: 'm1', text: '−1', by: -10, disabled: state.widthTenths - 10 < WIDTH_MIN_TENTHS },
    { id: 'm01', text: '−0.1', by: -1, disabled: state.widthTenths - 1 < WIDTH_MIN_TENTHS },
    { id: 'p01', text: '+0.1', by: 1, disabled: state.widthTenths + 1 > WIDTH_MAX_TENTHS },
    { id: 'p1', text: '+1', by: 10, disabled: state.widthTenths + 10 > WIDTH_MAX_TENTHS },
  ];
  const heightButtons: readonly AdjustButton[] = [
    {
      id: 'm',
      text: '−0.5',
      by: -1,
      disabled: state.pieceHeightHalves <= PIECE_HEIGHT_MIN_HALVES,
    },
    {
      id: 'p',
      text: '+0.5',
      by: 1,
      disabled: state.pieceHeightHalves >= PIECE_HEIGHT_MAX_HALVES,
    },
  ];
  const radiusButtons: readonly AdjustButton[] = [
    {
      id: 'm',
      text: '−0.5',
      by: -1,
      disabled: state.pieceRadiusHalves <= PIECE_RADIUS_MIN_HALVES,
    },
    {
      id: 'p',
      text: '+0.5',
      by: 1,
      disabled: state.pieceRadiusHalves >= PIECE_RADIUS_MAX_HALVES,
    },
  ];

  const renderGroup = (
    name: 'width' | 'height' | 'radius',
    label: string,
    type: 'cn-width' | 'cn-radius' | 'cn-height',
    buttons: readonly AdjustButton[],
  ) => (
    <div className={styles.cnGroup} role="group" aria-label={label}>
      <span className={styles.cnGroupLabel}>{label}</span>
      <div className={styles.cnBtnRow}>
        {buttons.map((b) => (
          <button
            key={b.id}
            type="button"
            className={styles.button}
            data-testid={`cn-${name}-${b.id}`}
            aria-label={S.cylNet.adjust(label, b.text)}
            disabled={readOnly || state.folded || b.disabled}
            onClick={() => adjust(type, b.by)}
          >
            {b.text}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className={styles.wrap}
      data-mode="cylinder-net"
      data-target-size={targetSize}
      data-testid="cn-view"
      data-step={step ?? 'none'}
      data-reduced-motion={motionOff ? 'true' : 'false'}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <p className={styles.instructions}>{S.cylNet.instructions}</p>
      <div role="status" aria-live="polite" className={styles.srOnly}>
        {liveMessage}
      </div>

      {settings.steps.length > 1 ? (
        <div className={styles.toolbar} role="group" aria-label={S.cylNet.stepsLabel}>
          {settings.steps.map((s) => (
            <button
              key={s}
              type="button"
              className={styles.button}
              data-testid={`cn-step-${s}`}
              aria-pressed={step === s}
              disabled={readOnly}
              onClick={() => setStep(s)}
            >
              {STEP_LABEL[s]}
            </button>
          ))}
        </div>
      ) : null}

      <div className={styles.stageRow}>
        <div className={`${styles.boardArea} ${styles.xrayStageBoard}`}>
          {step === 'assemble' ? (
            <CylNetBoard state={state} />
          ) : (
            <RollStage state={state} eighths={step === 'roll' ? displayEighths : 0} />
          )}
        </div>

        <div className={`${styles.sideStack} ${styles.cnSide}`}>
          {step === 'roll' ? (
            <div className={styles.cnBtnRow} role="group" aria-label={S.cylNet.rollLabel}>
              <button
                type="button"
                className={styles.button}
                data-testid="cn-roll-step"
                disabled={readOnly || state.rollEighths >= ROLL_FULL}
                onClick={() => roll(1)}
              >
                {S.cylNet.rollStep}
              </button>
              <button
                type="button"
                className={styles.button}
                data-testid="cn-roll-back"
                disabled={readOnly || state.rollEighths <= 0}
                onClick={() => roll(-1)}
              >
                {S.cylNet.rollBack}
              </button>
              <button
                type="button"
                className={styles.button}
                data-testid="cn-roll-full"
                disabled={readOnly || state.rollEighths >= ROLL_FULL}
                onClick={rollFull}
              >
                {S.cylNet.rollFull}
              </button>
              <button
                type="button"
                className={styles.button}
                data-testid="cn-roll-reset"
                disabled={readOnly || state.rollEighths <= 0}
                onClick={rollReset}
              >
                {S.cylNet.rollReset}
              </button>
            </div>
          ) : null}

          {step === 'assemble' ? (
            <>
              {renderGroup('width', S.cylNet.widthGroup, 'cn-width', widthButtons)}
              {renderGroup('height', S.cylNet.heightGroup, 'cn-height', heightButtons)}
              {renderGroup('radius', S.cylNet.radiusGroup, 'cn-radius', radiusButtons)}
              <div className={styles.cnGroup}>
                <button
                  type="button"
                  className={styles.button}
                  data-testid="cn-fold"
                  aria-pressed={state.folded}
                  disabled={readOnly}
                  onClick={toggleFold}
                >
                  {state.folded ? S.cylNet.unfold : S.cylNet.fold}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {step !== null ? (
        <p className={styles.hint}>
          {step === 'roll' ? S.cylNet.keyHintRoll : S.cylNet.keyHintAssemble}
        </p>
      ) : null}
    </div>
  );
}
