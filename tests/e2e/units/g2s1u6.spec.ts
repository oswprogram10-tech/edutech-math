import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectContentPanelsReachable, expectInsideScroller } from '../panel-layout';

/**
 * T059 g2s1u6 「곱셈」 단원 E2E.
 * 활동마다 과제를 대표 오답 → 힌트 ① → 정답 순서로 끝까지 해 본다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

test.describe.configure({ timeout: 120_000 });

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
  await field(page, id).getByRole('button').first().click();
  await responseSlot(page).getByRole('button', { name: '모두 지우기' }).click();
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectFailedWithHint(page: Page, text: string): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', '1');
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

/** E02 measure-out: 고르기 버튼과 덜어 내기 버튼 이름이 같아 first/last로 나눈다. */
async function chooseSize(page: Page, size: number): Promise<void> {
  await slot(page, 'main')
    .getByRole('button', { name: `${size}개 덜어 내기` })
    .first()
    .click();
}

async function bagOnce(page: Page, size: number): Promise<void> {
  await slot(page, 'main')
    .getByRole('button', { name: `${size}개 덜어 내기` })
    .last()
    .click();
}

async function bagTimes(page: Page, size: number, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) await bagOnce(page, size);
}

async function addRows(page: Page, count: number): Promise<void> {
  const button = slot(page, 'main').getByRole('button', { name: '줄 하나 늘리기' });
  for (let index = 0; index < count; index += 1) await button.click();
}

async function addCols(page: Page, count: number): Promise<void> {
  const button = slot(page, 'main').getByRole('button', { name: '칸 하나 늘리기' });
  for (let index = 0; index < count; index += 1) await button.click();
}

async function removeCols(page: Page, count: number): Promise<void> {
  const button = slot(page, 'main').getByRole('button', { name: '칸 하나 줄이기' });
  for (let index = 0; index < count; index += 1) await button.click();
}

async function recordArray(page: Page): Promise<void> {
  await slot(page, 'main').getByRole('button', { name: '배열 기록하기' }).click();
}

async function toggleChoice(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

test('A1 묶어 세기 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g2s1u6.A1', '묶어 세기');
  await screenshot(page, 'g2s1u6-a1.png');

  // T1 — 4개씩 고르고 제출해 MC-MUL-GROUP-SIZE ①을 만난 뒤, 3개씩 4묶음으로 고친다.
  await chooseSize(page, 4);
  await submit(page);
  await expectFailedWithHint(page, '한 봉지에 몇 개씩이야?');
  await chooseSize(page, 3);
  await bagTimes(page, 3, 4);
  await typeNumber(page, 'g', ['4']);
  await submit(page);
  await expectPassed(page);

  // T2 — 3개씩 골라 4묶음이라고 써서 GROUP-SIZE ①을 만난 뒤, 4개씩 3묶음으로 고친다.
  await chooseSize(page, 3);
  await bagTimes(page, 3, 4);
  await typeNumber(page, 'g', ['4']);
  await submit(page);
  await expectFailedWithHint(page, '한 봉지에 몇 개씩이야?');
  await chooseSize(page, 4);
  await bagTimes(page, 4, 3);
  await clearNumber(page, 'g');
  await typeNumber(page, 'g', ['3']);
  await submit(page);
  await expectPassed(page);

  // T3 — 2개씩 6묶음을 덜어 내고 2+6=8이라고 써서 MC-MUL-ADD-CONFUSE ①을 만난 뒤 12로 고친다.
  await bagTimes(page, 2, 6);
  await typeNumber(page, 'n', ['8']);
  await submit(page);
  await expectFailedWithHint(page, '2가 몇 번 있어?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['1', '2']);
  await submit(page);
  await expectPassed(page);

  // T4 — 5개씩 두 봉지에 담고 남은 2개도 한 묶음으로 세어 3이라고 써서
  // MC-MUL-UNEQUAL-GROUPS ①을 만난 뒤, 2묶음·2개 남음으로 고친다.
  await bagTimes(page, 5, 2);
  await toggleChoice(page, 'left', '있어요');
  await typeNumber(page, 'b', ['3']);
  await typeNumber(page, 'r', ['2']);
  await submit(page);
  await expectFailedWithHint(page, '모든 봉지가 똑같아?');
  await clearNumber(page, 'b');
  await typeNumber(page, 'b', ['2']);
  await submit(page);
  await expectPassed(page, true);
});

