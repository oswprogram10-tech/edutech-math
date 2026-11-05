import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';

/**
 * T051 g1s1u3 「덧셈과 뺄셈」 단원 E2E.
 * 활동마다 대표 오답 → 힌트 ① → 고쳐서 통과 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

// 과제 하나에 조작·오답·힌트·수정이 이어져 기본 30초로는 모자란다.
test.describe.configure({ timeout: 150_000 });

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function responseSlot(page: Page): Locator {
  return slot(page, 'response');
}

function field(page: Page, id: string): Locator {
  return responseSlot(page).locator(`[data-response-field="${id}"]`);
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

async function typeNumber(page: Page, id: string, keys: readonly string[]): Promise<void> {
  const box = field(page, id);
  await box.getByRole('button', { name: /빈칸$/ }).first().click();
  for (const key of keys) await page.keyboard.press(key);
}

async function clearNumber(page: Page, id: string): Promise<void> {
  // 입력 대상 필드를 먼저 고른 뒤, 필드 밖에 하나뿐인 키패드의 지우기를 누른다.
  await field(page, id).getByRole('button').first().click();
  await responseSlot(page).getByRole('button', { name: '모두 지우기' }).click();
}

async function fillNumbers(page: Page, values: Readonly<Record<string, string>>): Promise<void> {
  for (const [id, value] of Object.entries(values)) {
    await typeNumber(page, id, [...value]);
  }
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectFailedWithHint(page: Page, text: string, level = 1): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', String(level));
  await expect(page.getByTestId('hint-text')).toContainText(text);
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
  // 버튼 클릭으로 스크롤된 상태가 남지 않게 맨 위에서 찍는다.
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

/** 두 번째 접시를 첫 번째 접시로 합친다. */
async function merge(panel: Locator): Promise<void> {
  await panel.getByRole('button', { name: '1번 접시로 합치기' }).click();
}

/** 첫 번째 접시에서 한 개를 두 번째 접시로 옮긴다. */
async function moveOne(panel: Locator): Promise<void> {
  await panel.getByRole('button', { name: '1번 접시 칸막이 왼쪽으로 하나 옮기기' }).click();
}

/** 지금 접시의 가르기를 기록한다. */
async function recordSplit(panel: Locator): Promise<void> {
  await panel.getByRole('button', { name: '가르기 기록하기' }).click();
}

/** 두 접시의 셈돌을 키보드로 하나씩 짝짓는다. */
async function pair(
  page: Page,
  panel: Locator,
  first: { readonly plate: number; readonly slot: number },
  second: { readonly plate: number; readonly slot: number },
): Promise<void> {
  const firstCounter = panel.getByRole('button', {
    name: `${first.plate}번 접시 ${first.slot}번째 셈돌`,
  });
  const secondCounter = panel.getByRole('button', {
    name: `${second.plate}번 접시 ${second.slot}번째 셈돌`,
  });
  await firstCounter.focus();
  await page.keyboard.press('Enter');
  await secondCounter.focus();
  await page.keyboard.press('Enter');
}

