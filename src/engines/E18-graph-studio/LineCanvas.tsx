/**
 * E18 꺾은선그래프 SVG 한 장(`data-testid="graph-canvas"`, `data-graph-type="line"`).
 *
 * - 가로축마다 세로 줄(레인)이 있다. 학생 그래프(또는 예측 단계)에서 레인을 누르거나 끌면
 *   그 높이에 점이 찍힌다(`plotStep`에 붙음). 끄는 동안은 화면 안 미리보기만 두고, 손을 뗄 때 Action 한 번을 보낸다.
 * - `connect: 'student'`이면 점에서 점으로 끌거나 점 둘을 차례로 눌러 잇고, 선분을 누르면 끊는다.
 * - 학생 점이 맞는지는 어디에도 나타내지 않는다.
 * - 예측은 점선 + 빈 원, 실제는 실선 + 채운 원이다(색만으로 구별하지 않는다).
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { pointerToLogical, useDrag, useRenderedSize } from '../../core/engine-sdk';
import type { TargetSize } from '../../core/engine-sdk';
import { Rational } from '../../core/math';
import { textSize } from './layout';
import {
  LINE_HEIGHT,
  LINE_WIDTH,
  adjacentPairs,
  autoSegments,
  formatValue,
  laneAt,
  laneCenter,
  laneWidth,
  lineGeometry,
  lineTickCells,
  plotBottom,
  plotStepCountAt,
  snapValue,
  tickValueOf,
  valueOf,
  yOfCell,
  yOfValue,
} from './line';
import { graphStrings as S } from './strings.ko';
import type { GraphAction, LineGraphState } from './types';
import styles from './View.module.css';

const INK = '#1d2330';
const GRID = '#d3dbe9';
const BLUE = '#1d4fa8';
const ORANGE = '#b45309';
const PAPER = '#fbfaf6';
/** 왼쪽(150)과 오른쪽(40) 여백. 레인 폭을 늘려 그림 폭을 정할 때 쓴다. */
const SIDE_MARGIN = 190;

interface LineCanvasProps {
  readonly state: LineGraphState;
  readonly dispatch: (action: GraphAction) => void;
  readonly readOnly: boolean;
  readonly targetSize: TargetSize;
  /** 주어진 그래프의 점을 눌러 값 말풍선을 볼 수 있는가. */
  readonly tooltipsOn: boolean;
}

function labelSize(span: number, text: string, max: number, floor: number): number {
  return Math.max(floor, Math.min(max, (span - 12) / Math.max(1, [...text].length)));
}

/** 선분의 양 끝을 `by`만큼 줄인다(끝의 점을 누르는 일이 선분에 막히지 않게). */
function trimmed(
  line: { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number },
  by: number,
) {
  const length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
  if (length <= by * 2) return line;
  const ux = (line.x2 - line.x1) / length;
  const uy = (line.y2 - line.y1) / length;
  return {
    x1: line.x1 + ux * by,
    y1: line.y1 + uy * by,
    x2: line.x2 - ux * by,
    y2: line.y2 - uy * by,
  };
}

function zigzag(x: number, y: number): string {
  const half = 7;
  const points = [0, 1, 2, 3, 4].map(
    (step) => `${x - 14 + step * half},${y + (step % 2 === 0 ? 0 : -6)}`,
  );
  return points.join(' ');
}

