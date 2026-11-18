/**
 * E18 그림그래프 판: SVG 한 장(`data-testid="graph-canvas"`) + 행마다 HTML 조작 단추.
 *
 * - 학생이 만드는 그림그래프(`interactive`)에는 말풍선도 맞음 표시도 없다.
 * - 그림을 놓은 칸은 `targetSize` px 이상이다. SVG 논리 좌표는 화면 px와 같고(가로폭 = 그래프 영역 폭),
 *   한 줄에 다 안 들어가면 그림을 겹치지 않고 다음 줄로 접는다(가로 스크롤 없음). 세로가 길면 판이 스크롤한다.
 * - 묶기: 올가미(`useLasso`)로 한 행의 작은 그림을 정확히 `legendBig`개 둘러싸거나 "묶기" 단추.
 * - 펼치기: 큰 그림에서 Enter/Space 또는 "펼치기" 단추. 놓인 그림을 누르면(작은 그림) 하나 뺀다.
 *   올가미가 포인터를 잡으면 `click`이 SVG로 가므로, 누르기는 올가미의 탭으로 받아 그림 위치를 직접 찾는다.
 */
import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { pointerToLogical, useLasso, useRenderedSize } from '../../core/engine-sdk';
import type { TargetSize } from '../../core/engine-sdk';
import { PictoIcon } from './icons';
import { ICON_GAP, iconAt, lassoOutcome, pictoLayout } from './picto-layout';
import type { PictoItem } from './picto-layout';
import { rowValueOf } from './reduce';
import { graphStrings as S } from './strings.ko';
import type { GraphAction, GraphSettings, PictographRow } from './types';
import styles from './View.module.css';

const INK = '#1d2330';
const GRID = '#d3dbe9';
const BLUE = '#1d4fa8';
const PAPER = '#fbfaf6';
const ORANGE = '#e8872e';
const FALLBACK_WIDTH = 480;

interface PictographBoardProps {
  readonly settings: GraphSettings;
  readonly rows: Readonly<Record<string, PictographRow>>;
  readonly legendBig: number;
  /** 학생이 그림을 놓고 묶는 중인가(`pictograph` 모드 + 학생이 만들기 + 조작 가능). */
  readonly interactive: boolean;
  readonly dispatch: (action: GraphAction) => void;
  readonly targetSize: TargetSize;
  /** 행 값 말풍선을 보일 수 있는 설정인가(학생이 만드는 그림그래프는 늘 false). */
  readonly tooltipsOn: boolean;
}

function labelSize(span: number, text: string): number {
  return Math.max(14, Math.min(26, (span - 12) / Math.max(1, [...text].length)));
}

