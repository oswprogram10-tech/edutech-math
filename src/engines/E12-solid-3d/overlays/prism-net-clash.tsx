/**
 * 힌트 ② `prism-net-clash`(일반 규칙, `prismNetBothBasesSameEnd`용):
 * 지금 전개도를 작게 그리고, 접었을 때 같은 자리로 가는 조각들(중복)에 같은 빗금을 칠해
 * 곡선 화살표로 잇는다. 어느 자리인지 이름은 쓰지 않는다. 중복이 없으면 그리지 않는다.
 */
import type { OverlayProps } from '../../../core/engine-sdk';
import { layoutPieces, polygonCenter } from '../prismnet/layout';
import { evaluateState } from '../prismnet/observe';
import { fitPlaced, toScreen } from '../prismnet/visuals';
import { solid3dStrings as S } from '../strings.ko';
import type { SolidConfig, SolidState } from '../types';
import { HatchPattern, MiniNet } from '../views/PrismNetMini';
import { NET_CARD_H, NET_CARD_HEADER_H, NET_CARD_W, NetHelperBox } from './NetHelperBox';

const INNER_W = NET_CARD_W;
const INNER_H = NET_CARD_H - NET_CARD_HEADER_H;
const HATCH_ID = 'e12-prismnet-hatch-overlay';

export function PrismNetClashOverlay({ state }: OverlayProps<SolidConfig, SolidState>) {
  if (state.mode !== 'prism-net' || state.pieces.length === 0) return null;
  const evaluation = evaluateState(state);
  if (evaluation.duplicateGroups.length === 0) return null;

  const { settings } = state;
  const placed = layoutPieces(
    state.pieces.map((p) => ({
      id: p.id,
      type: p.type,
      parent: p.parent,
      parentEdge: p.parentEdge,
      edge: p.edge,
    })),
    settings.n,
    settings.sideLen,
    settings.height,
  );
  const fit = fitPlaced(placed, INNER_W, INNER_H, 14, 20);
  const hatched = new Set(evaluation.duplicates);
  const centers = placed.map((piece) => polygonCenter(piece.points.map((p) => toScreen(fit, p))));

  const arrows: { readonly key: string; readonly d: string; readonly head: string }[] = [];
  evaluation.duplicateGroups.forEach((group, gi) => {
    for (let k = 0; k + 1 < group.length; k += 1) {
      const a = centers[group[k] ?? 0];
      const b = centers[group[k + 1] ?? 0];
      if (!a || !b) continue;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      // 가운데 점을 수직 방향으로 밀어 곡선으로 만든다.
      const cx = mx - (dy / len) * Math.min(28, len * 0.4);
      const cy = my + (dx / len) * Math.min(28, len * 0.4);
      const tx = b.x - cx;
      const ty = b.y - cy;
      const tl = Math.hypot(tx, ty) || 1;
      const ux = tx / tl;
      const uy = ty / tl;
      const hx = b.x - ux * 6;
      const hy = b.y - uy * 6;
      arrows.push({
        key: `clash-arrow-${gi}-${k}`,
        d: `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`,
        head: `${(hx - uy * 4).toFixed(1)},${(hy + ux * 4).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)} ${(hx + uy * 4).toFixed(1)},${(hy - ux * 4).toFixed(1)}`,
      });
    }
  });

  return (
    <NetHelperBox
      testId="prism-net-clash"
      titleTestId="prism-net-clash-title"
      title={S.prismNet.clashTitle}
      canvasSelector='svg[data-testid="prismnet-board"]'
    >
      <defs>
        <HatchPattern id={HATCH_ID} />
      </defs>
      <MiniNet placed={placed} fit={fit} hatched={hatched} hatchId={HATCH_ID} />
      {arrows.map((a) => (
        <g key={a.key} data-testid="prism-net-clash-arrow">
          <path d={a.d} fill="none" stroke="#b91c1c" strokeWidth={2} strokeLinecap="round" />
          <polygon points={a.head} fill="#b91c1c" />
        </g>
      ))}
    </NetHelperBox>
  );
}
