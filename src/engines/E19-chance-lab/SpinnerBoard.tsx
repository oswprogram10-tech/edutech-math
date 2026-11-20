/**
 * E19 spinner 판(논리 1000×600 SVG). 왼쪽에 회전판(또는 주머니), 오른쪽에 최근 결과 10개 줄과 색별 횟수 표를 둔다.
 * 아래 줄(y 480~)은 힌트 ② 오버레이 자리라 비워 둔다. 돌리기 연출은 600ms이고 `prefers-reduced-motion`이면 바로 결과를 보인다.
 */
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { DeviceFigure } from './DeviceFigure';
import { sectorAngles, sectorOfPick } from './device';
import { OUTCOME_INK, fillOf, outcomeName, usePatternPrefix } from './outcome';
import { PatternDefs } from './PatternDefs';
import { E19_STRINGS as S } from './strings.ko';
import { LAST_COUNT, LOGICAL_HEIGHT, LOGICAL_WIDTH, OUTCOMES } from './types';
import type { SpinnerState } from './types';
import type { ChanceUi } from './useChanceUi';

const INK = OUTCOME_INK;
const DEVICE = { cx: 270, cy: 270, r: 190 } as const;
const SPIN_MS = 600;

interface Props {
  readonly state: SpinnerState;
  readonly ui: ChanceUi;
  readonly readOnly: boolean;
  readonly svgStyle: CSSProperties | undefined;
  readonly className: string | undefined;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function SpinnerBoard({ state, ui, readOnly, svgStyle, className }: Props) {
  const prefix = usePatternPrefix('sp');
  const { device } = state;
  const spinner = device.type === 'spinner';
  const angles = sectorAngles(device);
  const pickedSector = state.lastPick === null ? null : sectorOfPick(device, state.lastPick);
  const target = pickedSector === null ? 0 : (angles[pickedSector]?.mid ?? 0);
  // 시행마다 두 바퀴 + 칸 가운데. 결과가 없으면 12시.
  const angle = state.trials === 0 ? 0 : state.trials * 720 + target;
  const animate = state.trials > 0 && !prefersReducedMotion();

  const onKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey || readOnly) return;
    if (!spinner) return;
    if (event.key === 'ArrowLeft') ui.moveSector(-1);
    else if (event.key === 'ArrowRight') ui.moveSector(1);
    else return;
    event.preventDefault();
  };

  const lastShown = state.last.slice(-LAST_COUNT);
  const first = lastShown.length === 0 ? null : lastShown[lastShown.length - 1];

  return (
    <svg
      className={className}
      style={{ ...svgStyle, touchAction: 'manipulation' }}
      viewBox={`0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`}
      role="group"
      aria-label={S.spinner.boardLabel}
      tabIndex={readOnly ? -1 : 0}
      data-testid="chance-canvas"
      data-mode="spinner"
      data-device={device.type}
      data-trials={state.trials}
      onKeyDown={onKeyDown}
    >
      <PatternDefs prefix={prefix} />
      <rect width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} fill="#fbfcff" />
      <DeviceFigure
        device={device}
        cx={DEVICE.cx}
        cy={DEVICE.cy}
        r={DEVICE.r}
        prefix={prefix}
        selected={spinner ? ui.selectedSector : null}
        pick={state.lastPick}
        onSelect={readOnly || !state.editable ? undefined : ui.selectSector}
      />
      {spinner ? (
        <g transform={`translate(${DEVICE.cx} ${DEVICE.cy})`} pointerEvents="none">
          <g
            data-part="arrow"
            data-angle={angle}
            style={{
              transform: `rotate(${angle}deg)`,
              transition: animate ? `transform ${SPIN_MS}ms ease-out` : 'none',
            }}
          >
            <polygon
              points={`-12,0 12,0 0,${-(DEVICE.r + 6)}`}
              fill="#ffffff"
              stroke={INK}
              strokeWidth={3}
              strokeLinejoin="round"
            />
          </g>
          <circle r={12} fill={INK} />
        </g>
      ) : null}

      <text x={560} y={70} fontSize={22} fontWeight={800} fill={INK}>
        {S.spinner.lastTitle}
      </text>
      {lastShown.length === 0 ? (
        <text x={560} y={118} fontSize={20} fontWeight={700} fill="#3d485c">
          {S.spinner.noResult}
        </text>
      ) : (
        lastShown.map((outcome, i) => (
          <g key={i} data-part="last" data-outcome={outcome}>
            <rect
              x={560 + i * 40}
              y={90}
              width={34}
              height={34}
              rx={6}
              fill={fillOf(prefix, outcome)}
              stroke={i === lastShown.length - 1 ? '#e8872e' : INK}
              strokeWidth={i === lastShown.length - 1 ? 5 : 2}
            />
          </g>
        ))
      )}
      {first === null || first === undefined ? null : (
        <text data-part="last-name" x={560} y={152} fontSize={20} fontWeight={700} fill={INK}>
          {outcomeName(first)}
        </text>
      )}

      <text x={560} y={216} fontSize={22} fontWeight={800} fill={INK}>
        {S.spinner.countsTitle}
      </text>
      {OUTCOMES.map((outcome, i) => (
        <g
          key={outcome}
          data-part="count-row"
          data-outcome={outcome}
          data-count={state.counts[outcome]}
        >
          <rect
            x={560}
            y={232 + i * 56}
            width={36}
            height={36}
            rx={6}
            fill={fillOf(prefix, outcome)}
            stroke={INK}
            strokeWidth={2}
          />
          <text x={612} y={258 + i * 56} fontSize={22} fontWeight={700} fill={INK}>
            {S.spinner.countText(outcomeName(outcome), state.counts[outcome])}
          </text>
        </g>
      ))}
    </svg>
  );
}
