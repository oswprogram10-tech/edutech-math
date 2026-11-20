/** E19 결과 4색 무늬 정의와 견본(컴포넌트). 상수·이름은 outcome.ts에 있다. */
import { OUTCOME_COLOR, OUTCOME_INK, fillOf, usePatternPrefix } from './outcome';
import { OUTCOMES } from './types';
import type { Outcome } from './types';

/** SVG 안에 한 번 두는 무늬 정의. prefix는 같은 문서 안에서 겹치지 않게 한다. */
export function PatternDefs({ prefix }: { readonly prefix: string }) {
  return (
    <defs>
      {OUTCOMES.map((outcome) => (
        <pattern
          key={outcome}
          id={`${prefix}-${outcome}`}
          width={10}
          height={10}
          patternUnits="userSpaceOnUse"
        >
          <rect width={10} height={10} fill={OUTCOME_COLOR[outcome]} />
          {outcome === 'blue' ? (
            <path d="M-2,2 l4,-4 M0,10 l10,-10 M8,12 l4,-4" stroke="#ffffff" strokeWidth={2} />
          ) : null}
          {outcome === 'yellow' ? (
            <>
              <circle cx={2.5} cy={2.5} r={1.7} fill={OUTCOME_INK} />
              <circle cx={7.5} cy={7.5} r={1.7} fill={OUTCOME_INK} />
            </>
          ) : null}
          {outcome === 'green' ? (
            <path d="M0,5 H10 M5,0 V10" stroke="#ffffff" strokeWidth={1.6} />
          ) : null}
        </pattern>
      ))}
    </defs>
  );
}

/** 조작 칸(HTML) 안에 놓는 작은 견본. 이름 글은 옆에 따로 쓴다. */
export function Swatch({
  outcome,
  size = 28,
}: {
  readonly outcome: Outcome;
  readonly size?: number;
}) {
  const prefix = usePatternPrefix('sw');
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <PatternDefs prefix={prefix} />
      <rect
        x={2}
        y={2}
        width={24}
        height={24}
        rx={5}
        fill={fillOf(prefix, outcome)}
        stroke={OUTCOME_INK}
        strokeWidth={2}
      />
    </svg>
  );
}
