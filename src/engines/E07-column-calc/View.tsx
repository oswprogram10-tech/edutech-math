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
  // 어림(estimate) 모드는 자체 화면이 op에 맞는 격자를 고른다.
  if (props.state.mode === 'estimate') return <EstimateView {...props} />;
  // 소수 곱셈(decimal + mul)도 같은 곱셈 격자를 쓴다.
  if (props.state.op === 'mul') return <MulView {...props} />;
  if (props.state.mode === 'div') return <DivView {...props} />;
  return <AddSubView {...props} />;
}
