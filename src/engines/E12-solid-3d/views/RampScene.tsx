/**
 * E12 `shapes-sort` 경사로 장면.
 *
 * 경사로 꼭대기에 물건을 올리고 ▶를 누르면 1.2초 동안 정해진 연출을 한다.
 * 굴러가는 물건은 바닥 끝까지 가고, 머무는 물건은 제자리에서 살짝 흔들린다.
 * 결과를 글로 쓰지 않는다. 학생이 보고 판단하고, 지난 시도는 작은 그림 줄로만 남긴다.
 */
import { itemOf, poseOf } from '../shapes/reduce';
import { rampResult } from '../shapes/rules';
import { solid3dStrings as S } from '../strings.ko';
import type { ShapesState } from '../types';
import styles from '../View.module.css';
import { ShapeGlyph, ShapeIcon } from './ShapeIcon';
import { spinCenter } from './shapeGlyphMeta';
import { easeIn, easeOut, useScriptedProgress } from './shapesMotion';

export const RAMP_W = 420;
export const RAMP_H = 270;
const A = { x: 26, y: 64 };
const B = { x: 296, y: 224 };
const FLOOR_Y = B.y;
const START_T = 0.12;
const FLOOR_END_X = 372;
const GLYPH_K = 1.1;
const ANGLE = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI;
const SLOPE_LEN = Math.hypot(B.x - A.x, B.y - A.y);
const SPIN_RADIUS = 24;
const PLAY_MS = 1200;
const SHOWN_TRIALS = 8;

interface Placement {
  readonly x: number;
  readonly y: number;
  readonly tilt: number;
  readonly spin: number;
  readonly wobble: number;
}

