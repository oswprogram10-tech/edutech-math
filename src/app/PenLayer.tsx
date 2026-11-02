/**
 * 시연 모드 펜 주석 레이어.
 *
 * 좌표는 무대 크기에 대한 0~1 비율로만 들고 있는다. 화면 좌표 궤적을
 * 저장소에 쓰지 않는다(AGENTS 규칙 9). 부모가 초기화하면 함께 사라진다.
 */
import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from '../core/engine-sdk';
import styles from './PenLayer.module.css';

export type PenColor = 'black' | 'red' | 'blue';
export type PenMode = 'off' | 'eraser' | PenColor;

export interface PenStroke {
  readonly id: string;
  readonly color: PenColor;
  readonly points: readonly Point[];
}

interface PenLayerProps {
  readonly mode: PenMode;
  readonly strokes: readonly PenStroke[];
  readonly onChange: (strokes: readonly PenStroke[]) => void;
}

const STROKE_COLOR: Record<PenColor, string> = {
  black: '#101828',
  red: '#d92d20',
  blue: '#2f6fde',
};

function pathOf(points: readonly Point[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

export function PenLayer({ mode, strokes, onChange }: PenLayerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<{ color: PenColor; points: Point[] } | null>(null);
  const activeRef = useRef<{ color: PenColor; points: Point[] } | null>(null);
  const strokeSeq = useRef(0);

  function pointOf(event: ReactPointerEvent<SVGSVGElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (mode === 'off' || mode === 'eraser') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = { color: mode, points: [pointOf(event)] };
    activeRef.current = next;
    setActive(next);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const current = activeRef.current;
    if (!current) return;
    event.preventDefault();
    const next = { color: current.color, points: [...current.points, pointOf(event)] };
    activeRef.current = next;
    setActive(next);
  }

  function finishStroke() {
    const current = activeRef.current;
    activeRef.current = null;
    setActive(null);
    if (!current || current.points.length < 2) return;
    strokeSeq.current += 1;
    onChange([
      ...strokes,
      {
        id: `pen-${Date.now()}-${strokeSeq.current}`,
        color: current.color,
        points: current.points,
      },
    ]);
  }

  function erase(strokeId: string) {
    onChange(strokes.filter((stroke) => stroke.id !== strokeId));
  }

  return (
    <svg
      ref={svgRef}
      className={styles.layer}
      data-testid="demo-pen-layer"
      data-pen-mode={mode}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ pointerEvents: mode === 'off' ? 'none' : 'auto' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
    >
      {strokes.map((stroke) => (
        <g key={stroke.id}>
          <path
            d={pathOf(stroke.points)}
            className={styles.stroke}
            stroke={STROKE_COLOR[stroke.color]}
            data-stroke-id={stroke.id}
          />
          <path
            d={pathOf(stroke.points)}
            className={styles.hit}
            data-stroke-hit={stroke.id}
            style={{ pointerEvents: mode === 'eraser' ? 'stroke' : 'none' }}
            onPointerDown={(event) => {
              if (mode !== 'eraser') return;
              event.stopPropagation();
              erase(stroke.id);
            }}
          />
        </g>
      ))}
      {active && active.points.length > 1 ? (
        <path
          d={pathOf(active.points)}
          className={styles.stroke}
          stroke={STROKE_COLOR[active.color]}
        />
      ) : null}
    </svg>
  );
}
