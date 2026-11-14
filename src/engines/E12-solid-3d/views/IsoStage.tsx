/**
 * E12 2D 등각(아이소메트릭) SVG 무대.
 *
 * - 각 기둥을 `<g data-col="x,y">`로 묶어 바닥 마름모와 쌓기나무를 한 누름 영역으로 다룬다.
 * - 색 쌓기나무는 윗면뿐 아니라 앞면·오른쪽 면에도 무늬(● ▲ ■ ◆)를 그려 위에 쌓여도 구분된다.
 */
import type { Point } from '../../../core/engine-sdk';
import {
  computeStageLayout,
  cubeFaces,
  floorDiamond,
  frontMarkerGeometry,
  pointsAttr,
  sortColumnsForPainter,
  sortCubesForPainter,
} from '../layout';
import { solid3dStrings as S } from '../strings.ko';
import type { CPA } from '../../../core/engine-sdk';
import type { CubeColor, CubeItem, CubesState } from '../types';
import { rotateCell } from '../voxel';
import styles from '../View.module.css';
import {
  CUBE_INK,
  CUBE_PALETTE,
  FOCUS_STROKE,
  isTopFloorFocused,
  matchesFocus,
} from './focusMatch';
import type { PressGestureHandlers } from './usePressGesture';

interface IsoStageProps {
  readonly state: CubesState;
  readonly cpa: CPA;
  readonly readOnly: boolean;
  readonly editable?: boolean;
  readonly press: PressGestureHandlers;
  readonly hiddenFromFocus?: boolean;
}

function mapFacePoints(
  face: readonly [Point, Point, Point, Point],
  coords: readonly (readonly [number, number])[],
): string {
  const [p0, p1, p2, p3] = face;
  const cx = (p0.x + p2.x) / 2;
  const cy = (p0.y + p2.y) / 2;
  const e1x = (p1.x - p0.x) / 2;
  const e1y = (p1.y - p0.y) / 2;
  const e2x = (p3.x - p0.x) / 2;
  const e2y = (p3.y - p0.y) / 2;

  return coords
    .map(
      ([u, v]) => `${(cx + u * e1x + v * e2x).toFixed(2)},${(cy + u * e1y + v * e2y).toFixed(2)}`,
    )
    .join(' ');
}

const CIRCLE_POLY: readonly (readonly [number, number])[] = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return [Math.cos(a) * 0.34, Math.sin(a) * 0.34];
});

const MARK_SHAPES: Readonly<
  Record<Exclude<CubeColor, 'plain'>, readonly (readonly [number, number])[]>
> = {
  red: CIRCLE_POLY,
  blue: [
    [0, 0.36],
    [0.34, -0.28],
    [-0.34, -0.28],
  ],
  yellow: [
    [-0.27, -0.27],
    [0.27, -0.27],
    [0.27, 0.27],
    [-0.27, 0.27],
  ],
  green: [
    [0, 0.38],
    [0.38, 0],
    [0, -0.38],
    [-0.38, 0],
  ],
};

function faceMark(
  color: CubeColor,
  face: readonly [Point, Point, Point, Point],
  fillOpacity: number,
) {
  if (color === 'plain') return null;
  const shape = MARK_SHAPES[color];
  return (
    <polygon
      points={mapFacePoints(face, shape)}
      fill={CUBE_PALETTE[color].mark}
      fillOpacity={fillOpacity}
      pointerEvents="none"
    />
  );
}

