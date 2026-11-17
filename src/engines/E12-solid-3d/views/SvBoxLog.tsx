/**
 * `surface-volume` fixed-volume 기록표. 엔진은 줄(가로·세로·높이)만 만들고 겉넓이는 학생이 적는다.
 * 맞음·틀림이나 색 표시를 하지 않는다(판정은 Observation과 GoalSpec 몫).
 */
import { sameBox } from '../sv/geometry';
import { SV_MAX_LOG_ROWS } from '../sv/reduce';
import { solid3dStrings as S } from '../strings.ko';
import type { SvAction, SvState } from '../types';
import styles from '../View.module.css';

interface SvBoxLogProps {
  readonly state: SvState;
  readonly readOnly: boolean;
  readonly dispatch: (action: SvAction) => void;
  readonly onLiveMessage: (msg: string) => void;
}

function parseCell(raw: string): number | null {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  return digits === '' ? null : Number(digits);
}

export function SvBoxLog({ state, readOnly, dispatch, onLiveMessage }: SvBoxLogProps) {
  const [w, d, h] = state.dims;
  const duplicate = state.logRows.some((r) => sameBox([r.w, r.d, r.h], [w, d, h]));
  const addDisabled = readOnly || duplicate || state.logRows.length >= SV_MAX_LOG_ROWS;

  return (
    <div className={styles.svLog} data-testid="sv-log" role="group" aria-label={S.sv.logTitle}>
      <button
        type="button"
        className={styles.button}
        data-testid="sv-log-add"
        disabled={addDisabled}
        onClick={() => {
          dispatch({ type: 'add-log-row' });
          onLiveMessage(S.sv.live.rowAdded);
        }}
      >
        <span>{S.sv.logAdd}</span>
      </button>
      {state.logRows.length > 0 ? (
        <table className={styles.svLogGrid}>
          <thead>
            <tr>
              <th scope="col">{S.sv.widthLabel}</th>
              <th scope="col">{S.sv.depthLabel}</th>
              <th scope="col">{S.sv.heightLabel}</th>
              <th scope="col">{S.sv.surfaceLabel}</th>
              <th scope="col" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {state.logRows.map((row, i) => (
              <tr key={`${row.w}-${row.d}-${row.h}`} data-testid={`sv-log-row-${i}`}>
                <td>{row.w}</td>
                <td>{row.d}</td>
                <td>{row.h}</td>
                <td>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    className={styles.svLogCell}
                    data-testid={`sv-log-cell-${i}`}
                    aria-label={S.sv.logCellAria(row.w, row.d, row.h)}
                    value={row.surface === null ? '' : String(row.surface)}
                    disabled={readOnly}
                    onChange={(e) =>
                      dispatch({
                        type: 'set-log-surface',
                        row: i,
                        value: parseCell(e.target.value),
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.svLogRemove}`}
                    data-testid={`sv-log-remove-${i}`}
                    aria-label={S.sv.logRemoveAria(row.w, row.d, row.h)}
                    disabled={readOnly}
                    onClick={() => {
                      dispatch({ type: 'remove-log-row', row: i });
                      onLiveMessage(S.sv.live.rowRemoved);
                    }}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
