/**
 * 힌트 ② `trial-compare` (MC-ANGLE-SUM-SHAPE-DEPENDENT).
 *
 * 학생이 기록한 시도(최대 3개)를 작게 나란히 그리고 각자 모은 부채꼴을 그린다.
 * 시도가 1개면 그 도형을 2배로 키운 그림과 부채꼴을 옆에 둔다.
 * 각도 숫자는 쓰지 않는다(학생의 기록만 보여 준다).
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { fanSchematic, normalizePolygonToBox, pegScreen, pointsAttribute } from '../layout';
import { cutStrings as S } from '../strings.ko';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { AngleGatherState, AngleTrial } from '../angle-gather/types';
import type { CutConfig, CutState } from '../types';

const BLUE = '#2f6fde';
const ORANGE = '#e8872e';

function TrialMark({ trial, number, total }: { trial: AngleTrial; number: number; total: number }) {
  const left = 712 + (number - 1) * 146;
  const points = normalizePolygonToBox(trial.vertices.map(pegScreen), {
    x: left,
    y: 90,
    width: 120,
    height: 110,
  });
  const fanPaths = fanSchematic({ x: left + 60, y: 290 }, 48, trial.sum);
  return (
    <g data-trial-mark={number}>
      <polygon
        points={pointsAttribute(points)}
        fill={BLUE}
        fillOpacity={0.16}
        stroke={BLUE}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      {fanPaths.map((path, index) => (
        <path
          key={`fan-${number}-${index}`}
          d={path}
          fill="none"
          stroke={ORANGE}
          strokeWidth={5}
          strokeLinecap="round"
        />
      ))}
      <text x={left + 60} y={368} textAnchor="middle" fontSize={17} fontWeight={700} fill="#5a6478">
        {S.angle.trial(number, total)}
      </text>
    </g>
  );
}

export function TrialCompareOverlay({ state }: OverlayProps<CutConfig, CutState>) {
  if (state.mode !== 'angle-gather') return null;
  const angleState = state as AngleGatherState;
  if (angleState.trials.length === 0) return null;

  if (angleState.trials.length === 1) {
    const trial = angleState.trials[0];
    if (!trial) return null;
    const points = normalizePolygonToBox(trial.vertices.map(pegScreen), {
      x: 740,
      y: 90,
      width: 360,
      height: 320,
    });
    const fanPaths = fanSchematic({ x: 1030, y: 250 }, 130, trial.sum);
    return (
      <CanvasAlignedOverlay
        testId="trial-compare"
        canvasSelector={'svg[data-testid="cut-canvas"]'}
        logicalWidth={LOGICAL_WIDTH}
        logicalHeight={LOGICAL_HEIGHT}
      >
        <polygon
          points={pointsAttribute(points)}
          fill={BLUE}
          fillOpacity={0.14}
          stroke={BLUE}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        {fanPaths.map((path, index) => (
          <path
            key={`fan-single-${index}`}
            d={path}
            fill="none"
            stroke={ORANGE}
            strokeWidth={6}
            strokeLinecap="round"
          />
        ))}
        <title>{S.overlays.trialCompare}</title>
      </CanvasAlignedOverlay>
    );
  }

  const visible = angleState.trials.slice(0, 3);
  return (
    <CanvasAlignedOverlay
      testId="trial-compare"
      canvasSelector={'svg[data-testid="cut-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      {visible.map((trial, index) => (
        <TrialMark
          key={`trial-mark-${index}`}
          trial={trial}
          number={index + 1}
          total={angleState.settings.repeatTrials}
        />
      ))}
      <title>{S.overlays.trialCompare}</title>
    </CanvasAlignedOverlay>
  );
}
