/**
 * rule-shooter 모드 화면: 관계식을 쓰고 발사하면 식에 맞는 점에 레이저 점이 떨어지고,
 * 보석이 맞았는지(✓)·빗나갔는지(✕) 드러난다. 빗나간 보석에는 설명 패널이 붙는다.
 * 숨은 규칙은 DOM에 없다. 패널에는 보석의 □(과제 자료)와 학생 식의 □만 쓴다.
 * 판에 안 들어가면 줄이지 않고(보석 지름 24px 이상 유지) 판 안에서 스크롤한다.
 */
import { useRef } from 'react';
import { useRenderedSize } from '../../core/engine-sdk';
import type { EngineViewProps } from '../../core/engine-sdk';
import type { Relation } from '../../core/math';
import { Frame } from './Frame';
import { RelationTable } from './RelationTable';
import { columnsOf, tryParse, visibleMarks } from './relation-check';
import {
  GEM_SIZE,
  gemHits,
  gemsOf,
  laserPoints,
  missInfo,
  pointX,
  pointY,
  shooterLayout,
  tickStep,
} from './shooter';
import type { Gem, LaserPoint } from './shooter';
import { functionStrings as S } from './strings.ko';
import { tableLayout } from './table-layout';
import type { FunctionAction, FunctionConfig, ShooterState } from './types';
import styles from './View.module.css';

type ShooterViewProps = Omit<
  EngineViewProps<FunctionConfig, ShooterState, FunctionAction>,
  'state'
> & { readonly state: ShooterState };

const MAX_SCALE = 2.2;
/** 이 배율 밑으로는 줄이지 않는다(보석 지름 GEM_SIZE × 0.9 ≥ 24px). */
const GRID_MIN_SCALE = 0.9;

/** 판에 맞춘 배율. 최소 배율보다 좁으면 최소 배율로 두고 스크롤한다. */
function fitScale(
  board: { readonly width: number; readonly height: number },
  width: number,
  height: number,
  minScale: number,
  atLeastOne: boolean,
): { scale: number; scroll: boolean } {
  if (board.width <= 0 || board.height <= 0) return { scale: Math.max(1, minScale), scroll: false };
  const fit = Math.min(board.width / width, board.height / height);
  if (fit >= minScale) {
    return { scale: Math.min(MAX_SCALE, atLeastOne ? Math.max(1, fit) : fit), scroll: false };
  }
  return { scale: minScale, scroll: true };
}

/** 보석 모양(다이아몬드 + 윤곽 + 번호). 격자와 패널이 같은 그림을 쓴다. */
function GemShape({ cx, cy, n, faded }: { cx: number; cy: number; n: number; faded: boolean }) {
  const h = GEM_SIZE / 2;
  return (
    <g opacity={faded ? 0.45 : 1}>
      <polygon
        points={`${cx},${cy - h} ${cx + h},${cy} ${cx},${cy + h} ${cx - h},${cy}`}
        fill="#bfe3f5"
        stroke="#1d4f7a"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <text
        x={cx}
        y={cy}
        fontSize={13}
        fontWeight={800}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#10263a"
      >
        {n}
      </text>
    </g>
  );
}

function GemIcon({ n }: { readonly n: number }) {
  const size = GEM_SIZE + 4;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className={styles.gemIcon}
    >
      <GemShape cx={size / 2} cy={size / 2} n={n} faded={false} />
    </svg>
  );
}

interface ShotView {
  readonly rel: Relation;
  readonly hits: boolean[];
  readonly lasers: LaserPoint[];
}

/** 가장 최근 발사의 결과. 식을 고치면(입력이 시험한 식과 달라지면) 없다. */
function shotOf(state: ShooterState, gems: readonly Gem[]): ShotView | null {
  const tested = state.tested;
  if (tested === null || !tested.ok || tested.text !== state.ruleText) return null;
  const parsed = tryParse(tested.text);
  if (!parsed.ok) return null;
  return {
    rel: parsed.rel,
    hits: gemHits(parsed.rel, gems),
    lasers: laserPoints(parsed.rel, state.settings.grid),
  };
}

interface GridProps {
  readonly state: ShooterState;
  readonly gems: readonly Gem[];
  readonly shot: ShotView | null;
  readonly scale: number;
}

