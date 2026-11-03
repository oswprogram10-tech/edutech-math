/** ?깅텇?? 臾대뜑湲곗쓽 ?덈룎???묒떆???섎굹???섎늿?? */
import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { distance, pointerToLogical, useDrag } from '../../../core/engine-sdk';
import type { EngineViewProps, Point } from '../../../core/engine-sdk';
import { CounterIconShape } from '../icons';
import { sharePlateCenter } from '../layout';
import { countersStrings as S } from '../strings.ko';
import type { CountersAction, CountersConfig, CountersState, CounterIcon } from '../types';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import styles from '../View.module.css';

type Props = EngineViewProps<CountersConfig, CountersState, CountersAction>;

const PAPER = '#fbfaf6';
const LOGICAL = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
const PILE_RADIUS = 18;
const PLATE_COUNTER_RADIUS = 12;
const PLATE_HALF = 92;

function pilePoint(index: number): Point {
  return { x: 90 + (index % 12) * 60, y: 140 + Math.floor(index / 12) * 50 };
}

function plateSlot(center: Point, index: number): Point {
  return {
    x: center.x - 62 + (index % 5) * 31,
    y: center.y - 20 + Math.floor(index / 5) * 28,
  };
}

export function ShareView({
  config,
  state,
  dispatch,
  readOnly = false,
  scale = 1,
  targetSize,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const fromPile = useRef(false);
  const [ghost, setGhost] = useState<Point | null>(null);
  const share = state.mode === 'share' ? state : null;

  const plateAt = (point: Point): number | null => {
    if (!share) return null;
    for (let plate = 0; plate < share.groups; plate += 1) {
      if (distance(point, sharePlateCenter(share.groups, plate)) <= 110) return plate;
    }
    return null;
  };

  const drag = useDrag({
    getPoint: (event) => pointerToLogical(event, svgRef.current, LOGICAL),
    onStart: (info) => {
      if (readOnly) return;
      fromPile.current = info.start.y < 380;
      if (fromPile.current) setGhost(info.start);
    },
    onMove: (info) => {
      if (fromPile.current) setGhost(info.current);
    },
    onEnd: (info) => {
      const started = fromPile.current;
      fromPile.current = false;
      setGhost(null);
      if (!started) return;
      const plate = plateAt(info.current);
      if (plate !== null) dispatch({ type: 'deal', plate });
    },
    onCancel: () => {
      fromPile.current = false;
      setGhost(null);
    },
    disabled: readOnly,
  });

  if (!share) return null;
  const showNumeral = config.showNumeral === 'always';
  const icon: CounterIcon = config.icon ?? 'candy';
  const total = share.pile + share.plates.reduce((sum, count) => sum + count, 0);

  const onPlateKey = (event: ReactKeyboardEvent<SVGGElement>, plate: number) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    event.preventDefault();
    if (!readOnly) dispatch({ type: 'deal', plate });
  };

  const onPlateTap = (event: ReactPointerEvent<SVGGElement>, plate: number) => {
    event.preventDefault();
    if (!readOnly) dispatch({ type: 'deal', plate });
  };

  return (
    <div className={styles.wrap} data-target-size={targetSize} style={{ width: `${100 * scale}%` }}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.button}
          onClick={() => dispatch({ type: 'deal-round' })}
          disabled={readOnly || share.pile < share.groups}
        >
          {S.dealRound}
        </button>
        {showNumeral ? (
          <p className={styles.total} data-testid="counter-total">
            {S.total(total)}
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
        onPointerDown={drag.handlers.onPointerDown}
        onPointerMove={drag.handlers.onPointerMove}
        onPointerUp={drag.handlers.onPointerUp}
        onPointerCancel={drag.handlers.onPointerCancel}
      >
        <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill={PAPER} />
        <text x={60} y={110} fontSize={20} fill="#5b6577">
          {S.pile}
        </text>

        {Array.from({ length: share.pile }, (_, index) => {
          const point = pilePoint(index);
          return (
            <g key={`pile-${index}`}>
              <CounterIconShape icon={icon} color="red" x={point.x} y={point.y} r={PILE_RADIUS} />
            </g>
          );
        })}

        {Array.from({ length: share.groups }, (_, plate) => {
          const center = sharePlateCenter(share.groups, plate);
          const count = share.plates[plate] ?? 0;
          return (
            <g
              key={`plate-${plate}`}
              role="button"
              tabIndex={readOnly ? -1 : 0}
              className={styles.plate}
              aria-label={S.plateLabel(plate)}
              data-plate={plate}
              onKeyDown={(event) => onPlateKey(event, plate)}
              onPointerDown={(event) => onPlateTap(event, plate)}
            >
              <ellipse
                cx={center.x}
                cy={center.y}
                rx={PLATE_HALF}
                ry={56}
                fill="#ffffff"
                stroke="#9aa6ba"
                strokeWidth={3}
              />
              {Array.from({ length: count }, (_, index) => {
                const point = plateSlot(center, index);
                return (
                  <CounterIconShape
                    key={`plate-${plate}-${index}`}
                    icon={icon}
                    color="blue"
                    x={point.x}
                    y={point.y}
                    r={PLATE_COUNTER_RADIUS}
                  />
                );
              })}
            </g>
          );
        })}

        {ghost ? (
          <g opacity={0.7}>
            <CounterIconShape icon={icon} color="red" x={ghost.x} y={ghost.y} r={PILE_RADIUS} />
          </g>
        ) : null}
      </svg>

      <p className={styles.instructions}>{S.shareHint}</p>

      <div className={styles.plateControls}>
        {Array.from({ length: share.groups }, (_, plate) => (
          <div key={`take-back-${plate}`} className={styles.plateControl}>
            <span className={styles.plateName}>{S.plateLabel(plate)}</span>
            <button
              type="button"
              className={styles.smallButton}
              onClick={() => dispatch({ type: 'take-back', plate })}
              disabled={readOnly || (share.plates[plate] ?? 0) <= 0}
              aria-label={S.takeBack(plate)}
            >
              ??
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
