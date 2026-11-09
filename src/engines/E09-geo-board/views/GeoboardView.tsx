/**
 * E09 geoboard 모드: 못판에 고무줄을 걸어 도형을 만든다.
 *
 * - 못에서 못으로 끌면 `start-band` + `add-peg`가 된다.
 * - 방향키로 못 커서를 옮기고 Enter로 잇거나 닫는다.
 * - 꼭짓점·변 수는 `showCounts: 'always'`일 때만 쓴다. 도형 이름은 쓰지 않는다.
 */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { clamp, minTouchRadius, pointerToLogical, useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps } from '../../../core/engine-sdk';
import { gp, isSimplePolygon, simplifyPolygon } from '../../../core/math';
import { allPegs, boardRect, pegPoint, snapPeg } from '../layout';
import { findBand } from '../reduce';
import { geoBoardStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoAction, GeoBand, GeoConfig, GeoboardState, Peg } from '../types';
import styles from '../View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const PAPER = '#fbfaf6';
const INK = '#1d2330';
const GRID = '#c9d2e2';
const ORANGE = '#e8872e';

const BAND_PALETTE = [
  { stroke: '#2f6fde', width: 5, dash: undefined, fill: '#2f6fde' },
  { stroke: '#c2410c', width: 4, dash: '12 6', fill: '#c2410c' },
  { stroke: '#2f9e6b', width: 4, dash: '2 7', fill: '#2f9e6b' },
  { stroke: '#7c3aed', width: 6, dash: '16 4 4 4', fill: '#7c3aed' },
] as const;

type GeoViewProps = EngineViewProps<GeoConfig, GeoboardState, GeoAction>;

