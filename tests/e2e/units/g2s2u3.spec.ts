import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectControlsAboveFold } from '../controls-fold';
import { expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T210 g2s2u3 「길이 재기(m·cm)」 단원 E2E.
 * A1(E13 length mergeRule)·A2(E13 length unit-train)를 끝까지 통과하고, 대표 오답의 힌트 ①②를 확인한다.
 * 조작은 단추·키보드로만 하므로 판 좌표를 쓰지 않는다(상자 너비 배율도 필요 없다).
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

// 과제 하나에 조작·오답·힌트·수정이 이어져 기본 30초로는 모자란다.
test.describe.configure({ timeout: 180_000 });

const A1 = { id: 'g2s2u3.A1', title: '100cm → 1m 줄자 합체' } as const;
const A2 = { id: 'g2s2u3.A2', title: '길이 블록 기차 단위 승격기' } as const;

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function responseSlot(page: Page): Locator {
  return slot(page, 'response');
}

function field(page: Page, id: string): Locator {
  return responseSlot(page).locator(`[data-response-field="${id}"]`);
}

function button(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true });
}

async function openActivity(page: Page, activity: { id: string; title: string }): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/${activity.id}`);
  await expect(page.getByRole('heading', { name: activity.title })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectHint(page: Page, level: number, text: string): Promise<void> {
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

function canvasOf(page: Page, testId: string): Locator {
  return slot(page, 'main').getByTestId(testId);
}

/** 판이 칸에 맞춰 크기를 정할 때까지(상자가 두 번 연속 같아질 때까지) 기다린다. */
async function settleCanvas(page: Page, testId: string): Promise<void> {
  await canvasOf(page, testId).scrollIntoViewIfNeeded();
  let previous = '';
  await expect
    .poll(async () => {
      const now = JSON.stringify(await canvasOf(page, testId).boundingBox());
      const same = now === previous;
      previous = now;
      return same;
    })
    .toBe(true);
}

async function screenshot(page: Page, testId: string, name: string): Promise<void> {
  await settleCanvas(page, testId);
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

/** 힌트 ② 오버레이가 본 판 svg와 같은 자리·크기(1px 안)에 놓였는지 본다. */
async function expectOverlayOverCanvas(
  page: Page,
  overlayName: string,
  canvasTestId: string,
): Promise<Locator> {
  const overlay = slot(page, 'main').locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  await expect
    .poll(async () => {
      const overlayBox = await overlay.locator('svg').first().boundingBox();
      const canvasBox = await canvasOf(page, canvasTestId).boundingBox();
      if (!overlayBox || !canvasBox) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(overlayBox.x - canvasBox.x),
        Math.abs(overlayBox.y - canvasBox.y),
        Math.abs(overlayBox.width - canvasBox.width),
        Math.abs(overlayBox.height - canvasBox.height),
      );
    })
    .toBeLessThanOrEqual(1);
  return overlay;
}

/** 수 응답 칸에 숫자를 쓴다(저학년 키패드 방식: 빈칸을 누르고 키를 친다). */
async function typeIn(page: Page, id: string, keys: string): Promise<void> {
  await field(page, id).getByRole('button').first().click();
  for (const key of keys) await page.keyboard.press(key);
}

/** 칸에 든 수를 모두 지운다. */
async function clearField(page: Page, id: string): Promise<void> {
  await field(page, id).getByRole('button').first().click();
  await responseSlot(page).getByRole('button', { name: '모두 지우기' }).click();
}

async function writeAnswer(
  page: Page,
  values: Readonly<Record<string, string>>,
  clear = false,
): Promise<void> {
  for (const [id, keys] of Object.entries(values)) {
    if (clear) await clearField(page, id);
    await typeIn(page, id, keys);
  }
}

async function pressTimes(page: Page, name: string, times: number, key = 'Enter'): Promise<void> {
  const target = button(page, name);
  await target.focus();
  for (let i = 0; i < times; i += 1) await page.keyboard.press(key);
}

// ── A1 도우미 ──

async function passA1T1(page: Page): Promise<void> {
  await settleCanvas(page, 'length-canvas');
  await pressTimes(page, '10cm 막대 놓기', 10);
  await submit(page);
  await expectPassed(page);
}

/** 칠판 3m 20cm: 1m 줄자 셋과 10cm 막대 둘(키보드는 10cm 격자로 이어 붙는다). */
async function buildBlackboard(page: Page): Promise<void> {
  await pressTimes(page, '1m 줄자 놓기', 3);
  await pressTimes(page, '10cm 막대 놓기', 2);
}

async function passA1T2(page: Page): Promise<void> {
  await settleCanvas(page, 'length-canvas');
  await buildBlackboard(page);
  await writeAnswer(page, { m: '3', cm: '20', total: '320' });
  await submit(page);
  await expectPassed(page);
}

async function passA1T3(page: Page): Promise<void> {
  await writeAnswer(page, { m: '1', cm: '35' });
  await submit(page);
  await expectPassed(page);
}

async function passA1T4(page: Page, last = false): Promise<void> {
  await writeAnswer(page, { total: '205' });
  await submit(page);
  await expectPassed(page, last);
}

// ── A2 도우미 ──

async function passA2T1(page: Page): Promise<void> {
  await settleCanvas(page, 'train-canvas');
  await writeAnswer(page, { m: '3', cm: '70' });
  await submit(page);
  await expectPassed(page);
}

async function passA2T2(page: Page): Promise<void> {
  await settleCanvas(page, 'train-canvas');
  await button(page, '1m로 바꾸기').click();
  await writeAnswer(page, { m: '4', cm: '20' });
  await submit(page);
  await expectPassed(page);
}

async function passA2T3(page: Page): Promise<void> {
  await settleCanvas(page, 'train-canvas');
  await button(page, '10cm 막대로 풀기').click();
  await button(page, '빼기').click();
  await writeAnswer(page, { m: '2', cm: '50' });
  await submit(page);
  await expectPassed(page);
}

// ── A1 ──

test('A1 100cm → 1m 줄자 합체 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, A1);

  // T1 — 막대를 잇기 전에는 합체가 없어 일반 ①, 열 개를 이으면 통과한다.
  await settleCanvas(page, 'length-canvas');
  await submit(page);
  await expectHint(page, 1, '막대를 몇 개 이으면 끈 길이와 같아질까요?');
  await pressTimes(page, '10cm 막대 놓기', 10);
  await submit(page);
  await expectPassed(page);

  // T2 — 총 길이를 이어붙인 302로 쓰면 MC-LENGTH-UNIT-MIX ①, 다음 실패에서 ②(meter-100 정렬).
  await settleCanvas(page, 'length-canvas');
  await screenshot(page, 'length-canvas', 'g2s2u3-a1t2.png');
  await buildBlackboard(page);
  await writeAnswer(page, { m: '3', cm: '20', total: '302' });
  await submit(page);
  await expectHint(page, 1, '1m는 몇 cm였지?');
  await submit(page);
  await expectHint(page, 2, '1m 줄자를 100칸으로 펼쳐 봤어요');
  await expectOverlayOverCanvas(page, 'meter-100', 'length-canvas');
  await writeAnswer(page, { total: '320' }, true);
  await submit(page);
  await expectPassed(page);

  // T3 — 135를 13m 5cm로 읽으면(앞 두 자리를 m로) MC-LENGTH-UNIT-MIX ①.
  await writeAnswer(page, { m: '13', cm: '5' });
  await submit(page);
  await expectHint(page, 1, '1m는 몇 cm였지?');
  await writeAnswer(page, { m: '1', cm: '35' }, true);
  await submit(page);
  await expectPassed(page);

  // T4 — 2m 5cm를 25로 쓰면 MC-LENGTH-UNIT-MIX ①, 다음 실패에서 ②(say만).
  await writeAnswer(page, { total: '25' });
  await submit(page);
  await expectHint(page, 1, '1m는 몇 cm였지?');
  await submit(page);
  await expectHint(page, 2, '1m를 100칸으로 펼치면 한 칸이 1cm예요.');
  await expect(slot(page, 'main').locator('[data-overlay]')).toHaveCount(0);
  await writeAnswer(page, { total: '205' }, true);
  await submit(page);
  await expectPassed(page, true);
});

// ── A2 ──

test('A2 길이 블록 기차 단위 승격기 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, A2);

  // T1 — 승격이 필요 없는 덧셈.
  await passA2T1(page);

  // T2 — 승격 없이 4m 120cm를 쓰면 MC-LENGTH-NO-PROMOTE ①, 다음 실패에서 ②(meter-outline 정렬).
  await settleCanvas(page, 'train-canvas');
  await screenshot(page, 'train-canvas', 'g2s2u3-a2t2.png');
  await writeAnswer(page, { m: '4', cm: '120' });
  await submit(page);
  await expectHint(page, 1, 'cm 칸에 100cm가 넘으면?');
  await submit(page);
  await expectHint(page, 2, '1m 칸 크기의 점선 상자');
  const layer = await expectOverlayOverCanvas(page, 'meter-outline', 'train-canvas');
  await expect(layer).toBeVisible();
  await button(page, '1m로 바꾸기').click();
  await writeAnswer(page, { m: '4', cm: '20' }, true);
  await submit(page);
  await expectPassed(page);

  // T3 — 풀지 않고 빼기만 하거나 값만 쓰면 일반 ① 뒤, 풀고 빼면 통과한다.
  await settleCanvas(page, 'train-canvas');
  await writeAnswer(page, { m: '2', cm: '50' });
  await submit(page);
  await expectHint(page, 1, 'cm 칸이 모자라면 1m 칸 하나를 풀어 봐요.');
  await button(page, '10cm 막대로 풀기').click();
  await button(page, '빼기').click();
  await submit(page);
  await expectPassed(page);

  // T4 — 기차 없이 식만. 넘친 100cm를 버리면(4m 25cm) 전용 ①, 4m 125cm이면 NO-PROMOTE ②.
  await expect(slot(page, 'main').getByTestId('train-canvas')).toHaveCount(0);
  await writeAnswer(page, { m: '4', cm: '25' });
  await submit(page);
  await expectHint(page, 1, '넘친 100cm를 어디로 보냈나요?');
  await writeAnswer(page, { cm: '125' }, true);
  await submit(page);
  await expectHint(page, 2, '100cm는 1m와 같아요.');
  await writeAnswer(page, { m: '5', cm: '25' }, true);
  await submit(page);
  await expectPassed(page, true);
});

test('A2.T3을 키보드만으로 푼다', async ({ page }) => {
  await openActivity(page, A2);
  await passA2T1(page);
  await passA2T2(page);
  await settleCanvas(page, 'train-canvas');
  await button(page, '10cm 막대로 풀기').focus();
  await page.keyboard.press('Enter');
  await button(page, '빼기').focus();
  await page.keyboard.press('Space');
  for (const [id, keys] of [
    ['m', '2'],
    ['cm', '50'],
  ] as const) {
    await field(page, id).getByRole('button').first().focus();
    await page.keyboard.press('Enter');
    for (const key of keys) await page.keyboard.press(key);
  }
  await page.getByRole('button', { name: '확인하기' }).focus();
  await page.keyboard.press('Enter');
  await expectPassed(page);
});

// ── 노출·터치 타깃·첫 화면·오프라인 ──

/** 판 안 글·aria·data-(학생이 놓은 자리 좌표 제외)를 모아 돌려준다. */
async function exposedText(page: Page): Promise<string> {
  return slot(page, 'main').evaluate((root) => {
    const skip = new Set([
      'data-x',
      'data-y',
      'data-start',
      'data-index',
      'data-tick',
      'data-target-size',
    ]);
    const parts: string[] = [root.textContent ?? ''];
    for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
      for (const attribute of Array.from(element.attributes)) {
        if (attribute.name === 'aria-label' || attribute.name === 'title') {
          parts.push(attribute.value);
        } else if (attribute.name.startsWith('data-') && !skip.has(attribute.name)) {
          parts.push(attribute.value);
        }
      }
    }
    return parts.join('\n');
  });
}

function numberIn(text: string, values: readonly string[]): boolean {
  return new RegExp(`(^|[^\\d.])(${values.join('|')})([^\\d.]|$)`).test(text);
}

async function noGrade(page: Page): Promise<void> {
  expect((await page.locator('body').textContent()) ?? '').not.toMatch(/[1-6]학년/);
}

test('시작 화면 DOM·aria·data-에 정답 길이와 결과 글이 없고 학년 표시도 없다', async ({ page }) => {
  // A1.T1 — 끈 100cm. 판에 "10개"·"100" 같은 값이 없다.
  await openActivity(page, A1);
  await settleCanvas(page, 'length-canvas');
  let text = await exposedText(page);
  expect(numberIn(text, ['100'])).toBe(false);
  await noGrade(page);
  await pressTimes(page, '10cm 막대 놓기', 10);
  await submit(page);
  await expectPassed(page);

  // A1.T2 — 칠판 320cm.
  await settleCanvas(page, 'length-canvas');
  text = await exposedText(page);
  expect(numberIn(text, ['320', '302', '3020'])).toBe(false);
  expect(text).not.toMatch(/3\s*m\s*20\s*cm/);
  await noGrade(page);
  await buildBlackboard(page);
  await writeAnswer(page, { m: '3', cm: '20', total: '320' });
  await submit(page);
  await expectPassed(page);

  // A1.T3·T4는 엔진이 숨겨져 있어 판이 없다. 응답 칸에도 답이 없다.
  await expect(slot(page, 'main')).toHaveCount(0);
  expect(await responseSlot(page).textContent()).not.toMatch(/135|205/);
  await noGrade(page);

  // A2.T1·T2 — 기차 시작 화면에 "3m 70cm"·"4m 20cm" 글이 없다(칸 수 aria만).
  await openActivity(page, A2);
  await settleCanvas(page, 'train-canvas');
  text = await exposedText(page);
  expect(text).not.toMatch(/3\s*m\s*70\s*cm|370/);
  await noGrade(page);
  await passA2T1(page);
  await settleCanvas(page, 'train-canvas');
  text = await exposedText(page);
  expect(text).not.toMatch(/4\s*m\s*20\s*cm|420/);
  await noGrade(page);
  await button(page, '1m로 바꾸기').click();
  await writeAnswer(page, { m: '4', cm: '20' });
  await submit(page);
  await expectPassed(page);

  // A2.T3 — 5m 20cm − 2m 70cm. 답 2m 50cm(250)는 뺄 길이와 달라 판에서 베낄 수 없다.
  await settleCanvas(page, 'train-canvas');
  text = await exposedText(page);
  expect(text).not.toMatch(/2\s*m\s*50\s*cm|250/);
  await noGrade(page);
});

async function expectMin64(locator: Locator, label: string): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, label).not.toBeNull();
  expect(box?.width ?? 0, `${label} 너비`).toBeGreaterThanOrEqual(63.5);
  expect(box?.height ?? 0, `${label} 높이`).toBeGreaterThanOrEqual(63.5);
}

test('저학년 모드 64px 터치 타깃: 단위 단추·기차 단추·응답 칸', async ({ page }) => {
  await openActivity(page, A1);
  await passA1T1(page);
  await settleCanvas(page, 'length-canvas');
  await expectMin64(button(page, '1m 줄자 놓기'), '1m 줄자 놓기');
  await expectMin64(button(page, '10cm 막대 놓기'), '10cm 막대 놓기');
  for (const id of ['m', 'cm', 'total']) {
    await expectMin64(field(page, id).getByRole('button').first(), `응답 칸 ${id}`);
  }

  await openActivity(page, A2);
  await settleCanvas(page, 'train-canvas');
  for (const name of ['1m로 바꾸기', '10cm 막대로 풀기']) {
    await expectMin64(button(page, name), name);
  }
  await passA2T1(page);
  await settleCanvas(page, 'train-canvas');
  await passA2T2(page);
  await settleCanvas(page, 'train-canvas');
  for (const name of ['빼기', '1cm 블록으로 풀기', '처음으로']) {
    await expectMin64(button(page, name), name);
  }
});

test('크롬북·전자칠판 첫 화면에 엔진·응답 칸·확인하기가 들어온다', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'ipad',
    '아이패드는 판을 위아래로 두어 짧은 스크롤을 허용한다',
  );

  for (const item of [A1, A2]) {
    await openActivity(page, item);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoPanelInnerScroll(page);
    await expect(slot(page, 'main')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
  }
});

test('A1·A2 모든 과제에서 조작 칸 첫 단추 줄이 첫 화면에 보인다(T223)', async ({ page }) => {
  await openActivity(page, A1);
  await settleCanvas(page, 'length-canvas');
  await expectControlsAboveFold(page, 'g2s2u3.A1.T1');
  await passA1T1(page);

  await settleCanvas(page, 'length-canvas');
  await expectControlsAboveFold(page, 'g2s2u3.A1.T2');
  await passA1T2(page);

  // A1.T3·T4는 엔진을 숨겨(showEngine false) 조작 칸이 없다. 응답 칸과 확인하기만 본다.
  for (const passTask of [passA1T3, (p: Page) => passA1T4(p, true)]) {
    await expect(slot(page, 'main')).toHaveCount(0);
    await expect(responseSlot(page)).toBeVisible();
    await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
    await passTask(page);
  }

  await openActivity(page, A2);
  await settleCanvas(page, 'train-canvas');
  await expectControlsAboveFold(page, 'g2s2u3.A2.T1');
  await passA2T1(page);

  await settleCanvas(page, 'train-canvas');
  await expectControlsAboveFold(page, 'g2s2u3.A2.T2');
  await passA2T2(page);

  await settleCanvas(page, 'train-canvas');
  await expectControlsAboveFold(page, 'g2s2u3.A2.T3');
  await passA2T3(page);

  await expect(slot(page, 'main')).toHaveCount(0);
  await expect(responseSlot(page)).toBeVisible();
});

test('오프라인에서도 g2s2u3.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/${A1.id}`);
  await expect(page.getByRole('heading', { name: A1.title })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: A1.title })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
