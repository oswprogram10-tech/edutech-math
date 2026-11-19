/** E16 대응 관계 화면. 상태의 `mode`에 따라 세 모드 화면으로 나눈다. 설정 오류면 빈 판을 그린다. */
import type { EngineViewProps } from '../../core/engine-sdk';
import { BlackBoxView } from './BlackBoxView';
import { CovaryView } from './CovaryView';
import { TableView } from './TableView';
import { functionStrings as S } from './strings.ko';
import type { FunctionAction, FunctionConfig, FunctionState } from './types';
import styles from './View.module.css';

export function FunctionView(
  props: EngineViewProps<FunctionConfig, FunctionState, FunctionAction>,
) {
  const { state } = props;
  if (state.settings.error !== null) {
    return (
      <div className={styles.wrap} data-target-size={props.targetSize} data-mode={state.mode}>
        <div className={styles.errorBoard} role="alert" data-testid="function-error">
          <p>{S.configError}</p>
          <p>{S.configErrorBody}</p>
        </div>
      </div>
    );
  }
  if (state.mode === 'table') return <TableView {...props} state={state} />;
  if (state.mode === 'covary') return <CovaryView {...props} state={state} />;
  return <BlackBoxView {...props} state={state} />;
}
