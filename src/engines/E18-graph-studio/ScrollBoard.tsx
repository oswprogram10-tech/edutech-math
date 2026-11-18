/**
 * 누르는 ○ 그래프의 스크롤 칸(boardArea)과 스크롤 안내 띠.
 *
 * 칸이 더 있는 쪽(세로 그래프는 위, 가로 그래프는 오른쪽)이 아직 안 보이면 그 가장자리에
 * 반투명 띠 + 안내 글을 둔다. 띠는 `pointer-events: none`이라 칸 누르기를 막지 않고,
 * 끝까지 스크롤하면 사라진다. 스크롤 칸(`data-scroll="true"`)은 그래프 SVG의 부모 그대로다.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { TargetSize } from '../../core/engine-sdk';
import { graphStrings as S } from './strings.ko';
import styles from './View.module.css';

interface ScrollBoardProps {
  readonly vertical: boolean;
  readonly targetSize: TargetSize;
  readonly children: ReactNode;
}

export function ScrollBoard({ vertical, targetSize, children }: ScrollBoardProps) {
  const area = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const update = () => {
      // 세로 그래프는 처음에 맨 아래(축)에서 시작하므로 위쪽이 더 있다 = scrollTop > 0.
      // 가로 그래프는 처음에 맨 왼쪽에서 시작하므로 오른쪽이 더 있다.
      const hidden = vertical
        ? element.scrollTop > 1
        : element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
      setMore(hidden);
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    if (element.firstElementChild) observer?.observe(element.firstElementChild);
    return () => {
      element.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [vertical]);

  return (
    <div className={styles.boardWrap}>
      <div ref={area} className={styles.boardArea} data-scroll="true">
        {children}
      </div>
      {more ? (
        <div
          className={vertical ? styles.cueTop : styles.cueRight}
          data-testid="graph-scroll-cue"
          data-target-size={targetSize}
          aria-hidden="true"
        >
          <span>{vertical ? S.scroll.moreAbove : S.scroll.moreSide}</span>
        </div>
      ) : null}
    </div>
  );
}
