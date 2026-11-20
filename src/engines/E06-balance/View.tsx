/**
 * E06 양팔저울 화면. 판(SVG)은 남는 칸에 맞춰 줄고 최소 배율 0.6 아래로는 줄이지 않고 스크롤한다.
 * 조작 칸은 스크롤 상자 밖에 있다. 설정 오류면 오류 문구만 보인다.
 */
import { useRef } from 'react';
import { useRenderedSize } from '../../core/engine-sdk';
import type { EngineViewProps } from '../../core/engine-sdk';
import { BalanceBoard } from './Board';
import { CompareView } from './compare/View';
import type { CompareConfig } from './compare/types';
import { Controls } from './Controls';
import { MIN_SCALE, fitBoard } from './fit';
import { ProportionView } from './proportion/View';
import { balanceStrings as S } from './strings.ko';
import type { BalanceAction, BalanceConfig, BalanceState } from './types';
import type { ProportionConfig } from './proportion/types';
import type { E06Action, E06Config, E06State } from './unions';
import { useBalanceUi } from './useBalanceUi';
import styles from './View.module.css';

export { MIN_SCALE };

function EquationView({
  state,
  dispatch,
  targetSize,
  readOnly = false,
}: EngineViewProps<BalanceConfig, BalanceState, BalanceAction>) {
  const boardRef = useRef<HTMLDivElement>(null);
  const board = useRenderedSize(boardRef);
  const ui = useBalanceUi(state, dispatch, readOnly);

  if (state.error !== null) {
    return (
      <div className={styles.wrap} data-target-size={targetSize} data-testid="balance-error-wrap">
        <div className={styles.errorBoard} role="alert" data-testid="balance-error">
          <p>{S.configError}</p>
          <p>{S.configErrorBody}</p>
        </div>
      </div>
    );
  }

  const { svgStyle, scroll } = fitBoard(board);

  return (
    <div
      className={styles.wrap}
      data-target-size={targetSize}
      data-look={state.settings.look}
      onKeyDown={ui.onKeyDown}
    >
      <div className={styles.stageRow}>
        <div
          ref={boardRef}
          className={styles.boardArea}
          data-scroll={scroll ? 'true' : 'false'}
          data-testid="balance-board"
        >
          <BalanceBoard state={state} svgStyle={svgStyle} className={styles.boardSvg} />
        </div>
        <Controls state={state} dispatch={dispatch} ui={ui} readOnly={readOnly} />
      </div>
    </div>
  );
}

/** 상태의 모드(equation·proportion·compare)에 맞는 화면을 고른다. */
export function BalanceView(props: EngineViewProps<E06Config, E06State, E06Action>) {
  const { state, dispatch, config, ...rest } = props;
  if (state.mode === 'compare') {
    return (
      <CompareView {...rest} config={config as CompareConfig} state={state} dispatch={dispatch} />
    );
  }
  if (state.mode === 'proportion') {
    return (
      <ProportionView
        {...rest}
        config={config as ProportionConfig}
        state={state}
        dispatch={dispatch}
      />
    );
  }
  return (
    <EquationView {...rest} config={config as BalanceConfig} state={state} dispatch={dispatch} />
  );
}
