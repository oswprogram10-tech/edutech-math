/** 포함제: 같은 수씩 덜어 내어 봉지에 담는다. 올가미 또는 버튼으로만 조작한다. */
import { useRef } from 'react';
import { pointerToLogical, selectInside, useLasso } from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import { CounterIconShape } from '../icons';
import { bagPoint } from '../layout';
import { countersStrings as S } from '../strings.ko';
import type { CountersAction, CountersConfig, CountersState, CounterIcon } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';

type Props = EngineViewProps<CountersConfig, CountersState, CountersAction>;

const PAPER = '#fbfaf6';
const MUTED = '#5b6577';
const COUNTER_RADIUS = 15;
const BAG_WIDTH = 124;
const BAG_HEIGHT = 72;
const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };

function bagIndexes(total: number): number[] {
  return Array.from({ length: total }, (_, index) => index);
}

export function MeasureOutView({
  config,
  state,
  dispatch,
  readOnly = false,
  scale = 1,
  targetSize,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const measure = state.mode === 'measure-out' ? state : null;

  const lasso = useLasso({
    getPoint: (event) => pointerToLogical(event, svgRef.current, LOGICAL),
    disabled: readOnly || measure === null || measure.groupSize === null,
    onGesture: (gesture) => {
      if (!measure || measure.groupSize === null) return;
      const loose = measure.counters
        .filter((counter) => counter.bag === null)
        .map((counter) => ({ point: { x: counter.x, y: counter.y }, id: counter.id }));
      const ids = gesture.isTap
        ? []
        : selectInside(gesture.points, loose, (item) => item.point).map((item) => item.id);
      if (ids.length === 0) return;
      dispatch({ type: 'bag', ids });
    },
  });

  if (!measure) return null;
  const showNumeral = config.showNumeral === 'always';
  const icon: CounterIcon = config.icon ?? 'strawberry';
  const size = measure.groupSize;
  const loose = measure.counters.filter((counter) => counter.bag === null);
  const remainder =
    config.showRemainder !== false && size !== null && loose.length > 0 && loose.length < size;
  const bags = bagIndexes(measure.bagCount);

  return (
    <div className={styles.wrap} data-target-size={targetSize} style={{ width: `${100 * scale}%` }}>
      <div className={styles.toolbar}>
        {measure.choices.length > 0 ? (
          <>
            <p className={styles.status}>{S.measureChoose}</p>
            {measure.choices.map((choice) => (
              <button
                key={`size-${choice}`}
                type="button"
                className={styles.button}
                onClick={() => dispatch({ type: 'choose-size', size: choice })}
                disabled={readOnly}
                aria-pressed={size === choice}
              >
                {S.bagNext(choice)}
              </button>
            ))}
          </>
        ) : null}
        {size !== null ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => dispatch({ type: 'bag-next' })}
            disabled={readOnly || loose.length < size}
          >
            {S.bagNext(size)}
          </button>
        ) : null}
        {showNumeral ? (
          <p className={styles.total} data-testid="counter-total">
            {S.bagCount(measure.bagCount)}
          </p>
        ) : null}
      </div>

      <svg
        ref={svgRef}
        className={styles.canvas}
        viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
        role="group"
        aria-label={S.canvasLabel}
        data-testid="counters-canvas"
        onPointerDown={lasso.handlers.onPointerDown}
        onPointerMove={lasso.handlers.onPointerMove}
        onPointerUp={lasso.handlers.onPointerUp}
        onPointerCancel={lasso.handlers.onPointerCancel}
      >
        <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />

        {remainder ? (
          <g aria-label={S.remainder}>
            <rect
              x={780}
              y={430}
              width={180}
              height={140}
              rx={18}
              fill="#ffffff"
              fillOpacity={0.5}
              stroke={MUTED}
              strokeWidth={3}
              strokeDasharray="10 8"
            />
            <text x={870} y={420} textAnchor="middle" fontSize={20} fill={MUTED}>
              {S.remainder}
            </text>
          </g>
        ) : null}

        {loose.map((counter, index) => (
          <g key={counter.id} role="img" aria-label={S.iconNames[icon]}>
            <CounterIconShape
              icon={icon}
              color="red"
              x={remainder ? 812 + (index % 4) * 32 : counter.x}
              y={remainder ? 476 + Math.floor(index / 4) * 34 : counter.y}
              r={remainder ? 12 : COUNTER_RADIUS}
            />
          </g>
        ))}

        {bags.map((bag) => {
          const point = bagPoint(bag);
          const inside = measure.counters.filter((counter) => counter.bag === bag);
          return (
            <g
              key={`bag-${bag}`}
              role="button"
              tabIndex={readOnly ? -1 : 0}
              aria-label={S.unbag(bag)}
              className={styles.bag}
              onKeyDown={(event) => {
                if (event.key !== 'Delete' && event.key !== 'Backspace') return;
                event.preventDefault();
                if (!readOnly) dispatch({ type: 'unbag', bag });
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                if (!readOnly) dispatch({ type: 'unbag', bag });
              }}
            >
              <rect
                x={point.x - BAG_WIDTH / 2}
                y={point.y - BAG_HEIGHT / 2}
                width={BAG_WIDTH}
                height={BAG_HEIGHT}
                rx={16}
                fill="#ffffff"
                stroke="#8a6a3a"
                strokeWidth={3}
              />
              {inside.map((counter, index) => (
                <CounterIconShape
                  key={counter.id}
                  icon={icon}
                  color="blue"
                  x={point.x - BAG_WIDTH / 2 + 22 + (index % 4) * 27}
                  y={point.y - BAG_HEIGHT / 2 + 24 + Math.floor(index / 4) * 26}
                  r={11}
                />
              ))}
            </g>
          );
        })}

        {lasso.active && lasso.path.length > 1 ? (
          <polyline
            points={lasso.path.map((point: Point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            stroke="#e8872e"
            strokeWidth={4}
            strokeDasharray="10 6"
            strokeLinecap="round"
          />
        ) : null}
      </svg>

      <p className={styles.instructions}>{S.measureHint}</p>

      <div className={styles.plateControls}>
        {bags.map((bag) => (
          <button
            key={`unbag-${bag}`}
            type="button"
            className={styles.smallButton}
            onClick={() => dispatch({ type: 'unbag', bag })}
            disabled={readOnly}
            aria-label={S.unbag(bag)}
          >
            {S.bagName(bag)}
          </button>
        ))}
        {measure.lastAttempt && !measure.lastAttempt.ok ? (
          <span className={styles.status} role="status">
            {S.measureMiss(measure.lastAttempt.count)}
          </span>
        ) : null}
      </div>

      {showNumeral && config.sentenceTemplate ? (
        <p className={styles.status} data-testid="counter-sentence">
          {config.sentenceTemplate
            .replace('{size}', String(size ?? 0))
            .replace('{groups}', String(measure.bagCount))
            .replace('{total}', String(measure.counters.length))
            .replace('{loose}', String(loose.length))}
        </p>
      ) : null}
    </div>
  );
}
