import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';
import { controlsFoldOverflow, expectControlsAboveFold } from '../controls-fold';

/**
 * T212 g3s1u5 「길이와 시간」 단원 E2E.
 * A1(E13 estimate 확대·map-route)·A2(E14 time-calc·duration)를 끝까지 통과하고, 대표 오답의 힌트 ①②를 확인한다.
 * 3학년이라 터치 타깃 48px, 자동 읽기 없음. 조작은 단추·키보드로 하므로 판 좌표를 쓰지 않는다.
 * 아이패드(WebKit)·크롬북·전자칠판 세 뷰포트에서 같은 흐름을 확인한다.
 */

test.describe.configure({ timeout: 180_000 });

const A1 = { id: 'g3s1u5.A1', title: 'mm 현미경과 km 지도' } as const;
const A2 = { id: 'g3s1u5.A2', title: '60진법 시간 블록' } as const;

const MEASURE_CONTROLS = 'measure-controls';
const CLOCK_CONTROLS = 'clock-controls';

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

/**
 * 못 맞추는 과제용 첫 화면 검사: 기기별로 알려진 모자람(px)을 허용하고 더 나빠지는 것만 막는다.
 * (A1.T1은 확대 칸이 있어, A2.T4는 시각 띠 판이 높아 단추 줄이 판 칸 안에서 잘린다. 카드 메모 참고.)
 */
async function expectControlsFoldWithin(
  page: Page,
  label: string,
  allowed: Readonly<Record<string, number>>,
  controlsTestId: string,
): Promise<void> {
  const limit = allowed[test.info().project.name] ?? 0;
  let previous = Number.NaN;
  await expect
    .poll(async () => {
      const now = await controlsFoldOverflow(page, undefined, controlsTestId);
      const same = now === previous;
      previous = now;
      return same;
    })
    .toBe(true);
  expect(
    await controlsFoldOverflow(page, undefined, controlsTestId),
    `${label}: 조작 칸 첫 단추 줄이 첫 화면 아래로 넘친 px`,
  ).toBeLessThanOrEqual(limit);
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

/** 수 응답 칸에 숫자를 쓴다(빈칸을 누르고 키를 친다). */
async function typeIn(page: Page, id: string, keys: string): Promise<void> {
  await field(page, id).getByRole('button', { name: /빈칸$/ }).first().click();
  for (const key of keys) await page.keyboard.press(key);
}

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

// ── A1 도우미 ──

/** 자를 키보드로 영점까지 옮긴다(눈금 2 → 0, 방향키 한 번에 0.5cm). */
async function alignRuler(page: Page): Promise<void> {
  await page.getByRole('button', { name: '자. ←→로 옮겨요' }).focus();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
}

async function passA1T1(page: Page): Promise<void> {
  await settleCanvas(page, 'estimate-canvas');
  await alignRuler(page);
  await button(page, '눈금 크게').click();
  await writeAnswer(page, { cm: '3', mm: '7' });
  await submit(page);
  await expectPassed(page);
}

async function passA1T2(page: Page): Promise<void> {
  await writeAnswer(page, { total: '37' });
  await submit(page);
  await expectPassed(page);
}

async function passA1T3(page: Page): Promise<void> {
  await settleCanvas(page, 'route-canvas');
  await button(page, '학교–공원').click();
  await submit(page);
  await expectPassed(page);
}

async function buildRouteViaLibrary(page: Page): Promise<void> {
  await button(page, '학교–도서관').click();
  await button(page, '도서관–공원').click();
}

// ── A2 도우미 ──

async function bundleHour(page: Page): Promise<void> {
  await button(page, '1시간으로 묶기').click();
  // 올가미 연출(약 0.4초)이 끝난 뒤에 묶인다.
  await expect(button(page, '1시간으로 묶기')).toBeVisible();
  await page.waitForTimeout(700);
}

async function passA2T1(page: Page): Promise<void> {
  await settleCanvas(page, 'timecalc-canvas');
  await bundleHour(page);
  await writeAnswer(page, { h: '2', m: '15' });
  await submit(page);
  await expectPassed(page);
}

async function passA2T2(page: Page): Promise<void> {
  await settleCanvas(page, 'timecalc-canvas');
  await button(page, '60분으로 풀기').click();
  await button(page, '빼기').click();
  await writeAnswer(page, { h: '1', m: '30' });
  await submit(page);
  await expectPassed(page);
}

async function passA2T3(page: Page): Promise<void> {
  await writeAnswer(page, { total: '150' });
  await submit(page);
  await expectPassed(page);
}

/** 끝 표시를 9시 50분에서 5분씩 8칸 옮겨 10시 30분에 놓는다(처음 한 번은 시작 자리에 놓인다). */
async function placeEnd(page: Page): Promise<void> {
  await settleCanvas(page, 'clock-canvas');
  for (let i = 0; i < 9; i += 1) await button(page, '끝 ▶').click();
}

// ── A1 ──

test('A1 mm 현미경과 km 지도 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, A1);

  // T1 — 자를 맞추지 않고 끝 눈금 5cm 7mm를 쓰면 MC-MEASURE-ENDPOINT ①, 다음 실패에서 ②(count-cells 정렬).
  await settleCanvas(page, 'estimate-canvas');
  await screenshot(page, 'estimate-canvas', 'g3s1u5-a1t1.png');
  await writeAnswer(page, { cm: '5', mm: '7' });
  await submit(page);
  await expectHint(page, 1, '물체가 어디서부터 시작했지?');
  await submit(page);
  await expectHint(page, 2, '1cm 칸을 하나씩 칠해 봤어요');
  await expectOverlayOverCanvas(page, 'count-cells', 'estimate-canvas');
  await alignRuler(page);
  await button(page, '눈금 크게').click();
  await writeAnswer(page, { cm: '3' }, true);
  await submit(page);
  await expectPassed(page);

  // T2 — 307로 쓰면 MC-MEAS-UNIT-CONVERT ①, 다음 실패에서 ②(say만).
  await expect(slot(page, 'main')).toHaveCount(0);
  await writeAnswer(page, { total: '307' });
  await submit(page);
  await expectHint(page, 1, '1cm 안에 1mm가 몇 개 들어가지?');
  await submit(page);
  await expectHint(page, 2, '1cm 안에는 1mm가 10개 있어요.');
  await expect(slot(page, 'main').locator('[data-overlay]')).toHaveCount(0);
  await writeAnswer(page, { total: '37' }, true);
  await submit(page);
  await expectPassed(page);

  // T3 — 도서관을 지나는 길(두 구간)은 1km에서 더 멀어 일반 ①. 지우고 학교–공원을 잇는다.
  await settleCanvas(page, 'route-canvas');
  await screenshot(page, 'route-canvas', 'g3s1u5-a1t3.png');
  await button(page, '학교–도서관').click();
  await button(page, '도서관–공원').click();
  await submit(page);
  await expectHint(page, 1, '길마다 길이를 더해 보고');
  await button(page, '처음으로').click();
  await button(page, '학교–공원').click();
  await submit(page);
  await expectPassed(page);

  // T4 — 1km 70m를 0km 1070m로 쓰면 전용 ①.
  await settleCanvas(page, 'route-canvas');
  await buildRouteViaLibrary(page);
  await writeAnswer(page, { km: '0', m: '1070' });
  await submit(page);
  await expectHint(page, 1, '1000m는 1km로 바꿔 쓸 수 있어요.');
  await writeAnswer(page, { km: '1', m: '70' }, true);
  await submit(page);
  await expectPassed(page, true);
});

