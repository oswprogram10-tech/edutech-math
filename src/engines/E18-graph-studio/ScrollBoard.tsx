/**
 * 누르는 ○ 그래프의 스크롤 칸(boardArea)과 스크롤 안내 띠.
 *
 * 칸이 더 있는 쪽(세로 그래프는 위, 가로 그래프는 오른쪽)이 아직 안 보이면 안내 글을 보인다.
 * 안내는 스크롤 칸 **밖**의 별도 줄(세로는 그래프 바로 위, 가로는 바로 오른쪽)이라 칸을 덮지 않고,
 * 너비(가로 그래프는 높이)는 SVG와 같다. 스크롤할 그림이면 안내가 안 보일 때도 자리를 차지해
 * 나타나고 사라질 때 화면이 들썩이지 않는다. 스크롤이 아예 없으면 자리도 없다.
 * 스크롤 칸(`data-scroll="true"`)은 그래프 SVG의 부모 그대로다.
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
  const wrap = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const [reserve, setReserve] = useState(false);
  const [more, setMore] = useState(false);
  const [span, setSpan] = useState(0);

  useEffect(() => {
    const host = area.current;
    const outer = wrap.current;
    if (!host || !outer) return;
    const update = () => {
      const svg = host.firstElementChild;
      const box = svg?.getBoundingClientRect();
      // 안내 줄이 자리를 차지하기 전 기준으로, 그림이 칸(wrap)보다 큰가.
      const scrollable = box
        ? vertical
          ? box.height > outer.clientHeight + 1
          : box.width > outer.clientWidth + 1
        : false;
      setReserve(scrollable);
      // 세로 그래프는 처음에 맨 아래(축)에서 시작하므로 위쪽이 더 있다 = scrollTop > 0.
      // 가로 그래프는 처음에 맨 왼쪽에서 시작하므로 오른쪽이 더 있다.
      setMore(
        vertical ? host.scrollTop > 1 : host.scrollLeft + host.clientWidth < host.scrollWidth - 1,
      );
      if (box) {
        const size = vertical
          ? Math.min(box.width, host.clientWidth)
          : Math.min(box.height, host.clientHeight);
        setSpan((current) => (Math.abs(current - size) < 0.5 ? current : size));
      }
    };
    update();
    host.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(host);
    observer?.observe(outer);
    if (host.firstElementChild) observer?.observe(host.firstElementChild);
    return () => {
      host.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [vertical]);

  const cue = reserve ? (
    <div
      className={vertical ? styles.cueTop : styles.cueRight}
      data-testid="graph-scroll-cue"
      data-target-size={targetSize}
      data-visible={more ? 'true' : 'false'}
      style={vertical ? { width: span } : { height: span }}
      aria-hidden="true"
    >
      <span>{vertical ? S.scroll.moreAbove : S.scroll.moreSide}</span>
    </div>
  ) : null;

  return (
    <div ref={wrap} className={styles.boardWrap} data-vertical={vertical ? 'true' : 'false'}>
      {vertical ? cue : null}
      <div ref={area} className={styles.boardArea} data-scroll="true">
        {children}
      </div>
      {vertical ? null : cue}
    </div>
  );
}
