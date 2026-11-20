/**
 * 모드별 오버레이를 E13 합집합 타입에 맞춰 주는 어댑터. 상태의 `mode`가 그 모드일 때만 그린다.
 * (오버레이는 실제로 `config`를 읽지 않는다.)
 */
import type { ComponentType } from 'react';
import type { OverlayProps } from '../../../core/engine-sdk';
import type { CompareConfig, CompareState } from '../compare/types';
import type { EstimateConfig, EstimateState } from '../estimate/types';
import { boardHeight as lengthBoardHeight } from '../length/layout';
import { Meter100 } from '../length/overlays/meter-100';
import type { LengthConfig, MeasureState } from '../length/types';
import { LENGTH_CANVAS_SELECTOR } from '../length/types';
import { isTrain } from '../modes';
import type { E13Config, E13State } from '../modes';
import type { TrainConfig, TrainState } from '../train/types';
import { boardHeight as trainBoardHeight } from '../train/layout';
import { TRAIN_CANVAS_SELECTOR } from '../train/types';

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
    if (state.mode !== 'length' || isTrain(state)) return null;
    return <Overlay {...props} config={props.config as LengthConfig} state={state} />;
  };
}

export function forEstimate(
  Overlay: ComponentType<OverlayProps<EstimateConfig, EstimateState>>,
): ComponentType<OverlayProps<E13Config, E13State>> {
  return function EstimateOverlay(props) {
    const { state } = props;
    if (state.mode !== 'estimate') return null;
    return <Overlay {...props} config={props.config as EstimateConfig} state={state} />;
  };
}

export function forTrain(
  Overlay: ComponentType<OverlayProps<TrainConfig, TrainState>>,
): ComponentType<OverlayProps<E13Config, E13State>> {
  return function TrainOverlay(props) {
    const { state } = props;
    if (!isTrain(state)) return null;
    return <Overlay {...props} config={props.config as TrainConfig} state={state} />;
  };
}

/** meter-100은 length(합체 규칙)·unit-train 두 판에서 쓴다. 판마다 맞출 본 판 svg가 다르다. */
export function Meter100Overlay({ state }: OverlayProps<E13Config, E13State>) {
  if (state.mode !== 'length' || state.error !== null) return null;
  if (isTrain(state)) {
    return (
      <Meter100 canvasSelector={TRAIN_CANVAS_SELECTOR} logicalHeight={trainBoardHeight(state)} />
    );
  }
  return (
    <Meter100 canvasSelector={LENGTH_CANVAS_SELECTOR} logicalHeight={lengthBoardHeight(state)} />
  );
}
