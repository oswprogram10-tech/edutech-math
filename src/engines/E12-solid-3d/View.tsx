/** E12 3D 입체 화면. 상태의 `mode`에 따라 모드 화면으로 나눈다. */
import type { EngineViewProps } from '../../core/engine-sdk';
import type { CubesConfig, SolidAction, SolidConfig, SolidState } from './types';
import { CubesView } from './views/CubesView';
import { NetFoldView } from './views/NetFoldView';
import { PrismNetView } from './views/PrismNetView';
import { PrismView } from './views/PrismView';
import { SurfaceVolumeView } from './views/SurfaceVolumeView';
import { XrayView } from './views/XrayView';

export function SolidView(props: EngineViewProps<SolidConfig, SolidState, SolidAction>) {
  if (props.state.mode === 'surface-volume') {
    const svConfig =
      props.config?.mode === 'surface-volume' ? props.config : { mode: 'surface-volume' as const };
    return <SurfaceVolumeView {...props} config={svConfig} state={props.state} />;
  }
  if (props.state.mode === 'prism-net') {
    const prismNetConfig =
      props.config?.mode === 'net-fold' && props.config.target === 'prism'
        ? props.config
        : { mode: 'net-fold' as const, target: 'prism' as const };
    return <PrismNetView {...props} config={prismNetConfig} state={props.state} />;
  }
  if (props.state.mode === 'net-fold') {
    const netConfig =
      props.config?.mode === 'net-fold' && props.config.target !== 'prism'
        ? props.config
        : { mode: 'net-fold' as const };
    return <NetFoldView {...props} config={netConfig} state={props.state} />;
  }
  if (props.state.mode === 'xray') {
    const xrayConfig = props.config?.mode === 'xray' ? props.config : { mode: 'xray' as const };
    return <XrayView {...props} config={xrayConfig} state={props.state} />;
  }
  if (props.state.mode === 'prism-pyramid') {
    const prismConfig =
      props.config?.mode === 'prism-pyramid' ? props.config : { mode: 'prism-pyramid' as const };
    return <PrismView {...props} config={prismConfig} state={props.state} />;
  }
  const cubesConfig: CubesConfig =
    props.config?.mode === 'net-fold' ||
    props.config?.mode === 'xray' ||
    props.config?.mode === 'prism-pyramid' ||
    props.config?.mode === 'surface-volume'
      ? {}
      : (props.config ?? {});
  return <CubesView {...props} config={cubesConfig} state={props.state} />;
}
