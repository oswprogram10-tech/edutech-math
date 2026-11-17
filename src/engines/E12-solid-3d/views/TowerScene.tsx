/**
 * E12 `shapes-sort` 쌓기 탑 장면.
 *
 * 탑 칸은 점선으로만 그린다. 탑 높이를 수나 글로 쓰지 않는다.
 * 탑에 못 머무는 물건은 0.8초 동안 미끄러져 탑 옆 바닥으로 굴러간다.
 */
import { itemOf, poseOf } from '../shapes/reduce';
import { solid3dStrings as S } from '../strings.ko';
import type { ShapesState } from '../types';
import styles from '../View.module.css';
import { ShapeGlyph } from './ShapeIcon';
import { spinCenter } from './shapeGlyphMeta';
import { easeIn, easeOut, useScriptedProgress } from './shapesMotion';

export const TOWER_W = 250;
export const TOWER_H = 300;
const GROUND_Y = 272;
const SLOT_H = 44;
const TOWER_X = 66;
const SLOT_W = 70;
const GLYPH_K = 0.85;
const FALL_K = 0.72;
const FALL_MS = 800;
const REST_XS = [168, 218] as const;
const SPIN_RADIUS = 22;

interface TowerSceneProps {
  readonly state: ShapesState;
  readonly readOnly: boolean;
  readonly onStack: () => void;
  readonly onUnstack: () => void;
  readonly onClear: () => void;
}

export function TowerScene({ state, readOnly, onStack, onUnstack, onClear }: TowerSceneProps) {
  const { settings, tower, fallen } = state;
  const { progress, running } = useScriptedProgress(fallen, fallen.length > 0, FALL_MS);

  // 탑 옆 바닥에 놓인 물건: 탑에 없는 것 중 가장 최근에 떨어진 둘.
  const restIds: string[] = [];
  for (let i = fallen.length - 1; i >= 0 && restIds.length < REST_XS.length; i -= 1) {
    const id = fallen[i]?.id;
    if (id !== undefined && !tower.includes(id) && !restIds.includes(id)) restIds.push(id);
  }
  const newestId = fallen.length > 0 ? (fallen[fallen.length - 1]?.id ?? null) : null;
  const slotY = (i: number) => GROUND_Y - SLOT_H * i;

  return (
    <section className={styles.ssScene} data-testid="ss-tower-scene">
      <svg
        className={styles.ssSvg}
        data-testid="ss-tower"
        data-running={running ? 'true' : 'false'}
        viewBox={`0 0 ${TOWER_W} ${TOWER_H}`}
        role="img"
        aria-label={S.shapes.towerLabel}
      >
        <rect x={-1000} y={GROUND_Y} width={TOWER_W + 2000} height={1000} fill="#e9e1cf" />
        <line
          x1={-1000}
          y1={GROUND_Y}
          x2={TOWER_W + 1000}
          y2={GROUND_Y}
          stroke="#9a8f74"
          strokeWidth={3}
        />
        {Array.from({ length: settings.towerMax }, (_, i) => {
          const id = tower[i];
          const item = itemOf(state, id ?? null);
          return (
            <g key={i} data-testid={`ss-tower-slot-${i}`} data-filled={item ? 'true' : 'false'}>
              <rect
                x={TOWER_X - SLOT_W / 2}
                y={slotY(i) - SLOT_H}
                width={SLOT_W}
                height={SLOT_H}
                rx={4}
                fill="none"
                stroke="#b7c2d6"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
              {item ? (
                <g
                  transform={`translate(${TOWER_X} ${slotY(i)}) scale(${GLYPH_K}) translate(-32 -58)`}
                >
                  <ShapeGlyph
                    kind={item.kind}
                    pose={poseOf(state, item)}
                    color={item.color}
                    size={item.size}
                  />
                </g>
              ) : null}
            </g>
          );
        })}
        {restIds.map((id, k) => {
          const item = itemOf(state, id);
          if (!item) return null;
          const pose = poseOf(state, item);
          const restX = REST_XS[k] ?? REST_XS[0];
          const animating = k === 0 && id === newestId && progress < 1;
          let x = restX;
          let y = GROUND_Y;
          let spin = 0;
          if (animating) {
            const startX = TOWER_X + 8;
            const startY = slotY(tower.length);
            // 처음 0.35는 탑 위에서 미끄러지고, 이어서 바닥으로 떨어져 굴러간다.
            const slide = Math.min(progress / 0.35, 1);
            const drop = progress < 0.35 ? 0 : easeIn((progress - 0.35) / 0.65);
            x = startX + (restX - startX) * (0.25 * easeOut(slide) + 0.75 * easeOut(progress));
            y = startY + (GROUND_Y - startY) * drop;
            spin = ((x - startX) / SPIN_RADIUS) * (180 / Math.PI);
          }
          const spinAt = spinCenter(item.kind, pose);
          return (
            <g
              key={id}
              data-testid={`ss-tower-fallen-${k}`}
              transform={`translate(${x} ${y}) scale(${FALL_K}) translate(-32 -58)`}
            >
              <g transform={`rotate(${spin} ${spinAt.x} ${spinAt.y})`}>
                <ShapeGlyph kind={item.kind} pose={pose} color={item.color} size={item.size} />
              </g>
            </g>
          );
        })}
      </svg>
      <div className={styles.ssActions}>
        <button
          type="button"
          className={`${styles.button} ${styles.ssBtn}`}
          data-testid="ss-tower-stack"
          disabled={readOnly || state.selected === null}
          onClick={onStack}
        >
          <span>{S.shapes.stack}</span>
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.ssBtn}`}
          data-testid="ss-tower-unstack"
          disabled={readOnly || tower.length === 0}
          onClick={onUnstack}
        >
          <span>{S.shapes.unstack}</span>
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.ssBtn}`}
          data-testid="ss-tower-clear"
          disabled={readOnly || (tower.length === 0 && fallen.length === 0)}
          onClick={onClear}
        >
          <span>{S.shapes.clearTower}</span>
        </button>
      </div>
    </section>
  );
}