// ── A2 ──

test('A2 60진법 시간 블록 — 대표 오답 뒤 고쳐서 네 과제를 통과한다', async ({ page }) => {
  await openActivity(page, A2);

  // T1 — 묶지 않고 1시간 75분을 쓰면 MC-TIME-BASE-100 ①, 다음 실패에서 ②(sixty-overflow 정렬·크기).
  await settleCanvas(page, 'timecalc-canvas');
  await screenshot(page, 'timecalc-canvas', 'g3s1u5-a2t1.png');
  await writeAnswer(page, { h: '1', m: '75' });
  await submit(page);
  await expectHint(page, 1, '1시간은 몇 분이었지?');
  await submit(page);
  await expectHint(page, 2, '큰 블록 크기의 점선 상자');
  const overlay = await expectOverlayOverCanvas(page, 'sixty-overflow', 'timecalc-canvas');
  const box = await overlay.locator('[data-part="box"]').boundingBox();
  const canvas = await canvasOf(page, 'timecalc-canvas').boundingBox();
  if (!box || !canvas) throw new Error('상자를 찾지 못했습니다.');
  // 판 너비(논리 1000)에 비례한 큰 블록 크기: 96 + 점선 여백 12.
  const scale = canvas.width / 1000;
  expect(Math.abs(box.width - 108 * scale)).toBeLessThanOrEqual(6);
  await bundleHour(page);
  await writeAnswer(page, { h: '2', m: '15' }, true);
  await submit(page);
  await expectPassed(page);

  // T2 — 100분으로 풀어 계산한 1시간 70분이면 MC-TIME-BASE-100 ①. 풀지 않고 쓰면 일반 ①.
  await settleCanvas(page, 'timecalc-canvas');
  await writeAnswer(page, { h: '1', m: '70' });
  await submit(page);
  await expectHint(page, 1, '1시간은 몇 분이었지? 풀면 분 칸에');
  await button(page, '60분으로 풀기').click();
  await button(page, '빼기').click();
  await writeAnswer(page, { h: '1', m: '30' }, true);
  await submit(page);
  await expectPassed(page);

  // T3 — 2분 30초를 230으로 쓰면 MC-TIME-BASE-100 ①, 다음 실패에서 ②(say만).
  await expect(slot(page, 'main')).toHaveCount(0);
  await writeAnswer(page, { total: '230' });
  await submit(page);
  await expectHint(page, 1, '1분은 몇 초였지?');
  await submit(page);
  await expectHint(page, 2, '1분을 60칸으로 펼치면');
  await expect(slot(page, 'main').locator('[data-overlay]')).toHaveCount(0);
  await writeAnswer(page, { total: '150' }, true);
  await submit(page);
  await expectPassed(page);

  // T4 — 9시 90분으로 쓰면 MC-TIME-BASE-100 ①, 다음 실패에서 ②(hour-60-split 정렬).
  await placeEnd(page);
  await writeAnswer(page, { h: '9', m: '90' });
  await submit(page);
  await expectHint(page, 1, '1시간은 몇 분이었지? 분이 60이 되면');
  await submit(page);
  await expectHint(page, 2, '60분이 되면 다음 시');
  await expectOverlayOverCanvas(page, 'hour-60-split', 'clock-canvas');
  await writeAnswer(page, { h: '10', m: '30' }, true);
  await submit(page);
  await expectPassed(page, true);
});

