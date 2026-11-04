/**
 * E07 세로셈 격자 화면 선택기.
 *
 * 모드에 따라 화면만 고른다. 계산·상태·판정은 reduce·observe·grid가 맡는다.
 * - add·sub·decimal: `views/AddSubView`
 * - mul: `views/MulView`
 * - estimate: `views/EstimateView`
 * - div: `views/DivView`
 */
import { AddSubView } from './views/AddSubView';
import type { ColumnViewProps } from './views/AddSubView';
import { DivView } from './views/DivView';
import { EstimateView } from './views/EstimateView';
import { MulView } from './views/MulView';

export function ColumnCalcView(props: ColumnViewProps) {
  if (props.state.mode === 'mul') return <MulView {...props} />;
  if (props.state.mode === 'estimate') return <EstimateView {...props} />;
  if (props.state.mode === 'div') return <DivView {...props} />;
  return <AddSubView {...props} />;
}
