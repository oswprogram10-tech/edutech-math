/**
 * E07 배수 사다리(T047 결정 6).
 *
 * C 단계는 나누는 수 막대를 k개 쌓아 "이 높이까지" 선과 견준다.
 * P 단계는 나누는 수의 배수 표를 보여 준다(명세가 허용한 비계).
 * 막대 높이는 화면 좌표 number로만 계산하고, 선을 넘는지 비교는 BigInt로 한다.
 * 정답 몫·나머지는 여기에 쓰지 않는다.
 */
import { columnCalcStrings as S } from '../strings.ko';
import ladderStyles from './EstimateLadder.module.css';

interface EstimateLadderProps {
  readonly cpa: string;
  readonly targetSize: number;
  readonly divisor: bigint;
  readonly partial: bigint;
  readonly maxMultiple: number;
  readonly candidate: number;
  readonly over: boolean;
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
  candidate,
  over,
  onPreview,
  onChoose,
}: EstimateLadderProps) {
  const multiples: number[] = [];
  for (let k = 1; k <= maxMultiple; k += 1) multiples.push(k);
  const ceiling = divisor * BigInt(maxMultiple);
  const lineHeight = barHeight(partial, ceiling);

  return (
    <section className={ladderStyles.panel} aria-label={S.estimateBarLabel}>
      <h3 className={ladderStyles.title}>{S.estimateBarLabel}</h3>

      {cpa === 'C' ? (
        <div className={ladderStyles.bars} style={{ minHeight: MAX_BAR_PX + 24 }}>
          <div
            className={ladderStyles.line}
            style={{ bottom: `${lineHeight}px` }}
            aria-hidden="true"
          >
            <span className={ladderStyles.lineLabel}>{S.estimateLine}</span>
          </div>
          {multiples.map((k) => {
            const value = divisor * BigInt(k);
            const isOver = value > partial;
            return (
              <button
                key={k}
                type="button"
                className={ladderStyles.bar}
                style={{
                  minWidth: targetSize,
                  height: `${barHeight(value, ceiling)}px`,
                }}
                data-over={isOver || undefined}
                data-candidate={k === candidate || undefined}
                aria-pressed={k === candidate}
                aria-label={`${S.estimateCandidate(k)} · ${isOver ? S.estimateOver : S.estimateShort}`}
                onClick={() => onPreview(k)}
              >
                <span className={ladderStyles.barTop} aria-hidden="true">
                  {k}
                </span>
              </button>
            );
          })}
        </div>
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
              const isOver = value > partial;
              return (
                <tr
                  key={k}
                  data-over={isOver || undefined}
                  data-candidate={k === candidate || undefined}
                >
                  <td>
                    <button
                      type="button"
                      className={ladderStyles.tableButton}
                      style={{ minHeight: targetSize, minWidth: targetSize }}
                      aria-pressed={k === candidate}
                      aria-label={`${S.estimateCandidate(k)} · ${isOver ? S.estimateOver : S.estimateShort}`}
                      onClick={() => onPreview(k)}
                    >
                      {k}
                    </button>
                  </td>
                  <td className={ladderStyles.multiple}>
                    {value.toString()}
                    <span className={ladderStyles.mark} aria-hidden="true">
                      {isOver ? '▲' : '●'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className={ladderStyles.status} aria-live="polite">
        {S.estimateCandidate(candidate)} · {over ? S.estimateOver : S.estimateShort}
      </p>
      <button
        type="button"
        className={ladderStyles.choose}
        style={{ minHeight: targetSize }}
        onClick={() => onChoose(candidate)}
      >
        {S.estimateChoose(candidate)}
      </button>
    </section>
  );
}
