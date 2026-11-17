/**
 * E12 `lathe` 모드 주 View(6학년): 평면도형을 축에 붙여 돌리고 레이저로 단면을 본다.
 *
 * - 입체 이름·단면 모양 이름·치수 결과를 화면에 쓰지 않는다(이름 고르기는 콘텐츠 응답이 한다).
 * - 키보드: 1·2·3 도형, Tab+Enter 변 붙이기, ← → 30° 돌리기, Space 한 바퀴, H·V 레이저,
 *   ↑ ↓ 레이저 높이, Q·E 완성 입체 돌려 보기.
 */
import { useRef, useState } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { clamp } from '../../../core/engine-sdk';
import {
  ANGLE_STEP,
  edgesOf,
  FULL_TURN,
  LASER_MAX_STEP,
  snapAngle,
  type LatheEdge,
  type LatheProfile,
} from '../lathe/profiles';
import { naturalChain, pointsAttr, type RH } from '../lathe/render';
import { isComplete, LATHE_DEFAULT_T } from '../lathe/reduce';
import { solid3dStrings as S } from '../strings.ko';
import type { LatheAction, LatheConfig, LatheState } from '../types';
import styles from '../View.module.css';
import { LatheStage } from './LatheStage';
import { SectionPanel } from './SectionPanel';
import { prefersReducedMotion, useScriptedProgress } from './shapesMotion';

const SPIN_MS = 1500;
const DIAL_PX = 92;

function isTypingTarget(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
  );
}

/** 도형 카드 그림(이름 글자 없음). */
function ProfileIcon({ profile }: { readonly profile: LatheProfile }) {
  const chain = naturalChain(profile);
  return <ChainIcon chain={chain} />;
}

