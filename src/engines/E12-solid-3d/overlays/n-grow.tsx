/**
 * 힌트 ② `n-grow` (MC-CONE-AS-PYRAMID):
 * 각뿔의 밑면 변의 수를 3 → 4 → 6 → 12로 바꾸며 그린 정지 그림 네 장을 한 줄로 놓고, 끝에 원뿔을 둔다.
 * 애니메이션은 없다. 변의 수를 글자로 쓰지 않는다. 도형을 아직 고르지 않았어도 그린다(`lathe` 모드일 때).
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { buildPrismModel } from '../prism/geometry';
import {
  axisChain,
  chainHeight,
  frontArc,
  makeProjector,
  pointsAttr,
  solidSilhouette,
} from '../lathe/render';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';
import { NET_CARD_H, NET_CARD_HEADER_H, NET_CARD_W, NetHelperBox } from './NetHelperBox';
import { PrismMiniSolid } from './PrismMiniSolid';

const INNER_W = NET_CARD_W;
const INNER_H = NET_CARD_H - NET_CARD_HEADER_H;
/** 각뿔 밑면 변의 수(정지 그림 순서). */
const N_GROW_SIDES: readonly number[] = [3, 4, 6, 12];
const CELL_W = INNER_W / (N_GROW_SIDES.length + 1);
const VIEW = { yaw: 0, pitch: 20 } as const;

function ConeMini() {
  const chain = axisChain('right-triangle', 'leg-vertical');
  if (!chain) return null;
  const hMid = chainHeight(chain) / 2;
  const projector = makeProjector(VIEW, 14, CELL_W, INNER_H - 40);
  const hull = solidSilhouette(chain, projector);
  const base = frontArc(projector, VIEW, 2, 0, hMid);
  return (
    <g data-testid="n-grow-cone">
      <polygon
        points={pointsAttr(hull)}
        fill="#ffffff"
        fillOpacity={0.9}
        stroke="#334155"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <polyline points={pointsAttr(base)} fill="none" stroke="#334155" strokeWidth={1.6} />
    </g>
  );
}

export function NGrowOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  if (state.mode !== 'lathe') return null;
  return (
    <NetHelperBox
      testId="n-grow"
      titleTestId="n-grow-title"
      title={S.lathe.overlay.nGrowTitle}
      canvasSelector='svg[data-testid="lt-stage"]'
    >
      {N_GROW_SIDES.map((n, i) => (
        <g key={n} transform={`translate(${i * CELL_W}, 10)`} data-testid={`n-grow-pyramid-${i}`}>
          <PrismMiniSolid
            model={buildPrismModel({ n, height: 3, top: 'apex' }, 'upright')}
            view={{ yaw: 0, pitch: 20 }}
            width={CELL_W}
            height={INNER_H - 40}
          />
        </g>
      ))}
      <g transform={`translate(${N_GROW_SIDES.length * CELL_W}, 10)`}>
        <ConeMini />
      </g>
    </NetHelperBox>
  );
}
