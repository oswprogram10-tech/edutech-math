/** E12 3D 입체 화면. 상태의 `mode`에 따라 모드 화면으로 나눈다. */
import type { EngineViewProps } from '../../core/engine-sdk';
import type { CubesConfig, SolidAction, SolidConfig, SolidState } from './types';
import { CubesView } from './views/CubesView';
import { NetFoldView } from './views/NetFoldView';
import { XrayView } from './views/XrayView';

export function SolidView(props: EngineViewProps<SolidConfig, SolidState, SolidAction>) {
  if (props.state.mode === 'net-fold') {
    const netConfig =
      props.config?.mode === 'net-fold' ? props.config : { mode: 'net-fold' as const };
    return <NetFoldView {...props} config={netConfig} state={props.state} />;
  }
  if (props.state.mode === 'xray') {
    const xrayConfig = props.config?.mode === 'xray' ? props.config : { mode: 'xray' as const };
    return <XrayView {...props} config={xrayConfig} state={props.state} />;
  }
  const cubesConfig: CubesConfig =
    props.config?.mode === 'net-fold' || props.config?.mode === 'xray' ? {} : (props.config ?? {});
  return <CubesView {...props} config={cubesConfig} state={props.state} />;
}