export function LineCanvas({ state, dispatch, readOnly, targetSize, tooltipsOn }: LineCanvasProps) {
  const { settings } = state;
  const line = settings.line;
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const student = settings.graph === 'student';
  const predictPhase = state.phase === 'predict';
  const editable = (student || predictPhase) && !readOnly;
  // 학생이 점을 찍는 그래프(예측 포함)는 레인이 targetSize 이상이 되도록 그림 폭을 정하고 필요하면 스크롤한다.
  const touch = student || line?.predict === true;
  const connectMode =
    line?.connect === 'student' && student && state.phase === 'actual' && !readOnly;

  const [host, setHost] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = svgRef.current?.parentElement;
    if (!touch || !element) return;
    const update = () => {
      const width = Math.floor(element.clientWidth);
      const height = Math.floor(element.clientHeight);
      setHost((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [touch]);

  const count = Math.max(1, line?.xs.length ?? 1);
  let width = LINE_WIDTH;
  let scale: number | null = null;
  if (touch && host.width > 0 && host.height > 0) {
    const fit = Math.min(host.width / LINE_WIDTH, host.height / LINE_HEIGHT);
    const lane = ((LINE_WIDTH - SIDE_MARGIN) / count) * fit;
    if (lane >= targetSize) {
      scale = fit;
    } else {
      // 레인이 좁으면 높이에 맞추고 폭을 늘려 레인 하나가 targetSize가 되게 한다(가로 스크롤).
      scale = host.height / LINE_HEIGHT;
      width = Math.ceil(SIDE_MARGIN + (count * targetSize) / scale);
    }
  }
  const pictureSize = scale
    ? { width: Math.floor(width * scale), height: Math.floor(LINE_HEIGHT * scale) }
    : null;
  const panX = pictureSize ? pictureSize.width > host.width + 1 : false;

  const screenScale =
    scale ??
    (rendered.width > 0 && rendered.height > 0
      ? Math.min(rendered.width / width, rendered.height / LINE_HEIGHT)
      : 1);
  const fs = (base: number) => textSize(base, screenScale, targetSize);
  const hit = Math.max(18, Math.ceil(targetSize / 2 / (screenScale > 0 ? screenScale : 1)));
  const LOGICAL = { width, height: LINE_HEIGHT };

  const [picked, setPicked] = useState<string | null>(null);
  const [selectedRaw, setSelected] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ readonly lane: number; readonly count: number } | null>(
    null,
  );
  const [linking, setLinking] = useState<{
    readonly from: number;
    readonly x: number;
    readonly y: number;
  } | null>(null);
  const pressed = useRef<{ mode: 'plot' | 'link'; lane: number } | null>(null);

  const yFromText = state.yFrom;
  const geometry = line ? lineGeometry(line, yFromText, width) : null;

  // 학생이 조작하는 점 모음.
  const editedPoints = predictPhase ? state.prediction : state.points;

  // 고른 점이 지워졌거나 단계가 바뀌면 선택은 없던 것으로 본다.
  const selected =
    selectedRaw !== null &&
    connectMode &&
    (state.points[line?.xs[selectedRaw] ?? ''] ?? null) !== null
      ? selectedRaw
      : null;

  const plotStep = line ? Rational.parse(line.plotStep) : Rational.of(1);

  const pointIndexAt = (point: { readonly x: number; readonly y: number }): number | null => {
    if (!line || !geometry) return null;
    for (let index = 0; index < line.xs.length; index += 1) {
      const value = valueOf(state.points[line.xs[index] as string]);
      if (value === null) continue;
      const dx = point.x - laneCenter(geometry, index);
      const dy = point.y - yOfValue(geometry, value);
      if (Math.hypot(dx, dy) <= hit) return index;
    }
    return null;
  };

  const tapPoint = (index: number) => {
    if (selected === null) setSelected(index);
    else if (selected === index) setSelected(null);
    else {
      dispatch({ type: 'connect', a: selected, b: index });
      setSelected(null);
    }
  };

  const drag = useDrag({
    disabled: !editable || !line || !geometry,
    getPoint: (event) => pointerToLogical(event, svgRef.current, LOGICAL),
    onStart: (info) => {
      if (!line || !geometry) return;
      const lane = laneAt(geometry, info.start.x);
      if (lane === null) return;
      if (info.start.y < geometry.plot.y - 8 || info.start.y > plotBottom(geometry) + 8) return;
      if (connectMode) {
        const index = pointIndexAt(info.start);
        if (index !== null) {
          pressed.current = { mode: 'link', lane: index };
          setLinking({ from: index, x: info.start.x, y: info.start.y });
          return;
        }
      }
      pressed.current = { mode: 'plot', lane };
      setPreview({ lane, count: plotStepCountAt(geometry, plotStep, info.start.y) });
    },
    onMove: (info) => {
      const action = pressed.current;
      if (!action || !geometry) return;
      if (action.mode === 'plot') {
        setPreview({
          lane: action.lane,
          count: plotStepCountAt(geometry, plotStep, info.current.y),
        });
      } else {
        setLinking({ from: action.lane, x: info.current.x, y: info.current.y });
      }
    },
    onEnd: (info) => {
      const action = pressed.current;
      pressed.current = null;
      setPreview(null);
      setLinking(null);
      if (!action || !line || !geometry) return;
      if (action.mode === 'plot') {
        const k = plotStepCountAt(geometry, plotStep, info.current.y);
        dispatch({
          type: 'set-point',
          x: line.xs[action.lane] as string,
          y: plotStep.mul(Rational.of(k)).toJSON(),
        });
        return;
      }
      const moved = Math.hypot(info.delta.x, info.delta.y);
      const target = pointIndexAt(info.current);
      if (moved < 8) tapPoint(action.lane);
      else if (target !== null && target !== action.lane) {
        dispatch({ type: 'connect', a: action.lane, b: target });
        setSelected(null);
      }
    },
    onCancel: () => {
      pressed.current = null;
      setPreview(null);
      setLinking(null);
    },
  });

  if (!line || !geometry) return null;
  const g = geometry;
  const unit = settings.valueLabel;
  const plot = g.plot;
  const bottom = plotBottom(g);
  const lane = laneWidth(g);

  const numberSize = fs(20);
  const skip = Math.max(1, Math.ceil((numberSize * 1.2) / g.unit));
  const ticks = lineTickCells(g.cells, skip);

  const onLaneKey = (event: ReactKeyboardEvent<SVGGElement>, index: number) => {
    if (!editable) return;
    const x = line.xs[index] as string;
    const current = valueOf(editedPoints[x]);
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const next =
        current === null
          ? g.from
          : event.key === 'ArrowUp'
            ? current.add(plotStep)
            : current.sub(plotStep);
      dispatch({ type: 'set-point', x, y: next.toJSON() });
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      dispatch({ type: 'clear-point', x });
    } else if ((event.key === 'Enter' || event.key === ' ') && connectMode && current !== null) {
      event.preventDefault();
      tapPoint(index);
    }
  };

  // 화면에 그릴 점·선분.
  const actualValues: (Rational | null)[] = predictPhase
    ? line.xs.map(() => null)
    : line.xs.map((x, index) => (student ? valueOf(state.points[x]) : valueOf(line.values[index])));
  const actualSegments: readonly (readonly [number, number])[] = predictPhase
    ? []
    : student
      ? state.segments
      : adjacentPairs(line.xs.length).map(([a, b]) => [a, b] as const);
  const predictionValues = line.predict ? line.xs.map((x) => valueOf(state.prediction[x])) : [];
  const predictionSegments = line.predict ? autoSegments(line.xs, state.prediction) : [];
  const linkable = connectMode;

  const previewValue =
    preview !== null ? snapValue(line, yFromText, plotStep.mul(Rational.of(preview.count))) : null;

  const renderAxes = () => (
    <g>
      {ticks.map((k) => {
        const y = yOfCell(g, k);
        return (
          <g key={`tick-${k}`}>
            <line
              x1={plot.x}
              x2={plot.x + plot.width}
              y1={y}
              y2={y}
              stroke={GRID}
              strokeWidth={k === 0 && !g.wavy ? 0 : 1.5}
            />
            <text
              x={plot.x - 14}
              y={y + numberSize * 0.35}
              textAnchor="end"
              fontSize={numberSize}
              fill={INK}
            >
              {formatValue(tickValueOf(g, k))}
            </text>
          </g>
        );
      })}
      {g.wavy ? (
        <text
          x={plot.x - 14}
          y={bottom + numberSize * 0.35}
          textAnchor="end"
          fontSize={numberSize}
          fill={INK}
        >
          0
        </text>
      ) : null}
      {g.wavy ? (
        <>
          <line
            x1={plot.x}
            x2={plot.x}
            y1={bottom}
            y2={bottom - g.unit * 0.35}
            stroke={INK}
            strokeWidth={3}
          />
          <line
            x1={plot.x}
            x2={plot.x}
            y1={bottom - g.unit * 0.65}
            y2={plot.y}
            stroke={INK}
            strokeWidth={3}
          />
          <g data-testid="line-wavy" data-wavy="true" fill="none" stroke={INK} strokeWidth={3}>
            <polyline points={zigzag(plot.x, bottom - g.unit * 0.35)} />
            <polyline points={zigzag(plot.x, bottom - g.unit * 0.65)} />
          </g>
        </>
      ) : (
        <line x1={plot.x} x2={plot.x} y1={plot.y} y2={bottom} stroke={INK} strokeWidth={3} />
      )}
      <line
        x1={plot.x}
        x2={plot.x + plot.width}
        y1={bottom}
        y2={bottom}
        stroke={INK}
        strokeWidth={3}
      />
    </g>
  );

  const renderTitles = () => (
    <g fontSize={fs(22)} fill={INK} fontWeight={700}>
      {settings.title ? (
        <text x={width / 2} y={20 + fs(26)} textAnchor="middle" fontSize={fs(26)}>
          {settings.title}
        </text>
      ) : null}
      {settings.valueAxisTitle ? (
        <text
          x={34}
          y={plot.y + plot.height / 2}
          textAnchor="middle"
          transform={`rotate(-90 34 ${plot.y + plot.height / 2})`}
        >
          {settings.valueAxisTitle}
        </text>
      ) : null}
      {settings.categoryAxisTitle ? (
        <text x={plot.x + plot.width / 2} y={LINE_HEIGHT - 20} textAnchor="middle">
          {settings.categoryAxisTitle}
        </text>
      ) : null}
    </g>
  );

  const renderLabels = () => (
    <g fill={INK} fontWeight={600}>
      {line.xs.map((x, index) => (
        <text
          key={x}
          x={laneCenter(g, index)}
          y={bottom + 52}
          textAnchor="middle"
          fontSize={labelSize(lane, x, 30, Math.min(fs(20), 40))}
        >
          {x}
        </text>
      ))}
    </g>
  );

  const renderLanes = () =>
    line.xs.map((x, index) => {
      const value = valueOf(editedPoints[x]);
      return (
        <g
          key={x}
          role={editable ? 'button' : undefined}
          tabIndex={editable ? 0 : undefined}
          aria-label={
            editable ? S.line.lane(x, value === null ? null : formatValue(value), unit) : undefined
          }
          data-testid="line-lane"
          data-x={x}
          onKeyDown={editable ? (event) => onLaneKey(event, index) : undefined}
        >
          {editable ? (
            <line
              x1={laneCenter(g, index)}
              x2={laneCenter(g, index)}
              y1={plot.y}
              y2={bottom}
              stroke={GRID}
              strokeWidth={2}
              strokeDasharray="4 6"
            />
          ) : null}
          <rect
            x={plot.x + index * lane}
            y={plot.y}
            width={lane}
            height={plot.height}
            fill="transparent"
          />
        </g>
      );
    });

  const segmentElement = (
    kind: 'actual' | 'prediction',
    a: number,
    b: number,
    values: readonly (Rational | null)[],
  ) => {
    const from = values[a];
    const to = values[b];
    if (!from || !to) return null;
    const coords = {
      x1: laneCenter(g, a),
      y1: yOfValue(g, from),
      x2: laneCenter(g, b),
      y2: yOfValue(g, to),
    };
    const prediction = kind === 'prediction';
    const removable = kind === 'actual' && linkable;
    return (
      <g
        key={`${kind}-${a}-${b}`}
        data-testid="line-segment"
        data-kind={kind}
        data-a={a}
        data-b={b}
        role={removable ? 'button' : undefined}
        tabIndex={removable ? 0 : undefined}
        aria-label={
          removable ? S.line.segment(line.xs[a] as string, line.xs[b] as string) : undefined
        }
        onPointerDown={removable ? (event) => event.stopPropagation() : undefined}
        onClick={removable ? () => dispatch({ type: 'disconnect', a, b }) : undefined}
        onKeyDown={
          removable
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ' || event.key === 'Delete') {
                  event.preventDefault();
                  dispatch({ type: 'disconnect', a, b });
                }
              }
            : undefined
        }
      >
        <line
          {...coords}
          stroke={prediction ? ORANGE : BLUE}
          strokeWidth={prediction ? 3.5 : 5}
          strokeDasharray={prediction ? '10 8' : undefined}
          strokeLinecap="round"
          pointerEvents="none"
        />
        {removable ? (
          <line
            {...trimmed(coords, 16)}
            stroke="transparent"
            strokeWidth={22}
            strokeLinecap="round"
          />
        ) : null}
      </g>
    );
  };

  const toggleTip = (x: string) => setPicked((current) => (current === x ? null : x));

  const pointElement = (kind: 'actual' | 'prediction', index: number, value: Rational | null) => {
    if (value === null) return null;
    const x = line.xs[index] as string;
    const cx = laneCenter(g, index);
    const cy = yOfValue(g, value);
    const prediction = kind === 'prediction';
    const tip = !prediction && tooltipsOn;
    return (
      <g
        key={`${kind}-${x}`}
        data-testid="line-point"
        data-kind={kind}
        data-x={x}
        data-y={formatValue(value)}
        role={tip ? 'button' : 'img'}
        tabIndex={tip ? 0 : undefined}
        aria-label={S.line.point(x, formatValue(value), unit)}
        onClick={tip ? () => toggleTip(x) : undefined}
        onKeyDown={
          tip
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggleTip(x);
                }
              }
            : undefined
        }
      >
        <circle
          cx={cx}
          cy={cy}
          r={10}
          fill={prediction ? PAPER : BLUE}
          stroke={prediction ? ORANGE : '#ffffff'}
          strokeWidth={prediction ? 4 : 2.5}
          pointerEvents={tip ? 'auto' : 'none'}
        />
        {tip || (linkable && !prediction) ? (
          <circle cx={cx} cy={cy} r={hit} fill="transparent" />
        ) : null}
        {selected === index && !prediction ? (
          <circle
            cx={cx}
            cy={cy}
            r={17}
            fill="none"
            stroke={ORANGE}
            strokeWidth={3}
            strokeDasharray="5 4"
            pointerEvents="none"
          />
        ) : null}
      </g>
    );
  };

  const renderTooltip = () => {
    if (picked === null || !tooltipsOn) return null;
    const index = line.xs.indexOf(picked);
    const value = valueOf(line.values[index]);
    if (index < 0 || value === null) return null;
    const text = S.line.tooltip(picked, formatValue(value), unit);
    const boxWidth = Math.max(120, [...text].length * 17 + 24);
    const x = Math.min(width - boxWidth - 8, Math.max(8, laneCenter(g, index) - boxWidth / 2));
    const y = Math.max(8, yOfValue(g, value) - 56);
    return (
      <g data-testid="graph-tooltip" data-x={picked} pointerEvents="none">
        <rect
          x={x}
          y={y}
          width={boxWidth}
          height={40}
          rx={10}
          fill="#ffffff"
          stroke={INK}
          strokeWidth={2.5}
        />
        <text
          x={x + boxWidth / 2}
          y={y + 27}
          textAnchor="middle"
          fontSize={21}
          fontWeight={700}
          fill={INK}
        >
          {text}
        </text>
      </g>
    );
  };

  const linkingFrom =
    linking !== null ? valueOf(state.points[line.xs[linking.from] as string]) : null;

  return (
    <svg
      ref={svgRef}
      className={styles.canvasSvg}
      viewBox={`0 0 ${width} ${LINE_HEIGHT}`}
      role="group"
      aria-label={S.line.board}
      data-testid="graph-canvas"
      data-graph-type="line"
      data-y-from={formatValue(g.from)}
      data-wavy={g.wavy ? 'true' : 'false'}
      data-logical-width={width}
      data-logical-height={LINE_HEIGHT}
      data-scroll={touch ? 'true' : undefined}
      style={
        pictureSize
          ? {
              width: pictureSize.width,
              height: pictureSize.height,
              touchAction: editable ? (panX ? 'pan-x' : 'none') : undefined,
            }
          : editable
            ? { touchAction: 'none' }
            : undefined
      }
      {...(editable ? drag.handlers : {})}
    >
      <rect width={width} height={LINE_HEIGHT} fill={PAPER} />
      <g key={yFromText} className={styles.flipIn}>
        {renderTitles()}
        {renderAxes()}
        {renderLabels()}
        {renderLanes()}
        {predictionSegments.map(([a, b]) => segmentElement('prediction', a, b, predictionValues))}
        {actualSegments.map(([a, b]) => segmentElement('actual', a, b, actualValues))}
        {predictionValues.map((value, index) => pointElement('prediction', index, value))}
        {actualValues.map((value, index) => pointElement('actual', index, value))}
        {preview !== null && previewValue !== null ? (
          <circle
            data-testid="line-preview"
            cx={laneCenter(g, preview.lane)}
            cy={yOfValue(g, previewValue)}
            r={12}
            fill="none"
            stroke={predictPhase ? ORANGE : BLUE}
            strokeWidth={4}
            pointerEvents="none"
          />
        ) : null}
        {linking !== null && linkingFrom !== null ? (
          <line
            x1={laneCenter(g, linking.from)}
            y1={yOfValue(g, linkingFrom)}
            x2={linking.x}
            y2={linking.y}
            stroke={ORANGE}
            strokeWidth={4}
            strokeDasharray="6 6"
            pointerEvents="none"
          />
        ) : null}
        {renderTooltip()}
      </g>
    </svg>
  );
}
