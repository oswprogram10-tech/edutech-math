/**
 * 힌트 ② tally-check (MC-COUNT-ONE-TO-ONE).
 *
 * 아직 ✓가 없는 자료 카드를 점선 테두리로 강조한다. 자료 카드 줄은 HTML이므로
 * (SVG 오버레이가 아니라) 오버레이 칸 안에서 카드의 실제 자리를 재어 같은 크기의 상자를 얹는다.
 * 센 것·안 센 것만 보여 주고, 합계나 정답은 쓰지 않는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { OverlayProps } from '../../../core/engine-sdk';
import type { GraphConfig, GraphState } from '../types';

interface Box {
  readonly index: number;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function sameBoxes(a: readonly Box[], b: readonly Box[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((box, i) => {
    const other = b[i];
    return (
      other !== undefined &&
      box.index === other.index &&
      Math.abs(box.left - other.left) < 0.5 &&
      Math.abs(box.top - other.top) < 0.5 &&
      Math.abs(box.width - other.width) < 0.5 &&
      Math.abs(box.height - other.height) < 0.5
    );
  });
}

export function TallyCheckOverlay({ state }: OverlayProps<GraphConfig, GraphState>) {
  const host = useRef<HTMLDivElement | null>(null);
  const [boxes, setBoxes] = useState<readonly Box[]>([]);
  const { tallied } = state;

  const measure = useCallback(() => {
    const element = host.current;
    if (!element) return;
    // element = 오버레이 칸(inset 0) → 부모 = OverlayLayer → 그 부모가 엔진 View를 담는 판이다.
    const container = element.parentElement?.parentElement;
    const row = container?.querySelector('[data-testid="graph-tally-row"]');
    if (!row) {
      setBoxes((current) => (current.length === 0 ? current : []));
      return;
    }
    const hostBox = element.getBoundingClientRect();
    const next: Box[] = [];
    row.querySelectorAll('[data-tally-index]').forEach((card) => {
      const index = Number(card.getAttribute('data-tally-index'));
      if (tallied.includes(index)) return;
      const rect = card.getBoundingClientRect();
      next.push({
        index,
        left: rect.left - hostBox.left,
        top: rect.top - hostBox.top,
        width: rect.width,
        height: rect.height,
      });
    });
    setBoxes((current) => (sameBoxes(current, next) ? current : next));
  }, [tallied]);

  useEffect(() => {
    measure();
  });

  useEffect(() => {
    const container = host.current?.parentElement?.parentElement;
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    if (container) observer?.observe(container);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  return (
    <div ref={host} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {boxes.map((box) => (
        <div
          key={box.index}
          data-testid="tally-check-box"
          data-index={box.index}
          style={{
            position: 'absolute',
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            boxSizing: 'border-box',
            border: '4px dashed #e8872e',
            borderRadius: 12,
          }}
        />
      ))}
    </div>
  );
}
