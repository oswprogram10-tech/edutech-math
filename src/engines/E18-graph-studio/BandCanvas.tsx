/**
 * E18 띠·원그래프 SVG 한 장(`data-testid="graph-canvas"`, `data-graph-type="band-circle"`).
 *
 * - 100칸 띠와 원그래프는 같은 SVG 안에서 한 식(`bandCirclePath`)으로 모핑한다.
 * - `band: 'student'`이면 조각 아래 손잡이(`role="slider"`)를 끌거나 키보드로 칸 수를 정한다(곧은 띠일 때만).
 *   끄는 동안은 화면 안 미리보기만 두고, 손을 뗄 때 Action 한 번을 보낸다.
 * - `morph: 'drag'`이면 띠 오른쪽 끝 손잡이를 끌어 만다. 손가락과 띠 왼쪽 끝 사이 거리로 말기 정도를 정하고,
 *   놓으면 50 이상은 원그래프, 미만은 띠로 붙는다.
 * - 칸 합이 100이 아니어도 그 칸 수 그대로 그린다(넘치면 틀 밖 빗금). 맞고 틀림은 어디에도 나타내지 않는다.
 */
import { useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { pointerToLogical, useDrag, useRenderedSize } from '../../core/engine-sdk';
import type { TargetSize } from '../../core/engine-sdk';
import {
  BAND_CELLS,
  bandCirclePath,
  bandFrameOf,
  bandMapper,
  curlFromDistance,
  regionPath,
} from './band-circle';
import type { BandFrame, BandSegment } from './band-circle';
import { sliceColor } from './band-palette';
import { textSize } from './layout';
import { useReducedMotion } from './overlays/line-helpers';
import { bandCellsOf } from './observe';
import { roundPercent, truePercentOf } from './reduce';
import { graphStrings as S } from './strings.ko';
import type { BandCircleState, GraphAction } from './types';
import styles from './View.module.css';
import { useShownCurl } from './useShownCurl';

const INK = '#1d2330';
const PAPER = '#fbfaf6';
const ORANGE = '#b45309';
/** 끌기를 눌림과 구별하는 최소 움직임(논리 좌표). */
const MOVE_THRESHOLD = 3;

export interface BandCanvasProps {
  readonly state: BandCircleState;
  readonly dispatch: (action: GraphAction) => void;
  readonly readOnly: boolean;
  readonly targetSize: TargetSize;
  /** 두 원을 위아래로 쌓는가(`compare`가 있고 판이 좁을 때). */
  readonly stacked: boolean;
}

function textWidth(text: string, size: number): number {
  return [...text].length * size * 0.92;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface SegTarget {
  readonly cat: string;
  readonly before: number;
  readonly cells: number;
}

/**
 * 누른 손잡이. 칸이 0인 조각의 손잡이는 앞 조각 끝에 겹쳐 있어서, 겹친 손잡이를 누르면
 * 처음 움직이는 방향으로 고른다: 오른쪽이면 다음에 채울(칸이 0인 첫) 조각, 왼쪽이면 그 자리에서 끝나는 조각.
 */
type Pressed =
  | {
      readonly mode: 'seg';
      readonly candidates: readonly SegTarget[];
      readonly startX: number;
      chosen: SegTarget | null;
    }
  | { readonly mode: 'morph' };

/** 겹친 손잡이 후보 중 움직인 방향에 맞는 조각. 없으면 null. */
function chooseTarget(candidates: readonly SegTarget[], dx: number): SegTarget | null {
  if (candidates.length === 1) return candidates[0] ?? null;
  const owner = candidates.find((item) => item.cells > 0) ?? null;
  if (dx < 0) return owner;
  return candidates.find((item) => item.cells === 0) ?? owner;
}

export function BandCanvas({ state, dispatch, readOnly, targetSize, stacked }: BandCanvasProps) {
  const { settings } = state;
  const band = settings.bandCircle;
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const reduced = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const hatchId = `band-hatch-${uid}`;

  const frame: BandFrame = bandFrameOf(band?.compare != null, stacked);
  const LOGICAL = { width: frame.width, height: frame.height };

  const [segPreview, setSegPreview] = useState<{
    readonly cat: string;
    readonly cells: number;
  } | null>(null);
  const [curlPreview, setCurlPreview] = useState<number | null>(null);
  const pressed = useRef<Pressed | null>(null);
  const moved = useRef(false);

  const shown = useShownCurl(state.curl, curlPreview, reduced);

  const screenScale =
    rendered.width > 0 && rendered.height > 0
      ? Math.min(rendered.width / frame.width, rendered.height / frame.height)
      : 1;
  const fs = (base: number) => textSize(base, screenScale, targetSize);
  const hit = Math.max(26, Math.ceil(targetSize / 2 / (screenScale > 0 ? screenScale : 1)));

  const cellsNow = band ? bandCellsOf(state) : {};
  const cellsOf = (cat: string): number =>
    segPreview !== null && segPreview.cat === cat ? segPreview.cells : (cellsNow[cat] ?? 0);

  const categories = settings.categories;
  const segments: BandSegment[] = categories.map((cat) => ({ cat, cells: cellsOf(cat) }));
  const sum = segments.reduce((total, segment) => total + segment.cells, 0);
  const path = bandCirclePath(segments, shown, frame);
  const mapper = bandMapper(frame, shown);

  const isBand = shown === 0;
  const isCircle = shown === 100;
  const studentBand = band?.band === 'student';
  const bandEditable = studentBand && !readOnly && isBand;
  const morphDrag = band?.morph === 'drag' && !readOnly && state.curl < 100 && shown < 100;

  // 손잡이 자리: 조각 오른쪽 끝(띠 아래), 띠 오른쪽 끝(가운데 선).
  const bandBottom = frame.band.y + frame.band.thickness / 2;
  const handleY = bandBottom + 38;
  const cellWidth = frame.band.length / BAND_CELLS;
  const handleXs: {
    readonly cat: string;
    readonly x: number;
    readonly before: number;
    readonly cells: number;
  }[] = [];
  {
    let used = 0;
    for (const segment of segments) {
      const before = used;
      used += segment.cells;
      handleXs.push({
        cat: segment.cat,
        x: frame.band.x + used * cellWidth,
        before,
        cells: segment.cells,
      });
    }
  }

  const drag = useDrag({
    disabled: readOnly || (!bandEditable && !morphDrag),
    getPoint: (event) => pointerToLogical(event, svgRef.current, LOGICAL),
    onStart: (info) => {
      moved.current = false;
      if (morphDrag) {
        const end = path.end;
        if (Math.hypot(info.start.x - end.x, info.start.y - end.y) <= hit) {
          pressed.current = { mode: 'morph' };
          return;
        }
      }
      if (bandEditable) {
        let best: (typeof handleXs)[number] | null = null;
        let bestDistance = Infinity;
        for (const handle of handleXs) {
          const distance = Math.hypot(info.start.x - handle.x, info.start.y - handleY);
          if (distance <= hit && distance < bestDistance) {
            best = handle;
            bestDistance = distance;
          }
        }
        if (best) {
          const candidates = handleXs
            .filter((handle) => Math.abs(handle.x - best.x) < 0.01)
            .map((handle) => ({ cat: handle.cat, before: handle.before, cells: handle.cells }));
          pressed.current = { mode: 'seg', candidates, startX: best.x, chosen: null };
        }
      }
    },
    onMove: (info) => {
      const action = pressed.current;
      if (!action) return;
      if (Math.hypot(info.delta.x, info.delta.y) >= MOVE_THRESHOLD) moved.current = true;
      if (action.mode === 'seg') {
        if (action.chosen === null && moved.current) {
          action.chosen = chooseTarget(action.candidates, info.current.x - action.startX);
        }
        const target = action.chosen;
        if (target === null) return;
        const end = Math.round((info.current.x - frame.band.x) / cellWidth);
        setSegPreview({ cat: target.cat, cells: clampInt(end - target.before, 0, BAND_CELLS) });
      } else {
        const d = Math.hypot(info.current.x - frame.band.x, info.current.y - frame.band.y);
        setCurlPreview(curlFromDistance(frame, d));
      }
    },
    onEnd: (info) => {
      const action = pressed.current;
      pressed.current = null;
      const wasMoved = moved.current;
      setSegPreview(null);
      setCurlPreview(null);
      if (!action || !wasMoved) return;
      if (action.mode === 'seg') {
        const target = action.chosen;
        if (target === null) return;
        const end = Math.round((info.current.x - frame.band.x) / cellWidth);
        dispatch({
          type: 'set-band',
          cat: target.cat,
          cells: clampInt(end - target.before, 0, BAND_CELLS),
        });
      } else {
        const d = Math.hypot(info.current.x - frame.band.x, info.current.y - frame.band.y);
        dispatch({ type: 'set-curl', value: curlFromDistance(frame, d) >= 50 ? 100 : 0 });
      }
    },
    onCancel: () => {
      pressed.current = null;
      setSegPreview(null);
      setCurlPreview(null);
    },
  });

  const onHandleKey = (event: ReactKeyboardEvent<SVGGElement>, cat: string) => {
    if (!bandEditable) return;
    const current = cellsNow[cat] ?? 0;
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = current - 1;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = current + 1;
        break;
      case 'PageUp':
        next = current + 10;
        break;
      case 'PageDown':
        next = current - 10;
        break;
      case 'Delete':
      case 'Backspace':
        next = 0;
        break;
      default:
        break;
    }
    if (next === null) return;
    event.preventDefault();
    dispatch({ type: 'set-band', cat, cells: clampInt(next, 0, BAND_CELLS) });
  };

  const percentText = (cat: string, cells: number): string =>
    band?.sliceLabels === 'name' ? S.band.sliceName(cat) : S.band.sliceNamePercent(cat, cells);

  const renderLabel = (
    key: string,
    cat: string,
    cells: number,
    at: { readonly x: number; readonly y: number },
    room: number,
    size: number,
  ) => {
    if (cells <= 0) return null;
    const full = percentText(cat, cells);
    const text =
      textWidth(full, size) <= room
        ? full
        : textWidth(cat, size) <= room
          ? S.band.sliceName(cat)
          : null;
    if (text === null) return null;
    return (
      <text
        key={key}
        x={at.x}
        y={at.y + size * 0.35}
        textAnchor="middle"
        fontSize={size}
        fontWeight={800}
        fill="#ffffff"
        stroke={INK}
        strokeWidth={size * 0.22}
        paintOrder="stroke"
        strokeLinejoin="round"
        pointerEvents="none"
        data-testid="band-label"
        data-cat={cat}
      >
        {text}
      </text>
    );
  };

  const labelSize = fs(22);
  const showLabels = isBand || isCircle;

  const overflowD = sum > BAND_CELLS ? regionPath(frame, shown, 1, sum / BAND_CELLS) : '';

  // 10칸 눈금과 한 칸 눈금. 띠(말리는 중 포함)에서는 띠 두께 방향으로 긋고, 원그래프(80~100)에서는
  // 조각 경계선과 헷갈리지 않게 원둘레 바깥쪽에 반지름의 8%만 짧게 긋는다. 가는 눈금은 말리기 시작하면 흐려진다.
  const outward = shown > 80;
  const tickLine = (k: number, tenth: boolean) => {
    const a = mapper.at(k / BAND_CELLS, 0);
    let b = mapper.at(k / BAND_CELLS, 1);
    if (outward) {
      const width = Math.hypot(b.x - a.x, b.y - a.y);
      const out = (frame.pie.r * 0.08) / Math.max(width, 1);
      b = mapper.at(k / BAND_CELLS, -out);
    }
    return (
      <line
        key={`${tenth ? 'b' : 't'}-${k}`}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={INK}
        strokeWidth={tenth ? 2 : 1}
        opacity={tenth ? 0.85 : 0.35}
        pointerEvents="none"
        data-testid={tenth ? 'band-tick' : undefined}
      />
    );
  };
  const gridLines = [];
  const thinOpacity = Math.max(0, 1 - shown / 20);
  for (let k = 0; k <= BAND_CELLS; k += 1) {
    const tenth = k % 10 === 0;
    if (tenth) gridLines.push(tickLine(k, true));
    else if (thinOpacity > 0.02 && !outward) gridLines.push(tickLine(k, false));
  }

  // 두 번째 원그래프(읽기 전용, 원그래프일 때만).
  const compare = band?.compare ?? null;
  const comparePath =
    compare !== null && frame.compare !== null && isCircle
      ? bandCirclePath(
          compare.categories.map((cat) => ({
            cat,
            cells: roundPercent(truePercentOf(compare.data[cat] ?? 0, compare.total)),
          })),
          100,
          { ...frame, pie: { ...frame.pie, cx: frame.compare.cx, cy: frame.compare.cy } },
        )
      : null;

  const pieLabelRoom = (
    cells: number,
    label: { readonly x: number; readonly y: number },
    cx: number,
    cy: number,
  ) => {
    const radius = Math.hypot(label.x - cx, label.y - cy);
    return Math.max(0, ((cells * 3.6 * Math.PI) / 180) * radius * 0.9);
  };

  return (
    <svg
      ref={svgRef}
      className={styles.canvasSvg}
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      role="group"
      aria-label={S.band.board}
      data-testid="graph-canvas"
      data-graph-type="band-circle"
      data-curl={Math.round(shown * 100) / 100}
      data-stacked={frame.stacked ? 'true' : 'false'}
      data-cell-sum={sum}
      data-logical-width={frame.width}
      data-logical-height={frame.height}
      style={{
        aspectRatio: `${frame.width} / ${frame.height}`,
        touchAction: bandEditable || morphDrag ? 'none' : undefined,
      }}
      {...(bandEditable || morphDrag ? drag.handlers : {})}
    >
      <defs>
        <pattern
          id={hatchId}
          patternUnits="userSpaceOnUse"
          width={12}
          height={12}
          patternTransform="rotate(45)"
        >
          <rect width={5} height={12} fill={INK} opacity={0.6} />
        </pattern>
      </defs>
      <rect width={frame.width} height={frame.height} fill={PAPER} />
      {settings.title ? (
        <text
          x={frame.compare !== null ? frame.width / 2 : 60}
          y={20 + fs(26)}
          textAnchor={frame.compare !== null ? 'middle' : 'start'}
          fontSize={fs(26)}
          fontWeight={700}
          fill={INK}
          data-testid="band-title"
        >
          {settings.title}
        </text>
      ) : null}
      {frame.compare !== null && isCircle && band?.circleTitle ? (
        <text
          x={frame.pie.cx}
          y={frame.pie.cy - frame.pie.r - 34}
          textAnchor="middle"
          fontSize={fs(24)}
          fontWeight={700}
          fill={INK}
          data-testid="band-circle-title"
        >
          {band.circleTitle}
        </text>
      ) : null}

      <path d={path.frameD} fill="#ffffff" stroke="none" data-testid="band-frame-fill" />
      <g data-testid="band-slices">
        {path.slices.map((slice) =>
          slice.d === '' ? null : (
            <path
              key={slice.cat}
              d={slice.d}
              fill={sliceColor(slice.index)}
              stroke={INK}
              strokeWidth={3.5}
              strokeLinejoin="round"
              role="img"
              aria-label={S.band.slice(slice.cat, slice.cells)}
              data-testid="band-slice"
              data-cat={slice.cat}
              data-cells={slice.cells}
            />
          ),
        )}
      </g>
      {overflowD !== '' ? (
        <path
          d={overflowD}
          fill={`url(#${hatchId})`}
          stroke={INK}
          strokeWidth={2}
          strokeDasharray="6 4"
          pointerEvents="none"
          data-testid="band-overflow"
        />
      ) : null}
      <g data-testid="band-grid">{gridLines}</g>
      <path
        d={path.frameD}
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinejoin="round"
        pointerEvents="none"
        data-testid="band-frame-line"
      />

      {showLabels ? (
        <g>
          {path.slices.map((slice) =>
            isBand
              ? renderLabel(
                  slice.cat,
                  slice.cat,
                  slice.cells,
                  slice.label,
                  slice.cells * cellWidth - 6,
                  labelSize,
                )
              : renderLabel(
                  slice.cat,
                  slice.cat,
                  slice.cells,
                  slice.label,
                  pieLabelRoom(slice.cells, slice.label, frame.pie.cx, frame.pie.cy),
                  labelSize,
                ),
          )}
        </g>
      ) : null}

      {comparePath !== null && compare !== null && frame.compare !== null ? (
        <g data-testid="compare-circle" aria-label={S.band.compareLabel} role="group">
          {compare.title ? (
            <text
              x={frame.compare.cx}
              y={frame.compare.cy - frame.pie.r - 34}
              textAnchor="middle"
              fontSize={fs(24)}
              fontWeight={700}
              fill={INK}
            >
              {compare.title}
            </text>
          ) : null}
          <path d={comparePath.frameD} fill="#ffffff" />
          {comparePath.slices.map((slice) =>
            slice.d === '' ? null : (
              <path
                key={slice.cat}
                d={slice.d}
                fill={sliceColor(slice.index)}
                stroke={INK}
                strokeWidth={3.5}
                strokeLinejoin="round"
                role="img"
                aria-label={S.band.slice(slice.cat, slice.cells)}
                data-testid="compare-slice"
                data-cat={slice.cat}
                data-cells={slice.cells}
              />
            ),
          )}
          <path
            d={comparePath.frameD}
            fill="none"
            stroke={INK}
            strokeWidth={4}
            strokeLinejoin="round"
          />
          {comparePath.slices.map((slice) =>
            renderLabel(
              `compare-${slice.cat}`,
              slice.cat,
              slice.cells,
              slice.label,
              pieLabelRoom(
                slice.cells,
                slice.label,
                frame.compare?.cx ?? 0,
                frame.compare?.cy ?? 0,
              ),
              labelSize,
            ),
          )}
        </g>
      ) : null}

      {bandEditable
        ? handleXs.map((handle) => {
            const cells = cellsOf(handle.cat);
            const dragging = segPreview?.cat === handle.cat;
            return (
              <g
                key={handle.cat}
                role="slider"
                tabIndex={0}
                aria-label={S.band.handle(handle.cat)}
                aria-orientation="horizontal"
                aria-valuemin={0}
                aria-valuemax={BAND_CELLS}
                aria-valuenow={cellsNow[handle.cat] ?? 0}
                aria-valuetext={S.band.dragCells(cellsNow[handle.cat] ?? 0)}
                data-testid="band-handle"
                data-cat={handle.cat}
                data-cells={cells}
                onKeyDown={(event) => onHandleKey(event, handle.cat)}
              >
                <line
                  x1={handle.x}
                  x2={handle.x}
                  y1={bandBottom}
                  y2={handleY}
                  stroke={INK}
                  strokeWidth={3}
                  pointerEvents="none"
                />
                <circle
                  cx={handle.x}
                  cy={handleY}
                  r={hit}
                  fill="transparent"
                  data-testid="band-handle-hit"
                />
                <circle
                  cx={handle.x}
                  cy={handleY}
                  r={16}
                  fill="#ffffff"
                  stroke={sliceColor(categories.indexOf(handle.cat))}
                  strokeWidth={5}
                  pointerEvents="none"
                />
                <text
                  x={handle.x}
                  y={handleY + 6}
                  textAnchor="middle"
                  fontSize={18}
                  fontWeight={800}
                  fill={INK}
                  pointerEvents="none"
                >
                  ↔
                </text>
                {dragging ? (
                  <g pointerEvents="none" data-testid="band-bubble">
                    <rect
                      x={handle.x - 46}
                      y={handleY - hit - 38}
                      width={92}
                      height={36}
                      rx={10}
                      fill="#ffffff"
                      stroke={INK}
                      strokeWidth={2.5}
                    />
                    <text
                      x={handle.x}
                      y={handleY - hit - 12}
                      textAnchor="middle"
                      fontSize={22}
                      fontWeight={800}
                      fill={INK}
                    >
                      {S.band.dragCells(cells)}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })
        : null}

      {morphDrag ? (
        <g data-testid="band-morph-handle" aria-hidden="true">
          <circle
            cx={path.end.x}
            cy={path.end.y}
            r={hit}
            fill="transparent"
            data-testid="band-morph-hit"
          />
          <circle
            cx={path.end.x}
            cy={path.end.y}
            r={18}
            fill={ORANGE}
            stroke="#ffffff"
            strokeWidth={3}
            pointerEvents="none"
          />
          <text
            x={path.end.x}
            y={path.end.y + 8}
            textAnchor="middle"
            fontSize={22}
            fontWeight={800}
            fill="#ffffff"
            pointerEvents="none"
          >
            ↻
          </text>
        </g>
      ) : null}
    </svg>
  );
}
