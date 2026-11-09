/**
 * E07 배수 사다리(T047 결정 6).
 *
 * C 단계는 후보 숫자 버튼을 같은 크기로 늘어놓고, 학생이 한 후보를 고른 뒤에만
 * 그 후보의 나누는 수 막대 k개와 "이 높이까지" 선을 그린다.
 * P 단계는 나누는 수의 배수 표를 보여 준다(명세가 허용한 비계).
 * 넘침·모자람 표시와 문구는 고른 후보 하나에만, 그 열에서 후보를 고른 뒤에만 보인다.
 * 막대 높이는 화면 좌표 number로만 계산하고, 선을 넘는지 비교는 BigInt로 한다.
 * 정답 몫·나머지는 여기에 쓰지 않는다.
 */
import type { EstimateFit } from '../grid-div';
import { columnCalcStrings as S } from '../strings.ko';
import ladderStyles from './EstimateLadder.module.css';

interface EstimateLadderProps {
  readonly cpa: string;
  readonly targetSize: number;
  readonly divisor: bigint;
  readonly partial: bigint;
  readonly maxMultiple: number;
  /** 이 열에서 마지막으로 고른 후보. 아직 고르지 않았으면 null. */
  readonly selected: number | null;
  /** 고른 후보가 선을 넘는지·딱 맞는지·모자라는지. `selected`가 있을 때만 뜻이 있다. */
  readonly fit: EstimateFit;
  readonly onPreview: (k: number) => void;
  readonly onChoose: (k: number) => void;
}

const MAX_BAR_PX = 150;
const MIN_BAR_PX = 18;

function barHeight(value: bigint, ceiling: bigint): number {
  if (ceiling <= 0n) return MIN_BAR_PX;
  const ratio = Number((value * 1000n) / ceiling) / 1000;
  return Math.max(MIN_BAR_PX, Math.round(ratio * MAX_BAR_PX));
}

export function EstimateLadder({
  cpa,
  targetSize,
  divisor,
  partial,
  maxMultiple,
  selected,
  fit,
  onPreview,
  onChoose,
}: EstimateLadderProps) {
  const multiples: number[] = [];
  for (let k = 1; k <= maxMultiple; k += 1) multiples.push(k);
  const ceiling = divisor * BigInt(maxMultiple);
  const lineHeight = barHeight(partial, ceiling);
  const stackHeight = selected === null ? 0 : barHeight(divisor * BigInt(selected), ceiling);

  return (
    <section className={ladderStyles.panel} aria-label={S.estimateBarLabel}>
      <h3 className={ladderStyles.title}>{S.estimateBarLabel}</h3>

      {cpa === 'C' ? (
        <>
          <div className={ladderStyles.candidates}>
            {multiples.map((k) => (
              <button
                key={k}
                type="button"
                className={ladderStyles.candidate}
                style={{ minWidth: targetSize, minHeight: targetSize }}
                data-candidate={selected === k ? k : undefined}
                data-over={selected === k && fit === 'over' ? true : undefined}
                aria-pressed={k === selected}
                aria-label={S.estimateCandidate(k)}
                onClick={() => onPreview(k)}
              >
                {k}
              </button>
            ))}
          </div>

          {selected === null ? null : (
            <div
              className={ladderStyles.stack}
              style={{ height: MAX_BAR_PX + 8 }}
              aria-hidden="true"
            >
              <div className={ladderStyles.line} style={{ bottom: `${lineHeight}px` }}>
                <span className={ladderStyles.lineLabel}>{S.estimateLine}</span>
              </div>
              <div
                className={fit === 'over' ? ladderStyles.blocksOver : ladderStyles.blocks}
                style={{ height: `${stackHeight}px` }}
              >
                {Array.from({ length: selected }, (_, index) => (
                  <span key={index} className={ladderStyles.block} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <table className={ladderStyles.table}>
          <caption className={ladderStyles.caption}>{S.estimateBarP}</caption>
          <thead>
            <tr>
              <th scope="col">{S.rowQuotient}</th>
              <th scope="col">{S.divisorLabel}</th>
            </tr>
          </thead>
          <tbody>
            {multiples.map((k) => {
              const value = divisor * BigInt(k);
              return (
                <tr key={k} data-candidate={selected === k ? k : undefined}>
                  <td>
                    <button
                      type="button"
                      className={ladderStyles.tableButton}
                      style={{ minHeight: targetSize, minWidth: targetSize }}
                      aria-pressed={k === selected}
                      aria-label={S.estimateCandidate(k)}
                      onClick={() => onPreview(k)}
                    >
                      {k}
                    </button>
                  </td>
                  <td className={ladderStyles.multiple}>{value.toString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {selected === null ? null : (
        <>
          <p className={ladderStyles.status} aria-live="polite">
            {S.estimateCandidate(selected)} ·{' '}
            {fit === 'over' ? S.estimateOver : fit === 'exact' ? S.estimateExact : S.estimateShort}
          </p>
          <button
            type="button"
            className={ladderStyles.choose}
            style={{ minHeight: targetSize }}
            onClick={() => onChoose(selected)}
          >
            {S.estimateChoose(selected)}
          </button>
        </>
      )}
    </section>
  );
}