test('A1 구슬 모으기·가르기 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s1u3.A1', '구슬 모으기·가르기');
  await screenshot(page, 'g1s1u3-a1.png');
  const panel = slot(page, 'main');

  // T1 — 합치지 않고 4라고 답해 MC-COUNT-ONE-TO-ONE을 만든 뒤, 합쳐서 5로 고친다.
  await typeNumber(page, 'n', ['4']);
  await submit(page);
  await expectFailedWithHint(page, '하나씩 손으로 짚어 볼까?');
  // 같은 오답을 한 번 더 내면 ② 번호 붙인 셈돌과 안내가 나온다.
  await submit(page);
  await expectFailedWithHint(page, '번호가 붙은 셈돌을 다시 세어 볼까?', 2);
  await expect(panel.locator('svg')).toHaveCount(2);
  await merge(panel);
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['5']);
  await submit(page);
  await expectPassed(page);

  // T2 — 6개가 한 접시에만 있어 틀린 뒤, 한 개를 옮겨 두 접시로 나눈다.
  await submit(page);
  await expectFailedWithHint(page, '두 접시에 모두 사탕이 있나요?');
  await moveOne(panel);
  await submit(page);
  await expectPassed(page);

  // T3 — 기록 없이 제출해 틀린 뒤, 세 가지 가르기를 기록한다.
  await submit(page);
  await expectFailedWithHint(page, '한 접시에서 하나를 옮기면 어떻게 달라질까?');
  await recordSplit(panel);
  await moveOne(panel);
  await recordSplit(panel);
  await moveOne(panel);
  await recordSplit(panel);
  await submit(page);
  await expectPassed(page);

  // T4 — 13이라고 답해 MC-EQUAL-ANSWER를 만든 뒤, 3으로 고친다.
  await typeNumber(page, 'n', ['1', '3']);
  await submit(page);
  await expectFailedWithHint(page, '모두 8개야. 5개를 빼면 몇 개가 남을까?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['3']);
  await submit(page);
  await expectPassed(page);

  // T5 — 엔진 없이 13이라고 답해 틀린 뒤, 5로 고친다.
  await typeNumber(page, 'n', ['1', '3']);
  await submit(page);
  await expectFailedWithHint(page, '양쪽이 같아야 해. 왼쪽은 몇이야?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['5']);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 그림 이야기 극장 — 대표 오답 뒤 고쳐서 다섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g1s1u3.A2', '그림 이야기 극장');
  await screenshot(page, 'g1s1u3-a2.png');
  const panel = slot(page, 'main');

  // T1 — 합치지 않고 제출해 틀린 뒤, 새를 모아 덧셈식을 쓴다.
  await submit(page);
  await expectFailedWithHint(page, '처음에 몇 마리였고, 몇 마리가 왔나요?');
  await merge(panel);
  await fillNumbers(page, { x: '3', y: '2', z: '5' });
  await submit(page);
  await expectPassed(page);

  // T2 — 7+2=9라고 답해 MC-SUB-DIRECTION을 만든 뒤, 5로 고친다.
  await fillNumbers(page, { x: '7', y: '2', z: '9' });
  await submit(page);
  await expectFailedWithHint(page, '터진 뒤 남은 풍선은 몇 개?');
  await moveOne(panel);
  await moveOne(panel);
  await clearNumber(page, 'z');
  await typeNumber(page, 'z', ['5']);
  await submit(page);
  await expectPassed(page);

  // T3 — 5+3=8이라고 답해 MC-SUB-DIRECTION을 만든 뒤, 짝짓고 2로 고친다.
  await typeNumber(page, 'n', ['8']);
  await submit(page);
  await expectFailedWithHint(page, '짝이 없는 사탕은 몇 개?');
  await pair(page, panel, { plate: 1, slot: 1 }, { plate: 2, slot: 1 });
  await pair(page, panel, { plate: 1, slot: 2 }, { plate: 2, slot: 2 });
  await pair(page, panel, { plate: 1, slot: 3 }, { plate: 2, slot: 3 });
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['2']);
  await submit(page);
  await expectPassed(page);

  // T4 — 3이라고 답해 틀린 뒤, 4로 고친다.
  await typeNumber(page, 'n', ['3']);
  await submit(page);
  await expectFailedWithHint(page, '빈 접시에는 몇 개가 있나요?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['4']);
  await submit(page);
  await expectPassed(page);

  // T5 — 엔진 없이 '더 왔어요'를 골라 틀린 뒤, 날아간 이야기로 고친다.
  const pick = responseSlot(page);
  await pick.getByRole('button', { name: '새 5마리에 3마리가 더 왔어요' }).click();
  await submit(page);
  await expectFailedWithHint(page, '빼기는 없어지거나 줄어드는 이야기예요. 어느 이야기가 그럴까?');
  await pick.getByRole('button', { name: '새 5마리 중 3마리가 날아갔어요' }).click();
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면에 엔진·응답 칸·확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g1s1u3.A1', title: '구슬 모으기·가르기' },
    { id: 'g1s1u3.A2', title: '그림 이야기 극장' },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));

    // 64px 타깃이 켜진 상태에서 엔진 조작·응답 키패드·확인하기가 모두 보여야 한다.
    await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
    await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: '1번 접시로 합치기' })).toBeInViewport({
      ratio: 1,
    });
    await expect(responseSlot(page).getByRole('button', { name: '1', exact: true })).toBeInViewport(
      { ratio: 1 },
    );
  }
});

test('오프라인에서도 g1s1u3.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g1s1u3.A1`);
  await expect(page.getByRole('heading', { name: '구슬 모으기·가르기' })).toBeVisible();

  // 서비스 워커가 설치·활성화되어 이 페이지를 제어할 때까지 기다린다.
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
  await expect(page.getByRole('heading', { name: '구슬 모으기·가르기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
