/**
 * 힌트 ② 시각적 반례 레이어.
 * 엔진 View 위에 겹쳐 그리되 포인터를 가로채지 않는다(조작은 계속 가능해야 한다).
 */
import type { EngineDefinition } from './types';

export interface OverlayLayerProps<Config, State, Action> {
  definition: EngineDefinition<Config, State, Action>;
  /** HintRule.show.overlay가 가리키는 이름 */
  overlay: string;
  config: Config;
  state: State;
  args?: unknown;
  scale?: number;
}

export function OverlayLayer<Config, State, Action>({
  definition,
  overlay,
  config,
  state,
  args,
  scale,
}: OverlayLayerProps<Config, State, Action>) {
  const Component = definition.overlays?.[overlay];
  if (!Component) return null;
  return (
    <div
      data-overlay={overlay}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <Component config={config} state={state} args={args} scale={scale} />
    </div>
  );
}
