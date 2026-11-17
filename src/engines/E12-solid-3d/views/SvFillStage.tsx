/**
 * E12 `surface-volume` 등각 그림 두 가지.
 *
 * - `SvFillStage`: w×d×h 투명 상자(점선 테두리)에 1cm³ 쌓기나무를 채운다. 지금 층의 바닥 칸(마름모)을
 *   누르면 놓고, 놓인 칸을 누르면 뺀다. 개수는 쓰지 않는다.
 * - `SvStackedBox`: fixed-volume에서 지금 상자를 1cm 칸 격자가 보이는 등각 그림으로 그린다.
 */
import { clamp, type Point } from '../../../core/engine-sdk';
import { computeStageLayout, pointsAttr, projectPoint, sortCubesForPainter } from '../layout';
import { hasCube } from '../sv/reduce';
import { solid3dStrings as S } from '../strings.ko';
import type { SvAction, SvState } from '../types';
import styles from '../View.module.css';

const UNIT = 48;

interface FillStageProps {
  readonly state: SvState;
  readonly readOnly: boolean;
  readonly dispatch: (action: SvAction) => void;
  readonly onLiveMessage: (msg: string) => void;
}

function boxEdges(
  layout: ReturnType<typeof computeStageLayout>,
  w: number,
  d: number,
  h: number,
): readonly (readonly [Point, Point])[] {
  const p = (x: number, y: number, z: number) => projectPoint(layout, x, y, z);
  const out: (readonly [Point, Point])[] = [];
  for (const y of [0, d]) {
    for (const z of [0, h]) out.push([p(0, y, z), p(w, y, z)]);
  }
  for (const x of [0, w]) {
    for (const z of [0, h]) out.push([p(x, 0, z), p(x, d, z)]);
  }
  for (const x of [0, w]) {
    for (const y of [0, d]) out.push([p(x, y, 0), p(x, y, h)]);
  }
  return out;
}

export function SvFillStage({ state, readOnly, dispatch, onLiveMessage }: FillStageProps) {
  const [w, d, h] = state.dims;
  const layout = computeStageLayout(w, d, h, UNIT);
  const z = state.layer;
  const sorted = sortCubesForPainter(
    state.filled.map(([x, y, cz]) => ({ x, y, z: cz })),
    w,
    d,
    0,
  );

  const cells: { readonly x: number; readonly y: number }[] = [];
  for (let x = 0; x < w; x += 1) for (let y = 0; y < d; y += 1) cells.push({ x, y });
  // 뒤쪽 칸이 먼저 오도록(앞쪽 칸의 누름 영역이 위에 놓인다).
  cells.sort((a, b) => a.x - a.y - (b.x - b.y) || a.x + a.y - (b.x + b.y));

  const diamond = (x: number, y: number, level: number) =>
    pointsAttr([
      projectPoint(layout, x, y, level),
      projectPoint(layout, x + 1, y, level),
      projectPoint(layout, x + 1, y + 1, level),
      projectPoint(layout, x, y + 1, level),
    ]);

  const press = (x: number, y: number) => {
    if (readOnly) return;
    if (hasCube(state.filled, x, y, z)) {
      dispatch({ type: 'remove-cube', x, y });
      onLiveMessage(S.sv.live.removed);
      return;
    }
    if (z > 0 && !hasCube(state.filled, x, y, z - 1)) return;
    dispatch({ type: 'place-cube', x, y });
    onLiveMessage(S.sv.live.placed);
  };

  return (
    <svg
      className={styles.xrayStageSvg}
      data-testid="sv-fill-stage"
      data-layer={z}
      viewBox={`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`}
      width={layout.viewBox.width}
      height={layout.viewBox.height}
      role="group"
      aria-label={S.sv.fillLabel}
    >
      {/* 바닥 격자(1cm 칸) */}
      {cells.map(({ x, y }) => (
        <polygon
          key={`floor-${x}-${y}`}
          points={diamond(x, y, 0)}
          fill="#f3f6fb"
          stroke="#cbd5e1"
          strokeWidth={1}
        />
      ))}
      {boxEdges(layout, w, d, h).map(([a, b], i) => (
        <line
          key={`edge-${i}`}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke="#7a8aa5"
          strokeWidth={1.6}
          strokeDasharray="5 5"
        />
      ))}
      {sorted.map(({ cube, rx, ry }) => {
        const p = (ax: number, ay: number, az: number) => projectPoint(layout, ax, ay, az);
        const top = pointsAttr([
          p(rx, ry, cube.z + 1),
          p(rx + 1, ry, cube.z + 1),
          p(rx + 1, ry + 1, cube.z + 1),
          p(rx, ry + 1, cube.z + 1),
        ]);
        const front = pointsAttr([
          p(rx, ry, cube.z),
          p(rx + 1, ry, cube.z),
          p(rx + 1, ry, cube.z + 1),
          p(rx, ry, cube.z + 1),
        ]);
        const right = pointsAttr([
          p(rx + 1, ry, cube.z),
          p(rx + 1, ry + 1, cube.z),
          p(rx + 1, ry + 1, cube.z + 1),
          p(rx + 1, ry, cube.z + 1),
        ]);
        return (
          <g
            key={`cube-${cube.x}-${cube.y}-${cube.z}`}
            data-testid={`sv-cube-${cube.x}-${cube.y}-${cube.z}`}
            pointerEvents="none"
          >
            <polygon
              points={top}
              fill="#dbe7ff"
              stroke="#334155"
              strokeWidth={1.4}
              strokeLinejoin="round"
            />
            <polygon
              points={front}
              fill="#b7cdf5"
              stroke="#334155"
              strokeWidth={1.4}
              strokeLinejoin="round"
            />
            <polygon
              points={right}
              fill="#93b1ea"
              stroke="#334155"
              strokeWidth={1.4}
              strokeLinejoin="round"
            />
          </g>
        );
      })}
      {/* 지금 층의 바닥 칸(누름 대상) */}
      {cells.map(({ x, y }) => {
        const filled = hasCube(state.filled, x, y, z);
        const supported = z === 0 || hasCube(state.filled, x, y, z - 1);
        const canPress = !readOnly && (filled || supported);
        return (
          <polygon
            key={`cell-${x}-${y}`}
            data-testid={`sv-cell-${x}-${y}`}
            data-filled={filled ? 'true' : 'false'}
            data-enabled={supported ? 'true' : 'false'}
            points={diamond(x, y, z)}
            fill={filled ? 'transparent' : supported ? 'rgba(47, 111, 222, 0.14)' : 'transparent'}
            stroke={filled ? '#e8872e' : supported ? '#2f6fde' : '#cbd5e1'}
            strokeWidth={filled ? 2.2 : 2}
            strokeDasharray={filled ? undefined : '6 4'}
            strokeLinejoin="round"
            role="button"
            tabIndex={canPress ? 0 : -1}
            aria-disabled={canPress ? undefined : true}
            aria-label={S.sv.cellAria(x, y, filled)}
            aria-pressed={filled}
            style={canPress ? { cursor: 'pointer' } : undefined}
            onClick={() => press(x, y)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                press(x, y);
              }
            }}
          />
        );
      })}
    </svg>
  );
}

