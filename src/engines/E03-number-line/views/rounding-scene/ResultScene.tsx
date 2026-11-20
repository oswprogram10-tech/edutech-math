/**
 * rounding 상황 결과 장면: 고른 방법의 결과를 마지막 묶음만 그려 보여 준다.
 * 어느 방법이 맞는지는 쓰지 않는다.
 */
import type { RoundingScene } from '../../scenario';
import { numberLineStrings } from '../../strings.ko';
import { BagArt, BusArt, SCENE_TOP, StopArt, TrayArt } from './Art';

const S = numberLineStrings.rounding.scene;

export function captionOf(scene: RoundingScene): string {
  switch (scene.consequence) {
    case 'all-seated':
      return S.allSeated;
    case 'left-behind':
      return S.leftBehind;
    case 'leftover':
      return S.leftover;
    case 'partial-bag':
      return S.partialBag;
    case 'exact':
      return S.exact;
  }
}

export function ResultScene({ scene }: { readonly scene: RoundingScene }) {
  const top = SCENE_TOP + 40;
  // 못 탄 학생·남은 사탕이 있으면 마지막 묶음은 가득 찬 채다.
  const filled = scene.left > 0 ? scene.size : scene.filled;
  return (
    <g
      pointerEvents="none"
      data-testid="rounding-scene"
      data-scenario={scene.scenario}
      data-consequence={scene.consequence}
      role="group"
      aria-label={S.group}
    >
      {scene.scenario === 'bus-seats' ? (
        <>
          <BusArt x={110} y={top} size={scene.size} filled={filled} />
          {scene.consequence === 'left-behind' ? (
            <StopArt x={620} y={top + 90} count={scene.left} />
          ) : null}
        </>
      ) : (
        <>
          <BagArt
            x={110}
            y={top}
            size={scene.size}
            filled={filled}
            label={scene.consequence === 'partial-bag' ? S.bagLabel : S.bagFull}
          />
          {scene.consequence === 'leftover' ? (
            <TrayArt x={620} y={top + 4} count={scene.left} />
          ) : null}
        </>
      )}
      <text
        x={500}
        y={580}
        textAnchor="middle"
        fontSize={22}
        fontWeight={800}
        fill="#1d2330"
        data-testid="rounding-scene-caption"
      >
        {captionOf(scene)}
      </text>
    </g>
  );
}