function Grid({ state, gems, shot, scale }: GridProps) {
  const layout = shooterLayout(state.settings.grid);
  const { left, top, cellX, cellY, plotW, plotH, xMax, yMax } = layout;
  const stepX = tickStep(cellX * scale);
  const stepY = tickStep(cellY * scale);
  const key = `${state.shots.length}-${state.tested?.text ?? ''}`;
  const count = shot?.lasers.length ?? 0;
  // 레이저 점 전체가 0.5초 안에 차례로 떨어진다(점 하나 0.2초).
  const gap = count > 1 ? 0.5 / (count - 1) : 0;

  return (
    <svg
      data-testid="shooter-canvas"
      className={styles.shooterSvg}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width * scale}
      height={layout.height * scale}
      role="group"
      aria-label={S.shooter.canvasLabel}
    >
      <title>{S.shooter.canvasLabel}</title>
      <rect x={0} y={0} width={layout.width} height={layout.height} fill="#fbfaf6" />
      {Array.from({ length: xMax + 1 }, (_, n) => (
        <line
          key={`gx-${n}`}
          x1={left + n * cellX}
          y1={top}
          x2={left + n * cellX}
          y2={top + plotH}
          stroke={n === 0 ? '#3d485c' : '#d7deea'}
          strokeWidth={n === 0 ? 3 : 1}
        />
      ))}
      {Array.from({ length: yMax + 1 }, (_, n) => (
        <line
          key={`gy-${n}`}
          x1={left}
          y1={top + (yMax - n) * cellY}
          x2={left + plotW}
          y2={top + (yMax - n) * cellY}
          stroke={n === 0 ? '#3d485c' : '#d7deea'}
          strokeWidth={n === 0 ? 3 : 1}
        />
      ))}
      {Array.from({ length: xMax + 1 }, (_, n) =>
        n % stepX === 0 ? (
          <text
            key={`tx-${n}`}
            x={left + n * cellX}
            y={top + plotH + 18}
            fontSize={13}
            fontWeight={600}
            textAnchor="middle"
            fill="#3d485c"
          >
            {n}
          </text>
        ) : null,
      )}
      {Array.from({ length: yMax + 1 }, (_, n) =>
        n % stepY === 0 ? (
          <text
            key={`ty-${n}`}
            x={left - 8}
            y={top + (yMax - n) * cellY}
            fontSize={13}
            fontWeight={600}
            textAnchor="end"
            dominantBaseline="central"
            fill="#3d485c"
          >
            {n}
          </text>
        ) : null,
      )}
      <text
        x={left + plotW / 2}
        y={layout.height - 8}
        fontSize={20}
        fontWeight={800}
        textAnchor="middle"
        fill="#1d2330"
        data-testid="shooter-axis-x"
      >
        {S.shooter.axisX}
      </text>
      <text
        x={left}
        y={16}
        fontSize={20}
        fontWeight={800}
        textAnchor="middle"
        fill="#1d2330"
        data-testid="shooter-axis-y"
      >
        {S.shooter.axisY}
      </text>

      {shot === null ? null : (
        <g key={key} data-testid="shooter-lasers">
          {shot.lasers.map((point, index) => {
            const cx = pointX(layout, point.x);
            const cy = pointY(layout, point.y);
            return (
              <g
                key={point.x.toString()}
                className={styles.laser}
                style={{ animationDelay: `${(index * gap).toFixed(3)}s` }}
                data-laser={point.x.toString()}
                role="img"
                aria-label={S.shooter.laserLabel(point.x.toString(), point.y.toString())}
              >
                <circle cx={cx} cy={cy} r={6} fill="#fff4e0" stroke="#c0731a" strokeWidth={3} />
                <path
                  d={`M${cx - 10} ${cy} L${cx + 10} ${cy} M${cx} ${cy - 10} L${cx} ${cy + 10}`}
                  stroke="#c0731a"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </g>
      )}

      {gems.map((gem, index) => {
        const cx = pointX(layout, gem.x);
        const cy = pointY(layout, gem.y);
        const hit = shot === null ? null : (shot.hits[index] ?? false);
        const bx = cx + GEM_SIZE / 2;
        const by = cy - GEM_SIZE / 2;
        return (
          <g
            key={index}
            data-gem={index}
            data-hit={hit === null ? undefined : String(hit)}
            role="img"
            aria-label={S.shooter.gemLabel(index + 1, gem.x.toString(), gem.y.toString())}
          >
            <GemShape cx={cx} cy={cy} n={index + 1} faded={hit === true} />
            {hit === true ? (
              <g data-badge="hit" aria-label={S.shooter.hitBadge}>
                <circle cx={bx} cy={by} r={11} fill="#dff3e4" stroke="#2e7d46" strokeWidth={3} />
                <path
                  d={`M${bx - 5} ${by} L${bx - 1} ${by + 5} L${bx + 6} ${by - 5}`}
                  fill="none"
                  stroke="#2e7d46"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ) : null}
            {hit === false ? (
              <g data-badge="miss" aria-label={S.shooter.missBadge}>
                <rect
                  x={bx - 11}
                  y={by - 11}
                  width={22}
                  height={22}
                  rx={4}
                  fill="#fde4e4"
                  stroke="#c0392b"
                  strokeWidth={3}
                />
                <path
                  d={`M${bx - 5} ${by - 5} L${bx + 5} ${by + 5} M${bx + 5} ${by - 5} L${bx - 5} ${by + 5}`}
                  stroke="#c0392b"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                />
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function MissPanel({ gems, shot }: { readonly gems: readonly Gem[]; readonly shot: ShotView }) {
  const misses = gems.flatMap((_, index) => (shot.hits[index] === false ? [index] : []));
  if (misses.length === 0) return null;
  return (
    <ul className={styles.missPanel} aria-label={S.shooter.missPanelLabel} data-testid="miss-panel">
      {misses.map((index) => {
        const gem = gems[index] as Gem;
        const info = missInfo(shot.rel, gem);
        return (
          <li key={index} className={styles.missRow} data-miss={index}>
            <GemIcon n={index + 1} />
            <span>
              {info.ruleY === null
                ? S.shooter.missNone(info.x.toString())
                : S.shooter.missLine(info.x.toString(), info.ruleY.toString())}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ShooterView({ state, dispatch, targetSize, readOnly = false }: ShooterViewProps) {
  const { settings } = state;
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useRenderedSize(boardRef);
  const gems = gemsOf(settings);
  const shot = shotOf(state, gems);
  const columns = columnsOf(state);
  const isGrid = settings.look === 'grid';

  let fitted: { scale: number; scroll: boolean };
  if (isGrid) {
    const layout = shooterLayout(settings.grid);
    fitted = fitScale(board, layout.width, layout.height, GRID_MIN_SCALE, false);
  } else {
    const layout = tableLayout(columns.length, settings.xLabel, settings.yLabel);
    const minScale = targetSize / Math.min(layout.cellW, layout.cellH);
    fitted = fitScale(board, layout.width, layout.height, minScale, true);
  }

  const hitCount = shot === null ? 0 : shot.hits.filter(Boolean).length;
  const summary = shot === null ? '' : S.shooter.summary(hitCount, gems.length);

  const side = (
    <>
      <p
        className={styles.status}
        role="status"
        data-testid="shooter-summary"
        data-all-hit={shot !== null && hitCount === gems.length ? 'true' : undefined}
      >
        {summary}
      </p>
      {settings.missPanel && shot !== null ? <MissPanel gems={gems} shot={shot} /> : null}
    </>
  );

  return (
    <Frame
      state={state}
      dispatch={dispatch}
      targetSize={targetSize}
      readOnly={readOnly}
      instruction={isGrid ? S.shooter.instructions : S.shooter.tableInstructions}
      boardRef={boardRef}
      boardScroll={fitted.scroll}
      boardTall
      board={
        isGrid ? (
          <Grid state={state} gems={gems} shot={shot} scale={fitted.scale} />
        ) : (
          <RelationTable
            columns={columns}
            xLabel={settings.xLabel}
            yLabel={settings.yLabel}
            active={null}
            highlight={null}
            holds={visibleMarks(state, columns)}
            readOnly={readOnly}
            scale={fitted.scale}
            onActivate={() => undefined}
          />
        )
      }
      side={side}
      status={summary}
      exprOps={settings.allowedOps}
      testLabel={S.shooter.fire}
    />
  );
}
