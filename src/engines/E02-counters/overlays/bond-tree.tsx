/** 힌트 ②: 지금 접시 수 그대로 가르기 나무를 그린다(정답이 아니라 학생 상태). */
import type { OverlayProps } from '../../../core/engine-sdk';
import { platesOf } from '../reduce';
import { countersStrings as S } from '../strings.ko';
import type { CountersConfig, CountersState } from '../types';

export function BondTreeOverlay({ state }: OverlayProps<CountersConfig, CountersState>) {
  if (state.mode !== 'part-whole') return null;
  if ('variant' in state) return null;
  const plates = platesOf(state);
  const total = state.counters.length;
  const width = 760;
  const left = 120;
  const step = plates.length > 1 ? width / (plates.length - 1) : 0;

  return (
    <svg viewBox="0 0 1000 600" width="100%" height="100%" aria-hidden="true">
      <text x={500} y={180} textAnchor="middle" fontSize={18} fill="#5b6577">
        {S.bondTitle}
      </text>
      <circle cx={500} cy={220} r={34} fill="#ffffff" stroke="#1d2330" strokeWidth={2.5} />
      <text x={500} y={230} textAnchor="middle" fontSize={26} fill="#1d2330">
        {total}
      </text>
      {plates.map((count, index) => {
        const x = plates.length > 1 ? left + index * step : 500;
        return (
          <g key={`bond-${index}`}>
            <line x1={500} y1={254} x2={x} y2={310} stroke="#1d2330" strokeWidth={2.5} />
            <circle cx={x} cy={344} r={30} fill="#ffffff" stroke="#1d2330" strokeWidth={2.5} />
            <text x={x} y={353} textAnchor="middle" fontSize={24} fill="#1d2330">
              {count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
