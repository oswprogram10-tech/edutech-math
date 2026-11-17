/**
 * E12 `shapes-sort` 모드 주 View(1학년, 저학년 64px 타깃 기준).
 *
 * - 장면: 경사로·탑·가린 상자. 선반에서 물건을 골라 장면에 올린다.
 * - 학생 화면에 결과 글·탑 높이 수·가린 모양 이름을 쓰지 않는다.
 * - 키보드: ← → 고르기, S/L 세우기·눕히기, R 경사로, Space ▶, T 쌓기, U 내리기, M 만져 보기.
 */
import { useRef, useState } from 'react';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { hasRamp, hasTower, itemOf, poseOf } from '../shapes/reduce';
import { isAllowedPose } from '../shapes/rules';
import { solid3dStrings as S } from '../strings.ko';
import type { ShapesAction, ShapesSortConfig, ShapesState } from '../types';
import styles from '../View.module.css';
import { MysteryBox } from './MysteryBox';
import { RampScene } from './RampScene';
import { ShapeIcon } from './ShapeIcon';
import { TowerScene } from './TowerScene';

function isTypingTarget(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
  );
}

export function ShapesView({
  state,
  dispatch,
  readOnly = false,
}: EngineViewProps<ShapesSortConfig, ShapesState, ShapesAction>) {
  const { settings } = state;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const showRamp = hasRamp(settings);
  const showTower = hasTower(settings);
  const showMystery = settings.scene === 'mystery';
  const selectedItem = itemOf(state, state.selected);
  const selectedPose = selectedItem ? poseOf(state, selectedItem) : null;
  const showPose = selectedItem !== null && selectedItem.kind === 'cylinder';

  const focusShelf = (id: string) => {
    wrapRef.current?.querySelector<HTMLElement>(`[data-testid="ss-shelf-${id}"]`)?.focus();
  };

  const select = (id: string) => {
    if (readOnly) return;
    dispatch({ type: 'ss-select', id });
    setLiveMessage(state.selected === id ? S.shapes.live.unselected : S.shapes.live.selected);
  };
  const setPose = (pose: 'standing' | 'lying') => {
    if (readOnly || !selectedItem || !isAllowedPose(selectedItem.kind, pose)) return;
    dispatch({ type: 'ss-set-pose', id: selectedItem.id, pose });
    setLiveMessage(S.shapes.live.posed);
  };
  const place = () => {
    if (readOnly || !showRamp) return;
    dispatch({ type: 'ss-place-ramp' });
    setLiveMessage(S.shapes.live.placed);
  };
  const play = () => {
    if (readOnly || !showRamp) return;
    dispatch({ type: 'ss-play' });
    setLiveMessage(S.shapes.live.played);
  };
  const resetRamp = () => {
    if (readOnly || !showRamp) return;
    dispatch({ type: 'ss-reset-ramp' });
    setLiveMessage(S.shapes.live.resetRamp);
  };
  const stack = () => {
    if (readOnly || !showTower) return;
    dispatch({ type: 'ss-stack' });
    setLiveMessage(S.shapes.live.stacked);
  };
  const unstack = () => {
    if (readOnly || !showTower) return;
    dispatch({ type: 'ss-unstack' });
    setLiveMessage(S.shapes.live.unstacked);
  };
  const clearTower = () => {
    if (readOnly || !showTower) return;
    dispatch({ type: 'ss-clear-tower' });
    setLiveMessage(S.shapes.live.cleared);
  };
  const touch = () => {
    if (readOnly || !showMystery) return;
    dispatch({ type: 'ss-touch' });
    setLiveMessage(S.shapes.live.touched);
  };

  const moveSelection = (delta: 1 | -1) => {
    const list = settings.objects;
    if (list.length === 0) return;
    const at = list.findIndex((item) => item.id === state.selected);
    const next = at < 0 ? (delta === 1 ? 0 : list.length - 1) : at + delta;
    const target = list[next];
    if (!target || target.id === state.selected) return;
    select(target.id);
    focusShelf(target.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (readOnly || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
    const key = e.key;
    if (key === ' ' || key === 'Spacebar') {
      // 단추에서 눌러도 ▶만 한 번 하도록 기본 동작(단추 누름)을 막는다. 누름은 keyup에서도 막는다.
      e.preventDefault();
      if (!e.repeat) play();
      return;
    }
    if (key === 'ArrowRight' || key === 'ArrowLeft') {
      e.preventDefault();
      moveSelection(key === 'ArrowRight' ? 1 : -1);
      return;
    }
    const k = key.toLowerCase();
    if (k === 's') {
      e.preventDefault();
      setPose('standing');
    } else if (k === 'l') {
      e.preventDefault();
      setPose('lying');
    } else if (k === 'r') {
      e.preventDefault();
      place();
    } else if (k === 't') {
      e.preventDefault();
      stack();
    } else if (k === 'u') {
      e.preventDefault();
      unstack();
    } else if (k === 'm') {
      e.preventDefault();
      touch();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === ' ' || e.key === 'Spacebar') e.preventDefault();
  };

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      data-mode="shapes-sort"
      data-scene={settings.scene}
      data-target-size="64"
      data-testid="ss-view"
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <p className={styles.instructions}>{S.shapes.instructions[settings.scene]}</p>
      <div role="status" aria-live="polite" className={styles.srOnly}>
        {liveMessage}
      </div>

      <div className={styles.ssScenes} role="group" aria-label={S.shapes.sceneLabel}>
        {showRamp ? (
          <RampScene
            state={state}
            readOnly={readOnly}
            onPlace={place}
            onPlay={play}
            onReset={resetRamp}
          />
        ) : null}
        {showTower ? (
          <TowerScene
            state={state}
            readOnly={readOnly}
            onStack={stack}
            onUnstack={unstack}
            onClear={clearTower}
          />
        ) : null}
        {showMystery ? <MysteryBox state={state} readOnly={readOnly} onTouch={touch} /> : null}
      </div>

      <div className={styles.ssShelfRow}>
        <div
          className={styles.ssShelf}
          data-testid="ss-shelf"
          role="group"
          aria-label={S.shapes.shelfLabel}
        >
          {settings.objects.map((item) => {
            const picked = state.selected === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.button} ${styles.ssShelfBtn}`}
                data-testid={`ss-shelf-${item.id}`}
                aria-pressed={picked}
                aria-label={S.shapes.itemAria(
                  S.shapes.colors[item.color],
                  S.shapes.sizes[item.size],
                  S.shapes.kinds[item.kind],
                )}
                disabled={readOnly}
                onClick={() => select(item.id)}
              >
                <ShapeIcon
                  px={48}
                  kind={item.kind}
                  pose={poseOf(state, item)}
                  color={item.color}
                  size={item.size}
                />
                {picked ? (
                  <span className={styles.ssCheck} aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {showPose && selectedItem ? (
          <div className={styles.ssPoses} role="group" aria-label={S.shapes.poseLabel}>
            {(['standing', 'lying'] as const).map((pose) => (
              <button
                key={pose}
                type="button"
                className={`${styles.button} ${styles.ssBtn}`}
                data-testid={`ss-pose-${pose}`}
                aria-pressed={selectedPose === pose}
                disabled={readOnly || state.tower.includes(selectedItem.id)}
                onClick={() => setPose(pose)}
              >
                <ShapeIcon
                  px={36}
                  kind="cylinder"
                  pose={pose}
                  color={selectedItem.color}
                  size="large"
                />
                <span>{pose === 'standing' ? S.shapes.standing : S.shapes.lying}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <p className={styles.hint}>{S.shapes.keyHint}</p>
    </div>
  );
}