function ChainIcon({
  chain,
  edgeIndex,
  unit = 9,
}: {
  readonly chain: readonly RH[];
  readonly edgeIndex?: number;
  readonly unit?: number;
}) {
  const pad = 6;
  const pts = chain.map((p) => ({ x: pad + p.r * unit, y: pad + (4 - p.h) * unit }));
  const edge = edgeIndex === undefined ? null : [pts[edgeIndex], pts[(edgeIndex + 1) % pts.length]];
  return (
    <svg width={pad * 2 + 4 * unit} height={pad * 2 + 4 * unit} aria-hidden="true">
      <polygon
        points={pointsAttr(pts)}
        fill="#bcd4ff"
        fillOpacity={0.7}
        stroke="#2f6fde"
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      {edge && edge[0] && edge[1] ? (
        <line
          x1={edge[0].x}
          y1={edge[0].y}
          x2={edge[1].x}
          y2={edge[1].y}
          stroke="#d9730d"
          strokeWidth={5}
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

/** 붙일 변을 도형 그림 위에 굵게 보인 단추 그림. */
function EdgeIcon({ profile, edge }: { readonly profile: LatheProfile; readonly edge: LatheEdge }) {
  const chain = naturalChain(profile);
  let edgeIndex: number | undefined;
  if (profile === 'rectangle') edgeIndex = edge === 'long' ? 3 : 0;
  else if (profile === 'right-triangle') {
    edgeIndex = edge === 'leg-vertical' ? 2 : edge === 'leg-horizontal' ? 0 : 1;
  } else edgeIndex = chain.length - 1;
  return <ChainIcon chain={chain} edgeIndex={edgeIndex} unit={7} />;
}

interface DialProps {
  readonly angle: number;
  readonly disabled: boolean;
  readonly onAngle: (angle: number) => void;
}

function angleFromPointer(rect: DOMRect, x: number, y: number): number {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const deg = (Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function wrapDelta(delta: number): number {
  let d = delta;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

function Dial({ angle, disabled, onAngle }: DialProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: number; last: number; acc: number; sent: number } | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? angle;
  const knob = (shown * Math.PI) / 180;
  const R = DIAL_PX / 2 - 14;
  const cx = DIAL_PX / 2;
  const kx = cx + R * Math.sin(knob);
  const ky = cx - R * Math.cos(knob);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = ref.current;
    if (!el) return;
    const raw = angleFromPointer(el.getBoundingClientRect(), e.clientX, e.clientY);
    drag.current = { id: e.pointerId, last: raw, acc: angle, sent: angle };
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {
      // 일부 테스트 환경에서는 pointer capture를 지원하지 않는다.
    }
    setPreview(angle);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || d.id !== e.pointerId) return;
    const raw = angleFromPointer(el.getBoundingClientRect(), e.clientX, e.clientY);
    d.acc = clamp(d.acc + wrapDelta(raw - d.last), 0, FULL_TURN);
    d.last = raw;
    setPreview(d.acc);
    const snapped = snapAngle(d.acc);
    if (snapped !== null && snapped !== d.sent) {
      d.sent = snapped;
      onAngle(snapped);
    }
  };
  const onEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const snapped = snapAngle(d.acc);
    if (snapped !== null && snapped !== d.sent) onAngle(snapped);
    setPreview(null);
  };

  return (
    <div
      ref={ref}
      className={styles.ltDial}
      data-testid="lt-dial"
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={S.lathe.dialLabel}
      aria-valuemin={0}
      aria-valuemax={FULL_TURN}
      aria-valuenow={angle}
      aria-valuetext={S.lathe.dialValue(angle)}
      aria-disabled={disabled}
      data-disabled={disabled ? 'true' : 'false'}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
    >
      <svg width={DIAL_PX} height={DIAL_PX} aria-hidden="true">
        <circle cx={cx} cy={cx} r={R} fill="#ffffff" stroke="#2f6fde" strokeWidth={3} />
        {Array.from({ length: FULL_TURN / ANGLE_STEP }, (_, i) => {
          const a = (i * ANGLE_STEP * Math.PI) / 180;
          return (
            <line
              key={i}
              x1={cx + (R - 8) * Math.sin(a)}
              y1={cx - (R - 8) * Math.cos(a)}
              x2={cx + R * Math.sin(a)}
              y2={cx - R * Math.cos(a)}
              stroke="#2f6fde"
              strokeWidth={2}
            />
          );
        })}
        <circle cx={kx} cy={ky} r={10} fill="#d9730d" stroke="#ffffff" strokeWidth={2.5} />
        <text
          x={cx}
          y={cx + 6}
          textAnchor="middle"
          fontSize={18}
          fontWeight={800}
          fill="#1d2330"
          data-testid="lt-dial-text"
        >
          {S.lathe.dialValue(Math.round(shown))}
        </text>
      </svg>
    </div>
  );
}

export function LatheView({
  state,
  dispatch,
  readOnly = false,
  targetSize,
}: EngineViewProps<LatheConfig, LatheState, LatheAction>) {
  const { settings } = state;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const [spinSerial, setSpinSerial] = useState(0);
  const spin = useScriptedProgress(spinSerial, true, SPIN_MS);
  const running = spin.running && state.angle === FULL_TURN;
  const displayAngle = running ? spin.progress * FULL_TURN : state.angle;
  const complete = isComplete(state);
  const hasCut = settings.planes.length > 0;
  const attached = state.edge !== null;
  const laser = state.laser;
  const t = laser ? laser.t : LATHE_DEFAULT_T;
  const hasH = settings.planes.includes('perpendicular');
  const hasV = settings.planes.includes('through-axis');

  const pickProfile = (profile: LatheProfile) => {
    if (readOnly) return;
    dispatch({ type: 'lt-pick-profile', profile });
    setLiveMessage(S.lathe.live.profile);
  };
  const attach = (edge: LatheEdge) => {
    if (readOnly || state.profile === null) return;
    dispatch({ type: 'lt-attach', edge });
    setLiveMessage(S.lathe.live.edge);
  };
  const setAngle = (angle: number) => {
    if (readOnly || !attached) return;
    dispatch({ type: 'lt-set-angle', angle });
    setLiveMessage(S.lathe.live.angle(angle));
  };
  const doSpin = () => {
    if (readOnly || !attached || running) return;
    dispatch({ type: 'lt-set-angle', angle: FULL_TURN });
    setSpinSerial((n) => n + 1);
    setLiveMessage(S.lathe.live.spun);
  };
  const reset = () => {
    if (readOnly) return;
    dispatch({ type: 'lt-reset' });
    setLiveMessage(S.lathe.live.reset);
  };
  const setLaser = (plane: 'perpendicular' | 'through-axis', next: number = t) => {
    if (readOnly || !complete || running) return;
    dispatch({ type: 'lt-set-laser', plane, t: next });
    setLiveMessage(S.lathe.live.laser);
  };
  const clearLaser = () => {
    if (readOnly) return;
    dispatch({ type: 'lt-clear-laser' });
    setLiveMessage(S.lathe.live.laserOff);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
    const key = e.key;
    if (key === ' ' || key === 'Spacebar') {
      // 단추에서 눌러도 한 번만 돌리도록 단추 누름 기본 동작은 막는다(keyup에서도 막는다).
      e.preventDefault();
      if (!e.repeat) doSpin();
      return;
    }
    if (key === '1' || key === '2' || key === '3') {
      const profile = settings.profiles[Number(key) - 1];
      if (profile) {
        e.preventDefault();
        pickProfile(profile);
      }
      return;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      if (!attached || running) return;
      e.preventDefault();
      setAngle(
        clamp(state.angle + (key === 'ArrowRight' ? ANGLE_STEP : -ANGLE_STEP), 0, FULL_TURN),
      );
      return;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      if (!hasH || !complete || running) return;
      e.preventDefault();
      setLaser('perpendicular', clamp(t + (key === 'ArrowUp' ? 1 : -1), 0, LASER_MAX_STEP));
      return;
    }
    const k = key.toLowerCase();
    if (k === 'h' && hasH) {
      e.preventDefault();
      setLaser('perpendicular');
    } else if (k === 'v' && hasV) {
      e.preventDefault();
      setLaser('through-axis');
    } else if ((k === 'q' || k === 'e') && complete) {
      e.preventDefault();
      dispatch({ type: 'rotate-view', dYaw: k === 'q' ? -15 : 15, dPitch: 0 });
      setLiveMessage(S.lathe.live.turned);
    }
  };
  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ' || e.key === 'Spacebar') e.preventDefault();
  };

  const edges = state.profile ? edgesOf(state.profile) : [];
  const motionOff = prefersReducedMotion();

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      data-mode="lathe"
      data-target-size={targetSize}
      data-testid="lt-view"
      data-running={running ? 'true' : 'false'}
      data-reduced-motion={motionOff ? 'true' : 'false'}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <p className={styles.instructions}>
        {hasCut ? S.lathe.instructionsCut : S.lathe.instructions}
      </p>
      <div role="status" aria-live="polite" className={styles.srOnly}>
        {liveMessage}
      </div>

      <div className={styles.stageRow}>
        <div className={`${styles.boardArea} ${styles.xrayStageBoard}`}>
          <LatheStage
            state={state}
            displayAngle={displayAngle}
            readOnly={readOnly}
            dispatch={dispatch}
            onLiveMessage={setLiveMessage}
          />
        </div>

        <div className={`${styles.sideStack} ${styles.ltSide}`}>
          <div className={styles.ltCol}>
            <div className={styles.ltRow} role="group" aria-label={S.lathe.profilesLabel}>
              {settings.profiles.map((profile) => (
                <button
                  key={profile}
                  type="button"
                  className={`${styles.button} ${styles.ltCard}`}
                  data-testid={`lt-profile-${profile}`}
                  aria-pressed={state.profile === profile}
                  aria-label={S.lathe.profiles[profile]}
                  disabled={readOnly}
                  onClick={() => pickProfile(profile)}
                >
                  <ProfileIcon profile={profile} />
                </button>
              ))}
            </div>

            {state.profile ? (
              <div className={styles.ltRow} role="group" aria-label={S.lathe.edgesLabel}>
                {edges.map((edge) => (
                  <button
                    key={edge}
                    type="button"
                    className={`${styles.button} ${styles.ltEdge}`}
                    data-testid={`lt-edge-${edge}`}
                    aria-pressed={state.edge === edge}
                    disabled={readOnly}
                    onClick={() => attach(edge)}
                  >
                    <EdgeIcon profile={state.profile as LatheProfile} edge={edge} />
                    <span>{S.lathe.edges[edge]}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className={styles.ltRow}>
              {settings.rotateHandle ? (
                <Dial
                  angle={state.angle}
                  disabled={readOnly || !attached || running}
                  onAngle={setAngle}
                />
              ) : null}
              <div className={styles.ltBtnCol}>
                <button
                  type="button"
                  className={styles.button}
                  data-testid="lt-spin"
                  disabled={readOnly || !attached || running}
                  onClick={doSpin}
                >
                  {S.lathe.spin}
                </button>
                <button
                  type="button"
                  className={styles.button}
                  data-testid="lt-reset"
                  disabled={readOnly}
                  onClick={reset}
                >
                  {S.lathe.reset}
                </button>
              </div>
            </div>
          </div>

          {hasCut ? (
            <div className={styles.ltCutRow}>
              <div className={styles.ltBtnCol} role="group" aria-label={S.lathe.laserLabel}>
                {hasH ? (
                  <button
                    type="button"
                    className={styles.button}
                    data-testid="lt-laser-h"
                    aria-pressed={laser?.plane === 'perpendicular'}
                    disabled={readOnly || !complete || running}
                    onClick={() => setLaser('perpendicular')}
                  >
                    {S.lathe.laserH}
                  </button>
                ) : null}
                {hasV ? (
                  <button
                    type="button"
                    className={styles.button}
                    data-testid="lt-laser-v"
                    aria-pressed={laser?.plane === 'through-axis'}
                    disabled={readOnly || !complete || running}
                    onClick={() => setLaser('through-axis')}
                  >
                    {S.lathe.laserV}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={styles.button}
                  data-testid="lt-laser-off"
                  disabled={readOnly || laser === null}
                  onClick={clearLaser}
                >
                  {S.lathe.laserOff}
                </button>
              </div>
              {hasH ? (
                <input
                  className={styles.ltSlider}
                  data-testid="lt-laser-t"
                  type="range"
                  min={0}
                  max={LASER_MAX_STEP}
                  step={1}
                  value={t}
                  aria-label={S.lathe.laserHeight}
                  disabled={readOnly || !complete || running}
                  onChange={(e) => setLaser('perpendicular', Number(e.target.value))}
                />
              ) : null}
              <SectionPanel state={state} />
            </div>
          ) : null}
        </div>
      </div>

      <p className={styles.hint}>{S.lathe.keyHint}</p>
    </div>
  );
}
