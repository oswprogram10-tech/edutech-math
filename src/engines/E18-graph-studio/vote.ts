/**
 * 학급 투표(class-vote)의 파생 값. 투표(`votes`)만 저장하고, 표·○ 그래프는 거기서 바로 계산한다.
 *
 * ○ 그래프와 표는 "주어진 ○ 그래프"(자료 = 투표 수)와 같은 그림으로 그린다. 그래서 투표가 쌓이면
 * ○가 아래부터 쌓이고 표 값이 함께 바뀐다. 학생이 칸을 고르지 않는다.
 */
import { voteCountOf } from './reduce';
import type { ClassVoteState, GraphState, TableToGraphState } from './types';

export function voteCounts(state: ClassVoteState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const option of state.settings.categories) {
    counts[option] = voteCountOf(state.votes, option);
  }
  return counts;
}

/** 투표를 자료로 바꾼 "주어진 ○ 그래프" 상태. 표·○ 그래프·Observation 계산이 공통으로 쓴다. */
export function voteViewState(state: ClassVoteState): TableToGraphState {
  const counts = voteCounts(state);
  return {
    mode: 'table-to-graph',
    settings: {
      ...state.settings,
      data: counts,
      graph: 'given',
      graphType: 'o-mark',
      table: state.settings.table === 'hidden' ? 'hidden' : 'given',
      tooltips: 'hide',
    },
    table: counts,
    tallied: state.tallied,
    marks: state.marks,
    bars: state.bars,
    scale: 1,
    orientation: state.orientation,
    datasetId: state.datasetId,
  };
}

export function isClassVote(state: GraphState): state is ClassVoteState {
  return state.mode === 'class-vote';
}
