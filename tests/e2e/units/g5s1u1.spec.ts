import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T186 g5s1u1 「자연수의 혼합 계산」 단원 E2E.
 * 활동마다 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

test.describe.configure({ timeout: 240_000 });

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function openActivity(page: Page, activityId: string, title: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/${activityId}`);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
}

function op(page: Page, opIndex: number): Locator {
  return page.locator(`[data-op="${opIndex}"]`);
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function toggleChoice(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

async function expectFailedWithHint(
  page: Page,
  text: string,
  answers: readonly string[] = [],
  level = 1,
): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', String(level));
  const hint = page.getByTestId('hint-text');
  await expect(hint).toContainText(text);
  const shown = await hint.innerText();
  for (const answer of answers) expect(shown).not.toContain(answer);
}

async function expectPassed(page: Page, last = false): Promise<void> {
  await expect(page.getByText('좋아요, 통과했어요!')).toBeVisible();
  if (last) {
    await expect(page.getByText('모든 과제를 마쳤어요.')).toBeVisible();
    return;
  }
  await page.getByRole('button', { name: '다음 과제' }).click();
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page).toHaveScreenshot(name, {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
    fullPage: true,
  });
}

/** 오버레이 svg 상자가 식 줄 svg 상자와 1px 이내로 같을 때까지 기다린다. */
async function expectOverlayOnExpr(page: Page, overlayName: string): Promise<void> {
  const overlay = page.locator(`[data-overlay="${overlayName}"] svg`);
  await expect(overlay).toHaveCount(1);
  await expect
    .poll(async () => {
      const canvas = await page.getByTestId('order-expr').boundingBox();
      const box = await overlay.boundingBox();
      if (!canvas || !box) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(box.x - canvas.x),
        Math.abs(box.y - canvas.y),
        Math.abs(box.width - canvas.width),
        Math.abs(box.height - canvas.height),
      );
    })
    .toBeLessThanOrEqual(1);
}

/** 화면에 학년 표시가 없고 보이면 안 되는 끝값이 없는지 본다. */
async function expectNoLeak(page: Page, forbidden: readonly string[]): Promise<void> {
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/[1-6]\s*학년/);
  for (const value of forbidden) expect(text).not.toContain(value);
}

/**
 * E08 키패드 단추로 한 줄을 쓴다(줄 번호는 0부터). 키: 숫자, + - * / ( ).
 * 수를 쓰는 동안 커서가 그 수 위에 있어, 기호·괄호 앞에서는 그 수 칸에 초점을 두고 → 로
 * 커서를 수 뒤로 옮긴다.
 */
async function typeLine(page: Page, line: number, expression: string): Promise<void> {
  const names: Record<string, string> = {
    '+': 'add',
    '-': 'sub',
    '*': 'mul',
    '/': 'div',
    '(': 'lparen',
    ')': 'rparen',
  };
  let tokens = 0;
  let previous = '';
  for (const char of expression) {
    const digit = /\d/.test(char);
    if (/\d/.test(previous) && !digit) {
      await page.getByTestId(`token-${line}-${tokens - 1}-value`).focus();
      await page.keyboard.press('ArrowRight');
    }
    if (!digit || !/\d/.test(previous)) tokens += 1;
    previous = char;
    await page.getByTestId(`key-${names[char] ?? char}`).click();
  }
}

test('A1 연산 순서 터치 트리 — 오개념 힌트를 보고 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g5s1u1.A1', '연산 순서 터치 트리');
  await screenshot(page, 'g5s1u1-a1-t1.png');
  await expectNoLeak(page, ['16']);
  await expect(page.getByTestId('order-tree-canvas')).toBeVisible();

  // T1 — −를 먼저 눌러 LEFT-TO-RIGHT 힌트 ①·② 오버레이를 본 뒤 ×부터 줄인다.
  await op(page, 0).click();
  await expect(page.getByTestId('order-wrong-message')).toContainText('다시 살펴봐요');
  await submit(page);
  await expectFailedWithHint(page, '덧셈·뺄셈보다 먼저 해야 할 계산이 있을까', ['20', '16']);
  await submit(page);
  await expectFailedWithHint(page, '나란히 놓고 견주어 봐요', ['16'], 2);
  await expectOverlayOnExpr(page, 'two-ways');
  await op(page, 1).click();
  await op(page, 0).click();
  await submit(page);
  await expectPassed(page);

  // T2 — ×를 먼저 눌러 MUL-BEFORE-DIV 힌트를 본 뒤 왼쪽부터 줄인다.
  await expectNoLeak(page, ['16']);
  await op(page, 1).click();
  await submit(page);
  await expectFailedWithHint(page, '곱셈과 나눗셈은 누가 먼저라는 약속이 있었나', ['16']);
  await submit(page);
  await expectFailedWithHint(page, '나란히 놓고 견주어 봐요', [], 2);
  await expectOverlayOnExpr(page, 'two-ways');
  await op(page, 0).click();
  await op(page, 1).click();
  await submit(page);
  await expectPassed(page);

  // T3 — 괄호 밖 −를 눌러 PAREN-IGNORED 힌트 ①·② 오버레이를 본 뒤 괄호 안부터 줄인다.
  await op(page, 2).click();
  await submit(page);
  await expectFailedWithHint(page, '괄호는 어떤 약속이었지', ['4']);
  await submit(page);
  await expectFailedWithHint(page, '굵은 상자로 묶인 부분', [], 2);
  await expectOverlayOnExpr(page, 'group-box');
  await op(page, 0).click();
  await op(page, 1).click();
  await op(page, 2).click();
  await submit(page);
  await expectPassed(page);

  // T4 — 틀린 누름 없이 괄호 → 곱셈 → 나눗셈 → 덧셈 순서로 끝까지 계산한다.
  await expectNoLeak(page, ['13']);
  await op(page, 2).click();
  await op(page, 1).click();
  await op(page, 3).click();
  await op(page, 0).click();
  await submit(page);
  await expectPassed(page);

  // T5 — 두 줄만 쓰면 줄 수가 모자라 힌트 ①이 뜬다. 줄을 이어 써서 끝낸다.
  await expectNoLeak(page, ['30']);
  await expect(page.getByTestId('order-tree-canvas')).toHaveCount(0);
  await typeLine(page, 1, '60/6*3');
  await submit(page);
  await expectFailedWithHint(page, '줄을 바꿀 때마다 값이 그대로여야 해요', ['30']);
  await page.getByTestId('key-add-line').click();
  await typeLine(page, 2, '10*3');
  await page.getByTestId('key-add-line').click();
  await typeLine(page, 3, '30');
  await submit(page);
  await expectPassed(page, true);
});

test('A2 괄호를 옮기면 이야기가 바뀐다 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({
  page,
}) => {
  await openActivity(page, 'g5s1u1.A2', '괄호를 옮기면 이야기가 바뀐다');

  // T1 — '나'를 골라 힌트 ①을 본 뒤 '가'로 고친다.
  await expect(page.getByTestId('order-expr')).toBeVisible();
  await expect(page.getByTestId('order-tree-canvas')).toHaveCount(0);
  await toggleChoice(page, 'expr', '나');
  await submit(page);
  await expectFailedWithHint(page, '3상자에는 사과가 모두 몇 개인지', ['31']);
  await toggleChoice(page, 'expr', '가');
  await submit(page);
  await expectPassed(page);

  // T2 — '가'를 골라 힌트 ①·②를 본 뒤 '나'로 고친다.
  await toggleChoice(page, 'expr', '가');
  await submit(page);
  await expectFailedWithHint(page, '괄호는 어떤 약속이었지');
  await submit(page);
  await expectFailedWithHint(page, '괄호 안부터 차례로 계산해 봐요', [], 2);
  await toggleChoice(page, 'expr', '나');
  await submit(page);
  await expectPassed(page);

  // T3 — 둘째 줄이 아닌 줄을 눌러 힌트 ①을 본 뒤 둘째 줄을 고른다.
  await screenshot(page, 'g5s1u1-a2-t3.png');
  await expectNoLeak(page, ['30']);
  await page.getByTestId('sample-line-3').click();
  await submit(page);
  await expectFailedWithHint(page, '한 줄씩 따라가며 약속대로 계산했는지', ['30']);
  await page.getByTestId('sample-line-1').click();
  await expect(page.getByTestId('sample-line-1')).toHaveAttribute('aria-pressed', 'true');
  await submit(page);
  await expectPassed(page);

  // T4 — 틀린 줄을 쓴 뒤 힌트 ①을 보고 비우고, 약속대로 한 줄씩 다시 쓴다.
  await typeLine(page, 1, '48*10');
  await submit(page);
  await expectFailedWithHint(page, '줄을 바꿀 때마다 값이 그대로여야 해요', ['30']);
  // 학생 줄이 하나뿐이라 ×는 줄을 지우지 않고 비운다.
  await page.getByTestId('remove-1').click();
  await typeLine(page, 1, '50-2*10');
  await page.getByTestId('key-add-line').click();
  await typeLine(page, 2, '50-20');
  await page.getByTestId('key-add-line').click();
  await typeLine(page, 3, '30');
  await submit(page);
  await expectPassed(page, true);
});

test('키보드만으로 연산 순서 터치 트리 한 과제를 끝낸다', async ({ page }) => {
  await openActivity(page, 'g5s1u1.A1', '연산 순서 터치 트리');
  await op(page, 0).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('order-wrong-message')).toContainText('다시 살펴봐요');
  await page.keyboard.press('ArrowRight');
  await expect(op(page, 1)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('tree-row-1')).toBeVisible();
  await expect(op(page, 0)).toBeFocused();
  await page.keyboard.press('Enter');
  await submit(page);
  await expectPassed(page);
});

test('힌트 문구에 끝값이 들어 있지 않다', () => {
  const content = JSON.parse(readFileSync('data/content/g5s1u1.json', 'utf8')) as {
    activities: { tasks: { hints: { say?: string }[] }[] }[];
  };
  for (const activity of content.activities) {
    for (const task of activity.tasks) {
      for (const hint of task.hints) {
        for (const value of ['16', '13', '31', '21', '30']) {
          expect(hint.say ?? '').not.toContain(value);
        }
      }
    }
  }
});

test('크롬북·전자칠판 첫 화면에 응답 칸과 확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g5s1u1.A1', title: '연산 순서 터치 트리' },
    { id: 'g5s1u1.A2', title: '괄호를 옮기면 이야기가 바뀐다' },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoPanelInnerScroll(page);
    await expectContentPanelsReachable(page);
  }
  await expect(slot(page, 'response')).toBeVisible();
});

test('오프라인에서도 g5s1u1.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g5s1u1.A1`);
  await expect(page.getByRole('heading', { name: '연산 순서 터치 트리' })).toBeVisible();

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
          once: true,
        }),
      );
    }
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: '연산 순서 터치 트리' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
  await expect(page.getByTestId('order-expr')).toBeVisible();
});
