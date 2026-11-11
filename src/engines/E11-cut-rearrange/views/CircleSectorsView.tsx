/**
 * circle-sectors 화면.
 *
 * - 손 단계: 원에서 부채꼴을 끌어 줄 칸에 놓는다. 두 번 탭하면 들고 있는
 *   방향(arcUp)이 바뀐다. 키보드는 Enter(집기) → ←/→(칸) → R(방향) →
 *   Enter(놓기), Delete(치우기), Esc(취소)다.
 * - 자동 단계: "자동으로 붙이기"로 줄 전체를 배열한다.
 * - 표시선은 `showDimensions`가 켜졌을 때만 그린다. 원주·넓이 값은 쓰지 않는다.
 */
import { useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { pointerToLogical, useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import {
  circleSectorPath,
  CIRCLE_CENTER,
  CIRCLE_RADIUS,
  dimensionText,
  nearestSlot,
  rowRight,
  rowScale,
  rowScreenRight,
  rowScreenTop,
  rowUnscale,
  sectorAngleHit,
  sectorArrivalOffset,
  SLOT_BASELINE,
  SLOT_X0,
  slotSectorPath,
} from '../circle-sectors/layout';
import { arranged, currentDivisions, isManual } from '../circle-sectors/reduce';
import type { CircleSectorsState } from '../circle-sectors/types';
import { cutStrings as S } from '../strings.ko';
import type { CutAction, CutConfig } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';

const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const PAPER = '#fbfaf6';
const INK = '#1d2330';
const TAP_MS = 350;
const SECTOR_COLORS = [
  '#2f6fde',
  '#c2410c',
  '#2f9e6b',
  '#7c3aed',
  '#b08900',
  '#0e7490',
  '#be185d',
] as const;

type CircleViewProps = EngineViewProps<CutConfig, CircleSectorsState, CutAction>;

interface Held {
  readonly sector: number;
  readonly slot: number;
  readonly arcUp: boolean;
}

type Drag = {
  readonly pointerId: number;
  readonly sector: number;
  readonly start: Point;
  readonly arcUp: boolean;
} | null;

function colorOf(index: number): string {
  return SECTOR_COLORS[index % SECTOR_COLORS.length] ?? SECTOR_COLORS[0];
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function CircleSectorsView({
  state,
  dispatch,
  cpa,
  readOnly = false,
  targetSize,
}: CircleViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  useRenderedSize(svgRef);
  const colored = cpa !== 'P';

  const n = currentDivisions(state);
  const manual = isManual(state);
  const done = arranged(state);
  const placedCount = state.slots.filter((slot) => slot !== null).length;

  const [held, setHeld] = useState<Held | null>(null);
  const [status, setStatus] = useState('');
  const [orientations, setOrientations] = useState<Readonly<Record<number, boolean>>>({});
  const dragRef = useRef<Drag>(null);
  const lastTap = useRef<{ readonly sector: number; readonly at: number } | null>(null);

  const placedAt = new Map<number, number>();
  state.slots.forEach((slot, index) => {
    if (slot) placedAt.set(slot.sector, index);
  });

  const scale = rowScale(n);
  const rowTransform = `translate(${SLOT_X0} ${SLOT_BASELINE}) scale(${scale.toFixed(4)}) translate(${-SLOT_X0} ${-SLOT_BASELINE})`;
  // 자동 배열은 원 자리에서 줄 자리로 1초 동안 옮겨 간다. 줄인 움직임이면 바로 놓는다.
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const rowAnimated = !manual && state.autoArranged && !reducedMotion;
  const showDimensions =
    state.settings.showDimensions !== 'off' && (manual ? placedCount > 0 : state.autoArranged);
  const labels = dimensionText(state.settings.showDimensions === 'named');

  const place = (sector: number, slot: number, arcUp: boolean): void => {
    dispatch({ type: 'place-sector', sector, slot, arcUp });
    setStatus('');
  };

  const placeHeld = (): void => {
    if (!held) return;
    place(held.sector, held.slot, held.arcUp);
    setHeld(null);
  };

  const changeLevel = (level: number): void => {
    if (readOnly) return;
    setHeld(null);
    setStatus('');
    dispatch({ type: 'set-level', level });
  };

  const onSectorKeyDown = (event: ReactKeyboardEvent<SVGPathElement>, sector: number): void => {
    if (readOnly) return;
    const key = event.key;
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      event.stopPropagation();
      if (held) {
        placeHeld();
        return;
      }
      if (!manual) return;
      const existing = placedAt.get(sector);
      const slot = existing ?? 0;
      const arcUp =
        existing !== undefined
          ? (state.slots[existing]?.arcUp ?? true)
          : (orientations[sector] ?? true);
      setHeld({ sector, slot, arcUp });
      return;
    }
    if (key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setHeld(null);
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      dispatch({ type: 'unplace-sector', sector: held?.sector ?? sector });
      setHeld(null);
      setStatus('');
      return;
    }
    if (!held) return;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      const delta = key === 'ArrowLeft' ? -1 : 1;
      const slot = Math.max(0, Math.min(n - 1, held.slot + delta));
      setHeld({ ...held, slot });
      return;
    }
    if (key === 'r' || key === 'R') {
      event.preventDefault();
      event.stopPropagation();
      setHeld({ ...held, arcUp: !held.arcUp });
    }
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly || !manual) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    const sector = sectorAngleHit(point, n);
    if (sector === null || placedAt.has(sector)) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom·이미 끝난 포인터.
    }
    dragRef.current = {
      pointerId: event.pointerId,
      sector,
      start: point,
      arcUp: orientations[sector] ?? true,
    };
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || readOnly || drag.pointerId !== event.pointerId) return;
    const point = pointerToLogical(event, svgRef.current, LOGICAL);
    const moved = distance(point, drag.start) > 8;

    if (moved) {
      const slot = nearestSlot(rowUnscale(point, n), n);
      place(drag.sector, slot, drag.arcUp);
      return;
    }

    const now = event.timeStamp;
    const previous = lastTap.current;
    if (previous && previous.sector === drag.sector && now - previous.at < TAP_MS) {
      setOrientations((current) => ({
        ...current,
        [drag.sector]: !(current[drag.sector] ?? true),
      }));
      lastTap.current = null;
      return;
    }
    lastTap.current = { sector: drag.sector, at: now };
  };

  const rowSectors =
    manual && !state.autoArranged
      ? state.slots.map((slot, index) => (slot ? { ...slot, slot: index } : null))
      : null;

  const autoSectors =
    !manual && state.autoArranged
      ? Array.from({ length: n }, (_, index) => ({
          sector: index,
          arcUp: index % 2 === 0,
          slot: index,
        }))
      : null;

  const rowItems = rowSectors ?? autoSectors;
  const showSectorInCircle = (sector: number): boolean => manual && !placedAt.has(sector);

  const sectorShape = (sector: number, arcUp: boolean | null, slot: number | null) => {
    const up = arcUp ?? orientations[sector] ?? true;
    const path = slot === null ? circleSectorPath(sector, n) : slotSectorPath(slot, n, up);
    const fill = colored ? colorOf(sector) : '#ffffff';
    const label = S.circle.sectorLabel(sector + 1);
    const interactive = readOnly ? false : manual;
    const arrival = slot !== null && rowAnimated ? sectorArrivalOffset(sector, slot, n) : null;
    const arrivalStyle: CSSProperties | undefined = arrival
      ? {
          ['--from-x' as string]: `${arrival.x.toFixed(1)}px`,
          ['--from-y' as string]: `${arrival.y.toFixed(1)}px`,
        }
      : undefined;
    return (
      <path
        key={`${slot === null ? 'circle' : 'row'}-${sector}`}
        className={arrival ? styles.autoSector : undefined}
        style={arrivalStyle}
        d={path}
        fill={fill}
        fillOpacity={colored ? (slot === null ? 0.3 : 0.34) : 1}
        stroke={colored ? colorOf(sector) : INK}
        strokeWidth={2.5}
        strokeLinejoin="round"
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? label : undefined}
        data-sector={sector}
        data-slot={slot ?? undefined}
        data-arc-up={up ? 'true' : 'false'}
        onKeyDown={interactive ? (event) => onSectorKeyDown(event, sector) : undefined}
      />
    );
  };

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.button}
          onClick={() => changeLevel(state.level - 1)}
          disabled={readOnly || state.level <= 0}
        >
          {S.circle.less}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => changeLevel(state.level + 1)}
          disabled={readOnly || state.level >= state.settings.divisions.length - 1}
        >
          {S.circle.more}
        </button>
        <label className={styles.slider}>
          <span className={styles.groupLabel}>{S.circle.divisions}</span>
          <input
            type="range"
            aria-label={S.circle.divisions}
            min={0}
            max={Math.max(0, state.settings.divisions.length - 1)}
            step={1}
            value={state.level}
            disabled={readOnly}
            onChange={(event) => changeLevel(Number(event.target.value))}
          />
        </label>
        {!manual ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              dispatch({ type: 'auto-arrange' });
              setStatus('');
            }}
            disabled={readOnly || state.autoArranged}
          >
            {S.circle.auto}
          </button>
        ) : null}
        <span className={styles.hint}>{S.circle.hint}</span>
      </div>

      <p className={styles.instructions}>{S.instructions['circle-sectors']}</p>
      <p className={styles.status} role="status" data-testid="circle-status">
        {done ? S.circle.arranged : status}
      </p>

      <div className={styles.boardArea}>
        <svg
          ref={svgRef}
          className={styles.canvas}
          viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
          role="group"
          aria-label={S.canvasLabel['circle-sectors']}
          tabIndex={readOnly ? -1 : 0}
          data-testid="cut-canvas"
          data-cpa={cpa}
          data-phase={manual ? 'manual' : 'auto'}
          data-divisions={n}
          data-slot-cursor={held ? held.slot : 0}
          data-held-arc-up={held ? String(held.arcUp) : 'false'}
          data-arranged={done ? 'true' : 'false'}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />

          <circle
            cx={CIRCLE_CENTER.x}
            cy={CIRCLE_CENTER.y}
            r={CIRCLE_RADIUS}
            fill="#ffffff"
            stroke="#c9d2e2"
            strokeWidth={2}
            pointerEvents="none"
          />

          {manual || !state.autoArranged
            ? Array.from({ length: n }, (_, sector) =>
                showSectorInCircle(sector) || !manual ? sectorShape(sector, null, null) : null,
              )
            : null}

          {rowItems ? (
            <g transform={rowTransform}>
              <line
                x1={SLOT_X0}
                y1={SLOT_BASELINE}
                x2={rowRight(n)}
                y2={SLOT_BASELINE}
                stroke="#c9d2e2"
                strokeWidth={2}
                pointerEvents="none"
              />
              {rowItems.map((item) =>
                item ? sectorShape(item.sector, item.arcUp, item.slot) : null,
              )}
            </g>
          ) : null}

          {showDimensions ? (
            <g pointerEvents="none" data-testid="circle-dimensions">
              <line
                x1={SLOT_X0}
                y1={rowScreenTop(n) - 26}
                x2={rowScreenRight(n)}
                y2={rowScreenTop(n) - 26}
                stroke="#8a4b00"
                strokeWidth={2.5}
                strokeDasharray="9 6"
              />
              <line
                x1={SLOT_X0}
                y1={SLOT_BASELINE}
                x2={SLOT_X0}
                y2={rowScreenTop(n)}
                stroke="#8a4b00"
                strokeWidth={2.5}
                strokeDasharray="9 6"
              />
              <text
                x={(SLOT_X0 + rowScreenRight(n)) / 2}
                y={rowScreenTop(n) - 36}
                textAnchor="middle"
                fontSize={16}
                fontWeight={700}
                fill="#8a4b00"
              >
                {labels.horizontal}
              </text>
              <text
                x={SLOT_X0 + 12}
                y={(SLOT_BASELINE + rowScreenTop(n)) / 2}
                fontSize={16}
                fontWeight={700}
                fill="#8a4b00"
              >
                {labels.vertical}
              </text>
            </g>
          ) : null}

          <text
            x={CIRCLE_CENTER.x}
            y={CIRCLE_CENTER.y + CIRCLE_RADIUS + 34}
            textAnchor="middle"
            fontSize={15}
            fontWeight={700}
            fill="#5a6478"
            pointerEvents="none"
          >
            {manual ? `${placedCount} / ${n}` : `${n}`}
          </text>
        </svg>
      </div>

      <p className={styles.hint}>{manual ? S.circle.hint : S.circle.auto}</p>
    </div>
  );
}
