/**
 * `prism-pyramid` 카운터 표. 엔진은 줄(입체 종류와 n)만 만들고, 면·모서리·꼭짓점 수는 학생이 적는다.
 * 맞음·틀림이나 색 표시를 하지 않는다(판정은 Observation과 GoalSpec 몫).
 */
import { prismKind } from '../prism/geometry';
import { solid3dStrings as S } from '../strings.ko';
import type { PrismAction, PrismState, PrismTableCol, PrismTableRow } from '../types';
import styles from '../View.module.css';

interface PrismCounterTableProps {
  readonly state: PrismState;
  readonly readOnly: boolean;
  readonly dispatch: (action: PrismAction) => void;
  readonly onLiveMessage: (msg: string) => void;
}

const COLS: readonly { readonly id: PrismTableCol; readonly label: string }[] = [
  { id: 'faces', label: S.prism.tableColFaces },
  { id: 'edges', label: S.prism.tableColEdges },
  { id: 'vertices', label: S.prism.tableColVertices },
];

function rowName(row: PrismTableRow): string {
  return row.kind === 'prism' ? S.prism.prismName(row.n) : S.prism.pyramidName(row.n);
}

function parseCell(raw: string): number | null {
  const digits = raw.replace(/\D/g, '').slice(0, 2);
  return digits === '' ? null : Number(digits);
}

export function PrismCounterTable({
  state,
  readOnly,
  dispatch,
  onLiveMessage,
}: PrismCounterTableProps) {
  const kind = prismKind({ n: state.sides, height: state.height, top: state.top });
  const duplicate = state.table.some((r) => r.kind === kind && r.n === state.sides);
  const addDisabled = readOnly || kind === 'base' || duplicate;

  return (
    <div
      className={styles.prismTable}
      data-testid="prism-table"
      role="group"
      aria-label={S.prism.tableTitle}
    >
      <button
        type="button"
        className={styles.button}
        data-testid="prism-table-add"
        disabled={addDisabled}
        onClick={() => {
          dispatch({ type: 'add-table-row' });
          onLiveMessage(S.prism.live.rowAdded);
        }}
      >
        <span>{S.prism.tableAdd}</span>
      </button>
      {state.table.length > 0 ? (
        <table className={styles.prismTableGrid}>
          <thead>
            <tr>
              <th scope="col">{S.prism.tableColName}</th>
              {COLS.map((c) => (
                <th key={c.id} scope="col">
                  {c.label}
                </th>
              ))}
              <th scope="col" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {state.table.map((row, i) => {
              const name = rowName(row);
              return (
                <tr key={`${row.kind}-${row.n}`} data-testid={`prism-row-${i}`}>
                  <th scope="row" className={styles.prismRowName}>
                    {name}
                  </th>
                  {COLS.map((c) => (
                    <td key={c.id}>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={2}
                        className={styles.prismCell}
                        data-testid={`prism-cell-${i}-${c.id}`}
                        aria-label={S.prism.tableCellAria(name, c.label)}
                        value={row[c.id] === null ? '' : String(row[c.id])}
                        disabled={readOnly}
                        onChange={(e) =>
                          dispatch({
                            type: 'set-table-cell',
                            row: i,
                            col: c.id,
                            value: parseCell(e.target.value),
                          })
                        }
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.prismRowRemove}`}
                      data-testid={`prism-row-remove-${i}`}
                      aria-label={S.prism.tableRemoveRow(name)}
                      disabled={readOnly}
                      onClick={() => {
                        dispatch({ type: 'remove-table-row', row: i });
                        onLiveMessage(S.prism.live.rowRemoved);
                      }}
                    >
                      <span aria-hidden="true">✕</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
