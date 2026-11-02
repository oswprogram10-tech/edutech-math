import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * T016 응답 위젯 E2E.
 * iPad(WebKit)·Chromebook·전자칠판 뷰포트에서 같다.
 * 과제마다 틀린 답을 한 번 내고, 정답 값이 화면에 새지 않는지 확인한 뒤 고쳐서 통과한다.
 */
async function openActivity(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto('/#/activity/demo.A3');
  await expect(page.getByRole('heading', { name: '답을 직접 써 보기' })).toBeVisible();
}

function panel(page: Page): Locator {
  return page.getByTestId('runner-slot-response');
}

async function expectNoAnswerLeak(page: Page, answers: readonly string[]) {
  const body = await page.locator('body').innerText();
  for (const answer of answers) expect(body).not.toContain(answer);
  expect(body).not.toContain('정답');
  await expect(page.getByRole('button', { name: /정답/ })).toHaveCount(0);
}

async function failThenNext(page: Page) {
  await page.getByRole('button', { name: '확인하기' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
}

async function passThenNext(page: Page) {
  await page.getByRole('button', { name: '확인하기' }).click();
  await expect(page.getByText('좋아요, 통과했어요!')).toBeVisible();
  await page.getByRole('button', { name: '다음 과제' }).click();
}

test('응답 과제 다섯 가지를 틀렸다가 고쳐서 통과한다', async ({ page }) => {
  await openActivity(page);

  // 엔진 조작 판은 숨기고 응답 슬롯만 보인다.
  await expect(page.getByTestId('runner-slot-main')).toHaveCount(0);
  await expect(panel(page)).toBeVisible();

  // T1 — 분수 쓰기. 키보드만으로 5/7을 쓴다.
  const response = panel(page);
  await response.getByRole('button', { name: '분자: 빈칸' }).click();
  await page.keyboard.press('5');
  await page.keyboard.press('/');
  await page.keyboard.press('7');
  await expect(response.getByRole('button', { name: '분자: 5' })).toBeVisible();
  await expect(response.getByRole('button', { name: '분모: 7' })).toBeVisible();

  await failThenNext(page);
  await expectNoAnswerLeak(page, ['5/6']);

  // 되돌리기 한 번으로 마지막 숫자만 지운다.
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(response.getByRole('button', { name: '분모: 빈칸' })).toBeVisible();
  await response.getByRole('button', { name: '분모: 빈칸' }).click();
  await page.keyboard.press('6');
  await passThenNext(page);
  await expect(
    page.getByRole('heading', { name: '1/2만큼 색칠한 그림을 고르세요.' }),
  ).toBeVisible();

  // T2 — 그림 고르기. 처음에는 2/3 그림을 골라 틀린다.
  await panel(page).getByRole('button', { name: '나' }).click();
  await failThenNext(page);
  await expectNoAnswerLeak(page, []);
  await panel(page).getByRole('button', { name: '가' }).click();
  await passThenNext(page);
  await expect(
    page.getByRole('heading', { name: '1/2, 2/3, 3/4을 작은 수부터 차례대로 놓으세요.' }),
  ).toBeVisible();

  // T3 — 순서 정하기. 콘텐츠 순서 그대로 내면 틀린다.
  await failThenNext(page);
  await expectNoAnswerLeak(page, []);
  await panel(page).getByRole('button', { name: '1/2 위로' }).click();
  await panel(page).getByRole('button', { name: '1/2 위로' }).click();
  await passThenNext(page);
  await expect(
    page.getByRole('heading', { name: '3/5와 2/3 사이에 알맞은 부등호를 고르세요.' }),
  ).toBeVisible();

  // T4 — 부등호. 크다를 골라 틀린 뒤 작다로 고친다.
  await panel(page).getByRole('button', { name: '크다' }).click();
  await failThenNext(page);
  await expectNoAnswerLeak(page, []);
  await panel(page).getByRole('button', { name: '작다' }).click();
  await passThenNext(page);
  await expect(
    page.getByRole('heading', { name: '수를 1보다 작은 것과 1보다 큰 것으로 나누세요.' }),
  ).toBeVisible();

  // T5 — 카드 분류. 5/4를 작은 쪽에 잘못 놓았다가 옮긴다.
  const card = (label: string) =>
    panel(page).getByRole('button', { name: `${label} 옮길 카드로 고르기` });
  const bin = (label: string) => panel(page).getByRole('button', { name: `${label} 여기에 놓기` });

  await card('5/4').click();
  await bin('1보다 작아요').click();
  await failThenNext(page);
  await expectNoAnswerLeak(page, []);

  await card('5/4').click();
  await bin('1보다 커요').click();
  for (const [label, target] of [
    ['3/4', '1보다 작아요'],
    ['0.6', '1보다 작아요'],
    ['1.2', '1보다 커요'],
  ] as const) {
    await card(label).click();
    await bin(target).click();
  }
  await page.getByRole('button', { name: '확인하기' }).click();
  await expect(page.getByText('모든 과제를 마쳤어요.')).toBeVisible();
  await expectNoAnswerLeak(page, []);
});
