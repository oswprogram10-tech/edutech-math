// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { loadEngine } from '../../engine-sdk';
import type { EngineId, GoalSpec, LoadedEngine } from '../../engine-sdk';
import { ActivityRunner } from '../ActivityRunner';
import { parseUnitContent } from '../content-schema';
import { engineIdsOfContent } from '../views';
import type { ContentTask, UnitContent } from '../types';

type JsonModule = { readonly default: unknown };

const demoModules = import.meta.glob<JsonModule>('../../../../data/content/demo.json', {
  eager: true,
});

let demo: UnitContent;
let definitions: ReadonlyMap<EngineId, LoadedEngine>;

beforeAll(async () => {
  const entry = Object.values(demoModules)[0];
  if (!entry) throw new Error('demo.json을 읽지 못했습니다.');
  demo = parseUnitContent(entry.default);
  const ids = engineIdsOfContent(demo);
  const loaded = await Promise.all(ids.map(async (id) => [id, await loadEngine(id)] as const));
  definitions = new Map(loaded);
});

afterEach(cleanup);

function activityIdOf(task: ContentTask): string {
  return task.id.slice(0, task.id.lastIndexOf('.'));
}

function taskContent(task: ContentTask): UnitContent {
  const activityId = activityIdOf(task);
  const activity = demo.activities.find((item) => item.id === activityId);
  return {
    unit: 'demo',
    title: '힌트 검사',
    activities: [
      {
        id: activityId,
        title: activity?.title ?? activityId,
        tasks: [task],
      },
    ],
  };
}

function renderTask(task: ContentTask, onHint?: (text: string | null) => void) {
  return render(
    <ActivityRunner
      content={taskContent(task)}
      definitions={definitions}
      activityId={activityIdOf(task)}
      onHint={onHint}
    />,
  );
}

function a3Task(id: string): ContentTask {
  const activity = demo.activities.find((item) => item.id === 'demo.A3');
  const task = activity?.tasks.find((item) => item.id === id);
  if (!task) throw new Error(`과제를 찾지 못했습니다: ${id}`);
  return task;
}

/** GoalSpec의 문자열 정답만 모은다. 배열·객체 정답은 화면 글자로 새지 않는다. */
function answerStrings(goal: GoalSpec): string[] {
  if (goal.kind === 'equals') {
    return typeof goal.value === 'string' ? [goal.value] : [];
  }
  if (goal.kind === 'equivalent-expr') return [goal.expr];
  if (goal.kind === 'all' || goal.kind === 'any') {
    return goal.of.flatMap(answerStrings);
  }
  return [];
}

function expectNoAnswerLeak(task: ContentTask) {
  // 발문에 이미 들어 있는 수(예: "셈돌을 5개 놓아 보세요")는 숨은 정답이 아니다.
  const body = (document.body.textContent ?? '').split(task.prompt).join('');
  // 부등호 기호는 고르는 단추의 이름 자체라 정답 노출이 아니다.
  for (const answer of answerStrings(task.goal).filter((answer) => answer.length > 1)) {
    expect(body).not.toContain(answer);
  }
  expect(body).not.toContain('정답');
  expect(screen.queryByRole('button', { name: /정답/ })).toBeNull();
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: '확인하기' }));
  return screen.getByTestId('hint');
}

function typeFraction(numerator: string, denominator: string) {
  const panel = within(screen.getByTestId('runner-slot-response'));
  fireEvent.click(panel.getByRole('button', { name: '분자: 빈칸' }));
  fireEvent.click(panel.getByRole('button', { name: numerator }));
  fireEvent.click(panel.getByRole('button', { name: '분모: 빈칸' }));
  fireEvent.click(panel.getByRole('button', { name: denominator }));
}

describe('힌트 사다리', () => {
  it('데모 과제를 틀려도 정답 값을 화면에 만들지 않는다', () => {
    for (const activity of demo.activities) {
      for (const task of activity.tasks) {
        renderTask(task);
        try {
          if (task.submit === 'button') {
            for (const level of [1, 2, 3]) {
              const hint = submit();
              expect(hint.dataset.hintLevel).toBe(String(level));
              expectNoAnswerLeak(task);
            }
          } else {
            // 자동 제출 과제는 실패·힌트가 없다. 처음 화면만 확인한다.
            expectNoAnswerLeak(task);
          }
        } finally {
          cleanup();
        }
      }
    }
  });

  it('1/2 + 1/3을 2/5로 쓰면 ① 발문 → ② 그림 → ③ 도움 카드로 올라간다', () => {
    const hintsSeen: (string | null)[] = [];
    const task = a3Task('demo.A3.T1');
    renderTask(task, (text) => hintsSeen.push(text));

    typeFraction('2', '5');

    const first = submit();
    expect(first.dataset.hintLevel).toBe('1');
    expect(within(first).getByTestId('hint-text').textContent).toContain('2/5');
    expect(within(first).queryByTestId('hint-overlay')).toBeNull();
    expectNoAnswerLeak(task);

    const second = submit();
    expect(second.dataset.hintLevel).toBe('2');
    const overlay = within(second).getByTestId('hint-overlay');
    expect(overlay.querySelector('[data-overlay="lasso-guide"]')).not.toBeNull();
    // 문구 없이 그림만 있는 ② 힌트도 빈 칸이 아니라 기본 안내 문구를 보여 준다.
    expect(within(second).getByTestId('hint-text').textContent).toBe(
      '교구에 표시한 그림을 살펴보세요.',
    );
    expectNoAnswerLeak(task);

    const third = submit();
    expect(third.dataset.hintLevel).toBe('3');
    expect(within(third).getByTestId('hint-help')).not.toBeNull();
    expectNoAnswerLeak(task);

    // 지우고 5/6으로 고치면 통과하고 힌트를 지운다.
    fireEvent.click(
      within(screen.getByTestId('runner-slot-response')).getByRole('button', {
        name: '모두 지우기',
      }),
    );
    typeFraction('5', '6');
    fireEvent.click(screen.getByRole('button', { name: '확인하기' }));

    expect(screen.getByText('좋아요, 통과했어요!')).not.toBeNull();
    expect(screen.queryByTestId('hint')).toBeNull();
    expect(hintsSeen[0]).toContain('2/5');
    expect(hintsSeen.at(-1)).toBeNull();
    expectNoAnswerLeak(task);
  });
});
