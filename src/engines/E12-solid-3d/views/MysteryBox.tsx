/**
 * E12 `shapes-sort` 가린 상자 장면.
 *
 * 천으로 덮은 상자 그림과 "만져 보기" 단추를 둔다. 만질 때마다 단서 카드가 하나씩 드러난다.
 * 단서와 그림자는 모양 이름을 쓰지 않는다. 학생이 단서를 모아 어떤 모양인지 추리해 선반에서 고른다.
 */
import { cluesOf, shadowOf, type ShapeClue } from '../shapes/rules';
import { solid3dStrings as S } from '../strings.ko';
import type { ShapesState } from '../types';
import styles from '../View.module.css';

interface MysteryBoxProps {
  readonly state: ShapesState;
  readonly readOnly: boolean;
  readonly onTouch: () => void;
}

function ClueIcon({ clue }: { readonly clue: ShapeClue }) {
  return (
    <svg width={56} height={56} viewBox="0 0 56 56" aria-hidden="true" focusable="false">
      {clue === 'flat' ? (
        <>
          <rect
            x={6}
            y={34}
            width={44}
            height={10}
            rx={3}
            fill="#cfd8ea"
            stroke="#5b6f93"
            strokeWidth={2}
          />
          <rect
            x={10}
            y={14}
            width={36}
            height={14}
            rx={6}
            fill="#f6d3b3"
            stroke="#8a5a2b"
            strokeWidth={2}
          />
          <line x1={6} y1={48} x2={50} y2={48} stroke="#5b6f93" strokeWidth={2} />
        </>
      ) : null}
      {clue === 'pointy' ? (
        <>
          <polyline
            points="10,46 28,10 46,46"
            fill="none"
            stroke="#5b6f93"
            strokeWidth={4}
            strokeLinejoin="miter"
          />
          <circle cx={28} cy={10} r={4.5} fill="#e8872e" />
        </>
      ) : null}
      {clue === 'round' ? (
        <path
          d="M8 44 C8 10 48 10 48 44"
          fill="none"
          stroke="#5b6f93"
          strokeWidth={4}
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

function Shadow({ state }: { readonly state: ShapesState }) {
  const mystery = state.settings.mystery;
  if (!mystery || mystery.shadow === null) return null;
  const form = shadowOf(mystery.kind, mystery.shadow);
  return (
    <figure className={styles.ssShadow} data-testid="ss-shadow" data-view={mystery.shadow}>
      <svg width={96} height={84} viewBox="0 0 96 84" role="img" aria-label={S.shapes.shadowLabel}>
        <rect x={0} y={0} width={96} height={84} rx={10} fill="#f1efe6" />
        {form === 'circle' ? (
          <circle cx={48} cy={42} r={28} fill="#3a3f4b" />
        ) : (
          <rect x={20} y={14} width={56} height={56} fill="#3a3f4b" />
        )}
      </svg>
      <figcaption>{mystery.shadow === 'top' ? S.shapes.shadowTop : S.shapes.shadowSide}</figcaption>
    </figure>
  );
}

export function MysteryBox({ state, readOnly, onTouch }: MysteryBoxProps) {
  const mystery = state.settings.mystery;
  const clues = mystery ? cluesOf(mystery.kind) : [];
  const shown = clues.slice(0, state.cluesShown);
  const done = mystery === null || state.cluesShown >= clues.length;
  return (
    <section className={styles.ssScene} data-testid="ss-mystery-scene">
      <div className={styles.ssMysteryRow}>
        <svg
          className={styles.ssSvg}
          data-testid="ss-mystery"
          viewBox="0 0 220 200"
          role="img"
          aria-label={S.shapes.mysteryLabel}
        >
          <rect x={-1000} y={170} width={2220} height={1000} fill="#e9e1cf" />
          <line x1={-1000} y1={170} x2={1220} y2={170} stroke="#9a8f74" strokeWidth={3} />
          <path
            d="M34 170 C20 120 40 60 76 44 C96 34 124 34 144 44 C180 60 200 120 186 170 Z"
            fill="#8e7cc3"
            stroke="#5b4a94"
            strokeWidth={3}
          />
          <path
            d="M78 60 C84 100 80 140 70 170 M110 46 C112 100 112 140 110 170 M142 60 C136 100 140 140 150 170"
            fill="none"
            stroke="#6f5db0"
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        </svg>
        <Shadow state={state} />
      </div>
      <div className={styles.ssActions}>
        <button
          type="button"
          className={`${styles.button} ${styles.ssBtn}`}
          data-testid="ss-touch"
          disabled={readOnly || done}
          onClick={onTouch}
        >
          <span aria-hidden="true">✋</span>
          <span>{S.shapes.touch}</span>
        </button>
      </div>
      <ul className={styles.ssClues} aria-label={S.shapes.cluesLabel}>
        {shown.map((clue, i) => (
          <li key={clue} className={styles.ssClue} data-testid={`ss-clue-${i}`} data-clue={clue}>
            <ClueIcon clue={clue} />
            <span>{S.shapes.clues[clue]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
