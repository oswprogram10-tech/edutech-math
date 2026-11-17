/**
 * 접힌 각기둥 무대(SVG). `prism/geometry.ts`의 각기둥 모델을 돌려 볼 수 있게 그린다.
 * 밑면은 파랑, 옆면은 노랑 계열이다. 판정 이유나 자리 이름은 쓰지 않는다.
 */
import { useRef, useState } from 'react';
import { clamp } from '../../../core/engine-sdk';
import {
  buildPrismModel,
  normalizeView,
  polygonPoints,
  projectPrismPoint,
  viewBasis,
  visiblePrismFaces,
  PRISM_HEIGHT_UNIT,
} from '../prism/geometry';
import { solid3dStrings as S } from '../strings.ko';
import styles from '../View.module.css';

const W = 240;
const H = 160;
const LIGHT: readonly [number, number, number] = [-0.35, -0.55, 0.75];
const BASE_RGB: readonly [number, number, number] = [190, 215, 250];
const SIDE_RGB: readonly [number, number, number] = [255, 236, 160];
const DRAG_PX = 6;

interface Props {
  readonly n: number;
  readonly sideLen: number;
  readonly height: number;
  readonly readOnly: boolean;
  readonly onLiveMessage: (msg: string) => void;
}

function shade(rgb: readonly [number, number, number], normal: readonly [number, number, number]) {
  const len = Math.hypot(normal[0], normal[1], normal[2]) || 1;
  const d = (normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2]) / len;
  const k = 0.8 + 0.2 * clamp(0.5 + 0.5 * d, 0, 1);
  return `rgb(${Math.round(rgb[0] * k)}, ${Math.round(rgb[1] * k)}, ${Math.round(rgb[2] * k)})`;
}

export function PrismNetFoldedStage({ n, sideLen, height, readOnly, onLiveMessage }: Props) {
  const [yaw, setYaw] = useState(60);
  const dragRef = useRef<{ id: number; x: number; yaw: number; moved: boolean } | null>(null);
  const [dragYaw, setDragYaw] = useState<number | null>(null);
  const view = normalizeView({ yaw: dragYaw ?? yaw, pitch: 25 });

  // 밑면 한 변(외접원 반지름 1이면 2·sin(π/n))에 대한 옆면 높이 비율로 높이를 정한다. 화면용 실수다.
  const side = 2 * Math.sin(Math.PI / n);
  const heightStep = ((height / sideLen) * side) / PRISM_HEIGHT_UNIT;
  const model = buildPrismModel({ n, height: heightStep, top: 'flat' }, 'upright');
  const basis = viewBasis(view);
  const visible = new Set(visiblePrismFaces(model, view));

  // 먼저 배율 1로 투영해 보고 무대에 들어오게 맞춘다.
  const raw = model.faces.flatMap((f) => f.points.map((p) => projectPrismPoint(p, basis, 1, 0, 0)));
  const minX = Math.min(...raw.map((p) => p.x));
  const maxX = Math.max(...raw.map((p) => p.x));
  const minY = Math.min(...raw.map((p) => p.y));
  const maxY = Math.max(...raw.map((p) => p.y));
  const scale = Math.min(
    (W * 0.84) / Math.max(maxX - minX, 1e-6),
    (H * 0.84) / Math.max(maxY - minY, 1e-6),
  );
  const proj = (p: readonly [number, number, number]) => {
    const q = projectPrismPoint(p, basis, scale, 0, 0);
    return {
      x: W / 2 + q.x - ((minX + maxX) / 2) * scale,
      y: H / 2 + q.y - ((minY + maxY) / 2) * scale,
      depth: q.depth,
    };
  };

  const faces = model.faces
    .filter((f) => visible.has(f.id))
    .map((f) => ({
      face: f,
      depth: proj(f.center).depth,
      points: polygonPoints(f.points.map(proj)),
    }))
    .sort((a, b) => a.depth - b.depth);

  const turn = (delta: number) => {
    if (readOnly) return;
    setYaw((y) => y + delta);
    onLiveMessage(S.prismNet.live.turned);
  };

  return (
    <div className={styles.prismNetFoldedRow}>
      <svg
        className={styles.prismNetFoldedSvg}
        data-testid="prismnet-folded-stage"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={S.prismNet.stageLabel}
        onPointerDown={(e) => {
          if (readOnly) return;
          dragRef.current = { id: e.pointerId, x: e.clientX, yaw, moved: false };
          try {
            e.currentTarget.setPointerCapture?.(e.pointerId);
          } catch {
            // 일부 테스트 환경에서는 pointer capture를 지원하지 않는다.
          }
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (!drag || drag.id !== e.pointerId) return;
          const dx = e.clientX - drag.x;
          if (!drag.moved && Math.abs(dx) > DRAG_PX) drag.moved = true;
          if (drag.moved) setDragYaw(drag.yaw + dx * 0.6);
        }}
        onPointerUp={(e) => {
          const drag = dragRef.current;
          if (!drag || drag.id !== e.pointerId) return;
          dragRef.current = null;
          if (drag.moved) {
            setYaw(normalizeView({ yaw: drag.yaw + (e.clientX - drag.x) * 0.6, pitch: 25 }).yaw);
            onLiveMessage(S.prismNet.live.turned);
          }
          setDragYaw(null);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          setDragYaw(null);
        }}
      >
        {faces.map(({ face, points }) => (
          <polygon
            key={face.id}
            points={points}
            fill={shade(face.id.startsWith('s') ? SIDE_RGB : BASE_RGB, face.normal)}
            stroke="#1e293b"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <div className={styles.prismNetTurns}>
        <button
          type="button"
          className={styles.button}
          data-testid="prismnet-turn-left"
          aria-label={S.prismNet.turnLeft}
          disabled={readOnly}
          onClick={() => turn(-30)}
        >
          <span aria-hidden="true">↺</span>
        </button>
        <button
          type="button"
          className={styles.button}
          data-testid="prismnet-turn-right"
          aria-label={S.prismNet.turnRight}
          disabled={readOnly}
          onClick={() => turn(30)}
        >
          <span aria-hidden="true">↻</span>
        </button>
      </div>
    </div>
  );
}
