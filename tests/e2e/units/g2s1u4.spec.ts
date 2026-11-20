import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { expectControlsAboveFold, expectEstimateSubmitAboveFold } from '../controls-fold';
import { expectNoPanelInnerScroll } from '../panel-layout';

/**
 * T209 g2s1u4 「길이 재기」 단원 E2E.
 * A1(E13 length)·A2(E13 estimate)를 끝까지 통과하고, 대표 오답의 힌트 ①②를 확인한다.
 * 판 좌표는 논리 1000 폭이고, 상자 너비로만 배율을 구한다(논리 높이를 가정하지 않는다).
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

// 과제 하나에 조작·오답·힌트·수정이 이어져 기본 30초로는 모자란다.
test.describe.configure({ timeout: 180_000 });

const A1 = { id: 'g2s1u4.A1', title: '뼘 vs 클립, 1cm 자 발명' } as const;
const A2 = { id: 'g2s1u4.A2', title: '영점 교정 어림 게임' } as const;

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

/** 고르기 응답 보기를 누른다. */
async function choose(page: Page, label: string): Promise<void> {
  await field(page, 'why').getByRole('button', { name: label, exact: true }).click();
}

/** 수 응답 칸 n에 숫자를 쓴다(저학년 키패드 방식: 빈칸을 누르고 키를 친다). */
async function typeNumber(page: Page, keys: readonly string[]): Promise<void> {
  await field(page, 'n').getByRole('button', { name: /빈칸$/ }).first().click();
  for (const key of keys) await page.keyboard.press(key);
}

async function clearNumber(page: Page): Promise<void> {
  await field(page, 'n').getByRole('button').first().click();
  await responseSlot(page).getByRole('button', { name: '모두 지우기' }).click();
}

// ── A1 도우미 ──

const WHY_RIGHT = '두 친구의 뼘 크기가 달라서';
const WHY_TRAP = '수가 큰 친구의 책상이 더 길어서';

async function pressTimes(page: Page, name: string, times: number, key = 'Enter'): Promise<void> {
  const target = button(page, name);
  await target.focus();
  for (let i = 0; i < times; i += 1) await page.keyboard.press(key);
}

/** 클립 네 개를 이어 붙인다. */
async function placeClips(page: Page): Promise<void> {
  const clip = button(page, '클립 놓기');
  for (let i = 0; i < 4; i += 1) await clip.click();
}

async function passA1T1(page: Page): Promise<void> {
  await choose(page, WHY_RIGHT);
  await submit(page);
  await expectPassed(page);
}

async function passA1T2(page: Page): Promise<void> {
  await settleCanvas(page, 'length-canvas');
  await placeClips(page);
  await typeNumber(page, ['4']);
  await submit(page);
  await expectPassed(page);
}

async function setGapAndOverlap(page: Page): Promise<void> {
  // 둘째를 +1cm(방향키 두 번) 옮기면 앞에는 틈이, 뒤에는 셋째와 겹침이 생긴다.
  const second = page.getByRole('button', { name: '2번째 조각, 클립' });
  await second.focus();
  for (let i = 0; i < 2; i += 1) await page.keyboard.press('ArrowRight');
}

async function makeRuler(page: Page): Promise<void> {
  await pressTimes(page, '1cm 블록 놓기', 10);
  await button(page, '자 만들기').click();
  const canvas = canvasOf(page, 'length-canvas');
  await expect(canvas.locator('[data-part="tick"]')).toHaveCount(11);
  for (let tick = 0; tick <= 10; tick += 1) {
    await canvas.locator(`[data-part="tick"][data-tick="${tick}"]`).focus();
    if (tick === 10) {
      await page.keyboard.press('1');
      await page.keyboard.press('0');
    } else {
      await page.keyboard.press(String(tick));
    }
  }
  await expect(canvas.locator('[data-part="tick-value"]')).toHaveCount(11);
}

// ── A2 도우미 ──

async function setEstimate(page: Page, digits: readonly number[]): Promise<void> {
  for (const digit of digits) await button(page, `숫자 ${digit}`).click();
  await button(page, '어림 넣기').click();
  await expect(page.getByTestId('estimate-draft')).toContainText('어림:');
}

async function passA2Plain(page: Page, keys: readonly string[]): Promise<void> {
  await settleCanvas(page, 'estimate-canvas');
  await typeNumber(page, keys);
  await submit(page);
  await expectPassed(page);
}

