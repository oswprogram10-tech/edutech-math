/**
 * black-box 모드 화면: 규칙 상자에 수를 넣으면 □가 나오고 대응표에 쌓인다.
 * 숨은 규칙은 DOM에 없다. 상자 그림에는 학생이 넣은 수와 나온 수만 쓴다.
 */
import type { EngineViewProps } from '../../core/engine-sdk';
import { Frame } from './Frame';
import { RelationTable } from './RelationTable';
import { columnsOf, visibleMarks } from './relation-check';
import { functionStrings as S } from './strings.ko';
import type { BlackBoxState, FunctionAction, FunctionConfig } from './types';
import styles from './View.module.css';

type BlackBoxViewProps = Omit<
  EngineViewProps<FunctionConfig, BlackBoxState, FunctionAction>,
  'state'
> & { readonly state: BlackBoxState };

function Machine({ state }: { readonly state: BlackBoxState }) {
  const last = state.trials[state.trials.length - 1];
  const n = state.trials.length;
  return (
    <svg
      data-testid="machine-canvas"
      className={styles.figureSvg}
      viewBox="0 0 640 360"
      role="img"
      aria-label={S.blackBox.machineLabel}
    >
      <title>{S.blackBox.machineLabel}</title>
      <rect x={0} y={0} width={640} height={360} fill="#fbfaf6" />
      <defs>
        <marker
          id="bb-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0 0 L10 5 L0 10 Z" fill="#3d485c" />
        </marker>
      </defs>
      <line
        x1={110}
        y1={190}
        x2={196}
        y2={190}
        stroke="#3d485c"
        strokeWidth={6}
        markerEnd="url(#bb-arrow)"
      />
      <line
        x1={446}
        y1={190}
        x2={540}
        y2={190}
        stroke="#3d485c"
        strokeWidth={6}
        markerEnd="url(#bb-arrow)"
      />
      <rect
        x={200}
        y={70}
        width={240}
        height={240}
        rx={28}
        fill="#dfe8fb"
        stroke="#2f6fde"
        strokeWidth={6}
      />
      <circle
        cx={262}
        cy={244}
        r={30}
        fill="none"
        stroke="#2f6fde"
        strokeWidth={6}
        strokeDasharray="10 8"
      />
      <circle
        cx={380}
        cy={244}
        r={22}
        fill="none"
        stroke="#2f6fde"
        strokeWidth={6}
        strokeDasharray="8 7"
      />
      <text x={320} y={112} fontSize={26} fontWeight={800} textAnchor="middle" fill="#1d4fa8">
        {S.blackBox.machineLabel}
      </text>
      <text
        x={320}
        y={206}
        fontSize={72}
        fontWeight={800}
        textAnchor="middle"
        fill="#2f6fde"
        opacity={0.85}
      >
        ?
      </text>
      <text x={64} y={286} fontSize={24} fontWeight={700} textAnchor="middle" fill="#3d485c">
        {S.blackBox.entrance}
      </text>
      <text x={560} y={286} fontSize={24} fontWeight={700} textAnchor="middle" fill="#3d485c">
        {S.blackBox.exit}
      </text>
      <circle cx={64} cy={190} r={44} fill="#ffffff" stroke="#2f6fde" strokeWidth={5} />
      <text x={64} y={92} fontSize={30} fontWeight={800} textAnchor="middle" fill="#3d485c">
        ○
      </text>
      <rect
        x={516}
        y={146}
        width={88}
        height={88}
        rx={10}
        fill="#ffffff"
        stroke="#c0731a"
        strokeWidth={5}
      />
      <text x={560} y={92} fontSize={30} fontWeight={800} textAnchor="middle" fill="#3d485c">
        □
      </text>
      {last === undefined ? null : (
        <>
          <text
            x={64}
            y={190}
            fontSize={[...last[0]].length > 3 ? 24 : 36}
            fontWeight={800}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#1d2330"
          >
            {last[0]}
          </text>
          <text
            key={`out-${n}`}
            className={styles.outPop}
            x={560}
            y={190}
            fontSize={[...last[1]].length > 3 ? 24 : 36}
            fontWeight={800}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#1d2330"
            data-testid="machine-output"
          >
            {last[1]}
          </text>
        </>
      )}
    </svg>
  );
}

export function BlackBoxView({ state, dispatch, targetSize, readOnly = false }: BlackBoxViewProps) {
  const { settings } = state;
  const columns = columnsOf(state);
  const holds = visibleMarks(state, columns);
  const limited = settings.maxTrials !== null && state.trials.length >= settings.maxTrials;
  const last = state.trials[state.trials.length - 1];

  let notice = '';
  if (state.notice === 'range') {
    notice = S.blackBox.range(settings.inputRange[0], settings.inputRange[1]);
  } else if (state.notice === 'no-output') {
    notice = S.blackBox.noOutput;
  } else if (state.notice === 'limit' || limited) {
    notice = S.blackBox.limitReached;
  }

  const side = (
    <>
      <div className={styles.inputRow}>
        <div
          role="textbox"
          aria-readonly="true"
          aria-label={S.blackBox.inputField}
          tabIndex={readOnly ? -1 : 0}
          className={styles.field}
          data-active={state.target === 'input' ? 'true' : undefined}
          data-testid="input-draft"
          onFocus={() => {
            if (!readOnly && state.target !== 'input') dispatch({ type: 'focus', target: 'input' });
          }}
          onClick={() => {
            if (!readOnly && state.target !== 'input') dispatch({ type: 'focus', target: 'input' });
          }}
        >
          <span className={styles.fieldLabel}>{S.blackBox.inputLabel}</span>
          <span className={styles.fieldValue}>{state.draft}</span>
        </div>
        <button
          type="button"
          className={styles.button}
          disabled={readOnly || limited || state.draft === ''}
          onClick={() => dispatch({ type: 'insert-input' })}
        >
          {S.blackBox.insert}
        </button>
      </div>
      <p className={styles.count} data-testid="trial-count">
        {S.blackBox.trialCount(state.trials.length, settings.maxTrials)}
      </p>
      {notice === '' ? null : (
        <p className={styles.status} role="status" data-testid="function-notice">
          {notice}
        </p>
      )}
      <RelationTable
        columns={columns}
        xLabel={settings.xLabel}
        yLabel={settings.yLabel}
        active={null}
        highlight={
          state.lastX === null ? null : (columns.find((c) => c.x.value === state.lastX)?.id ?? null)
        }
        holds={holds}
        readOnly={readOnly}
        scale={1}
        onActivate={() => undefined}
      />
    </>
  );

  return (
    <Frame
      state={state}
      dispatch={dispatch}
      targetSize={targetSize}
      readOnly={readOnly}
      instruction={S.blackBox.instructions}
      board={<Machine state={state} />}
      side={side}
      status={last === undefined ? '' : S.blackBox.result(last[0], last[1])}
    />
  );
}