test('A2 과수원 배열 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g2s1u6.A2', '과수원 배열 90° 회전');
  await screenshot(page, 'g2s1u6-a2.png');
  const panel = slot(page, 'main');

  // T1 — 4그루씩 3줄을 만들고 4+3을 골라 MC-MUL-ADD-CONFUSE ①을 만난 뒤
  // 4+4+4로 고친다.
  await addRows(page, 3);
  await addCols(page, 4);
  await expect(panel.getByTestId('row-count')).toHaveText('3');
  await expect(panel.getByTestId('col-count')).toHaveText('4');
  await toggleChoice(page, 'sum', '4 + 3');
  await submit(page);
  await expectFailedWithHint(page, '4가 몇 번 있어?');
  await toggleChoice(page, 'sum', '4 + 4 + 4');
  await submit(page);
  await expectPassed(page);

  // T2 — 4×3의 곱을 4+3=7이라고 써서 ADD-CONFUSE ①을 만난 뒤 12로 고친다.
  await typeNumber(page, 'a', ['4']);
  await typeNumber(page, 'b', ['3']);
  await typeNumber(page, 'p', ['7']);
  await submit(page);
  await expectFailedWithHint(page, '4가 몇 번 있어?');
  await clearNumber(page, 'p');
  await typeNumber(page, 'p', ['1', '2']);
  await submit(page);
  await expectPassed(page);

  // T3 — 돌리면 나무 수가 적어진다고 골라 일반 힌트 ①을 만난 뒤,
  // '돌리기'로 4×3을 만들고 '그대로예요'로 고친다.
  await toggleChoice(page, 'pred', '적어져요');
  await panel.getByRole('button', { name: '돌리기' }).click();
  await expect(panel.getByTestId('row-count')).toHaveText('4');
  await expect(panel.getByTestId('col-count')).toHaveText('3');
  await submit(page);
  await expectFailedWithHint(page, '돌리기 전과 뒤에 나무를');
  await toggleChoice(page, 'pred', '그대로예요');
  await submit(page);
  await expectPassed(page);

  // T4 — 2×9만 기록하고 제출해 '돌려서 같아지는 배열' 힌트를 만난 뒤,
  // 3×6을 더 기록해 18개 배열 두 가지를 만든다. 되돌리기가 보이는지도 본다.
  await expect(page.getByRole('button', { name: '되돌리기' })).toBeVisible();
  await addRows(page, 2);
  await addCols(page, 9);
  await recordArray(page);
  await expect(panel.getByTestId('recorded-badge')).toHaveText('1가지 배열을 기록했어요.');
  await submit(page);
  await expectFailedWithHint(page, '돌려서 같아지는 배열은 한 가지예요');
  await addRows(page, 1);
  await removeCols(page, 3);
  await recordArray(page);
  await expect(panel.getByTestId('recorded-badge')).toHaveText('2가지 배열을 기록했어요.');
  await submit(page);
  await expectPassed(page, true);
});