async function passA2Estimated(
  page: Page,
  estimate: readonly number[],
  keys: readonly string[],
  last = false,
): Promise<void> {
  await settleCanvas(page, 'estimate-canvas');
  await setEstimate(page, estimate);
  await typeNumber(page, keys);
  await submit(page);
  await expectPassed(page, last);
}

// ── A1 ──

test('A1 뼘 vs 클립, 1cm 자 발명 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, A1);
  await settleCanvas(page, 'length-canvas');

  // T1 — 수가 큰 쪽이 더 길다고 하면 MC-MEASURE-UNIT-SIZE ①, 다음 실패에서 ②(두 뼘을 겹친 그림).
  await choose(page, WHY_TRAP);
  await submit(page);
  await expectHint(page, 1, '두 뼘의 크기는 같아?');
  await submit(page);
  await expectHint(page, 2, '두 친구의 뼘을 나란히 겹쳐 놓았어요');
  await expectOverlayOverCanvas(page, 'span-compare', 'length-canvas');
  await choose(page, WHY_RIGHT);
  await submit(page);
  await expectPassed(page);

  // T2 — 클립 사이에 틈을 두고 4를 쓰면 MC-MEASURE-GAP ①, 다음 실패에서 ②(틈·겹침 표시).
  await settleCanvas(page, 'length-canvas');
  await screenshot(page, 'length-canvas', 'g2s1u4-a1t2.png');
  await placeClips(page);
  await setGapAndOverlap(page);
  await typeNumber(page, ['4']);
  await submit(page);
  await expectHint(page, 1, '사이에 빈 곳이 있어?');
  await submit(page);
  await expectHint(page, 2, '빈 곳은 빨간 줄로');
  const marks = await expectOverlayOverCanvas(page, 'gap-marks', 'length-canvas');
  await expect(marks.locator('[data-part="gap-mark"]').first()).toBeVisible();
  // 둘째 조각을 제자리로 돌려놓으면 통과한다.
  const second = page.getByRole('button', { name: '2번째 조각, 클립' });
  await second.focus();
  for (let i = 0; i < 2; i += 1) await page.keyboard.press('ArrowLeft');
  await submit(page);
  await expectPassed(page);

  // T3 — 1cm 블록 열두 개를 이어 붙이고 12를 쓴다. 11개일 때는 실패한다.
  await settleCanvas(page, 'length-canvas');
  await pressTimes(page, '1cm 블록 놓기', 11);
  await typeNumber(page, ['1', '2']);
  await submit(page);
  await expectHint(page, 1, '물건 처음부터 끝까지 빈틈없이 이어 붙였나요?');
  await button(page, '1cm 블록 놓기').click();
  await submit(page);
  await expectPassed(page);

  // T4 — 블록 열 개로 자를 만들고 눈금 숫자를 놓는다.
  await settleCanvas(page, 'length-canvas');
  await submit(page);
  await expectHint(page, 1, '0은 어디에 놓아야 할까요?');
  await makeRuler(page);
  await submit(page);
  await expectPassed(page, true);
});

test('A1.T3을 키보드만으로 푼다', async ({ page }) => {
  await openActivity(page, A1);
  await passA1T1(page);
  await passA1T2(page);
  await settleCanvas(page, 'length-canvas');
  await pressTimes(page, '1cm 블록 놓기', 12);
  await expect(page.getByRole('button', { name: '12번째 조각, 1cm 블록' })).toBeVisible();
  await field(page, 'n').getByRole('button', { name: /빈칸$/ }).first().focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  await page.getByRole('button', { name: '확인하기' }).focus();
  await page.keyboard.press('Enter');
  await expectPassed(page);
});

// ── A2 ──

