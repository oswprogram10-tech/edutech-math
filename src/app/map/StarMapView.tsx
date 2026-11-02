/**
 * S2 별자리 화면.
 *
 * SVG 한 장에 별 전체를 그리고, 확대·이동은 그룹 하나의 `transform`만 바꾼다.
 * 별 레이어는 `useMemo` + `memo`라서 확대·이동 중에 별을 다시 렌더하지 않는다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { ContentActivity } from '../../core/runner';
import { usePinch } from '../../core/engine-sdk';
import { starMapStrings } from '../strings.ko';
import type { Brightness } from './brightness';
import { ConceptStar } from './ConceptStar';
import { MAP_HEIGHT, MAP_WIDTH, STAR_RADIUS } from './layout';
import type { MapZone, StarMapLayout } from './layout';
import { STAR_PATH } from './star-shape';
import styles from './StarMap.module.css';

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.25;
const RESET_SCALE = 1;
const TAP_SLOP = 8;
const KEY_PAN = 44;

interface ViewPoint {
  readonly x: number;
  readonly y: number;
}

interface DragState {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  lastX: number;
  lastY: number;
  moved: number;
}

export interface StarMapViewProps {
  readonly layout: StarMapLayout;
  readonly brightness: ReadonlyMap<string, Brightness>;
  readonly sparkle: ReadonlySet<string>;
  readonly enabledUnits: ReadonlySet<string>;
  readonly activitiesByConcept: ReadonlyMap<string, readonly ContentActivity[]>;
  /** 화면 픽셀 기준 최소 터치 타깃(48 또는 64). */
  readonly targetSize: number;
  readonly onOpenActivity: (activityId: string) => void;
}

function scheduleFrame(callback: () => void): number {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback);
  callback();
  return 0;
}

