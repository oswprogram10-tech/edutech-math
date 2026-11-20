/**
 * equation·proportion 전용 오버레이(big-tilt·match-bars·cross-brackets·area-diff)를 compare 상태에서는
 * 그리지 않게 감싼다. 이 오버레이들은 □·넣어 본 값·격자를 읽으므로 compare에는 뜻이 없다.
 * 기존 오버레이 파일은 건드리지 않는다.
 */
import type { ComponentType } from 'react';
import type { OverlayProps } from '../../../../core/engine-sdk';
import type { E06Config, E06State } from '../../unions';

export function skipInCompare(
  Overlay: ComponentType<OverlayProps<E06Config, E06State>>,
): ComponentType<OverlayProps<E06Config, E06State>> {
  function Guarded(props: OverlayProps<E06Config, E06State>) {
    if (props.state.mode === 'compare') return null;
    return <Overlay {...props} />;
  }
  Guarded.displayName = `SkipInCompare(${Overlay.displayName ?? Overlay.name})`;
  return Guarded;
}