test('A2 영점 교정 어림 게임 — 대표 오답 뒤 고쳐서 여섯 과제를 통과한다', async ({ page }) => {
  await openActivity(page, A2);

  // T1 — 영점에 맞춘 자로 잰다.
  await settleCanvas(page, 'estimate-canvas');
  await typeNumber(page, ['5']);
  await submit(page);
  await expectPassed(page);

  // T2 — 끝 눈금 10을 쓰면 MC-MEASURE-ENDPOINT ①, 다음 실패에서 ②(count-cells 정렬).
  await settleCanvas(page, 'estimate-canvas');
  await screenshot(page, 'estimate-canvas', 'g2s1u4-a2t2.png');
  await typeNumber(page, ['1', '0']);
  await submit(page);
  await expectHint(page, 1, '물건이 어디에서 시작했어?');
  await submit(page);
  await expectHint(page, 2, '물건이 시작한 눈금부터 칸마다 색을 칠했어요');
  await expectOverlayOverCanvas(page, 'count-cells', 'estimate-canvas');
  await clearNumber(page);
  await typeNumber(page, ['7']);
  await submit(page);
  await expectPassed(page);

  // T3 — 6을 쓰면 전용 ①, 7을 쓰면 통과한다.
  await settleCanvas(page, 'estimate-canvas');
  await typeNumber(page, ['6']);
  await submit(page);
  await expectHint(page, 1, '끝이 6과 7 중 어느 눈금에 더 가까운지 봐요.');
  await clearNumber(page);
  await typeNumber(page, ['7']);
  await submit(page);
  await expectPassed(page);

  // T4 — 어림을 넣기 전에는 자가 없다. 끝 눈금 11을 쓰면 ①.
  await settleCanvas(page, 'estimate-canvas');
  await screenshot(page, 'estimate-canvas', 'g2s1u4-a2t4.png');
  await expect(canvasOf(page, 'estimate-canvas').locator('[data-part="ruler"]')).toHaveCount(0);
  await setEstimate(page, [8]);
  await expect(canvasOf(page, 'estimate-canvas').locator('[data-part="ruler"]')).toHaveCount(1);
  await typeNumber(page, ['1', '1']);
  await submit(page);
  await expectHint(page, 1, '물건이 어디에서 시작했어?');
  await clearNumber(page);
  await typeNumber(page, ['9']);
  await submit(page);
  await expectPassed(page);

  // T5 — 어림이 틀려도(1) 통과한다. 어림의 정오는 판정하지 않는다.
  await passA2Estimated(page, [1], ['1', '3']);

  // T6 — 끝 눈금 7을 쓰면 ①.
  await settleCanvas(page, 'estimate-canvas');
  await setEstimate(page, [5]);
  await typeNumber(page, ['7']);
  await submit(page);
  await expectHint(page, 1, '물건이 어디에서 시작했어?');
  await clearNumber(page);
  await typeNumber(page, ['6']);
  await submit(page);
  await expectPassed(page, true);
});

test('A2.T4는 어림을 넣지 않으면 정답이어도 통과하지 못한다', async ({ page }) => {
  await openActivity(page, A2);
  await passA2Plain(page, ['5']);
  await passA2Plain(page, ['7']);
  await passA2Plain(page, ['7']);
  await settleCanvas(page, 'estimate-canvas');
  await typeNumber(page, ['9']);
  await submit(page);
  await expectHint(page, 1, '물건의 끝이 몇 칸째인지 세어 봐요.');
  await expect(page.getByText('좋아요, 통과했어요!')).toHaveCount(0);
  await setEstimate(page, [9]);
  await submit(page);
  await expectPassed(page);
});

// ── 노출·터치 타깃·첫 화면·오프라인 ──

/**
 * 판 안 글·aria·data-(학생이 놓은 자리 좌표와 자 그림 제외)를 모아 돌려준다.
 * 자 눈금 숫자는 자 그림이라 예외이므로 자 부분은 복제본에서 뺀다. 물건 쪽만 본다.
 */
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
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-part^="ruler"]').forEach((node) => node.remove());
    const parts: string[] = [clone.textContent ?? ''];
    for (const element of [clone, ...Array.from(clone.querySelectorAll('*'))]) {
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

test('시작 화면 DOM·aria·data-에 물건 길이와 결과 글이 없고 학년 표시도 없다', async ({ page }) => {
  const resultText = /몇 cm예요|길이는 \d|약 \d/;

  // A1.T1 뼘 시연 — "4번·5번"은 시연 결과라 허용하고 책상 길이(60)만 본다.
  await openActivity(page, A1);
  await settleCanvas(page, 'length-canvas');
  let text = await exposedText(page);
  expect(numberIn(text, ['60'])).toBe(false);
  expect((await page.locator('body').textContent()) ?? '').not.toMatch(/[1-6]학년/);

  // A1.T2 — 연필 12cm와 클립 4개.
  await passA1T1(page);
  await settleCanvas(page, 'length-canvas');
  text = await exposedText(page);
  expect(numberIn(text, ['12', '4'])).toBe(false);
  expect(text).not.toMatch(resultText);
  expect((await page.locator('body').textContent()) ?? '').not.toMatch(/[1-6]학년/);

  // A1.T3 — 연필 12cm.
  await passA1T2(page);
  await settleCanvas(page, 'length-canvas');
  text = await exposedText(page);
  expect(numberIn(text, ['12'])).toBe(false);

  // A2.T1(5)·T2(7)·T3(6.7).
  await openActivity(page, A2);
  const lengths = [['5'], ['7'], ['6\\.7', '6', '7']];
  const keys = [['5'], ['7'], ['7']];
  for (const [index, values] of lengths.entries()) {
    await settleCanvas(page, 'estimate-canvas');
    text = await exposedText(page);
    expect(numberIn(text, values), `A2.T${index + 1} 시작 화면`).toBe(false);
    expect(text).not.toMatch(resultText);
    expect((await page.locator('body').textContent()) ?? '').not.toMatch(/[1-6]학년/);
    await typeNumber(page, keys[index] ?? []);
    await submit(page);
    await expectPassed(page);
  }
});

async function expectMin64(locator: Locator, label: string): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, label).not.toBeNull();
  expect(box?.width ?? 0, `${label} 너비`).toBeGreaterThanOrEqual(63.5);
  expect(box?.height ?? 0, `${label} 높이`).toBeGreaterThanOrEqual(63.5);
}

