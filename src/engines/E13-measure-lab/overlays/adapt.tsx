/**
 * 모드별 오버레이를 E13 합집합 타입에 맞춰 주는 어댑터. 상태의 `mode`가 그 모드일 때만 그린다.
 * (오버레이는 실제로 `config`를 읽지 않는다.)
 */
import type { ComponentType } from 'react';
import type { OverlayProps } from '../../../core/engine-sdk';
import type { CompareConfig, CompareState } from '../compare/types';
import type { LengthConfig, MeasureState } from '../length/types';
import type { E13Config, E13State } from '../modes';

export function forCompare(
  Overlay: ComponentType<OverlayProps<CompareConfig, CompareState>>,
): ComponentType<OverlayProps<E13Config, E13State>> {
  return function CompareOverlay(props) {
    const { state } = props;
    if (state.mode !== 'compare-direct') return null;
    return <Overlay {...props} config={props.config as CompareConfig} state={state} />;
  };
}

export function forLength(
  Overlay: ComponentType<OverlayProps<LengthConfig, MeasureState>>,
): ComponentType<OverlayProps<E13Config, E13State>> {
  return function LengthOverlay(props) {
    const { state } = props;
    if (state.mode !== 'length') return null;
    return <Overlay {...props} config={props.config as LengthConfig} state={state} />;
  };
}