export function PictographBoard({
  settings,
  rows,
  legendBig,
  interactive,
  dispatch,
  targetSize,
  tooltipsOn,
}: PictographBoardProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const measured = useRenderedSize(hostRef);
  const width = Math.max(240, Math.floor(measured.width) || FALLBACK_WIDTH);
  const layout = useMemo(
    () => pictoLayout(settings.categories, rows, width, targetSize),
    [settings.categories, rows, width, targetSize],
  );
  const size = { width: layout.width, height: layout.height };
  const [pickedBig, setPickedBig] = useState<string | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [miss, setMiss] = useState<'empty' | 'rows' | 'count' | null>(null);
  const unit = settings.valueLabel;

  const lasso = useLasso({
    getPoint: (event) => pointerToLogical(event, svgRef.current, size),
    disabled: !interactive,
    onGesture: ({ points, isTap }) => {
      if (isTap) {
        const point = points[0];
        const hit = point ? iconAt(layout, point) : null;
        setMiss(null);
        if (!hit) {
          setPickedBig(null);
          return;
        }
        if (hit.kind === 'small') {
          dispatch({ type: 'remove-small', cat: hit.cat });
        } else {
          setPickedBig((current) => (current === hit.cat ? null : hit.cat));
        }
        return;
      }
      const outcome = lassoOutcome(layout, points, legendBig);
      if (outcome.type === 'compress') {
        setMiss(null);
        setPickedBig(null);
        dispatch({ type: 'compress', cat: outcome.cat });
      } else {
        setMiss(outcome.reason);
      }
    },
  });

  const activate = (event: ReactKeyboardEvent, run: () => void) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    run();
  };

  const onItemKey = (event: ReactKeyboardEvent<SVGGElement>, cat: string, item: PictoItem) => {
    if (!interactive) {
      activate(event, () => setTip((current) => (current === cat ? null : cat)));
      return;
    }
    const remove = event.key === 'Delete' || event.key === 'Backspace';
    if (item.kind === 'small') {
      if (remove) {
        event.preventDefault();
        dispatch({ type: 'remove-small', cat });
      } else {
        activate(event, () => dispatch({ type: 'remove-small', cat }));
      }
    } else if (remove) {
      event.preventDefault();
      dispatch({ type: 'remove-big', cat });
    } else {
      activate(event, () => dispatch({ type: 'expand', cat }));
    }
  };

  const renderTooltip = (cat: string, top: number, height: number, value: number) => {
    if (!tooltipsOn || tip !== cat) return null;
    const text = S.pictograph.tooltip(cat, value, unit);
    const boxWidth = Math.max(120, [...text].length * 17 + 24);
    const x = Math.max(8, layout.width - boxWidth - 8);
    const y = top + Math.max(2, (height - 40) / 2);
    return (
      <g key={`tip-${cat}`} data-testid="graph-tooltip" data-cat={cat} pointerEvents="none">
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

  const half = ICON_GAP / 2;
  return (
    <div className={styles.pictoBox} data-testid="pictograph-board">
      {interactive ? (
        <p
          className={styles.pictoHint}
          data-testid="pictograph-hint"
          data-miss={miss ?? undefined}
          role="status"
        >
          {S.pictograph.lassoHint(legendBig)}
        </p>
      ) : null}

      <div ref={hostRef} className={styles.pictoHost}>
        <svg
          ref={svgRef}
          className={styles.pictoSvg}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          role="group"
          aria-label={S.pictograph.board}
          data-testid="graph-canvas"
          data-graph-type="pictograph"
          data-logical-width={layout.width}
          data-logical-height={layout.height}
          data-icon-side={layout.icon}
          data-legend-big={legendBig}
          {...(interactive ? lasso.handlers : {})}
        >
          <rect width={layout.width} height={layout.height} fill={PAPER} />
          {layout.rows.map((row) => {
            const data = rows[row.cat] ?? { big: 0, small: 0 };
            const lastSmall = data.small - 1;
            return (
              <g key={row.cat} data-row={row.cat}>
                <line
                  x1={0}
                  x2={layout.width}
                  y1={row.top + row.height}
                  y2={row.top + row.height}
                  stroke={GRID}
                  strokeWidth={1.5}
                />
                <text
                  x={layout.labelWidth / 2}
                  y={row.top + row.height / 2 + labelSize(layout.labelWidth, row.cat) / 3}
                  textAnchor="middle"
                  fontSize={labelSize(layout.labelWidth, row.cat)}
                  fontWeight={700}
                  fill={INK}
                >
                  {row.cat}
                </text>
                {row.items.map((item) => {
                  const key = `${item.kind}-${item.index}`;
                  const focusable =
                    interactive && (item.kind === 'big' || item.index === lastSmall);
                  const press =
                    !interactive && tooltipsOn
                      ? () => setTip((current) => (current === row.cat ? null : row.cat))
                      : undefined;
                  const label =
                    item.kind === 'big'
                      ? S.pictograph.bigIcon(row.cat, item.index)
                      : S.pictograph.smallIcon(row.cat, item.index);
                  const isPicked = item.kind === 'big' && pickedBig === row.cat;
                  return (
                    <g
                      key={key}
                      role={focusable || press ? 'button' : 'img'}
                      tabIndex={focusable || press ? 0 : undefined}
                      aria-label={label}
                      aria-pressed={item.kind === 'big' && interactive ? isPicked : undefined}
                      data-cat={row.cat}
                      data-kind={item.kind}
                      data-index={item.index}
                      data-picked={isPicked ? 'true' : undefined}
                      onClick={press}
                      onKeyDown={
                        focusable || press ? (event) => onItemKey(event, row.cat, item) : undefined
                      }
                    >
                      <rect
                        data-hit="true"
                        x={item.x - half}
                        y={item.y - half}
                        width={item.side + ICON_GAP}
                        height={item.side + ICON_GAP}
                        fill="transparent"
                      />
                      <PictoIcon
                        kind={settings.icon}
                        x={item.x}
                        y={item.y}
                        side={item.side}
                        big={item.kind === 'big'}
                      />
                      {isPicked ? (
                        <rect
                          x={item.x - 3}
                          y={item.y - 3}
                          width={item.side + 6}
                          height={item.side + 6}
                          rx={8}
                          fill="none"
                          stroke={ORANGE}
                          strokeWidth={4}
                          pointerEvents="none"
                        />
                      ) : null}
                    </g>
                  );
                })}
              </g>
            );
          })}
          {layout.rows.map((row) =>
            renderTooltip(
              row.cat,
              row.top,
              row.height,
              rowValueOf(rows[row.cat] ?? { big: 0, small: 0 }, legendBig),
            ),
          )}
          {lasso.active && lasso.path.length > 1 ? (
            <polyline
              points={lasso.path.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="rgba(47, 111, 222, 0.12)"
              stroke={BLUE}
              strokeWidth={3}
              strokeDasharray="8 6"
              pointerEvents="none"
            />
          ) : null}
        </svg>
      </div>

      {interactive ? (
        <div className={styles.pictoControls} data-testid="pictograph-controls">
          {settings.categories.map((cat) => {
            const row = rows[cat] ?? { big: 0, small: 0 };
            return (
              <div
                key={cat}
                className={styles.pictoControlRow}
                role="group"
                aria-label={S.pictograph.controlsGroup(cat)}
                data-cat={cat}
              >
                <span className={styles.pictoControlName}>{cat}</span>
                <button
                  type="button"
                  className={styles.button}
                  data-action="add-small"
                  aria-label={S.pictograph.addSmallLabel(cat)}
                  onClick={() => dispatch({ type: 'add-small', cat })}
                >
                  {S.pictograph.addSmall}
                </button>
                <button
                  type="button"
                  className={styles.button}
                  data-action="compress"
                  aria-label={S.pictograph.compressLabel(cat, legendBig)}
                  disabled={row.small < legendBig}
                  onClick={() => dispatch({ type: 'compress', cat })}
                >
                  {S.pictograph.compress}
                </button>
                <button
                  type="button"
                  className={styles.button}
                  data-action="expand"
                  data-picked={pickedBig === cat ? 'true' : undefined}
                  aria-label={S.pictograph.expandLabel(cat)}
                  disabled={row.big < 1}
                  onClick={() => dispatch({ type: 'expand', cat })}
                >
                  {S.pictograph.expand}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