function cancelFrame(id: number): void {
  if (id !== 0 && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
}

function zoneLabel(domain: MapZone['domain']): string {
  return starMapStrings.zones[domain];
}

export function StarMapView({
  layout,
  brightness,
  sparkle,
  enabledUnits,
  activitiesByConcept,
  targetSize,
  onOpenActivity,
}: StarMapViewProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef<SVGGElement | null>(null);
  const panRef = useRef<ViewPoint>({ x: 0, y: 0 });
  const scaleRef = useRef(RESET_SCALE);
  /** 마지막으로 화면에 적용한 배율. 앵커 보정은 이 값과 새 배율의 차이로 한다. */
  const appliedScaleRef = useRef(RESET_SCALE);
  const zoomAnchorRef = useRef<ViewPoint>({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
  const frameRef = useRef(0);
  const pointersRef = useRef(new Map<number, ViewPoint>());
  const dragRef = useRef<DragState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pinch = usePinch({
    initialScale: RESET_SCALE,
    min: MIN_SCALE,
    max: MAX_SCALE,
    step: ZOOM_STEP,
    onChange: (scale) => {
      scaleRef.current = scale;
    },
  });
  const { zoomIn: pinchZoomIn, zoomOut: pinchZoomOut } = pinch;

  const applyTransform = useCallback(() => {
    const node = transformRef.current;
    if (!node) return;
    const { x, y } = panRef.current;
    node.setAttribute('transform', `translate(${x} ${y}) scale(${scaleRef.current})`);
  }, []);

  const scheduleTransform = useCallback(() => {
    if (frameRef.current !== 0) return;
    frameRef.current = scheduleFrame(() => {
      frameRef.current = 0;
      applyTransform();
    });
  }, [applyTransform]);

  // 배율이 바뀌면 앵커(마지막 휠·핀치 지점, 기본은 하늘 가운데)가 화면에서 제자리에 있게 이동한다.
  useEffect(() => {
    const previous = appliedScaleRef.current;
    const next = pinch.scale;
    if (previous === next) return;
    const anchor = zoomAnchorRef.current;
    const shift = anchor.x * (previous - next);
    const shiftY = anchor.y * (previous - next);
    panRef.current = { x: panRef.current.x + shift, y: panRef.current.y + shiftY };
    appliedScaleRef.current = next;
    scaleRef.current = next;
    scheduleTransform();
  }, [pinch.scale, scheduleTransform]);

  useEffect(() => () => cancelFrame(frameRef.current), []);

  // 첫 화면에도 transform을 명시해 두어 확대 전후 값을 비교할 수 있게 한다.
  useEffect(() => {
    applyTransform();
  }, [applyTransform]);

  const rectOf = useCallback((): DOMRect | undefined => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return undefined;
    return rect;
  }, []);

  const screenToLogical = useCallback(
    (clientX: number, clientY: number): ViewPoint | undefined => {
      const rect = rectOf();
      if (!rect) return undefined;
      const screenX = ((clientX - rect.left) / rect.width) * MAP_WIDTH;
      const screenY = ((clientY - rect.top) / rect.height) * MAP_HEIGHT;
      const scale = scaleRef.current;
      return {
        x: (screenX - panRef.current.x) / scale,
        y: (screenY - panRef.current.y) / scale,
      };
    },
    [rectOf],
  );

  const nearestEnabledStar = useCallback(
    (clientX: number, clientY: number) => {
      const point = screenToLogical(clientX, clientY);
      const rect = rectOf();
      if (!point || !rect) return undefined;
      // 화면에서 targetSize만큼(반지름 targetSize/2) 떨어진 별까지 누른 것으로 본다.
      const logicalRadius = Math.max(
        STAR_RADIUS * 1.4,
        ((targetSize / 2) * (MAP_WIDTH / rect.width)) / scaleRef.current,
      );
      let best: (typeof layout.stars)[number] | undefined;
      let bestDistance = logicalRadius * logicalRadius;
      for (const star of layout.stars) {
        if (!enabledUnits.has(star.unitId)) continue;
        const dx = star.x - point.x;
        const dy = star.y - point.y;
        const distance = dx * dx + dy * dy;
        if (distance <= bestDistance) {
          bestDistance = distance;
          best = star;
        }
      }
      return best;
    },
    [enabledUnits, layout, rectOf, screenToLogical, targetSize],
  );

  const zoomIn = useCallback(() => {
    zoomAnchorRef.current = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
    pinchZoomIn();
  }, [pinchZoomIn]);

  const zoomOut = useCallback(() => {
    zoomAnchorRef.current = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
    pinchZoomOut();
  }, [pinchZoomOut]);

  const reset = useCallback(() => {
    zoomAnchorRef.current = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
    panRef.current = { x: 0, y: 0 };
    // usePinch에는 배율 지정 API가 없어서 한 단계씩 1배로 되돌린다(상태는 한 번만 커밋된다).
    let guard = 0;
    while (scaleRef.current > RESET_SCALE + 0.0001 && guard < 40) {
      pinchZoomOut();
      guard += 1;
    }
    while (scaleRef.current < RESET_SCALE - 0.0001 && guard < 40) {
      pinchZoomIn();
      guard += 1;
    }
    if (scaleRef.current !== RESET_SCALE) {
      scaleRef.current = RESET_SCALE;
    }
    appliedScaleRef.current = RESET_SCALE;
    scheduleTransform();
  }, [pinchZoomIn, pinchZoomOut, scheduleTransform]);

  // 휠은 Ctrl 없이도 확대·이동에 쓴다. passive 리스너를 피하려고 직접 단다.
  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = screenToLogical(event.clientX, event.clientY);
      if (point) zoomAnchorRef.current = point;
      if (event.deltaY < 0) pinchZoomIn();
      else if (event.deltaY > 0) pinchZoomOut();
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [pinchZoomIn, pinchZoomOut, screenToLogical]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pinch.handlers.onPointerDown(event);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) {
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: 0,
      };
    } else {
      dragRef.current = null;
      const pointers = [...pointersRef.current.values()];
      const first = pointers[0];
      const second = pointers[1];
      if (first && second) {
        const point = screenToLogical((first.x + second.x) / 2, (first.y + second.y) / 2);
        if (point) zoomAnchorRef.current = point;
      }
    }
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // 합성 이벤트·일부 브라우저에서는 포인터 캡처가 없어도 동작한다.
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    pinch.handlers.onPointerMove(event);
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2) return;

    const drag = dragRef.current;
    const rect = rectOf();
    if (!drag || drag.pointerId !== event.pointerId || !rect) return;

    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    panRef.current = {
      x: panRef.current.x + dx * (MAP_WIDTH / rect.width),
      y: panRef.current.y + dy * (MAP_HEIGHT / rect.height),
    };
    scheduleTransform();
  };

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (cancelled) {
      pinch.handlers.onPointerCancel(event);
    } else {
      pinch.handlers.onPointerUp(event);
    }
    pointersRef.current.delete(event.pointerId);
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // 캡처를 잡지 못했으면 풀 것도 없다.
    }

    const drag = dragRef.current;
    dragRef.current = null;
    if (cancelled || !drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved >= TAP_SLOP) return;

    const star = nearestEnabledStar(event.clientX, event.clientY);
    if (star) setSelectedId(star.conceptId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    if (key === '+' || key === '=') {
      event.preventDefault();
      zoomIn();
      return;
    }
    if (key === '-' || key === '_') {
      event.preventDefault();
      zoomOut();
      return;
    }
    if (key === '0') {
      event.preventDefault();
      reset();
      return;
    }
    const delta: ViewPoint | undefined =
      key === 'ArrowLeft'
        ? { x: KEY_PAN, y: 0 }
        : key === 'ArrowRight'
          ? { x: -KEY_PAN, y: 0 }
          : key === 'ArrowUp'
            ? { x: 0, y: KEY_PAN }
            : key === 'ArrowDown'
              ? { x: 0, y: -KEY_PAN }
              : undefined;
    if (!delta) return;
    event.preventDefault();
    panRef.current = { x: panRef.current.x + delta.x, y: panRef.current.y + delta.y };
    scheduleTransform();
  };

  const selectStar = useCallback((conceptId: string) => setSelectedId(conceptId), []);

  const linkLayer = useMemo(() => {
    const starById = new Map(layout.stars.map((star) => [star.conceptId, star]));
    const unitById = new Map(layout.units.map((unit) => [unit.unitId, unit]));
    return layout.links.flatMap((link) => {
      const from = starById.get(link.from);
      if (!from) return [];
      const to = starById.get(link.to) ?? unitById.get(link.to);
      if (!to) return [];
      return [
        <line
          key={`${link.from}-${link.to}`}
          className={styles.link}
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          aria-hidden="true"
        />,
      ];
    });
  }, [layout]);

  const starLayer = useMemo(
    () => (
      <g>
        {layout.stars.map((star) => (
          <ConceptStar
            key={star.index}
            conceptId={star.conceptId}
            label={star.label}
            x={star.x}
            y={star.y}
            brightness={brightness.get(star.conceptId) ?? 'missing'}
            sparkle={sparkle.has(star.conceptId)}
            enabled={enabledUnits.has(star.unitId)}
            onSelect={selectStar}
          />
        ))}
      </g>
    ),
    [brightness, enabledUnits, layout.stars, selectStar, sparkle],
  );

  const selected = selectedId
    ? layout.stars.find((star) => star.conceptId === selectedId)
    : undefined;
  const activities = selected ? (activitiesByConcept.get(selected.conceptId) ?? []) : [];
  const selectedBrightness = selected
    ? (brightness.get(selected.conceptId) ?? 'missing')
    : 'missing';

  return (
    <div className={styles.wrap}>
      <div className={styles.controls} role="toolbar" aria-label={starMapStrings.controls}>
        <button
          type="button"
          className={styles.control}
          aria-label={starMapStrings.zoomOut}
          onClick={zoomOut}
          disabled={!pinch.canZoomOut}
        >
          −
        </button>
        <span className={styles.zoomValue} data-testid="map-zoom" aria-live="polite">
          {starMapStrings.zoomLevel(Math.round(pinch.scale * 100))}
        </span>
        <button
          type="button"
          className={styles.control}
          aria-label={starMapStrings.zoomIn}
          onClick={zoomIn}
          disabled={!pinch.canZoomIn}
        >
          +
        </button>
        <button type="button" className={styles.controlWide} onClick={reset}>
          {starMapStrings.reset}
        </button>
      </div>

      <div
        ref={canvasRef}
        className={styles.canvas}
        data-testid="map-canvas"
        role="group"
        aria-label={starMapStrings.mapLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => endPointer(event, false)}
        onPointerCancel={(event) => endPointer(event, true)}
      >
        <svg
          className={styles.svg}
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          role="presentation"
        >
          <defs>
            <radialGradient id="starmap-sky" cx="50%" cy="45%" r="75%">
              <stop offset="0%" stopColor="#16234d" />
              <stop offset="100%" stopColor="#070c1e" />
            </radialGradient>
            <linearGradient id="starmap-half" x1="0" y1="0" x2="1" y2="0">
              <stop offset="50%" stopColor="#bcd3ff" />
              <stop offset="50%" stopColor="transparent" />
            </linearGradient>
          </defs>

          <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#starmap-sky)" />

          {layout.zones.map((zone) => (
            <g key={zone.domain}>
              <rect
                className={styles.zone}
                x={zone.x + 10}
                y={zone.y + 10}
                width={zone.width - 20}
                height={zone.height - 20}
                rx={26}
              />
              <text
                className={styles.zoneLabel}
                x={zone.labelX}
                y={zone.labelY}
                textAnchor={zone.labelAnchor}
              >
                {zoneLabel(zone.domain)}
              </text>
            </g>
          ))}

          <g ref={transformRef} data-testid="map-transform">
            <g className={styles.links}>{linkLayer}</g>
            {starLayer}
          </g>
        </svg>
      </div>

      <ul className={styles.legend} aria-label={starMapStrings.brightnessHeading}>
        {(['missing', 'practicing', 'mastered'] as const).map((level) => (
          <li key={level} className={styles.legendItem} data-testid={`legend-${level}`}>
            <svg className={styles.legendStar} viewBox="-12 -12 24 24" aria-hidden="true">
              <path
                className={`${styles.shape} ${styles[level]}`}
                d={STAR_PATH}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span>{starMapStrings.brightness[level]}</span>
          </li>
        ))}
      </ul>

      {selected ? (
        <section
          className={styles.detail}
          data-testid="star-detail"
          aria-labelledby="star-detail-heading"
          aria-live="polite"
        >
          <header className={styles.detailHeader}>
            <h2 id="star-detail-heading" className={styles.detailHeading}>
              {starMapStrings.detailLabel}
            </h2>
            <button
              type="button"
              className={styles.close}
              aria-label={starMapStrings.close}
              onClick={() => setSelectedId(null)}
            >
              ×
            </button>
          </header>
          <p className={styles.detailConcept}>{selected.label}</p>
          <p className={styles.detailBrightness}>{starMapStrings.brightness[selectedBrightness]}</p>
          {sparkle.has(selected.conceptId) ? (
            <p className={styles.sparkleNote}>{starMapStrings.sparkleNote}</p>
          ) : null}

          {activities.length === 0 ? (
            <p className={styles.empty}>{starMapStrings.noActivities}</p>
          ) : (
            <ul className={styles.activityList}>
              {activities.map((activity) => (
                <li key={activity.id}>
                  <button
                    type="button"
                    className={styles.activity}
                    onClick={() => onOpenActivity(activity.id)}
                  >
                    <span className={styles.activityTitle}>{activity.title}</span>
                    <span className={styles.activityMeta}>
                      {starMapStrings.taskCount(activity.tasks.length)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
