// @vitest-environment jsdom
/**
 * T013 필수 시나리오: g5s1u4 과제 연속 실패 → g3s1u6 개념 부스터 → 통과 → 원래 과제 복귀.
 *
 * 실제 `data/content/`에는 W1 콘텐츠가 아직 없으므로 `loadContent`로 가짜 콘텐츠를 넣는다.
 * 지식 그래프는 실제 `data/concepts.json`·`data/units.json`을 쓴다.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { loadEngine } from '../../engine-sdk';
import type { EngineId, LoadedEngine } from '../../engine-sdk';
import { MemoryStorage } from '../../storage';
import { ActivityRunner } from '../../runner/ActivityRunner';
import type { UnitContent } from '../../runner/types';
import { g3s1u6Content, g5s1u4Content } from './fixtures/content';

let definitions: ReadonlyMap<EngineId, LoadedEngine>;

beforeAll(async () => {
  definitions = new Map([['E00', await loadEngine('E00')]]);
});

afterEach(cleanup);

/** 2/5처럼 분수 틀에 분자·분모를 차례로 넣는다. */
function typeFraction(root: HTMLElement, numerator: string, denominator: string): void {
  fireEvent.click(within(root).getByRole('button', { name: numerator }));
  fireEvent.click(within(root).getByRole('button', { name: /^분모/ }));
  fireEvent.click(within(root).getByRole('button', { name: denominator }));
}

async function loadFixtureContent(unitId: string): Promise<UnitContent> {
  if (unitId === 'g3s1u6') return g3s1u6Content;
  throw new Error(`테스트 콘텐츠가 없습니다: ${unitId}`);
}

