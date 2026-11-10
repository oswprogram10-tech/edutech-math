/**
 * 힌트 ② condition-checklist (MC-GEO-SQUARE-NOT-RECT, MC-GEO-PARALLELOGRAM-NOT-TRAPEZOID).
 *
 * 학생이 지금 만든 사각형 위에 평행 화살표·직각 표시를 굵게 그리고, 왼쪽 아래에
 * 토글 조건마다 그 모양의 계산 결과 ✓/✗만 쓴다. 이름은 쓰지 않는다.
 */
import { CanvasAlignedOverlay } from '../../../core/engine-sdk';
import type { OverlayProps } from '../../../core/engine-sdk';
import { fitPoints, hierarchyPoints, hierarchyShapeBox } from '../layout';
import { hierarchyProps } from '../properties';
import { sorterStrings as S } from '../strings.ko';
import { ALL_TOGGLES, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../types';
import type { ConstraintToggle, SorterConfig, SorterState } from '../types';
import { ParallelArrows, RightAngleMarks, SorterDefs } from '../views/CardShape';
import { argsOf, stringListArg } from './helpers';

function conditionResult(
  toggle: ConstraintToggle,
  pairs: number,
  equalSides: boolean,
  rightAngles: number,
): boolean {
  switch (toggle) {
    case 'one-parallel-pair':
      return pairs >= 1;
    case 'two-parallel-pairs':
      return pairs === 2;
    case 'equal-sides':
      return equalSides;
    case 'right-angle':
      return rightAngles > 0;
    default:
      return false;
  }
}

export function ConditionChecklistOverlay({
  state,
  args,
}: OverlayProps<SorterConfig, SorterState>) {
  if (state.mode !== 'hierarchy') return null;
  const requested = stringListArg(argsOf(args)['conditions']) as ConstraintToggle[];
  const conditions =
    requested.length > 0
      ? ALL_TOGGLES.filter((toggle) => requested.includes(toggle))
      : [...ALL_TOGGLES];
  const { props } = hierarchyProps(state.toggles);
  const shape = fitPoints(hierarchyPoints(state.toggles), hierarchyShapeBox(), 46);
  const polygon = shape.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  const startY = 724;

  return (
    <CanvasAlignedOverlay
      testId="condition-checklist"
      canvasSelector={'svg[data-testid="sorter-canvas"]'}
      logicalWidth={LOGICAL_WIDTH}
      logicalHeight={LOGICAL_HEIGHT}
    >
      <SorterDefs />
      {shape.length >= 3 ? (
        <>
          <polygon
            points={polygon}
            fill="#2f6fde"
            fillOpacity={0.08}
            stroke="#1d2330"
            strokeWidth={6}
            strokeLinejoin="round"
          />
          <RightAngleMarks points={shape} vertices={props.rightAngles} />
          <ParallelArrows points={shape} pairs={props.parallelSidePairs} />
        </>
      ) : null}
      <rect
        x={20}
        y={startingBoxY(startY)}
        width={420}
        height={conditions.length * 56 + 24}
        fill="#ffffff"
        fillOpacity={0.94}
        stroke="#c9d2e2"
        strokeWidth={2}
        rx={12}
      />
      {conditions.map((toggle, index) => {
        const yes = conditionResult(
          toggle,
          props.parallelPairs,
          props.allSidesEqual,
          props.rightAngles.length,
        );
        const y = startY + index * 56;
        return (
          <g key={toggle}>
            <text x={36} y={y} fontSize={18} fontWeight={600} fill="#1d2330">
              {S.toggle[toggle]}
            </text>
            <text
              x={414}
              y={y}
              textAnchor="end"
              fontSize={24}
              fontWeight={700}
              fill={yes ? '#1c7c54' : '#c2410c'}
            >
              {S.hierarchy.conditionResult(yes)}
            </text>
          </g>
        );
      })}
    </CanvasAlignedOverlay>
  );
}

function startingBoxY(startY: number): number {
  return startY - 40;
}