export function IsoStage({
  state,
  cpa,
  readOnly,
  editable = true,
  press,
  hiddenFromFocus = false,
}: IsoStageProps) {
  const { settings } = state;
  const [cols, rows] = settings.grid;
  const interactive = !readOnly && editable;
  const layout = computeStageLayout(cols, rows, settings.maxHeight);

  const columns = sortColumnsForPainter(cols, rows, state.viewTurn);
  const cubesByCol = new Map<string, CubeItem[]>();
  for (const cube of state.cubes) {
    const key = `${cube.x},${cube.y}`;
    const list = cubesByCol.get(key) ?? [];
    list.push(cube);
    cubesByCol.set(key, list);
  }

  const frontMarker = settings.frontMarker
    ? frontMarkerGeometry(layout, cols, rows, state.viewTurn)
    : null;

  const [cursorRx, cursorRy] = rotateCell(
    state.cursor[0],
    state.cursor[1],
    cols,
    rows,
    state.viewTurn,
  );
  const cursorDiamond = floorDiamond(layout, cursorRx, cursorRy);
  void sortCubesForPainter;

  return (
    <svg
      className={styles.stageSvg}
      viewBox={`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`}
      style={{ aspectRatio: `${layout.viewBox.width} / ${layout.viewBox.height}` }}
      aria-label={S.canvasLabel}
      tabIndex={readOnly || hiddenFromFocus ? -1 : 0}
      data-testid="cubes-canvas"
      data-cpa={cpa}
    >
      {/* 바닥 격자 배경 */}
      <g pointerEvents="none">
        {columns.map(({ x, y, rx, ry }) => {
          const diamond = floorDiamond(layout, rx, ry);
          const isTopFocus = isTopFloorFocused(x, y, state.focus, rows);
          return (
            <polygon
              key={`floor-bg-${x}-${y}`}
              points={pointsAttr(diamond)}
              fill={isTopFocus ? '#ffedd5' : '#f1f5f9'}
              stroke={isTopFocus ? FOCUS_STROKE : '#94a3b8'}
              strokeWidth={isTopFocus ? 2.5 : 1.2}
            />
          );
        })}
      </g>

      {/* 앞 표시 */}
      {frontMarker ? (
        <g pointerEvents="none" data-testid="cubes-front-marker">
          <line
            x1={frontMarker.arrowFrom.x}
            y1={frontMarker.arrowFrom.y}
            x2={frontMarker.arrowTo.x}
            y2={frontMarker.arrowTo.y}
            stroke="#1d4fa8"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <circle cx={frontMarker.arrowTo.x} cy={frontMarker.arrowTo.y} r={3.2} fill="#1d4fa8" />
          <text
            x={frontMarker.text.x}
            y={frontMarker.text.y + 8}
            textAnchor="middle"
            fontSize={24}
            fontWeight={800}
            fill="#1d4fa8"
          >
            {S.front}
          </text>
        </g>
      ) : null}

      {/* 기둥별 누름 영역 + 화가 순서 쌓기나무 */}
      {columns.map(({ x, y, rx, ry }) => {
        const colCubes = cubesByCol.get(`${x},${y}`) ?? [];
        const diamond = floorDiamond(layout, rx, ry);
        const isCursor = state.cursor[0] === x && state.cursor[1] === y;
        return (
          <g
            key={`col-${x}-${y}`}
            data-col={`${x},${y}`}
            aria-label={S.columnAria(x, y)}
            style={interactive ? { cursor: 'pointer' } : undefined}
            onPointerDown={(event) => press.onPointerDown(event, x, y)}
            onPointerMove={press.onPointerMove}
            onPointerUp={(event) => press.onPointerUp(event, x, y)}
            onPointerCancel={press.onPointerCancel}
            onPointerLeave={press.onPointerCancel}
          >
            <polygon points={pointsAttr(diamond)} fill="transparent" data-floor={`${x},${y}`} />
            {colCubes.map((cube) => {
              const effectiveColor = settings.colorHints ? cube.color : 'plain';
              const palette = CUBE_PALETTE[effectiveColor];
              const faces = cubeFaces(layout, rx, ry, cube.z);
              const focusedCube = matchesFocus(cube, state.focus, rows, settings.maxHeight);
              const fillOpacity =
                state.layerFocus !== null
                  ? cube.z === state.layerFocus - 1
                    ? 1
                    : 0.2
                  : state.translucent
                    ? 0.35
                    : 1;
              return (
                <g
                  key={`cube-${cube.x}-${cube.y}-${cube.z}`}
                  data-cube={`${cube.x},${cube.y},${cube.z}`}
                  data-focused-cube={focusedCube ? 'true' : undefined}
                >
                  <polygon
                    points={pointsAttr(faces.top)}
                    fill={palette.top}
                    fillOpacity={fillOpacity}
                    stroke={CUBE_INK}
                    strokeWidth={1.6}
                    strokeLinejoin="round"
                  />
                  <polygon
                    points={pointsAttr(faces.front)}
                    fill={palette.front}
                    fillOpacity={fillOpacity}
                    stroke={CUBE_INK}
                    strokeWidth={1.6}
                    strokeLinejoin="round"
                  />
                  <polygon
                    points={pointsAttr(faces.right)}
                    fill={palette.right}
                    fillOpacity={fillOpacity}
                    stroke={CUBE_INK}
                    strokeWidth={1.6}
                    strokeLinejoin="round"
                  />
                  {settings.colorHints ? (
                    <>
                      {faceMark(effectiveColor, faces.top, fillOpacity)}
                      {faceMark(effectiveColor, faces.front, fillOpacity)}
                      {faceMark(effectiveColor, faces.right, fillOpacity)}
                    </>
                  ) : null}
                  {focusedCube ? (
                    <polygon
                      points={pointsAttr(faces.outline)}
                      fill="none"
                      stroke={FOCUS_STROKE}
                      strokeWidth={4}
                      strokeLinejoin="round"
                      pointerEvents="none"
                    />
                  ) : null}
                </g>
              );
            })}

            {/* 커서 칸 기둥 테두리 강조 */}
            {interactive && isCursor && colCubes.length > 0 ? (
              <polygon
                points={pointsAttr(cubeFaces(layout, rx, ry, colCubes.length - 1).top)}
                fill="none"
                stroke={FOCUS_STROKE}
                strokeWidth={3}
                strokeDasharray="6 4"
                pointerEvents="none"
              />
            ) : null}
          </g>
        );
      })}

      {/* 커서 바닥 마름모 굵은 점선 테두리 */}
      {interactive ? (
        <polygon
          points={pointsAttr(cursorDiamond)}
          fill="none"
          stroke={FOCUS_STROKE}
          strokeWidth={3.2}
          strokeDasharray="6 4"
          pointerEvents="none"
          data-testid="cubes-cursor"
        />
      ) : null}
    </svg>
  );
}
