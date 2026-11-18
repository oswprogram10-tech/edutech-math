/**
 * E18 그래프 SVG 한 장(`data-testid="graph-canvas"`).
 *
 * - 학생이 그리는 그래프(`graph: 'student'`)에는 말풍선도 맞음 표시도 없다.
 * - 막대는 끝을 끌어 칸에 붙이고(Pointer Events), 키보드 화살표로 한 칸씩 바꾼다.
 * - ○ 칸은 누르거나 Enter/Space로 채우고 비운다.
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { minTouchRadius, pointerToLogical, useDrag, useRenderedSize } from '../../core/engine-sdk';
import type { TargetSize } from '../../core/engine-sdk';
import {
  bandCenter,
  bandIndexAt,
  barRect,
  barThickness,
  cellLength,
  frameOf,
  isTouchOMark,
  textSize,
  touchScale,
  markRect,
  markSide,
  positionToCells,
  tickCells,
  valuePosition,
} from './layout';
import type { Frame } from './layout';
import { graphCellsOf, graphValueOf } from './observe';
import { axisCells } from './reduce';
import { graphStrings as S } from './strings.ko';
import type { GraphAction, GraphState } from './types';
import styles from './View.module.css';

const INK = '#1d2330';
const GRID = '#d3dbe9';
const BLUE = '#1d4fa8';
const PAPER = '#fbfaf6';

interface GraphCanvasProps {
  readonly state: GraphState;
  readonly dispatch: (action: GraphAction) => void;
  readonly readOnly: boolean;
  readonly targetSize: TargetSize;
  /** 값 말풍선을 보일 수 있는 설정인가(학생 그래프는 늘 false). */
  readonly tooltipsOn: boolean;
}

function labelSize(span: number, text: string, max: number, floor: number): number {
  return Math.max(floor, Math.min(max, (span - 12) / Math.max(1, [...text].length)));
}

