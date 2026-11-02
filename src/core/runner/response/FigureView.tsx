/**
 * 선택지·순서 항목에 붙는 읽기 전용 엔진 그림.
 *
 * 실행기가 이미 불러온 엔진 정의를 재사용한다. 그림은 장식이므로 포인터를
 * 받지 않고 `aria-hidden`으로 읽기 목록에서 뺀다. 옵션의 이름표가 뜻을 전한다.
 */
import { useMemo } from 'react';
import type { EngineId, LoadedEngine } from '../../engine-sdk';
import type { ResponseFigure } from './types';
import styles from './ResponseView.module.css';

interface FigureViewProps {
  readonly figure: ResponseFigure;
  readonly definitions?: ReadonlyMap<EngineId, LoadedEngine>;
}

export function FigureView({ figure, definitions }: FigureViewProps) {
  const definition = definitions?.get(figure.engine);
  const state = useMemo(
    () => (definition ? definition.createInitialState(figure.config as never) : null),
    [definition, figure.config],
  );
  if (!definition || state === null) {
    return <span className={styles.figureMissing} data-figure-missing="true" aria-hidden="true" />;
  }
  const View = definition.View;
  return (
    <span
      className={styles.figure}
      data-figure-engine={figure.engine}
      data-figure-mode={figure.mode}
      aria-hidden="true"
    >
      <View
        config={figure.config as never}
        state={state as never}
        dispatch={() => undefined}
        cpa={figure.cpa}
        mode={figure.mode}
        readOnly
        targetSize={48}
      />
    </span>
  );
}
