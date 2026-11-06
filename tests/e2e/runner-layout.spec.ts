import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * T082 실행기 판 크기 방식 E2E.
 *
 * 세로셈(E07)·줄 풀이(E08)·응답 칸은 `layout: 'content'`라 판 안쪽 스크롤이 없고
 * 페이지가 스크롤된다. 세 뷰포트(아이패드 세로·크롬북·전자칠판)에서
 * 숨어 있던 키를 페이지 스크롤로 눌러 값이 들어가는지 확인한다.
 */

test.describe.configure({ timeout: 120_000 });

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

/** 판의 첫 번째 div가 실행기의 viewport다(판 제목은 h3). */
function viewport(panel: Locator): Locator {
  return panel.locator(':scope > div').first();
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

/** content 판의 viewport가 판 안에서 스크롤되지 않아야 한다. */
async function expectNoInnerScroll(panel: Locator): Promise<void> {
  const overflow = await viewport(panel).evaluate(
    (element) => element.scrollHeight - element.clientHeight,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

/** 앱의 스크롤 영역(ActivityRunner의 main) 안에 완전히 들어오는지 확인한다. */
async function expectReachable(target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const clipped = await target.evaluate((element) => {
    const scroller = element.closest('main');
    if (!scroller) throw new Error('스크롤 영역(main)을 찾지 못했습니다.');
    const rect = element.getBoundingClientRect();
    const host = scroller.getBoundingClientRect();
    return {
      above: rect.top < host.top - 1,
      below: rect.bottom > host.bottom + 1,
      left: rect.left < host.left - 1,
      right: rect.right > host.right + 1,
    };
  });
  expect(clipped).toEqual({ above: false, below: false, left: false, right: false });
}

interface LayoutMetrics {
  readonly pageHeight: number;
  readonly viewportHeight: number;
  readonly panelHeight: number;
  readonly submitTop: number;
  readonly submitBottom: number;
}

/** 메모에 적을 스크롤 영역 높이·content 판 높이·확인하기 위치를 잰다. */
async function measureLayout(page: Page, slotName: string): Promise<LayoutMetrics> {
  return page.evaluate((name) => {
    const panel = document.querySelector(`[data-testid="runner-slot-${name}"]`);
    const scroller = document.querySelector('main');
    const button = Array.from(document.querySelectorAll('button')).find(
      (element) => element.textContent === '확인하기',
    );
    if (
      !(panel instanceof HTMLElement) ||
      !(scroller instanceof HTMLElement) ||
      !(button instanceof HTMLElement)
    ) {
      throw new Error('판이나 확인하기 버튼을 찾지 못했습니다.');
    }
    const panelBox = panel.getBoundingClientRect();
    const buttonBox = button.getBoundingClientRect();
    const hostBox = scroller.getBoundingClientRect();
    return {
      pageHeight: scroller.scrollHeight,
      viewportHeight: scroller.clientHeight,
      panelHeight: panelBox.height,
      submitTop: buttonBox.top - hostBox.top + scroller.scrollTop,
      submitBottom: buttonBox.bottom - hostBox.top + scroller.scrollTop,
    };
  }, slotName);
}

test('E07 content 판은 판 안 스크롤 없이 페이지 스크롤로 모든 키와 확인하기에 닿는다', async ({
  page,
}, testInfo) => {
  await openActivity(page, 'g2s1u3.A1', '블록과 세로셈');
  const left = slot(page, 'left');
  const right = slot(page, 'right');
  await expect(left).toHaveAttribute('data-layout', 'fit');
  await expect(right).toHaveAttribute('data-layout', 'content');
  await expectNoInnerScroll(right);

  const metrics = await measureLayout(page, 'right');
  console.log('T082 g2s1u3.A1.T1', { project: testInfo.project.name, ...metrics });

  // E07 키패드 모든 키를 페이지 스크롤로 눌러 결과 칸에 들어가는지 확인한다.
  const result = right.locator('[data-row="result"][data-column="0"]');
  for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
    await result.click();
    const key = right.getByRole('button', { name: `${digit} 쓰기` });
    await expectReachable(key);
    await key.click();
    await expect(result).toHaveText(digit);
  }
  await result.click();
  const clear = right.getByRole('button', { name: '이 칸 지우기' });
  await expectReachable(clear);
  await clear.click();
  await expect(result).toHaveText('');

  const submit = page.getByRole('button', { name: '확인하기' });
  await expectReachable(submit);
  await expectNoInnerScroll(right);
});

test('응답 content 판은 힌트 ② 뒤에도 판 안 스크롤 없이 모든 키가 눌린다', async ({
  page,
}, testInfo) => {
  await openActivity(page, 'g1s2u6.A1', '이중 텐프레임 10 채우기');
  const response = slot(page, 'response');
  await expect(response).toHaveAttribute('data-layout', 'content');
  await expectNoInnerScroll(response);

  // 두 번 틀려 힌트 ②를 연다.
  await page.getByRole('button', { name: '확인하기' }).click();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', '1');
  await page.getByRole('button', { name: '확인하기' }).click();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', '2');
  // 새 힌트가 화면 밖이면 실행기가 페이지를 스크롤해 보이게 한다.
  await expect(page.getByTestId('hint')).toBeInViewport();
  await expectNoInnerScroll(response);

  const metrics = await measureLayout(page, 'response');
  console.log('T082 g1s2u6.A1.T1 hint2', { project: testInfo.project.name, ...metrics });

  const field = response.locator('[data-response-field="n"]');
  const part = field.locator('[data-part="whole"]');
  await part.click();
  const zero = response.getByRole('button', { name: '0', exact: true });
  await expectReachable(zero);
  await zero.click();
  await expect(part).toHaveAttribute('aria-label', '자연수 부분: 0');

  const backspace = response.getByRole('button', { name: '한 칸 지우기' });
  await expectReachable(backspace);
  await backspace.click();
  await expect(part).toHaveAttribute('aria-label', '자연수 부분: 빈칸');

  // 다시 하나를 써서 '모두 지우기'가 지우는지 확인한다.
  await part.click();
  await response.getByRole('button', { name: '1', exact: true }).click();
  await expect(part).toHaveAttribute('aria-label', '자연수 부분: 1');
  const clear = response.getByRole('button', { name: '모두 지우기' });
  await expectReachable(clear);
  await clear.click();
  await expect(part).toHaveAttribute('aria-label', '자연수 부분: 빈칸');
  await expectNoInnerScroll(response);
});

test("'fit' 판만 있는 과제는 페이지 높이가 뷰포트를 넘지 않는다", async ({ page }) => {
  await openActivity(page, 'g1s1u1.A1', '손가락 수 소환 선반');
  const main = slot(page, 'main');
  await expect(main).toHaveAttribute('data-layout', 'fit');
  const pageHeight = await page.getByRole('main').evaluate((element) => element.scrollHeight);
  const viewportHeight = await page.getByRole('main').evaluate((element) => element.clientHeight);
  console.log("T082 g1s1u1.A1 'fit' page", { pageHeight, viewportHeight });
  expect(pageHeight).toBeLessThanOrEqual(viewportHeight + 1);
});
