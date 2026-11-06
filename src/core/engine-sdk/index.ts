// 엔진 SDK 공개 API. 엔진 폴더는 이 파일만 import한다.
export type {
  CPA,
  EngineDefinition,
  EngineEvent,
  EngineId,
  EnginePredicate,
  EngineViewProps,
  GoalSpec,
  HintRule,
  HintShow,
  JsonValue,
  LoadedEngine,
  Observation,
  OverlayComponent,
  OverlayProps,
  TargetSize,
  Task,
  UnitId,
} from './types';

export { assertSerializable, isSerializable, SerializationError } from './serialization';

export { clamp, clientToLogical, distance, midpoint, pointerToLogical } from './coordinates';
export type { LogicalSize, Point, RectLike } from './coordinates';

export { nearestPointOnRect, snapPoint, snapToEdges, snapToGrid, snapToPoints } from './snap';
export type { SnapEdgeRect, SnapGrid, SnapKind, SnapResult, SnapTargets } from './snap';

export { minTouchRadius, screenPixelsToLogical, svgScaleFactor, useRenderedSize } from './sizing';

export {
  canRedo,
  canUndo,
  createHistory,
  DEFAULT_HISTORY_LIMIT,
  pushHistory,
  redoHistory,
  undoHistory,
  useHistory,
} from './history';
export type { History, UseHistoryResult } from './history';

export { isTapGesture, pathLength, pointInPolygon, selectInside } from './lasso';

export { useDrag } from './useDrag';
export type { DragInfo, UseDragOptions, UseDragResult } from './useDrag';

export { clampScale, pinchDistance, pinchScale, usePinch } from './usePinch';
export type { UsePinchOptions, UsePinchResult } from './usePinch';

export { useLasso } from './useLasso';
export type { LassoGesture, UseLassoOptions, UseLassoResult } from './useLasso';

export { useMultiTouchCount } from './useMultiTouchCount';
export type { UseMultiTouchCountResult } from './useMultiTouchCount';

export { OverlayLayer } from './overlay';
export type { OverlayLayerProps } from './overlay';

export { CanvasAlignedOverlay } from './canvas-frame';
export type { CanvasAlignedOverlayProps } from './canvas-frame';

export { hasEngine, listEngineIds, loadEngine } from './registry';