function pointsString(points: readonly { readonly x: number; readonly y: number }[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

function bandStyle(index: number, colored: boolean) {
  const palette = BAND_PALETTE[index % BAND_PALETTE.length] ?? BAND_PALETTE[0];
  if (!colored) {
    return {
      stroke: INK,
      width: palette.width,
      dash: palette.dash,
      fill: INK,
    };
  }
  return palette;
}

function simplifiedCount(band: GeoBand): number {
  if (!band.closed) return 0;
  return simplifyPolygon(band.pegs.map((peg) => gp(peg[0], peg[1]))).length;
}

export function GeoboardView({ state, dispatch, cpa, readOnly = false, targetSize }: GeoViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const hitRadius = Math.max(14, Math.ceil(minTouchRadius(targetSize, rendered, LOGICAL)));
  const [cols, rows] = state.settings.grid;
  const rect = boardRect(cols, rows);
  const [cursor, setCursor] = useState<Peg>([0, 0]);
  const [focused, setFocused] = useState(false);
  const [vertex, setVertex] = useState<{ readonly band: string; readonly index: number } | null>(
    null,
  );
  const dragRef = useRef<{
    readonly pointerId: number;
    readonly start: Peg;
    readonly vertex: { readonly band: string; readonly index: number } | null;
  } | null>(null);

  const active = findBand(state, state.activeBand);
  const colored = cpa === 'C';

  const vertexAt = (peg: Peg): { readonly band: string; readonly index: number } | null => {
    for (const band of state.bands) {
      if (!band.closed) continue;
      const index = band.pegs.findIndex(
        (candidate) => candidate[0] === peg[0] && candidate[1] === peg[1],
      );
      if (index >= 0) return { band: band.id, index };
    }
    return null;
  };

  const pressPeg = (peg: Peg) => {
    if (readOnly) return;
    if (active === null) {
      dispatch({ type: 'start-band', peg });
      return;
    }
    const first = active.pegs[0];
    if (first && active.pegs.length >= 3 && first[0] === peg[0] && first[1] === peg[1]) {
      dispatch({ type: 'close-band' });
      return;
    }
    dispatch({ type: 'add-peg', peg });
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    const peg = snapPeg(rect, point, hitRadius);
    if (!peg) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 포인터가 이미 끝났거나 jsdom처럼 캡처를 지원하지 않는 환경.
    }
    const found = vertexAt(peg);
    dragRef.current = { pointerId: event.pointerId, start: peg, vertex: found };
    if (found === null) pressPeg(peg);
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || readOnly || drag.pointerId !== event.pointerId) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    const peg = snapPeg(rect, point, hitRadius) ?? drag.start;
    if (drag.vertex !== null) {
      if (peg[0] === drag.start[0] && peg[1] === drag.start[1]) return;
      dispatch({
        type: 'move-peg',
        band: drag.vertex.band,
        index: drag.vertex.index,
        peg,
      });
      return;
    }
    if (peg[0] === drag.start[0] && peg[1] === drag.start[1]) return;
    dispatch({ type: 'add-peg', peg });
  };

  const onCanvasKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const key = event.key;
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      const next: Peg = [
        key === 'ArrowLeft'
          ? clamp(cursor[0] - 1, 0, cols - 1)
          : key === 'ArrowRight'
            ? clamp(cursor[0] + 1, 0, cols - 1)
            : cursor[0],
        key === 'ArrowUp'
          ? clamp(cursor[1] - 1, 0, rows - 1)
          : key === 'ArrowDown'
            ? clamp(cursor[1] + 1, 0, rows - 1)
            : cursor[1],
      ];
      setCursor(next);
      return;
    }
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      pressPeg(cursor);
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      dispatch({ type: 'undo-peg' });
      return;
    }
    if (key === 'Delete') {
      event.preventDefault();
      if (state.activeBand !== null) dispatch({ type: 'delete-band', id: state.activeBand });
    }
  };

  const onBandKeyDown = (event: ReactKeyboardEvent<SVGGElement>, band: GeoBand) => {
    if (readOnly) return;
    const key = event.key;
    if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault();
      dispatch({ type: 'delete-band', id: band.id });
      return;
    }
    if (/^[1-9]$/.test(key)) {
      event.preventDefault();
      const index = Number(key) - 1;
      if (index < band.pegs.length) setVertex({ band: band.id, index });
      return;
    }
    if (vertex === null || vertex.band !== band.id) return;
    const peg = band.pegs[vertex.index];
    if (!peg) return;
    let next: Peg | null = null;
    if (key === 'ArrowUp') next = [peg[0], clamp(peg[1] - 1, 0, rows - 1)];
    if (key === 'ArrowDown') next = [peg[0], clamp(peg[1] + 1, 0, rows - 1)];
    if (key === 'ArrowLeft') next = [clamp(peg[0] - 1, 0, cols - 1), peg[1]];
    if (key === 'ArrowRight') next = [clamp(peg[0] + 1, 0, cols - 1), peg[1]];
    if (next) {
      event.preventDefault();
      dispatch({ type: 'move-peg', band: band.id, index: vertex.index, peg: next });
    }
  };

  const invalid = state.bands.some((band) => {
    if (!band.closed) return false;
    return !isSimplePolygon(band.pegs.map((peg) => gp(peg[0], peg[1])));
  });

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar}>
        <span className={styles.group}>
          <span className={styles.groupLabel}>{S.gridLabel}</span>
          <span data-testid="geo-grid">{S.gridValue(cols, rows)}</span>
        </span>
        <button
          type="button"
          className={styles.button}
          onClick={() => dispatch({ type: 'close-band' })}
          disabled={readOnly || active === null || active.pegs.length < 3}
        >
          {S.closeBand}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => dispatch({ type: 'undo-peg' })}
          disabled={readOnly || active === null}
        >
          {S.undoPeg}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            if (state.activeBand !== null) dispatch({ type: 'delete-band', id: state.activeBand });
          }}
          disabled={readOnly || state.activeBand === null}
        >
          {S.deleteBand}
        </button>
        {state.bands.length > 0 ? (
          <span className={styles.badge}>{S.bandsCount(state.bands.length)}</span>
        ) : null}
        <span className={styles.hint}>{S.canvasHint}</span>
      </div>

      <p className={styles.instructions}>{S.instructions.geoboard}</p>
      <p className={styles.status} role="status" data-testid="geo-status">
        {invalid ? S.overlap : ''}
      </p>

      <div className={styles.canvasArea}>
        <svg
          ref={svgRef}
          className={styles.canvas}
          viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
          role="group"
          aria-label={S.canvasLabel.geoboard}
          tabIndex={readOnly ? -1 : 0}
          data-testid="geo-canvas"
          data-cpa={cpa}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onCanvasKeyDown}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
          <g stroke={GRID} strokeWidth={1} strokeOpacity={0.5} pointerEvents="none">
            {Array.from({ length: rows }, (_, row) => (
              <line
                key={`h-${row}`}
                x1={rect.x}
                y1={pegPoint(rect, [0, row]).y}
                x2={rect.x + rect.width}
                y2={pegPoint(rect, [0, row]).y}
              />
            ))}
            {Array.from({ length: cols }, (_, col) => (
              <line
                key={`v-${col}`}
                x1={pegPoint(rect, [col, 0]).x}
                y1={rect.y}
                x2={pegPoint(rect, [col, 0]).x}
                y2={rect.y + rect.height}
              />
            ))}
          </g>

          {state.bands.map((band, index) => {
            const style = bandStyle(index, colored);
            const points = band.pegs.map((peg) => pegPoint(rect, peg));
            const label = S.bandLabel(index + 1);
            return (
              <g
                key={band.id}
                role="button"
                tabIndex={readOnly ? -1 : 0}
                aria-label={label}
                data-band={band.id}
                data-closed={band.closed ? 'true' : 'false'}
                onKeyDown={(event) => onBandKeyDown(event, band)}
              >
                {band.closed ? (
                  <polygon
                    points={pointsString(points)}
                    fill={colored ? style.fill : 'none'}
                    fillOpacity={colored ? 0.1 : 0}
                    stroke={style.stroke}
                    strokeWidth={style.width}
                    strokeDasharray={style.dash}
                    strokeLinejoin="round"
                    pointerEvents="none"
                  />
                ) : (
                  <polyline
                    points={pointsString(points)}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth={style.width}
                    strokeDasharray={style.dash}
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                )}
                {band.pegs.map((peg, pegIndex) => {
                  const point = pegPoint(rect, peg);
                  const chosen =
                    vertex !== null && vertex.band === band.id && vertex.index === pegIndex;
                  return (
                    <g key={`${band.id}-${pegIndex}`} pointerEvents="none">
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={chosen ? 13 : 8}
                        fill={band.closed ? style.stroke : PAPER}
                        stroke={style.stroke}
                        strokeWidth={chosen ? 4 : 3}
                      />
                      {chosen ? (
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={20}
                          fill="none"
                          stroke={ORANGE}
                          strokeWidth={2}
                          strokeDasharray="5 4"
                        />
                      ) : null}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {allPegs(rect).map((peg) => {
            const point = pegPoint(rect, peg);
            return (
              <circle
                key={`peg-${peg[0]}-${peg[1]}`}
                cx={point.x}
                cy={point.y}
                r={Math.max(3, Math.min(6, rect.spacing * 0.055))}
                fill={INK}
                pointerEvents="none"
              />
            );
          })}

          {state.settings.showCounts === 'always'
            ? state.bands.map((band, index) => {
                if (!band.closed) return null;
                const count = simplifiedCount(band);
                if (count < 3) return null;
                const points = band.pegs.map((peg) => pegPoint(rect, peg));
                const center = points.reduce(
                  (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
                  { x: 0, y: 0 },
                );
                const x = center.x / points.length;
                const y = center.y / points.length;
                const label = S.count(count, count);
                return (
                  <g key={`count-${band.id}`} pointerEvents="none">
                    <rect
                      x={x - 92}
                      y={y - 20}
                      width={184}
                      height={36}
                      rx={10}
                      fill="#ffffff"
                      fillOpacity={0.92}
                      stroke={bandStyle(index, colored).stroke}
                    />
                    <text
                      x={x}
                      y={y + 4}
                      textAnchor="middle"
                      fontSize={17}
                      fontWeight={700}
                      fill={INK}
                      data-counts={band.id}
                    >
                      {label}
                    </text>
                  </g>
                );
              })
            : null}

          {focused || active !== null ? (
            <circle
              cx={pegPoint(rect, cursor).x}
              cy={pegPoint(rect, cursor).y}
              r={Math.max(16, hitRadius * 0.62)}
              fill="none"
              stroke={ORANGE}
              strokeWidth={2.5}
              strokeDasharray="7 5"
              pointerEvents="none"
              data-testid="geo-cursor"
            />
          ) : null}

          {active && active.pegs.length > 0 ? (
            <text
              x={pegPoint(rect, active.pegs[0] ?? [0, 0]).x}
              y={rect.y - 34}
              textAnchor="middle"
              fontSize={18}
              fontWeight={700}
              fill={INK}
            >
              {S.bandLabel(state.bands.findIndex((band) => band.id === active.id) + 1)}
            </text>
          ) : null}
        </svg>
      </div>

      <p className={styles.hint}>{S.bandHint}</p>
    </div>
  );
}
