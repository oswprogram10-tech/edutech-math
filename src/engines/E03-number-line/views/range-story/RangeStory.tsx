/**
 * range 판의 이야기 층: 게이트와 줄 선 캐릭터. 게이트를 열면 왼쪽부터 한 명씩
 * 게이트 앞으로 와서 지나가거나(통과) 막혀 아래 줄로 비킨다.
 * 목표 범위는 어디에도 쓰지 않는다. 통과·막힘은 학생이 만든 범위로만 정한다.
 */
import { numberLineStrings } from '../../strings.ko';
import styles from '../../View.module.css';
import { RiderFigure, GateFigure } from './Figures';
import { BLOCKED_GROUND_Y, BLOCKED_X, GATE_GROUND_Y, GATE_X, PASSED_X, QUEUE_X } from './geometry';

const S = numberLineStrings.range;

export interface RangeStoryProps {
  readonly riders: readonly number[];
  /** 지금 학생 게이트로 지나가는 키인가. */
  readonly passes: (height: number) => boolean;
  readonly gateOpened: boolean;
  /** 게이트를 연 뒤 결과가 난 캐릭터 수(0~riders.length). */
  readonly shown: number;
  readonly story: 'rollercoaster' | 'train';
}

interface Slot {
  readonly x: number;
  readonly y: number;
  readonly mark: 'passed' | 'blocked' | null;
}

function slotsOf(props: RangeStoryProps): Slot[] {
  const { riders, passes, gateOpened, shown } = props;
  let passedOrder = 0;
  let blockedOrder = 0;
  return riders.map((height, index) => {
    if (!gateOpened || index > shown) {
      return { x: QUEUE_X(index), y: GATE_GROUND_Y, mark: null };
    }
    if (index === shown) return { x: GATE_X, y: GATE_GROUND_Y, mark: null };
    if (passes(height)) {
      const slot: Slot = { x: PASSED_X(passedOrder), y: GATE_GROUND_Y, mark: 'passed' };
      passedOrder += 1;
      return slot;
    }
    const slot: Slot = { x: BLOCKED_X(blockedOrder), y: BLOCKED_GROUND_Y, mark: 'blocked' };
    blockedOrder += 1;
    return slot;
  });
}

export function RangeStory(props: RangeStoryProps) {
  const { riders, passes, gateOpened, shown, story } = props;
  const slots = slotsOf(props);
  const current = gateOpened && shown < riders.length ? riders[shown] : undefined;
  const closed = current !== undefined && !passes(current);
  const done = gateOpened && shown >= riders.length;
  return (
    <g data-testid="range-story" data-gate-done={done} data-story={story}>
      <line
        x1={60}
        y1={GATE_GROUND_Y}
        x2={940}
        y2={GATE_GROUND_Y}
        stroke="#c9d1e0"
        strokeWidth={3}
      />
      <GateFigure closed={closed} label={story === 'train' ? S.storyTrain : S.storyRollercoaster} />
      {riders.map((height, index) => {
        const slot = slots[index];
        if (!slot) return null;
        return (
          <g
            key={`rider-${index}`}
            className={styles.riderMove}
            style={{ transform: `translate(${slot.x}px, ${slot.y}px)` }}
          >
            <RiderFigure
              x={0}
              y={0}
              height={height}
              mark={slot.mark}
              testId={`range-rider-${index}`}
            />
          </g>
        );
      })}
    </g>
  );
}
