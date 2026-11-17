/**
 * E12 `lathe` 단면 패널: 레이저로 자른 단면을 2D로 그린다.
 *
 * - 단면 이름 글자를 쓰지 않는다. 그림만 둔다(`data-shape`도 달지 않는다).
 * - `showSection:false`이면 그림 대신 "?" 카드를 보인다.
 * - 그림은 실제 도형 좌표에서 나온다(수평: 반지름 비례 원, 축 포함: 거울로 붙인 도형).
 */
import {
  axisChain,
  chainHeight,
  chainRadius,
  laserHeight,
  mirroredOutline,
  radiusAt,
} from '../lathe/render';
import { observeLathe } from '../lathe/observe';
import { isComplete } from '../lathe/reduce';
import { solid3dStrings as S } from '../strings.ko';
import type { LatheState } from '../types';
import styles from '../View.module.css';

const BOX = 180;
const PAD = 22;

function Figure({ state }: { readonly state: LatheState }) {
  const { profile, edge, laser } = state;
  const chain = profile && edge ? axisChain(profile, edge) : null;
  if (!chain || !laser || !isComplete(state)) return null;
  const R = chainRadius(chain);
  const H = chainHeight(chain);
  const unit = (BOX - 2 * PAD) / Math.max(2 * R, H);
  const cx = BOX / 2;
  const cy = BOX / 2;
  if (laser.plane === 'perpendicular') {
    const h = laserHeight(chain, laser.t);
    const r = radiusAt(chain, h);
    if (r < 1e-9) {
      return <circle cx={cx} cy={cy} r={4} fill="#dc2626" />;
    }
    return (
      <circle
        cx={cx}
        cy={cy}
        r={r * unit}
        fill="#dc2626"
        fillOpacity={0.25}
        stroke="#dc2626"
        strokeWidth={3}
      />
    );
  }
  const outline = mirroredOutline(chain);
  const pts = outline
    .map((p) => `${(cx + p.r * unit).toFixed(1)},${(cy - (p.h - H / 2) * unit).toFixed(1)}`)
    .join(' ');
  return (
    <polygon
      points={pts}
      fill="#dc2626"
      fillOpacity={0.25}
      stroke="#dc2626"
      strokeWidth={3}
      strokeLinejoin="round"
    />
  );
}

export function SectionPanel({ state }: { readonly state: LatheState }) {
  const { showSection } = state.settings;
  const obs = observeLathe(state);
  const hasSection = obs['section'] !== null;
  const mode = !showSection ? 'hidden' : hasSection ? 'shown' : 'empty';
  return (
    <section
      className={styles.ltSection}
      data-testid="lt-section"
      data-state={mode}
      aria-label={S.lathe.sectionLabel}
    >
      <span className={styles.ltSectionCaption}>{S.lathe.sectionLabel}</span>
      <svg
        className={styles.ltSectionSvg}
        viewBox={`0 0 ${BOX} ${BOX}`}
        role="img"
        aria-label={mode === 'hidden' ? S.lathe.sectionHidden : S.lathe.sectionLabel}
      >
        {mode === 'hidden' ? (
          <g data-testid="lt-section-unknown">
            <rect
              x={PAD}
              y={PAD}
              width={BOX - 2 * PAD}
              height={BOX - 2 * PAD}
              rx={14}
              fill="#f1f5fb"
              stroke="#94a3b8"
              strokeWidth={3}
              strokeDasharray="8 6"
            />
            <text
              x={BOX / 2}
              y={BOX / 2 + 20}
              textAnchor="middle"
              fontSize={64}
              fontWeight={800}
              fill="#64748b"
            >
              ?
            </text>
          </g>
        ) : mode === 'shown' ? (
          <Figure state={state} />
        ) : null}
      </svg>
      {mode === 'empty' ? (
        <span className={styles.ltSectionHint}>{S.lathe.sectionEmpty}</span>
      ) : null}
    </section>
  );
}
