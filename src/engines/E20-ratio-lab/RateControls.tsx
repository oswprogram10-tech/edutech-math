/**
 * E20 rate 조작 칸(SVG 밖). 캐릭터마다 거리·시간 입력 칸(편집할 수 있는 칸만), 누가 빠를지 예측 단추,
 * 경주 시작, 처음으로. 단추마다 단축키 하나(<kbd>)가 있다. 입력 칸에 글을 쓰는 동안에는 단축키가 꺼진다.
 * 예측 뒤에는 "내 예측"만 보이고, 맞았는지·누가 빠른지는 알리지 않는다.
 */
import { useEffect, useRef } from 'react';
import { ActionButton } from './ActionButton';
import { shortcutsOf } from './shortcuts';
import { E20_STRINGS as S } from './strings.ko';
import { SAME_PREDICTION } from './types';
import type { RacerState, RateState } from './types';
import type { RatioUi } from './useRatioUi';
import styles from './View.module.css';

interface FieldProps {
  readonly racer: RacerState;
  readonly field: 'distance' | 'time';
  readonly ui: RatioUi;
  readonly readOnly: boolean;
}

function Field({ racer, field, ui, readOnly }: FieldProps) {
  const editable = field === 'distance' ? racer.editDistance : racer.editTime;
  const value = racer[field];
  const label =
    field === 'distance' ? S.rate.inputDistance(racer.name) : S.rate.inputTime(racer.name);
  const unit = field === 'distance' ? S.rate.distanceUnit : S.rate.timeUnit;
  return (
    <label className={styles.field}>
      <span className={styles.fieldName}>
        {field === 'distance' ? S.rate.fieldDistance : S.rate.fieldTime}
      </span>
      {editable ? (
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className={styles.numberInput}
          aria-label={label}
          data-racer={racer.id}
          data-field={field}
          disabled={readOnly}
          value={ui.draft(racer.id, field) ?? (value === null ? '' : String(value))}
          onChange={(event) => ui.typeValue(racer.id, field, event.target.value)}
          onBlur={() => ui.clearDraft(racer.id, field)}
        />
      ) : (
        <span className={styles.fixedValue} aria-label={label} data-field={field}>
          {S.rate.fixedValue(value)}
        </span>
      )}
      <span className={styles.fieldUnit}>{unit}</span>
    </label>
  );
}

export interface RateControlsProps {
  readonly state: RateState;
  readonly ui: RatioUi;
  readonly readOnly: boolean;
}

export function RateControls({ state, ui, readOnly }: RateControlsProps) {
  const shortcuts = shortcutsOf(state);
  const common = { shortcuts, ui, readOnly };
  const predicted = state.prediction;
  const box = useRef<HTMLDivElement>(null);
  const hadPrediction = useRef(predicted !== null);

  // 예측하면 예측 단추가 사라지므로, 키보드 사용자의 포커스를 경주 시작 단추로 옮겨 단축키가 계속 듣게 한다.
  useEffect(() => {
    const first = !hadPrediction.current && predicted !== null;
    hadPrediction.current = predicted !== null;
    if (!first || document.activeElement !== document.body) return;
    box.current?.querySelector<HTMLElement>('[data-action="run"]')?.focus();
  }, [predicted]);
  const predictedLabel =
    predicted === SAME_PREDICTION
      ? S.rate.predictSame
      : (state.racers.find((r) => r.id === predicted)?.name ?? '');
  return (
    <div ref={box} className={styles.sideStack} data-testid="ratio-controls">
      <p className={styles.instructions}>{S.rate.instructions}</p>
      {state.racers.map((racer) => (
        <div key={racer.id} className={styles.racerBox} role="group" aria-label={racer.name}>
          <strong className={styles.racerName}>{racer.name}</strong>
          <Field racer={racer} field="distance" ui={ui} readOnly={readOnly} />
          <Field racer={racer} field="time" ui={ui} readOnly={readOnly} />
        </div>
      ))}
      {predicted === null ? (
        <div className={styles.group} role="group" aria-label={S.rate.predictTitle}>
          <p className={styles.made}>{S.rate.predictTitle}</p>
          <div className={styles.row}>
            {state.racers.map((racer) => (
              <ActionButton
                key={racer.id}
                id={`predict-${racer.id}`}
                label={racer.name}
                {...common}
              />
            ))}
            <ActionButton id="predict-same" label={S.rate.predictSame} {...common} />
          </div>
        </div>
      ) : (
        <p className={styles.made} data-testid="rate-prediction" data-value={predicted}>
          {S.rate.predictedLine(predictedLabel)}
        </p>
      )}
      <div className={styles.row} role="group" aria-label={S.controlsLabel}>
        <ActionButton
          id="run"
          label={state.runs > 0 ? S.rate.runAgain : S.rate.run}
          {...common}
          primary
        />
        <ActionButton id="reset" label={S.rate.reset} {...common} />
      </div>
      <p className={styles.status} role="status" data-testid="ratio-message">
        {ui.message ?? ''}
      </p>
    </div>
  );
}