test('저학년 모드 64px 터치 타깃: 단위 단추·응답 보기·어림 키패드', async ({ page }) => {
  await openActivity(page, A1);
  await settleCanvas(page, 'length-canvas');
  await expectMin64(button(page, '뼘 가 놓기'), '뼘 가 놓기');
  await expectMin64(field(page, 'why').getByRole('button', { name: WHY_RIGHT }), WHY_RIGHT);
  await expectMin64(field(page, 'why').getByRole('button', { name: WHY_TRAP }), WHY_TRAP);

  await openActivity(page, A2);
  await passA2Plain(page, ['5']);
  await passA2Plain(page, ['7']);
  await passA2Plain(page, ['7']);
  await settleCanvas(page, 'estimate-canvas');
  for (const name of ['숫자 0', '숫자 9', '지우기', '어림 넣기', '자 제자리로']) {
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
    await expect(responseSlot(page)).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: '확인하기' })).toBeInViewport({ ratio: 1 });
  }
});

test('A1·A2 모든 과제에서 조작 칸 첫 단추 줄이 첫 화면에 보인다(T223)', async ({ page }) => {
  await openActivity(page, A1);
  await settleCanvas(page, 'length-canvas');
  await expectControlsAboveFold(page, 'g2s1u4.A1.T1');
  await passA1T1(page);

  await settleCanvas(page, 'length-canvas');
  await expectControlsAboveFold(page, 'g2s1u4.A1.T2');
  await passA1T2(page);

  await settleCanvas(page, 'length-canvas');
  await expectControlsAboveFold(page, 'g2s1u4.A1.T3');
  await pressTimes(page, '1cm 블록 놓기', 12);
  await typeNumber(page, ['1', '2']);
  await submit(page);
  await expectPassed(page);

  await settleCanvas(page, 'length-canvas');
  await expectControlsAboveFold(page, 'g2s1u4.A1.T4');

  await openActivity(page, A2);
  const plain = [['5'], ['7'], ['7']] as const;
  for (const [index, keys] of plain.entries()) {
    await settleCanvas(page, 'estimate-canvas');
    await expectControlsAboveFold(page, `g2s1u4.A2.T${index + 1}`);
    await typeNumber(page, keys);
    await submit(page);
    await expectPassed(page);
  }
  const estimated = [
    { estimate: [8], keys: ['9'] },
    { estimate: [1], keys: ['1', '3'] },
    { estimate: [5], keys: ['6'] },
  ] as const;
  for (const [index, item] of estimated.entries()) {
    await settleCanvas(page, 'estimate-canvas');
    // 어림을 넣기 전(키패드가 있는 처음 화면)에 본다.
    await expectControlsAboveFold(page, `g2s1u4.A2.T${index + 4}`);
    await expectEstimateSubmitAboveFold(page, `g2s1u4.A2.T${index + 4}`);
    await setEstimate(page, item.estimate);
    await typeNumber(page, item.keys);
    await submit(page);
    await expectPassed(page, index === 2);
  }
});

test('오프라인에서도 g2s1u4.A1 활동이 열린다', async ({ page, context }) => {
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