function onRamp(t: number): { x: number; y: number } {
  return { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
}

/** 진행도 p(0~1)일 때 물건의 자리. `settled`면 연출이 끝난 자리다. */
function placementAt(roll: boolean, played: boolean, p: number): Placement {
  const start = onRamp(START_T);
  const rest: Placement = { x: start.x, y: start.y, tilt: ANGLE, spin: 0, wobble: 0 };
  if (!played) return rest;
  if (!roll) {
    return p >= 1 ? rest : { ...rest, wobble: 6 * Math.sin(p * Math.PI * 6) * (1 - p) };
  }
  const split = 0.6;
  if (p >= 1) return { x: FLOOR_END_X, y: FLOOR_Y, tilt: 0, spin: 0, wobble: 0 };
  if (p < split) {
    const t = START_T + (1 - START_T) * easeIn(p / split);
    const at = onRamp(t);
    const dist = (t - START_T) * SLOPE_LEN;
    return {
      x: at.x,
      y: at.y,
      tilt: ANGLE,
      spin: (dist / SPIN_RADIUS) * (180 / Math.PI),
      wobble: 0,
    };
  }
  const u = easeOut((p - split) / (1 - split));
  const x = B.x + (FLOOR_END_X - B.x) * u;
  const dist = (1 - START_T) * SLOPE_LEN + (x - B.x);
  return { x, y: FLOOR_Y, tilt: 0, spin: (dist / SPIN_RADIUS) * (180 / Math.PI), wobble: 0 };
}

interface RampSceneProps {
  readonly state: ShapesState;
  readonly readOnly: boolean;
  readonly onPlace: () => void;
  readonly onPlay: () => void;
  readonly onReset: () => void;
}

function TrialStrip({ state }: { readonly state: ShapesState }) {
  const shown = state.trials.slice(-SHOWN_TRIALS);
  return (
    <ul className={styles.ssTrials} data-testid="ss-trials" aria-label={S.shapes.trialsLabel}>
      {shown.map((trial, i) => {
        const item = itemOf(state, trial.id);
        return (
          <li
            key={`${state.trials.length - shown.length + i}`}
            className={styles.ssTrial}
            data-testid={`ss-trial-${i}`}
          >
            {item ? (
              <ShapeIcon
                px={30}
                kind={trial.kind}
                pose={trial.pose}
                color={item.color}
                size={item.size}
              />
            ) : null}
            <svg
              width={34}
              height={24}
              viewBox="0 0 34 24"
              role="img"
              aria-label={trial.result === 'roll' ? S.shapes.trialFloor : S.shapes.trialTop}
            >
              <polygon points="3,4 25,20 3,20" fill="#e3e8f2" stroke="#8a94a8" strokeWidth={1.2} />
              <line x1={0} y1={20} x2={34} y2={20} stroke="#8a94a8" strokeWidth={1.4} />
              {trial.result === 'roll' ? (
                <circle cx={30} cy={16} r={3.6} fill="#1d2330" />
              ) : (
                <circle cx={7} cy={7} r={3.6} fill="#1d2330" />
              )}
            </svg>
          </li>
        );
      })}
    </ul>
  );
}

export function RampScene({ state, readOnly, onPlace, onPlay, onReset }: RampSceneProps) {
  const item = itemOf(state, state.rampItem);
  const pose = item ? poseOf(state, item) : 'any';
  const roll = item ? rampResult(item.kind, pose) === 'roll' : false;
  const { progress, running } = useScriptedProgress(state.trials, state.trials.length > 0, PLAY_MS);
  const place = placementAt(roll, state.rampPlayed, progress);
  const spinAt = item ? spinCenter(item.kind, pose) : { x: 32, y: 34 };
  const spins = roll && item !== null;

  return (
    <section className={styles.ssScene} data-testid="ss-ramp-scene">
      <svg
        className={styles.ssSvg}
        data-testid="ss-ramp"
        data-running={running ? 'true' : 'false'}
        viewBox={`0 0 ${RAMP_W} ${RAMP_H}`}
        role="img"
        aria-label={S.shapes.rampLabel}
      >
        <rect x={-1000} y={FLOOR_Y} width={RAMP_W + 2000} height={1000} fill="#e9e1cf" />
        <line
          x1={-1000}
          y1={FLOOR_Y}
          x2={RAMP_W + 1000}
          y2={FLOOR_Y}
          stroke="#9a8f74"
          strokeWidth={3}
        />
        <polygon
          points={`${A.x},${A.y} ${B.x},${B.y} ${A.x},${B.y}`}
          fill="#cfd8ea"
          stroke="#5b6f93"
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <rect x={A.x - 14} y={A.y - 6} width={14} height={B.y - A.y + 6} fill="#aebbd6" />
        {item ? (
          <g
            data-testid="ss-ramp-item"
            data-item={item.id}
            transform={`translate(${place.x} ${place.y}) rotate(${place.tilt}) scale(${GLYPH_K}) translate(-32 -58)`}
          >
            <g
              transform={
                spins
                  ? `rotate(${place.spin} ${spinAt.x} ${spinAt.y})`
                  : `rotate(${place.wobble} 32 58)`
              }
            >
              <ShapeGlyph kind={item.kind} pose={pose} color={item.color} size={item.size} />
            </g>
          </g>
        ) : null}
      </svg>
      <div className={styles.ssActions}>
        <button
          type="button"
          className={`${styles.button} ${styles.ssBtn}`}
          data-testid="ss-ramp-place"
          disabled={readOnly || state.selected === null}
          onClick={onPlace}
        >
          <span>{S.shapes.rampPlace}</span>
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.ssBtn} ${styles.ssPlay}`}
          data-testid="ss-play"
          aria-label={S.shapes.playAria}
          disabled={readOnly || state.rampItem === null}
          onClick={onPlay}
        >
          <span aria-hidden="true">▶</span>
          <span>{S.shapes.play}</span>
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.ssBtn}`}
          data-testid="ss-ramp-reset"
          disabled={readOnly || state.rampItem === null}
          onClick={onReset}
        >
          <span>{S.shapes.resetRamp}</span>
        </button>
      </div>
      <TrialStrip state={state} />
    </section>
  );
}
