/**
 * E13 length Observation. 조각 목록은 시작 위치 순이고, 위치는 Rational 문자열(cm)이다.
 * 물건의 길이는 `reachesEnd`·`exact`로만 드러난다(화면·DOM에는 두지 않는다).
 */
import type { Observation } from '../../../core/engine-sdk';
import { analyze, sortedPieces } from './settings';
import type { MeasureState } from './types';

export function observeLength(state: MeasureState): Observation {
  const base = { mode: 'length', moves: state.moves };
  if (state.error !== null) return { ...base, error: true, misconceptions: [] };
  const sorted = sortedPieces(state.pieces);
  const analysis = analyze(state);
  const countByUnit: Record<string, number> = {};
  for (const piece of sorted) countByUnit[piece.unit] = (countByUnit[piece.unit] ?? 0) + 1;
  const gaps = analysis.gaps.length;
  const overlaps = analysis.overlaps.length;
  const labelsCorrect =
    state.rulerMade &&
    Array.from({ length: 11 }, (_, tick) => tick).every(
      (tick) => state.labels[String(tick)] === tick,
    );
  return {
    ...base,
    pieces: sorted.map((piece) => ({ unit: piece.unit, start: piece.start })),
    count: sorted.length,
    countByUnit,
    gaps,
    overlaps,
    startsAtZero: analysis.startsAtZero,
    reachesEnd: analysis.reachesEnd,
    exact: analysis.exact,
    rulerMade: state.rulerMade,
    labels: { ...state.labels },
    labelsCorrect,
    misconceptions: sorted.length >= 2 && (gaps > 0 || overlaps > 0) ? ['MC-MEASURE-GAP'] : [],
  };
}
