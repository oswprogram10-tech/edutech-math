/**
 * 힌트 ②: 학생이 고른 줄(기본은 첫 깨진 줄)과 그 앞 줄의 값을 같은 기준의
 * 막대 두 개로 그린다. 정답 막대는 그리지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { analyzeState, barRatio } from '../analyze';
import { stepSolverStrings as S } from '../strings.ko';
import type { StepSolverConfig, StepSolverState } from '../types';

function argsLine(args: unknown): number | null {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return null;
  const value = (args as Record<string, unknown>)['line'];
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

export function BarCheckOverlay({ state, args }: OverlayProps<StepSolverConfig, StepSolverState>) {
  const analysis = analyzeState(state);
  const line = argsLine(args) ?? analysis.firstBrokenLine;
  if (line === null || line <= 0 || line >= analysis.lines.length) return null;

  const previous = analysis.lines[line - 1];
  const current = analysis.lines[line];
  if (!previous?.value || !current?.value) return null;
  if (previous.value.isNegative() || current.value.isNegative()) return null;

  const maximum = previous.value.compareTo(current.value) >= 0 ? previous.value : current.value;
  const previousRatio = barRatio(previous.value, maximum);
  const currentRatio = barRatio(current.value, maximum);

  const left = 80;
  const width = 840;
  const top = 210;

  return (
    <svg
      viewBox="0 0 1000 600"
      width="100%"
      height="100%"
      data-testid="overlay-bar-check"
      aria-hidden="true"
    >
      <rect
        x={40}
        y={140}
        width={920}
        height={310}
        rx={20}
        fill="#ffffff"
        opacity={0.95}
        stroke="#e8b27a"
        strokeWidth={2}
      />
      <text x={left} y={190} fill="#1d2330" fontSize={24} fontWeight={700}>
        {S.barCheckLabel}
      </text>
      <g>
        <text x={left} y={top + 22} fill="#4b5668" fontSize={18}>
          {S.barPrevious}
        </text>
        <rect x={left + 110} y={top} width={width} height={34} rx={17} fill="#eef2f8" />
        <rect
          x={left + 110}
          y={top}
          width={Math.max(0, width * previousRatio)}
          height={34}
          rx={17}
          fill="#2f6fde"
          opacity={0.75}
        />
      </g>
      <g>
        <text x={left} y={top + 102} fill="#4b5668" fontSize={18}>
          {S.barCurrent}
        </text>
        <rect x={left + 110} y={top + 80} width={width} height={34} rx={17} fill="#eef2f8" />
        <rect
          x={left + 110}
          y={top + 80}
          width={Math.max(0, width * currentRatio)}
          height={34}
          rx={17}
          fill="#e8872e"
          opacity={0.85}
        />
      </g>
    </svg>
  );
}