describe('역추적 부스터 시나리오', () => {
  it('g5s1u4 연속 실패 → g3s1u6 부스터 → 통과 → 원래 과제 복귀(상태 보존, 힌트 ①부터)', async () => {
    const storage = new MemoryStorage();
    render(
      <ActivityRunner
        content={g5s1u4Content}
        definitions={definitions}
        storage={storage}
        loadContent={loadFixtureContent}
      />,
    );

    // 원래 과제에 오답(2/5)을 넣고 세 번 제출한다.
    const original = screen.getByTestId('runner-slot-response');
    typeFraction(original, '2', '5');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      fireEvent.click(screen.getByRole('button', { name: '확인하기' }));
    }

    // ③ 역추적 요청이 오개념(MC-FRAC-ADD-DENOM) 대상을 거쳐 g3s1u6 부스터를 연다.
    const dialog = await screen.findByTestId('booster-dialog', undefined, { timeout: 5000 });
    expect(within(dialog).getByRole('heading', { name: '잠깐 연습' })).toBeTruthy();
    expect(within(dialog).getAllByText('단위분수 알아보기').length).toBeGreaterThan(0);
    expect(dialog.textContent).not.toMatch(/학년/);
    expect(dialog.textContent).not.toContain('g3s1u6');

    // 모달이 덮는 동안 원래 과제는 일시 정지된다(키보드·포커스 차단).
    const originalSection = original.closest('section[data-paused]');
    expect(originalSection?.getAttribute('data-paused')).toBe('true');
    expect(
      originalSection?.hasAttribute('inert') ||
        originalSection?.getAttribute('aria-hidden') === 'true',
    ).toBe(true);

    // 모달 안에서 입력하다가 Ctrl+Z를 눌러도 모달 입력만 되돌아가고
    // 원래 과제의 2/5는 그대로 남는다.
    const modalResponse = within(dialog).getByTestId('runner-slot-response');
    fireEvent.click(within(modalResponse).getByRole('button', { name: '1' }));
    fireEvent.click(within(modalResponse).getByRole('button', { name: '2' }));
    expect(within(modalResponse).getByRole('button', { name: '자연수 부분: 12' })).toBeTruthy();

    // 일시 정지 중에는 aria-hidden으로 접근성 트리에서도 빠지므로 hidden: true로 확인한다.
    const originalFraction = () => {
      expect(within(original).getByRole('button', { name: '분자: 2', hidden: true })).toBeTruthy();
      expect(within(original).getByRole('button', { name: '분모: 5', hidden: true })).toBeTruthy();
    };

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(within(modalResponse).getByRole('button', { name: '자연수 부분: 1' })).toBeTruthy();
    originalFraction();

    // Ctrl+Shift+Z(다시 하기)도 모달 입력에만 적용된다.
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(within(modalResponse).getByRole('button', { name: '자연수 부분: 12' })).toBeTruthy();
    originalFraction();

    // 확인용으로 넣은 12를 지우고 부스터 과제를 처음부터 푼다.
    fireEvent.click(within(modalResponse).getByRole('button', { name: '모두 지우기' }));

    // 부스터 과제 3개를 통과한다. 정답 값은 테스트 픽스처에만 있다.
    for (const answer of ['1', '2', '3']) {
      const response = within(dialog).getByTestId('runner-slot-response');
      fireEvent.click(within(response).getByRole('button', { name: answer }));
      fireEvent.click(within(dialog).getByRole('button', { name: '확인하기' }));

      if (answer !== '3') {
        fireEvent.click(await within(dialog).findByRole('button', { name: '다음 과제' }));
      }
    }

    await waitFor(() => expect(screen.queryByTestId('booster-dialog')).toBeNull());

    // 원래 과제의 조작 상태(2/5)가 그대로 남고, 힌트는 ①부터 다시 시작한다.
    const restored = screen.getByTestId('runner-slot-response');
    expect(within(restored).getByRole('button', { name: '분자: 2' })).toBeTruthy();
    expect(within(restored).getByRole('button', { name: '분모: 5' })).toBeTruthy();
    // 모달이 닫히면 일시 정지도 풀린다.
    expect(restored.closest('[data-paused]')).toBeNull();
    expect(restored.closest('[inert]')).toBeNull();
    expect(restored.closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.queryByTestId('hint')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();

    // 숙달도: 원래 개념은 오답 3회만큼 내려가고, 부스터 개념은 3과제 정답으로 숙달된다.
    await waitFor(async () => {
      const records = await storage.listMastery();
      const originalConcept = records.find(
        (item) => item.conceptId === 'g5s1u4.common-denominator',
      );
      const boosterConcept = records.find((item) => item.conceptId === 'g3s1u6.unit-fraction');

      expect(originalConcept?.p).toBeCloseTo(0.3 * 0.75 ** 3, 6);
      expect(boosterConcept?.passedTasks).toHaveLength(3);
      expect(boosterConcept?.p).toBeGreaterThanOrEqual(0.8);
    });

    // 역추적 기록: 열림(깊이 2) → 통과.
    const backtracked = (await storage.listEvents()).filter(
      (event) => event.verb === 'backtracked',
    );
    expect(backtracked.map((event) => event.data?.['outcome'])).toEqual(['opened', 'passed']);
    expect(backtracked[0]?.data?.['to']).toBe('g3s1u6.unit-fraction');
    expect(backtracked[0]?.data?.['depth']).toBe(2);
    expect(backtracked[0]?.data?.['from']).toBe('g5s1u4.A1.T1');

    // 실패 횟수가 0으로 돌아갔으므로 다음 오답은 힌트 ①이다.
    fireEvent.click(screen.getByRole('button', { name: '확인하기' }));
    const hint = await screen.findByTestId('hint');
    expect(hint.getAttribute('data-hint-level')).toBe('1');

    // 힌트 ①을 본 뒤 맞히면 숙달도는 '힌트 ① 사용' 계수로만 오른다.
    const response = screen.getByTestId('runner-slot-response');
    fireEvent.click(within(response).getByRole('button', { name: '모두 지우기' }));
    typeFraction(response, '5', '6');
    fireEvent.click(screen.getByRole('button', { name: '확인하기' }));
    await screen.findByText('좋아요, 통과했어요!');

    await waitFor(async () => {
      const records = await storage.listMastery();
      const originalConcept = records.find(
        (item) => item.conceptId === 'g5s1u4.common-denominator',
      );
      // 오답 4번(부스터 전 3번 + 복귀 뒤 1번) 뒤 힌트 ① 정답.
      const afterFails = 0.3 * 0.75 ** 4;
      expect(originalConcept?.p).toBeCloseTo(afterFails + (1 - afterFails) * 0.2, 6);
      expect(originalConcept?.passedTasks).toEqual(['g5s1u4.A1.T1']);
    });
  });
});