/** fixed-volume의 상자 그림: 보이는 세 면에 1cm 칸 격자를 그린다. */
export function SvStackedBox({ state }: { readonly state: SvState }) {
  const [w, d, h] = state.dims;
  const unit = clamp(Math.round(240 / Math.max(w + d, h / 2, 4)), 14, UNIT);
  const layout = computeStageLayout(w, d, h, unit);
  const p = (x: number, y: number, z: number) => projectPoint(layout, x, y, z);

  const lines: { readonly a: Point; readonly b: Point }[] = [];
  // 윗면(z = h)
  for (let x = 1; x < w; x += 1) lines.push({ a: p(x, 0, h), b: p(x, d, h) });
  for (let y = 1; y < d; y += 1) lines.push({ a: p(0, y, h), b: p(w, y, h) });
  // 앞면(y = 0)
  for (let x = 1; x < w; x += 1) lines.push({ a: p(x, 0, 0), b: p(x, 0, h) });
  for (let z = 1; z < h; z += 1) lines.push({ a: p(0, 0, z), b: p(w, 0, z) });
  // 오른쪽 면(x = w)
  for (let y = 1; y < d; y += 1) lines.push({ a: p(w, y, 0), b: p(w, y, h) });
  for (let z = 1; z < h; z += 1) lines.push({ a: p(w, 0, z), b: p(w, d, z) });

  return (
    <svg
      className={styles.xrayStageSvg}
      data-testid="sv-box-stage"
      data-fixed="true"
      viewBox={`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`}
      width={layout.viewBox.width}
      height={layout.viewBox.height}
      role="img"
      aria-label={S.sv.boxLabel}
    >
      <polygon
        points={pointsAttr([p(0, 0, h), p(w, 0, h), p(w, d, h), p(0, d, h)])}
        fill="#e4edff"
      />
      <polygon
        points={pointsAttr([p(0, 0, 0), p(w, 0, 0), p(w, 0, h), p(0, 0, h)])}
        fill="#bcd0f4"
      />
      <polygon
        points={pointsAttr([p(w, 0, 0), p(w, d, 0), p(w, d, h), p(w, 0, h)])}
        fill="#9cb8ea"
      />
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.a.x}
          y1={l.a.y}
          x2={l.b.x}
          y2={l.b.y}
          stroke="#5b6f93"
          strokeOpacity={0.55}
          strokeWidth={1}
        />
      ))}
      {[
        [p(0, 0, h), p(w, 0, h), p(w, d, h), p(0, d, h)],
        [p(0, 0, 0), p(w, 0, 0), p(w, 0, h), p(0, 0, h)],
        [p(w, 0, 0), p(w, d, 0), p(w, d, h), p(w, 0, h)],
      ].map((quad, i) => (
        <polygon
          key={`o${i}`}
          points={pointsAttr(quad)}
          fill="none"
          stroke="#1e293b"
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