test('A3 수직선 뛰어 세기 — 대표 오답 뒤 고쳐서 세 과제를 통과한다', async ({ page }) => {
  await openActivity(page, 'g2s1u6.A3', '수직선 뛰어 세기');
  await screenshot(page, 'g2s1u6-a3.png');
  const panel = slot(page, 'main');

  // T1 — 5씩 네 번 뛰고 5+4=9라고 써서 MC-MUL-ADD-CONFUSE ①을 만난 뒤 20으로 고친다.
  await panel.getByRole('button', { name: '5씩', exact: true }).click();
  for (let index = 0; index < 4; index += 1) {
    await panel.getByRole('button', { name: '한 번 뛰기' }).click();
  }
  await typeNumber(page, 'a', ['5']);
  await typeNumber(page, 'b', ['4']);
  await typeNumber(page, 'p', ['9']);
  await submit(page);
  await expectFailedWithHint(page, '5가 몇 번 있어?');
  await clearNumber(page, 'p');
  await typeNumber(page, 'p', ['2', '0']);
  await submit(page);
  await expectPassed(page);

  // T2 — 3씩 여섯 번 뛰고 15라고 써서 덧셈 혼동 힌트를 만난 뒤 6으로 고친다.
  await panel.getByRole('button', { name: '3씩', exact: true }).click();
  for (let index = 0; index < 6; index += 1) {
    await panel.getByRole('button', { name: '한 번 뛰기' }).click();
  }
  await typeNumber(page, 'n', ['1', '5']);
  await submit(page);
  await expectFailedWithHint(page, '3을 몇 번 더했어?');
  await clearNumber(page, 'n');
  await typeNumber(page, 'n', ['6']);
  await submit(page);
  await expectPassed(page);

  // T3 — 크기가 다른 묶음까지 모두 골라 MC-MUL-UNEQUAL-GROUPS ①을 만난 뒤,
  // 4개씩 3묶음·3줄에 4개씩·0부터 4씩 3번만 남긴다.
  await toggleChoice(page, 'pick', '4개씩 3묶음');
  await toggleChoice(page, 'pick', '5개, 4개, 3개 묶음');
  await toggleChoice(page, 'pick', '3줄에 4개씩');
  await toggleChoice(page, 'pick', '0부터 4씩 3번 뛰기');
  await submit(page);
  await expectFailedWithHint(page, '모든 묶음이 똑같아?');
  await toggleChoice(page, 'pick', '5개, 4개, 3개 묶음');
  await submit(page);
  await expectPassed(page, true);
});

test('크롬북·전자칠판 첫 화면에 엔진·응답 칸·확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  const cases = [
    { id: 'g2s1u6.A1', title: '묶어 세기', control: '3개 덜어 내기' },
    { id: 'g2s1u6.A2', title: '과수원 배열 90° 회전', control: '줄 하나 늘리기' },
    { id: 'g2s1u6.A3', title: '수직선 뛰어 세기', control: '한 번 뛰기' },
  ] as const;

  for (const item of cases) {
    await openActivity(page, item.id, item.title);
    await page.evaluate(() => window.scrollTo(0, 0));
    // 응답 칸은 내용 높이를 쓰므로 판 안 스크롤 대신 페이지 스크롤로 확인한다.
    await expectContentPanelsReachable(page);
    await expect(responseSlot(page)).toBeVisible();
    await expectInsideScroller(
      slot(page, 'main').getByRole('button', { name: item.control }).first(),
    );
    const boxes = await page.evaluate(() => {
      const boxOf = (selector: string): DOMRect | null => {
        const element = document.querySelector(selector);
        return element ? element.getBoundingClientRect() : null;
      };
      const rect = (value: DOMRect | null): { top: number; bottom: number } | null =>
        value ? { top: Math.round(value.top), bottom: Math.round(value.bottom) } : null;
      return {
        viewportHeight: window.innerHeight,
        main: rect(boxOf('[data-testid="runner-slot-main"]')),
        response: rect(boxOf('[data-testid="runner-slot-response"]')),
      };
    });
    const controlBox = await slot(page, 'main')
      .getByRole('button', { name: item.control })
      .first()
      .boundingBox();
    const submitBox = await page.getByRole('button', { name: '확인하기' }).boundingBox();
    console.log('first screen at 64px', {
      project: testInfo.project.name,
      activity: item.id,
      ...boxes,
      controlBottom: controlBox ? Math.round(controlBox.y + controlBox.height) : null,
      submitBottom: submitBox ? Math.round(submitBox.y + submitBox.height) : null,
    });
  }
});

test('오프라인에서도 g2s1u6.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g2s1u6.A1`);
  await expect(page.getByRole('heading', { name: '묶어 세기' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '묶어 세기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
