/**
 * E18 distortion 그래프 SVG 한 장(`data-testid="graph-canvas"`).
 *
 * - 막대그래프(내 그래프·막대 예시)와 원그래프 예시를 같은 논리 크기(1000×700)로 그린다.
 * - 막대 위에는 값 글자를 쓰지 않는다(눈금으로 읽는다).
 * - 어느 그래프에도 맞음·틀림 표시를 하지 않는다. 예시의 `flaws`는 여기서 읽지 않는다.
 */
import { useRef } from 'react';
import { useRenderedSize } from '../../core/engine-sdk';
import type { TargetSize } from '../../core/engine-sdk';
import { sliceColor } from './band-palette';
import { bandCirclePath, bandFrameOf } from './band-circle';
import { exampleScene, ownScene } from './distortion';
import type { BarScene } from './distortion';
import { bandCenter, barRect, bandLength, cellLength, textSize, valuePosition } from './layout';
import { graphStrings as S } from './strings.ko';
import type { DistortionExample, DistortionState } from './types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './types';
import styles from './View.module.css';
import { WavyAxisBreak } from './wavy-axis';

const INK = '#1d2330';
const GRID = '#d3dbe9';
const BLUE = '#1d4fa8';
const PAPER = '#fbfaf6';

/** 원그래프 예시의 중심과 반지름(논리 좌표). */
const PIE = { cx: 500, cy: 400, r: 250 };
/** 이 칸 수(%) 이상인 조각에만 이름을 쓴다. */
const MIN_LABEL_CELLS = 6;

function labelSize(span: number, text: string, max: number, floor: number): number {
  return Math.max(floor, Math.min(max, (span - 12) / Math.max(1, [...text].length)));
}

interface DistortionCanvasProps {
  readonly state: DistortionState;
  readonly targetSize: TargetSize;
}