export function GraphCanvas({
  state,
  dispatch,
  readOnly,
  targetSize,
  tooltipsOn,
}: GraphCanvasProps) {
  const { settings } = state;
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const cells = axisCells(settings, state.scale);
  const frame: Frame = frameOf(
    state.orientation,
    settings.categories.length,
    cells,
    isTouchOMark(settings),
  );
  const LOGICAL = { width: frame.width, height: frame.height };
  const hit = Math.max(10, Math.ceil(minTouchRadius(targetSize, rendered, LOGICAL)));
  const [picked, setPicked] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ readonly cat: string; readonly cells: number } | null>(
    null,
  );
  const pressed = useRef<string | null>(null);

  const vertical = state.orientation === 'vertical';
  const student = settings.graph === 'student';
  const isBar = settings.graphType === 'bar';
  const interactive = student && !readOnly;
  // 누르는 ○ 그래프는 칸이 targetSize 이상이 되는 크기를 지키고, 판이 작으면 판 안에서 스크롤한다.
  const scrolls = isTouchOMark(settings);
  const [host, setHost] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = svgRef.current?.parentElement;
    if (!scrolls || !element) return;
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
  }, [scrolls]);
  // 화면 배율: 누르는 ○ 그래프는 max(minTouchScale, fitScale)(판 폭을 채우려고 더 키우지 않는다).
  const pictureScale = scrolls ? touchScale(frame, targetSize, host) : null;
  const minSize = pictureScale
    ? {
        width: Math.ceil(frame.width * pictureScale),
        height: Math.ceil(frame.height * pictureScale),
      }
    : null;
  const textScale =
    pictureScale ??
    (rendered.width > 0 && rendered.height > 0
      ? Math.min(rendered.width / frame.width, rendered.height / frame.height)
      : 1);
  const fs = (base: number) => textSize(base, textScale, targetSize);
  const scrollKey = `${state.orientation}|${cells}|${settings.categories.length}|${targetSize}`;
  useEffect(() => {
    const host = svgRef.current?.parentElement;
    if (!scrolls || !host) return;
    // 처음 위치: 축(0번 칸)이 보이는 쪽. 세로 그래프는 맨 아래, 가로 그래프는 맨 왼쪽.
    host.scrollTo?.({ top: vertical ? host.scrollHeight : 0, left: 0 });
  }, [scrolls, scrollKey, vertical]);
  const unit = settings.valueLabel;

  const snap = (point: { readonly x: number; readonly y: number }): number => {
    const raw = positionToCells(frame, vertical ? point.y : point.x);
    return Math.min(cells, Math.max(0, Math.round(raw)));
  };

  const drag = useDrag({
    disabled: !(interactive && isBar),
    getPoint: (event) => pointerToLogical(event, svgRef.current, LOGICAL),
    onStart: (info) => {
      const index = bandIndexAt(frame, vertical ? info.start.x : info.start.y);
      const cat = index === null ? null : (settings.categories[index] ?? null);
      pressed.current = cat;
      if (cat) setPreview({ cat, cells: snap(info.start) });
    },
    onMove: (info) => {
      const cat = pressed.current;
      if (cat) setPreview({ cat, cells: snap(info.current) });
    },
    onEnd: (info) => {
      const cat = pressed.current;
      pressed.current = null;
      setPreview(null);
      if (cat) dispatch({ type: 'set-bar', cat, cells: snap(info.current) });
    },
    onCancel: () => {
      pressed.current = null;
      setPreview(null);
    },
  });

  const activate = (event: ReactKeyboardEvent, run: () => void) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    run();
  };

  const onBarKey = (event: ReactKeyboardEvent<SVGGElement>, cat: string) => {
    if (!interactive) return;
    const grow = vertical ? 'ArrowUp' : 'ArrowRight';
    const shrink = vertical ? 'ArrowDown' : 'ArrowLeft';
    const current = state.bars[cat] ?? 0;
    if (event.key === grow) {
      event.preventDefault();
      dispatch({ type: 'set-bar', cat, cells: current + 1 });
    } else if (event.key === shrink) {
      event.preventDefault();
      dispatch({ type: 'set-bar', cat, cells: current - 1 });
    }
  };

  const numberSize = fs(20);
  // 눈금 글자끼리 겹치면 건너뛰어 쓴다(칸 간격이 글자 크기의 1.2배보다 좁을 때).
  const skip = Math.max(1, Math.ceil((numberSize * 1.2) / cellLength(frame)));
  const ticks = tickCells(cells, skip);
  const plot = frame.plot;
  const bandSpan = vertical ? plot.width / frame.count : 190;
  const base = valuePosition(frame, 0);

  const oMark = settings.graphType === 'o-mark';
  // ○ 그래프: 칸 줄마다 1, 2, 3…을 칸 가운데에 쓰고 0은 쓰지 않는다(칸이 20개를 넘으면 5칸마다).
  const cellNumbers = oMark
    ? Array.from({ length: cells }, (_, index) => index + 1).filter(
        (number) => (cells <= 20 || number % 5 === 0) && number % skip === 0,
      )
    : [];

  const renderAxes = () => (
    <g>
      {cellNumbers.map((number) => {
        const middle = valuePosition(frame, number - 0.5);
        return vertical ? (
          <text
            key={`num-${number}`}
            data-cell-number={number}
            x={plot.x - 14}
            y={middle + numberSize * 0.35}
            textAnchor="end"
            fontSize={numberSize}
            fill={INK}
          >
            {number}
          </text>
        ) : (
          <text
            key={`num-${number}`}
            data-cell-number={number}
            x={middle}
            y={plot.y + plot.height + 8 + numberSize}
            textAnchor="middle"
            fontSize={numberSize}
            fill={INK}
          >
            {number}
          </text>
        );
      })}
      {ticks.map((tick) => {
        const position = valuePosition(frame, tick);
        return (
          <g key={`tick-${tick}`}>
            {vertical ? (
              <>
                <line
                  x1={plot.x}
                  x2={plot.x + plot.width}
                  y1={position}
                  y2={position}
                  stroke={GRID}
                  strokeWidth={tick === 0 ? 0 : 1.5}
                />
                {oMark ? null : (
                  <text
                    x={plot.x - 14}
                    y={position + numberSize * 0.35}
                    textAnchor="end"
                    fontSize={numberSize}
                    fill={INK}
                  >
                    {tick * state.scale}
                  </text>
                )}
              </>
            ) : (
              <>
                <line
                  x1={position}
                  x2={position}
                  y1={plot.y}
                  y2={plot.y + plot.height}
                  stroke={GRID}
                  strokeWidth={tick === 0 ? 0 : 1.5}
                />
                {oMark ? null : (
                  <text
                    x={position}
                    y={plot.y + plot.height + 8 + numberSize}
                    textAnchor="middle"
                    fontSize={numberSize}
                    fill={INK}
                  >
                    {tick * state.scale}
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
      <line
        x1={plot.x}
        x2={plot.x}
        y1={plot.y}
        y2={plot.y + plot.height}
        stroke={INK}
        strokeWidth={3}
      />
      <line
        x1={plot.x}
        x2={plot.x + plot.width}
        y1={plot.y + plot.height}
        y2={plot.y + plot.height}
        stroke={INK}
        strokeWidth={3}
      />
    </g>
  );

  const renderTitles = () => (
    <g fontSize={fs(22)} fill={INK} fontWeight={700}>
      {settings.title ? (
        <text x={frame.width / 2} y={20 + fs(26)} textAnchor="middle" fontSize={fs(26)}>
          {settings.title}
        </text>
      ) : null}
      {settings.valueAxisTitle ? (
        vertical ? (
          <text
            x={34}
            y={plot.y + plot.height / 2}
            textAnchor="middle"
            transform={`rotate(-90 34 ${plot.y + plot.height / 2})`}
          >
            {settings.valueAxisTitle}
          </text>
        ) : (
          <text x={plot.x + plot.width / 2} y={frame.height - 20} textAnchor="middle">
            {settings.valueAxisTitle}
          </text>
        )
      ) : null}
      {settings.categoryAxisTitle ? (
        vertical ? (
          <text x={plot.x + plot.width / 2} y={frame.height - 20} textAnchor="middle">
            {settings.categoryAxisTitle}
          </text>
        ) : (
          <text
            x={34}
            y={plot.y + plot.height / 2}
            textAnchor="middle"
            transform={`rotate(-90 34 ${plot.y + plot.height / 2})`}
          >
            {settings.categoryAxisTitle}
          </text>
        )
      ) : null}
    </g>
  );

  const renderCategoryLabels = () => (
    <g fill={INK} fontWeight={600}>
      {settings.categories.map((cat, index) => {
        const center = bandCenter(frame, index);
        const size = labelSize(bandSpan, cat, 30, Math.min(fs(20), 40));
        return vertical ? (
          <text
            key={cat}
            x={center}
            y={plot.y + plot.height + 52}
            textAnchor="middle"
            fontSize={size}
          >
            {cat}
          </text>
        ) : (
          <text
            key={cat}
            x={plot.x - 16}
            y={center + size / 3}
            textAnchor="end"
            fontSize={labelSize(190, cat, 30, Math.min(fs(20), 40))}
          >
            {cat}
          </text>
        );
      })}
    </g>
  );

  const tooltipFor = (cat: string, index: number) => {
    if (picked !== cat || !tooltipsOn) return null;
    const text = S.graph.tooltip(cat, graphValueOf(state, cat), unit);
    const width = Math.max(120, [...text].length * 17 + 24);
    const filled = isBar ? (settings.data?.[cat] ?? 0) / state.scale : graphCellsOf(state, cat);
    const end = valuePosition(frame, Math.min(cells, filled));
    const center = bandCenter(frame, index);
    const rawX = vertical ? center - width / 2 : end + 14;
    const rawY = vertical ? end - 56 : center - 22;
    const x = Math.min(frame.width - width - 8, Math.max(8, rawX));
    const y = Math.min(frame.height - 50, Math.max(8, rawY));
    return (
      <g key={`tip-${cat}`} data-testid="graph-tooltip" data-cat={cat} pointerEvents="none">
        <rect
          x={x}
          y={y}
          width={width}
          height={40}
          rx={10}
          fill="#ffffff"
          stroke={INK}
          strokeWidth={2.5}
        />
        <text
          x={x + width / 2}
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

  const toggleTip = (cat: string) => setPicked((current) => (current === cat ? null : cat));

  const renderBars = () =>
    settings.categories.map((cat, index) => {
      const shown = preview && preview.cat === cat ? preview.cells : null;
      const exact = student
        ? (shown ?? state.bars[cat] ?? 0)
        : (settings.data?.[cat] ?? 0) / state.scale;
      const length = Math.min(cells, exact);
      const rect = barRect(frame, index, length);
      const count = graphCellsOf(state, cat);
      const tip = !student && tooltipsOn;
      const label = student
        ? S.graph.barCells(cat, state.bars[cat] ?? 0)
        : tip
          ? S.graph.barValue(cat, graphValueOf(state, cat), unit)
          : S.graph.barLabel(cat);
      const endCenter = vertical ? rect.x + rect.width / 2 : rect.x + rect.width;
      const endMiddle = vertical ? rect.y : rect.y + rect.height / 2;
      return (
        <g
          key={cat}
          role={interactive || tip ? 'button' : 'img'}
          tabIndex={interactive || tip ? 0 : undefined}
          aria-label={label}
          data-cat={cat}
          data-cells={count}
          onClick={tip ? () => toggleTip(cat) : undefined}
          onKeyDown={
            interactive
              ? (event) => onBarKey(event, cat)
              : tip
                ? (event) => activate(event, () => toggleTip(cat))
                : undefined
          }
        >
          {rect.width > 0 && rect.height > 0 ? (
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill="url(#graph-hatch)"
              stroke={BLUE}
              strokeWidth={3}
            />
          ) : null}
          {/* 눌러 볼 자리: 막대 띠 전체(굵기 + 여유). */}
          <rect
            x={vertical ? bandCenter(frame, index) - barThickness(frame) / 2 - 6 : base}
            y={vertical ? plot.y : bandCenter(frame, index) - barThickness(frame) / 2 - 6}
            width={vertical ? barThickness(frame) + 12 : plot.width}
            height={vertical ? plot.height : barThickness(frame) + 12}
            fill="transparent"
          />
          {interactive ? (
            <>
              <circle
                cx={endCenter}
                cy={endMiddle}
                r={Math.max(hit, 18)}
                fill="transparent"
                data-handle={cat}
              />
              <circle
                cx={endCenter}
                cy={endMiddle}
                r={14}
                fill="#ffffff"
                stroke={BLUE}
                strokeWidth={4}
                pointerEvents="none"
              />
            </>
          ) : null}
        </g>
      );
    });

  const renderMarks = () =>
    settings.categories.map((cat, index) => {
      const filledCells = new Set<number>(
        student
          ? (state.marks[cat] ?? [])
          : Array.from({ length: graphCellsOf(state, cat) }, (_, cell) => cell),
      );
      const tip = !student && tooltipsOn;
      return (
        <g key={cat} data-cat-column={cat}>
          {Array.from({ length: cells }, (_, cell) => {
            const rect = markRect(frame, index, cell);
            const filled = filledCells.has(cell);
            const side = markSide(frame);
            const press = interactive
              ? () => dispatch({ type: 'toggle-mark', cat, cell })
              : tip
                ? () => toggleTip(cat)
                : undefined;
            // 눌러 볼 자리는 값 축 방향으로는 한 칸(겹치지 않게), 범주 축 방향으로는 targetSize까지 넓힌다.
            const spread = Math.max(side, hit * 2);
            const slot = cellLength(frame);
            const hitRect = vertical
              ? {
                  x: rect.x + rect.width / 2 - spread / 2,
                  y: rect.y + rect.height / 2 - slot / 2,
                  width: spread,
                  height: slot,
                }
              : {
                  x: rect.x + rect.width / 2 - slot / 2,
                  y: rect.y + rect.height / 2 - spread / 2,
                  width: slot,
                  height: spread,
                };
            return (
              <g
                key={cell}
                role={press ? 'button' : 'img'}
                tabIndex={press ? 0 : undefined}
                aria-label={S.graph.cellLabel(cat, cell, filled)}
                aria-pressed={interactive ? filled : undefined}
                data-cat={cat}
                data-cell={cell}
                data-filled={filled ? 'true' : 'false'}
                onClick={press}
                onKeyDown={press ? (event) => activate(event, press) : undefined}
              >
                <rect
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  rx={6}
                  fill={filled ? '#dbe7ff' : 'none'}
                  stroke={filled ? BLUE : '#aab4c6'}
                  strokeWidth={filled ? 3.5 : 2}
                  strokeDasharray={filled ? undefined : '6 5'}
                />
                {filled ? (
                  <text
                    x={rect.x + rect.width / 2}
                    y={rect.y + rect.height / 2 + side * 0.22}
                    textAnchor="middle"
                    fontSize={side * 0.72}
                    fontWeight={700}
                    fill={BLUE}
                  >
                    {S.graph.cellMark}
                  </text>
                ) : null}
                <rect
                  x={hitRect.x}
                  y={hitRect.y}
                  width={hitRect.width}
                  height={hitRect.height}
                  fill="transparent"
                />
              </g>
            );
          })}
        </g>
      );
    });

  const renderTooltips = () => settings.categories.map((cat, index) => tooltipFor(cat, index));

  return (
    <svg
      ref={svgRef}
      className={styles.canvasSvg}
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      role="group"
      aria-label={S.graph.orientation[state.orientation]}
      data-testid="graph-canvas"
      data-orientation={state.orientation}
      data-graph-type={settings.graphType}
      data-scroll={scrolls ? 'true' : undefined}
      style={minSize ? { width: minSize.width, height: minSize.height } : undefined}
      {...(interactive && isBar ? drag.handlers : {})}
    >
      <defs>
        <pattern
          id="graph-hatch"
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="12" height="12" fill="#c9dafc" />
          <line x1="0" y1="0" x2="0" y2="12" stroke={BLUE} strokeWidth="4" />
        </pattern>
      </defs>
      <rect width={frame.width} height={frame.height} fill={PAPER} />
      <g key={state.orientation} className={styles.flipIn}>
        {renderTitles()}
        {renderAxes()}
        {renderCategoryLabels()}
        {isBar ? renderBars() : renderMarks()}
        {renderTooltips()}
      </g>
    </svg>
  );
}
