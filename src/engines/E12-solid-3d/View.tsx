/** E12 3D 입체 화면. 상태의 `mode`에 따라 모드 화면으로 나눈다. */
import type { EngineViewProps } from '../../core/engine-sdk';
import type { SolidAction, SolidConfig, SolidState } from './types';
import { CubesView } from './views/CubesView';

export function SolidView(props: EngineViewProps<SolidConfig, SolidState, SolidAction>) {
  return <CubesView {...props} />;
}