export function DistortionCanvas({ state, targetSize }: DistortionCanvasProps) {
  const { settings } = state;
  const distortion = settings.distortion;
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const textScale =
    rendered.width > 0 && rendered.height > 0
      ? Math.min(rendered.width / LOGICAL_WIDTH, rendered.height / LOGICAL_HEIGHT)
      : 1;
  const fs = (base: number) => textSize(base, textScale, targetSize);
  const example: DistortionExample | null =
    state.exampleIndex > 0 ? (distortion?.examples[state.exampleIndex - 1] ?? null) : null;
  const title = example === null ? settings.title : example.title;
  const circle = example !== null && example.kind === 'circle';
  const scene: BarScene | null = circle
    ? null
    : example === null
      ? ownScene(state)
      : exampleScene(example);

  const renderTitle = () =>
    title ? (
      <text
        x={LOGICAL_WIDTH / 2}
        y={20 + fs(26)}
        textAnchor="middle"
        fontSize={fs(26)}
        fontWeight={700}
        fill={INK}
        data-testid="distortion-title"
      >
        {title}
      </text>
    ) : null;

  const renderBars = (current: BarScene) => {
    const { frame } = current;
    const plot = frame.plot;
    const bottom = valuePosition(frame, 0);
    const numberSize = fs(20);
    const unitHeight = cellLength(frame);
    // 눈금 글자끼리 겹치면 건너뛰어 쓴다(맨 위·맨 아래 눈금은 늘 쓴다).
    const skip = Math.max(1, Math.ceil((numberSize * 1.2) / unitHeight));
    const bandSpan = bandLength(frame);
    return (
      <g>
        {current.ticks.map((tick, index) => {
          const y = valuePosition(frame, tick.unit);
          const labelled = index % skip === 0 || index === current.ticks.length - 1;
          return (
            <g key={`tick-${index}`} data-tick={index}>
              <line
                x1={plot.x}
                x2={plot.x + plot.width}
                y1={y}
                y2={y}
                stroke={GRID}
                strokeWidth={1.5}
              />
              {labelled ? (
                <text
                  x={plot.x - 14}
                  y={y + numberSize * 0.35}
                  textAnchor="end"
                  fontSize={numberSize}
                  fill={INK}
                  data-testid="distortion-tick"
                >
                  {tick.value}
                </text>
              ) : null}
            </g>
          );
        })}
        {current.wavy ? (
          <text
            x={plot.x - 14}
            y={bottom + numberSize * 0.35}
            textAnchor="end"
            fontSize={numberSize}
            fill={INK}
            data-testid="distortion-zero"
          >
            0
          </text>
        ) : null}
        {current.wavy ? (
          <WavyAxisBreak
            x={plot.x}
            top={plot.y}
            bottom={bottom}
            unit={unitHeight}
            ink={INK}
            testId="distortion-wavy"
          />
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
          data-testid="distortion-baseline"
        />
        {settings.valueAxisTitle ? (
          <text
            x={34}
            y={plot.y + plot.height / 2}
            textAnchor="middle"
            transform={`rotate(-90 34 ${plot.y + plot.height / 2})`}
            fontSize={fs(22)}
            fontWeight={700}
            fill={INK}
          >
            {settings.valueAxisTitle}
          </text>
        ) : null}
        {settings.categoryAxisTitle ? (
          <text
            x={plot.x + plot.width / 2}
            y={frame.height - 20}
            textAnchor="middle"
            fontSize={fs(22)}
            fontWeight={700}
            fill={INK}
          >
            {settings.categoryAxisTitle}
          </text>
        ) : null}
        <g fill={INK} fontWeight={600}>
          {current.bars.map((bar, index) => (
            <text
              key={bar.cat}
              x={bandCenter(frame, index)}
              y={bottom + 52}
              textAnchor="middle"
              fontSize={labelSize(bandSpan, bar.cat, 30, Math.min(fs(20), 40))}
            >
              {bar.cat}
            </text>
          ))}
        </g>
        {current.bars.map((bar, index) => {
          const rect = barRect(frame, index, bar.units);
          return (
            <g key={bar.cat} role="img" aria-label={S.distortion.bar(bar.cat)} data-cat={bar.cat}>
              {rect.width > 0 && rect.height > 0 ? (
                <rect
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  fill="url(#distortion-hatch)"
                  stroke={BLUE}
                  strokeWidth={3}
                  data-testid="distortion-bar"
                  data-cat={bar.cat}
                />
              ) : null}
            </g>
          );
        })}
      </g>
    );
  };

  const renderCircle = (current: DistortionExample) => {
    const frame = { ...bandFrameOf(false, false), pie: PIE };
    const path = bandCirclePath(
      current.categories.map((cat) => ({ cat, cells: current.data[cat] ?? 0 })),
      100,
      frame,
    );
    return (
      <g>
        {path.slices.map((slice) =>
          slice.d === '' ? null : (
            <path
              key={slice.cat}
              d={slice.d}
              fill={sliceColor(slice.index)}
              stroke="#ffffff"
              strokeWidth={3}
              role="img"
              aria-label={S.distortion.slice(slice.cat, slice.cells)}
              data-testid="distortion-slice"
              data-cat={slice.cat}
            />
          ),
        )}
        <path d={path.frameD} fill="none" stroke={INK} strokeWidth={3} />
        {path.slices.map((slice) =>
          slice.cells >= MIN_LABEL_CELLS ? (
            <text
              key={`label-${slice.cat}`}
              x={slice.label.x}
              y={slice.label.y}
              textAnchor="middle"
              fontSize={fs(20)}
              fontWeight={700}
              fill="#ffffff"
              stroke={INK}
              strokeWidth={4}
              paintOrder="stroke"
              pointerEvents="none"
            >
              {S.distortion.slice(slice.cat, slice.cells)}
            </text>
          ) : null,
        )}
      </g>
    );
  };

  return (
    <svg
      ref={svgRef}
      className={styles.canvasSvg}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      role="group"
      aria-label={circle ? S.distortion.circleBoard : S.distortion.board}
      data-testid="graph-canvas"
      data-graph-type={circle ? 'circle' : 'bar'}
      data-example={example === null ? undefined : example.id}
    >
      <defs>
        <pattern
          id="distortion-hatch"
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="12" height="12" fill="#c9dafc" />
          <line x1="0" y1="0" x2="0" y2="12" stroke={BLUE} strokeWidth="4" />
        </pattern>
      </defs>
      <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
      {renderTitle()}
      {scene !== null ? renderBars(scene) : example !== null ? renderCircle(example) : null}
    </svg>
  );
}
