/**
 * 별 하나. 밝기는 색만이 아니라 별 모양(빈 별 / 반 채운 별 / 꽉 찬 별)과
 * `aria-label` 문구로 함께 전달한다.
 *
 * `memo`인 이유: 확대·이동 중에는 부모가 다시 렌더해도 별은 그대로 둔다.
 */
import { memo } from 'react';
import type { KeyboardEvent } from 'react';
import { starMapStrings } from '../strings.ko';
import type { Brightness } from './brightness';
import { STAR_RADIUS } from './layout';
import { STAR_PATH } from './star-shape';
import styles from './StarMap.module.css';

export interface ConceptStarProps {
  readonly conceptId: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly brightness: Brightness;
  readonly sparkle: boolean;
  readonly enabled: boolean;
  readonly onSelect: (conceptId: string) => void;
}

function brightnessClass(brightness: Brightness): string {
  switch (brightness) {
    case 'mastered':
      return styles.mastered ?? '';
    case 'practicing':
      return styles.practicing ?? '';
    case 'missing':
      return styles.missing ?? '';
  }
}

export const ConceptStar = memo(function ConceptStar({
  conceptId,
  label,
  x,
  y,
  brightness,
  sparkle,
  enabled,
  onSelect,
}: ConceptStarProps) {
  const brightnessLabel = starMapStrings.brightness[brightness];
  const name = starMapStrings.starLabel(label, brightnessLabel);

  const activate = () => {
    if (enabled) onSelect(conceptId);
  };

  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (!enabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onSelect(conceptId);
    }
  };

  return (
    <g
      className={`${styles.star} ${brightnessClass(brightness)} ${enabled ? '' : styles.starOff}`}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={enabled ? 0 : undefined}
      aria-label={name}
      aria-disabled={enabled ? undefined : true}
      data-brightness={brightness}
      data-enabled={enabled ? 'true' : 'false'}
      data-sparkle={sparkle ? 'true' : 'false'}
      data-label={label}
      onClick={activate}
      onKeyDown={onKeyDown}
    >
      {enabled ? (
        <>
          <circle className={styles.hit} r={STAR_RADIUS + 6} />
          <circle className={styles.focusRing} r={STAR_RADIUS + 6} />
          <path
            className={`${styles.shape} ${brightnessClass(brightness)}`}
            d={STAR_PATH}
            vectorEffect="non-scaling-stroke"
          />
          {sparkle ? (
            <g className={styles.sparkle} aria-hidden="true">
              <circle cx={STAR_RADIUS + 3} cy={-STAR_RADIUS - 1} r={1.8} />
              <path d="M10,-14 L11,-11 L14,-10 L11,-9 L10,-6 L9,-9 L6,-10 L9,-11 Z" />
            </g>
          ) : null}
        </>
      ) : (
        // 꺼진 단원의 개념은 별이 아니라 작은 흐린 점으로만 보여 준다(docs/06 S2).
        <circle className={styles.dot} r={3.4} />
      )}
    </g>
  );
});
