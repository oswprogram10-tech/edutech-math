/**
 * 힌트 ② growth-split (MC-PATTERN-GROWTH-TOTAL).
 *
 * 보여 준 단계마다 앞 단계에서 이어진 쌓기나무는 회색 덮개로 덮고, 새로 놓은 쌓기나무는 굵은
 * 테두리로 다시 그린다. 단계 아래에는 그 단계 전체 개수 배지("모두 5개")를 단다.
 * 보여 준 단계는 눈으로 셀 수 있는 그림이라 정답 노출이 아니다. stepsShown 다음 단계는 그리지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { newCubes } from '../growth';
import { CUBE, cubeFaces, growthLayout } from '../growth-layout';
import { patternStrings as S } from '../strings.ko';
import type { PatternConfig, PatternState } from '../types';
import { GROWTH_CANVAS, growthOf } from './helpers';

const COVER = '#6b7385';
const MARK = '#1d2330';

export function GrowthSplitOverlay({ state }: OverlayProps<PatternConfig, PatternState>) {
  const growth = growthOf(state);
  if (!growth) return null;
  const layout = growthLayout(growth.settings);
  if (!layout) return null;
  const shape = growth.settings.shape;

  return (
    <CanvasAlignedOverlay
      testId="growth-split"
      canvasSelector={GROWTH_CANVAS}
      logicalWidth={layout.width}
      logicalHeight={layout.height}
    >
      {layout.panels.map((panel) => {
        // 이 단계에서 새로 놓은 쌓기나무. 1단계는 앞 단계가 없어 덮개도 테두리도 그리지 않는다.
        const fresh = new Set(newCubes(shape, panel.stage).map((cube) => cube.join(',')));
        return (
          <g key={panel.stage} data-testid="growth-split-panel" data-stage={panel.stage}>
            {panel.cubes.map((placed, index) => {
              const isFresh = fresh.has(placed.cube.join(','));
              // 1단계는 앞 단계가 없으므로 덮지 않는다.
              if (!isFresh && panel.stage >= 2) {
                return (
                  <g key={index} data-testid="growth-split-cover">
                    {layout.look === 'cubes' ? (
                      (() => {
                        const faces = cubeFaces(placed.left, placed.top);
                        return (
                          <>
                            <polygon points={faces.left} fill={COVER} fillOpacity={0.7} />
                            <polygon points={faces.right} fill={COVER} fillOpacity={0.7} />
                            <polygon points={faces.top} fill={COVER} fillOpacity={0.7} />
                          </>
                        );
                      })()
                    ) : (
                      <rect
                        x={placed.left}
                        y={placed.top}
                        width={CUBE}
                        height={CUBE}
                        fill={COVER}
                        fillOpacity={0.7}
                      />
                    )}
                  </g>
                );
              }
              if (isFresh && panel.stage >= 2) {
                return (
                  <g key={index} data-testid="growth-split-new">
                    {layout.look === 'cubes' ? (
                      (() => {
                        const faces = cubeFaces(placed.left, placed.top);
                        return (
                          <>
                            <polygon
                              points={faces.left}
                              fill="none"
                              stroke={MARK}
                              strokeWidth={4}
                              strokeLinejoin="round"
                            />
                            <polygon
                              points={faces.right}
                              fill="none"
                              stroke={MARK}
                              strokeWidth={4}
                              strokeLinejoin="round"
                            />
                            <polygon
                              points={faces.top}
                              fill="none"
                              stroke={MARK}
                              strokeWidth={4}
                              strokeLinejoin="round"
                            />
                          </>
                        );
                      })()
                    ) : (
                      <rect
                        x={placed.left + 1}
                        y={placed.top + 1}
                        width={CUBE - 2}
                        height={CUBE - 2}
                        fill="none"
                        stroke={MARK}
                        strokeWidth={4}
                      />
                    )}
                  </g>
                );
              }
              return null;
            })}
            <g data-testid="growth-split-badge" data-stage={panel.stage}>
              <rect
                x={panel.badgeX - 44}
                y={panel.badgeY - 14}
                width={88}
                height={28}
                rx={14}
                fill="#ffffff"
                stroke={MARK}
                strokeWidth={2.5}
              />
              <text
                x={panel.badgeX}
                y={panel.badgeY}
                fontSize={16}
                fontWeight={800}
                textAnchor="middle"
                dominantBaseline="central"
                fill={MARK}
              >
                {S.overlay.growthSplitTotal(panel.cubes.length)}
              </text>
            </g>
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}
