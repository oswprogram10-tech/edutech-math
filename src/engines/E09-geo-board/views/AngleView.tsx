/**
 * angle 모드 화면(T102).
 *
 * - 각 하나를 크게 그리고 각도기를 트레이에서 끌어 올려 돌린다.
 * - 각 크기·종류는 화면 글자로 쓰지 않는다. `NumberStepper`는 학생이 넣은 값만 보여 준다.
 * - 레이저 퍼즐은 발사대·별·빔만 그린다. 과녁까지의 선은 그리지 않는다.
 */
import { useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { clamp, minTouchRadius, pointerToLogical, useRenderedSize } from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import { starPoints } from '../layout';
import {
  alignmentOf,
  armDirections,
  currentAngle,
  launcherAlignment,
  normalizeDegrees,
} from '../modes/angle/observe';
import type { Alignment } from '../modes/angle/observe';
import type { AngleState } from '../modes/angle/types';
import { geoBoardStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { GeoAction, GeoConfig } from '../types';
import { NumberStepper } from './NumberStepper';
import {
  ANGLE_VIEW,
  Protractor,
  directionOfPoint,
  pointAtDirection,
  sectorPath,
  snapRotation,
} from './Protractor';
import styles from '../View.module.css';

const PAPER = '#fbfaf6';
const INK = '#1d2330';
const MUTED = '#8a93a5';
const ORANGE = '#e8872e';
const GREEN = '#2f9e6b';
const RED = '#c2410c';
const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };

type AngleViewProps = EngineViewProps<GeoConfig, AngleState, GeoAction>;

type AngleDrag = { readonly kind: 'tray' } | { readonly kind: 'rotate' } | null;

function angleArms(state: AngleState): number[] {
  if (state.protractor.on === 'launcher') return [0];
  const angle = currentAngle(state);
  return [...armDirections(angle)];
}

function activeScaleOf(state: AngleState): Alignment {
  if (state.protractor.on === 'launcher') return launcherAlignment(state.protractor.rotation);
  return alignmentOf(state);
}

function beamEnd(from: Point, direction: number, length: number): Point {
  return pointAtDirection(from, length, direction);
}

export function AngleView({ state, dispatch, cpa, readOnly = false, targetSize }: AngleViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rendered = useRenderedSize(svgRef);
  const hitRadius = Math.max(16, Math.ceil(minTouchRadius(targetSize, rendered, LOGICAL)));
  const { settings } = state;
  const angle = currentAngle(state);
  const entry = state.entries[angle.id] ?? {
    estimate: null,
    reading: null,
    readingAligned: null,
  };
  const puzzle = settings.puzzle;
  const [launchValue, setLaunchValue] = useState<number | null>(null);
  const dragRef = useRef<AngleDrag>(null);
  const dragStart = useRef<Point | null>(null);
  const vertex = ANGLE_VIEW.vertex;
  const launcher = ANGLE_VIEW.launcher;
  const placementCenter = puzzle ? launcher : vertex;
  const alignment = activeScaleOf(state);
  const placed = state.protractor.on !== null;

  const armEnds = (): [Point, Point] => {
    const [first, second] = armDirections(angle);
    return [
      pointAtDirection(vertex, ANGLE_VIEW.armLength * angle.arms[0], first),
      pointAtDirection(vertex, ANGLE_VIEW.armLength * angle.arms[1], second),
    ];
  };

  const protractorCenter = (): Point => (state.protractor.on === 'launcher' ? launcher : vertex);

  const protractorRadius = (): number =>
    state.protractor.on === 'launcher' ? 300 : ANGLE_VIEW.protractorRadius;

  const handlePoint = (): Point | null => {
    if (!placed) return null;
    return pointAtDirection(protractorCenter(), protractorRadius(), state.protractor.rotation);
  };

  const placeCurrent = () => {
    if (readOnly) return;
    const on = puzzle ? 'launcher' : angle.id;
    // 각도기는 꼭짓점에만 붙인다. 변에 맞춰 돌리는 것은 학생이 한다.
    dispatch({ type: 'place-protractor', on });
  };

  const lift = () => {
    if (readOnly) return;
    dispatch({ type: 'lift-protractor' });
  };

  const togglePlacement = () => {
    if (placed) lift();
    else placeCurrent();
  };

  const rotateBy = (delta: number, snap = false) => {
    const next = normalizeDegrees(state.protractor.rotation + delta);
    dispatch({
      type: 'rotate-protractor',
      rotation: snap ? snapRotation(next, angleArms(state)) : next,
    });
  };

  const onCanvasKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      togglePlacement();
      return;
    }
    if (!placed) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const step = event.shiftKey ? 15 : 1;
    // 키보드 1°는 4° 스냅을 거치지 않는다(맞춘 변에서 ±1이 다시 붙는 문제).
    rotateBy(event.key === 'ArrowRight' ? step : -step);
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const pointValue = pointerToLogical(event, svgRef.current, LOGICAL);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom·이미 끝난 포인터.
    }
    dragStart.current = pointValue;
    const handle = handlePoint();
    if (handle && Math.hypot(handle.x - pointValue.x, handle.y - pointValue.y) <= hitRadius) {
      dragRef.current = { kind: 'rotate' };
      return;
    }
    if (
      Math.hypot(ANGLE_VIEW.trayCenter.x - pointValue.x, ANGLE_VIEW.trayCenter.y - pointValue.y) <=
      ANGLE_VIEW.trayRadius + hitRadius
    ) {
      dragRef.current = { kind: 'tray' };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || readOnly || drag.kind !== 'rotate') return;
    const pointValue = pointerToLogical(event, svgRef.current, LOGICAL);
    const direction = directionOfPoint(protractorCenter(), pointValue);
    dispatch({
      type: 'rotate-protractor',
      rotation: snapRotation(direction, angleArms(state)),
    });
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || readOnly) return;
    if (drag.kind !== 'tray') return;
    const pointValue = pointerToLogical(event, svgRef.current, LOGICAL);
    const nearPlacement =
      Math.hypot(placementCenter.x - pointValue.x, placementCenter.y - pointValue.y) <=
      ANGLE_VIEW.placeRadius;
    const start = dragStart.current;
    const tap =
      start !== null &&
      Math.hypot(ANGLE_VIEW.trayCenter.x - pointValue.x, ANGLE_VIEW.trayCenter.y - pointValue.y) <=
        ANGLE_VIEW.trayRadius + hitRadius &&
      Math.hypot(start.x - pointValue.x, start.y - pointValue.y) <= hitRadius;
    if (nearPlacement || tap) placeCurrent();
  };

  const renderAngleScene = (): ReactNode => {
    const [first, second] = armEnds();
    const [firstDirection] = armDirections(angle);
    return (
      <g>
        <circle cx={vertex.x} cy={vertex.y} r={92} fill="#eef4ff" fillOpacity={0.5} />
        <path
          d={sectorPath(vertex, 92, firstDirection, Math.min(angle.degrees, 180))}
          fill={GREEN}
          fillOpacity={0.12}
          stroke="none"
        />
        <path
          d={sectorPath(vertex, 92, firstDirection, Math.min(angle.degrees, 180))}
          fill="none"
          stroke={GREEN}
          strokeWidth={2.5}
        />
        <line
          x1={vertex.x}
          y1={vertex.y}
          x2={first.x}
          y2={first.y}
          stroke={INK}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <line
          x1={vertex.x}
          y1={vertex.y}
          x2={second.x}
          y2={second.y}
          stroke={INK}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <circle cx={vertex.x} cy={vertex.y} r={9} fill={INK} />
      </g>
    );
  };

  const renderPuzzleScene = (): ReactNode => {
    if (!puzzle) return null;
    const { floorEnd } = ANGLE_VIEW;
    const target = pointAtDirection(launcher, ANGLE_VIEW.targetDistance, puzzle.targetAngle);
    const fired = state.puzzle?.fired ?? [];
    const lastFired = fired.length > 0 ? (fired[fired.length - 1] ?? null) : null;
    const hit = lastFired !== null && lastFired === puzzle.targetAngle;
    const beam =
      lastFired !== null ? beamEnd(launcher, lastFired, ANGLE_VIEW.targetDistance + 240) : null;
    return (
      <g>
        <line
          x1={launcher.x}
          y1={launcher.y}
          x2={floorEnd.x}
          y2={floorEnd.y}
          stroke={INK}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <circle cx={launcher.x} cy={launcher.y} r={12} fill={INK} />
        <text
          x={launcher.x - 10}
          y={launcher.y + 38}
          textAnchor="middle"
          fontSize={17}
          fontWeight={700}
          fill={MUTED}
        >
          {S.angle.launcher}
        </text>
        <polygon
          points={starPoints(target.x, target.y, 30, 13)}
          fill={hit ? ORANGE : PAPER}
          stroke={hit ? ORANGE : MUTED}
          strokeWidth={3}
        />
        {hit ? (
          <path
            d={`M ${target.x - 8} ${target.y + 2} l 6 7 l 12 -15`}
            fill="none"
            stroke={INK}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {beam ? (
          <line
            x1={launcher.x}
            y1={launcher.y}
            x2={beam.x}
            y2={beam.y}
            stroke={hit ? ORANGE : RED}
            strokeWidth={4}
            strokeDasharray="16 10"
            strokeLinecap="round"
            className={styles.laser}
            pointerEvents="none"
          />
        ) : null}
      </g>
    );
  };

  const renderProtractor = (): ReactNode => {
    const tray = (
      <g data-testid="protractor-tray" style={{ cursor: readOnly ? 'default' : 'grab' }}>
        <Protractor
          center={ANGLE_VIEW.trayCenter}
          radius={ANGLE_VIEW.trayRadius}
          rotation={0}
          showNumbers={false}
          tray
        />
        <text
          x={ANGLE_VIEW.trayCenter.x}
          y={ANGLE_VIEW.trayCenter.y + ANGLE_VIEW.trayRadius + 22}
          textAnchor="middle"
          fontSize={14}
          fontWeight={700}
          fill={MUTED}
        >
          {S.angle.protractor}
        </text>
      </g>
    );
    return (
      <g>
        {tray}
        {placed ? (
          <Protractor
            center={protractorCenter()}
            radius={protractorRadius()}
            rotation={state.protractor.rotation}
            showNumbers
            highlightActiveScale={settings.highlightActiveScale}
            activeScale={alignment.scale}
          />
        ) : null}
        {placed && handlePoint() ? (
          <circle
            cx={handlePoint()?.x ?? 0}
            cy={handlePoint()?.y ?? 0}
            r={14}
            fill={PAPER}
            stroke={ORANGE}
            strokeWidth={3}
          />
        ) : null}
      </g>
    );
  };

  const statusText = puzzle
    ? state.puzzle && state.puzzle.fired.length > 0
      ? state.puzzle.fired[state.puzzle.fired.length - 1] === puzzle.targetAngle
        ? S.angle.hit
        : S.angle.miss
      : ''
    : placed
      ? S.angle.placed
      : '';

  return (
    <div className={styles.wrap} data-target-size={targetSize}>
      {!puzzle ? (
        <div className={styles.toolbar} role="toolbar" aria-label={S.angle.angleButton(1)}>
          {settings.angles.map((candidate, index) => (
            <button
              key={candidate.id}
              type="button"
              className={styles.button}
              aria-pressed={state.current === index}
              onClick={() => dispatch({ type: 'select-angle', index })}
              disabled={readOnly}
            >
              {S.angle.angleButton(index + 1)}
            </button>
          ))}
          <button
            type="button"
            className={styles.button}
            aria-pressed={placed}
            onClick={togglePlacement}
            disabled={readOnly}
          >
            {placed ? S.angle.lift : S.angle.protractor}
          </button>
        </div>
      ) : (
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.button}
            aria-pressed={placed}
            onClick={togglePlacement}
            disabled={readOnly}
          >
            {placed ? S.angle.lift : S.angle.protractor}
          </button>
          <span className={styles.badge}>{S.angle.puzzleHint}</span>
        </div>
      )}

      <p className={styles.instructions}>{S.angle.instructions}</p>
      <p className={styles.status} role="status">
        {statusText}
      </p>

      <div className={styles.stageRow}>
        <div className={styles.boardArea}>
          <svg
            ref={svgRef}
            className={styles.canvas}
            viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
            role="group"
            aria-label={S.angle.canvasLabel}
            tabIndex={readOnly ? -1 : 0}
            data-testid="geo-canvas"
            data-cpa={cpa}
            onKeyDown={onCanvasKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
          >
            <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
            {puzzle ? renderPuzzleScene() : renderAngleScene()}
            {renderProtractor()}
          </svg>
        </div>

        <div className={styles.sideStack}>
          {!puzzle ? (
            <div className={styles.controlStack}>
              <NumberStepper
                label={S.angle.estimate}
                value={entry.estimate}
                testId="estimate-stepper"
                onChange={(value) => dispatch({ type: 'set-estimate', angle: angle.id, value })}
                disabled={readOnly}
              />
              <NumberStepper
                label={S.angle.reading}
                value={entry.reading}
                testId="reading-stepper"
                onChange={(value) => dispatch({ type: 'set-reading', angle: angle.id, value })}
                disabled={readOnly || (settings.estimateFirst && entry.estimate === null)}
              />
              {settings.estimateFirst && entry.estimate === null ? (
                <p className={styles.hint}>{S.angle.estimateFirstHint}</p>
              ) : null}
            </div>
          ) : (
            <div className={styles.controlStack}>
              {settings.estimateFirst ? (
                <NumberStepper
                  label={S.angle.launchEstimate}
                  value={state.puzzle?.estimate ?? null}
                  testId="launch-estimate-stepper"
                  onChange={(value) => dispatch({ type: 'set-launch-estimate', value })}
                  disabled={readOnly}
                />
              ) : null}
              <NumberStepper
                label={S.angle.launch}
                value={launchValue}
                testId="launch-stepper"
                onChange={setLaunchValue}
                disabled={
                  readOnly || (settings.estimateFirst && (state.puzzle?.estimate ?? null) === null)
                }
              />
              <div className={styles.toolbar}>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => dispatch({ type: 'fire', angle: clamp(launchValue ?? 0, 0, 360) })}
                  disabled={
                    readOnly ||
                    (settings.estimateFirst && (state.puzzle?.estimate ?? null) === null)
                  }
                >
                  {S.angle.fire}
                </button>
              </div>
              <p className={styles.hint}>{S.angle.puzzleHint}</p>
            </div>
          )}

          <div className={styles.hintBlock}>
            <p className={styles.hint}>{S.angle.canvasHint}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