test('A1.T3을 키보드만으로 푼다', async ({ page }) => {
  await openActivity(page, A1);
  await passA1T1(page);
  await passA1T2(page);
  await settleCanvas(page, 'route-canvas');
  await button(page, '학교–공원').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '확인하기' }).focus();
  await page.keyboard.press('Enter');
  await expectPassed(page);
});

// ── 노출·터치 타깃·첫 화면·오프라인 ──

/** 판 안 글·aria·data-(학생이 놓은 자리 좌표 제외)를 모아 돌려준다. */
async function exposedText(page: Page): Promise<string> {
  return slot(page, 'main').evaluate((root) => {
    const skip = new Set(['data-x', 'data-y', 'data-start', 'data-index', 'data-tick']);
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

test('시작 화면 DOM·aria·data-에 정답 값이 없고 학년 표시도 없다', async ({ page }) => {
  // A1.T1 — 연필 3.7cm(37mm). 판에 37·3.7이 없다.
  await openActivity(page, A1);
  await settleCanvas(page, 'estimate-canvas');
  let text = await exposedText(page);
  expect(numberIn(text, ['37', '3\\.7'])).toBe(false);
  expect(text).not.toMatch(/3\s*cm\s*7\s*mm/);
  await noGrade(page);
  await passA1T1(page);

  // A1.T2 — 엔진이 숨겨져 판이 없다. 응답 칸에도 답이 없다.
  await expect(slot(page, 'main')).toHaveCount(0);
  expect(await responseSlot(page).textContent()).not.toMatch(/37/);
  await noGrade(page);
  await passA1T2(page);

  // A1.T3 — 지도 구간 길이 글(450·620·980)은 보이지만 경로 합계·1km 70m 글은 없다.
  await settleCanvas(page, 'route-canvas');
  text = await exposedText(page);
  expect(numberIn(text, ['1070', '1,070'])).toBe(false);
  expect(text).not.toMatch(/1\s*km\s*70\s*m/);
  await noGrade(page);
  await passA1T3(page);

  // A1.T4 — 길을 이은 뒤에도 합계 글이 없다.
  await settleCanvas(page, 'route-canvas');
  await buildRouteViaLibrary(page);
  text = await exposedText(page);
  expect(numberIn(text, ['1070', '1,070'])).toBe(false);
  expect(text).not.toMatch(/1\s*km\s*70\s*m/);
  await noGrade(page);
  await writeAnswer(page, { km: '1', m: '70' });
  await submit(page);
  await expectPassed(page, true);

  // A2.T1 — 시작 화면에 2시간 15분(135분)이 없다.
  await openActivity(page, A2);
  await settleCanvas(page, 'timecalc-canvas');
  text = await exposedText(page);
  expect(text).not.toMatch(/2\s*시간\s*15\s*분/);
  expect(numberIn(text, ['135'])).toBe(false);
  await noGrade(page);
  await passA2T1(page);

  // A2.T2 — 뺄 시간만 글로 있고 답 1시간 30분(90분)은 없다.
  await settleCanvas(page, 'timecalc-canvas');
  text = await exposedText(page);
  expect(text).not.toMatch(/1\s*시간\s*30\s*분/);
  expect(numberIn(text, ['90'])).toBe(false);
  await noGrade(page);
  await passA2T2(page);

  // A2.T3 — 엔진이 숨겨져 판이 없다. 응답 칸에도 답이 없다.
  await expect(slot(page, 'main')).toHaveCount(0);
  expect(await responseSlot(page).textContent()).not.toMatch(/150/);
  await noGrade(page);
  await passA2T3(page);

  // A2.T4 — 시각 띠에 도착 시각 글이 없다.
  await settleCanvas(page, 'clock-canvas');
  text = await exposedText(page);
  expect(text).not.toMatch(/10\s*시\s*30\s*분|10:30/);
  await noGrade(page);
});

async function expectMin48(locator: Locator, label: string): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, label).not.toBeNull();
  expect(box?.width ?? 0, `${label} 너비`).toBeGreaterThanOrEqual(47.5);
  expect(box?.height ?? 0, `${label} 높이`).toBeGreaterThanOrEqual(47.5);
}

test('3학년 48px 터치 타깃: 눈금 크게·길 단추·묶기·풀기·빼기·응답 칸', async ({ page }) => {
  await openActivity(page, A1);
  await settleCanvas(page, 'estimate-canvas');
  await expectMin48(button(page, '눈금 크게'), '눈금 크게');
  for (const id of ['cm', 'mm']) {
    await expectMin48(field(page, id).getByRole('button').first(), `응답 칸 ${id}`);
  }
  await passA1T1(page);
  await passA1T2(page);
  await settleCanvas(page, 'route-canvas');
  for (const name of ['학교–도서관', '도서관–공원', '학교–공원', '하나 지우기', '처음으로']) {
    await expectMin48(button(page, name), name);
  }

  await openActivity(page, A2);
  await settleCanvas(page, 'timecalc-canvas');
  for (const name of ['1시간으로 묶기', '60분으로 풀기', '처음으로']) {
    await expectMin48(button(page, name), name);
  }
  await passA2T1(page);
  await settleCanvas(page, 'timecalc-canvas');
  await expectMin48(button(page, '빼기'), '빼기');
  await passA2T2(page);
  await passA2T3(page);
  await settleCanvas(page, 'clock-canvas');
  for (const name of ['끝 ▶', '끝 ◀']) {
    await expectMin48(button(page, name), name);
  }
});

test('A1·A2 엔진이 보이는 모든 과제에서 조작 칸 첫 단추 줄이 첫 화면에 보인다(T223)', async ({
  page,
}) => {
  await openActivity(page, A1);
  await settleCanvas(page, 'estimate-canvas');
  await expectControlsFoldWithin(
    page,
    'g3s1u5.A1.T1',
    { chromebook: 42, ipad: 3 },
    MEASURE_CONTROLS,
  );
  await passA1T1(page);

  // A1.T2는 엔진을 숨겨(showEngine false) 조작 칸이 없다. 응답 칸과 확인하기만 본다.
  await expect(slot(page, 'main')).toHaveCount(0);
  await expect(responseSlot(page)).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
  await passA1T2(page);

  await settleCanvas(page, 'route-canvas');
  await expectControlsAboveFold(page, 'g3s1u5.A1.T3', 0, MEASURE_CONTROLS);
  await passA1T3(page);

  await settleCanvas(page, 'route-canvas');
  await expectControlsAboveFold(page, 'g3s1u5.A1.T4', 0, MEASURE_CONTROLS);

  await openActivity(page, A2);
  await settleCanvas(page, 'timecalc-canvas');
  await expectControlsAboveFold(page, 'g3s1u5.A2.T1', 0, CLOCK_CONTROLS);
  await passA2T1(page);

  await settleCanvas(page, 'timecalc-canvas');
  await expectControlsAboveFold(page, 'g3s1u5.A2.T2', 0, CLOCK_CONTROLS);
  await passA2T2(page);

  await expect(slot(page, 'main')).toHaveCount(0);
  await expect(responseSlot(page)).toBeVisible();
  await passA2T3(page);

  await settleCanvas(page, 'clock-canvas');
  await expectControlsFoldWithin(
    page,
    'g3s1u5.A2.T4',
    { chromebook: 49, ipad: 10 },
    CLOCK_CONTROLS,
  );
});

test('오프라인에서도 g3s1u5.A1 활동이 열린다', async ({ page, context }) => {
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
