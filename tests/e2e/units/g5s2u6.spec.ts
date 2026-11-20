import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PREVIEW_URL } from '../../../playwright.config';

/**
 * T195 g5s2u6 「평균과 가능성」 12과제 단원 E2E.
 * - A1(E19 `leveling`·`seesaw`·`outlier` 6과제)·A2(E19 `words`·`spinner`·`simulate` 6과제) 흐름과 오개념 4코드 감지(3뷰포트)
 * - 오개념 ② 오버레이 `level-try`(A1.T3 6)·`sum-tower`(A1.T3 35)·`small-batches`(A2.T3 나)·`after-streak`(A2.T6 나) 1px 정렬
 * - 과제마다 대표 오답은 일반 힌트 ①, 키보드만으로 A1.T1, 오프라인 A1
 * - 첫 화면 스냅샷(A1.T1, A2.T3: 시뮬레이션을 돌리기 전) + 학생 화면에 답·학년이 보이지 않는다.
 * - 판 조작은 화면 좌표 클릭(page.mouse)과 키보드만 쓴다(아이패드 WebKit에서 SVG 글자 locator 클릭이 막힘).
 */

test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 20_000 });

interface UnitTask {
  readonly id: string;
  readonly showEngine?: boolean;
  readonly config: Record<string, unknown>;
}
interface UnitContent {
  readonly activities: readonly { readonly id: string; readonly tasks: readonly UnitTask[] }[];
}

const content = JSON.parse(
  readFileSync(new URL('../../../data/content/g5s2u6.json', import.meta.url), 'utf-8'),
) as UnitContent;

test('콘텐츠 설정이 명세를 따른다(응답만 있는 과제는 엔진 화면을 숨긴다)', () => {
  const task = (id: string): UnitTask => {
    for (const activity of content.activities) {
      const found = activity.tasks.find((t) => t.id === id);
      if (found) return found;
    }
    throw new Error(`과제 ${id}를 찾지 못했다.`);
  };
  expect(task('g5s2u6.A1.T1').config['data']).toEqual([7, 4, 9, 3, 7]);
  expect(task('g5s2u6.A1.T3').config['data']).toEqual([4, 12, 5, 6, 8]);
  expect(task('g5s2u6.A1.T4').config).toMatchObject({ dragIndex: 4, predict: true, max: 32 });
  expect(task('g5s2u6.A1.T5').showEngine).toBe(false);
  expect(task('g5s2u6.A1.T6').config['data']).toEqual([12, 15, 9]);
  expect(task('g5s2u6.A2.T3').config['editable']).toBe(false);
  expect(task('g5s2u6.A2.T6').config['showExpected']).toBe(false);
  expect(content.activities.map((a) => a.tasks.length)).toEqual([6, 6]);
});

function slot(page: Page, name: string): Locator {
  return page.getByTestId(`runner-slot-${name}`);
}

function field(page: Page, id: string): Locator {
  return slot(page, 'response').locator(`[data-response-field="${id}"]`);
}

async function openActivity(page: Page, activityId: string, heading: string): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`/#/activity/${activityId}`);
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
}

/** 엔진 조작 단추. */
function act(page: Page, name: string): Locator {
  return slot(page, 'main').getByRole('button', { name, exact: true });
}

async function press(page: Page, name: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i += 1) await act(page, name).click();
}

function canvas(page: Page): Locator {
  return slot(page, 'main').getByTestId('chance-canvas');
}

async function choose(page: Page, id: string, label: string): Promise<void> {
  await field(page, id).getByRole('button', { name: label, exact: true }).click();
}

/** 수 칸(정수)의 한 부분을 비우고 숫자를 넣는다(칸은 최대 9자리). */
async function typeWhole(page: Page, id: string, keys: string): Promise<void> {
  await field(page, id).locator('[data-part="whole"]').click();
  for (let i = 0; i < 9; i += 1) {
    await page.keyboard.press('Backspace');
  }
  for (const key of keys) {
    await page.keyboard.press(key);
  }
}

async function submit(page: Page): Promise<void> {
  await page.getByRole('button', { name: '확인하기' }).click();
}

async function expectFailedWithHint(
  page: Page,
  text: string | null,
  level: 1 | 2 | 3 = 1,
): Promise<void> {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('hint')).toHaveAttribute('data-hint-level', String(level));
  if (text !== null) {
    await expect(page.getByTestId('hint-text')).toContainText(text);
  }
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
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelector('main')?.scrollTo(0, 0);
    document.querySelectorAll('[data-testid="chance-controls"]').forEach((el) => el.scrollTo(0, 0));
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect(page).toHaveScreenshot(name, {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
    fullPage: true,
  });
}

/** 오버레이 svg 상자가 chance-canvas 상자와 1px 이내로 같다. */
async function expectOverlayAligned(panel: Locator, overlayName: string): Promise<void> {
  const overlay = panel.locator(`[data-overlay="${overlayName}"]`);
  await expect(overlay).toBeVisible();
  const board = panel.getByTestId('chance-canvas');
  await expect
    .poll(async () => {
      const overlayBox = await overlay.locator('svg').first().boundingBox();
      const canvasBox = await board.boundingBox();
      if (!overlayBox || !canvasBox) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(overlayBox.x - canvasBox.x),
        Math.abs(overlayBox.y - canvasBox.y),
        Math.abs(overlayBox.width - canvasBox.width),
        Math.abs(overlayBox.height - canvasBox.height),
      );
    })
    .toBeLessThanOrEqual(1);
}

/** 첫 화면: 판과 [확인하기]에 닿을 수 있고(필요하면 스크롤), 판이 잘리지 않는다. */
async function expectReachable(
  page: Page,
  targets: readonly Locator[],
  ratio = 0.99,
): Promise<void> {
  for (const target of targets) {
    await target.scrollIntoViewIfNeeded();
    await expect(target).toBeInViewport({ ratio });
  }
  const confirm = page.getByRole('button', { name: '확인하기' });
  await confirm.scrollIntoViewIfNeeded();
  await expect(confirm).toBeInViewport({ ratio: 1 });
}

/** 학생 화면에 정답·학년이 보이지 않는지 확인한다. */
async function expectNoLeak(page: Page, forbidden: readonly RegExp[]): Promise<void> {
  const text = (await page.locator('body').textContent()) ?? '';
  expect(text, '학생 화면에 학년 표시가 없어야 한다').not.toMatch(/\d\s*학년/);
  for (const pattern of forbidden) {
    expect(text, `학생 화면에 ${pattern}가 없어야 한다`).not.toMatch(pattern);
  }
}

// ---------------------------------------------------------------- 판 조작(화면 좌표)

/** 논리 좌표(1000×600)를 화면 좌표로 바꾼다. */
async function screenPoint(page: Page, lx: number, ly: number): Promise<{ x: number; y: number }> {
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('캔버스를 찾지 못했습니다.');
  return { x: box.x + (lx / 1000) * box.width, y: box.y + (ly / 600) * box.height };
}

async function dragLogical(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  const a = await screenPoint(page, from.x, from.y);
  const b = await screenPoint(page, to.x, to.y);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}

async function columnCx(page: Page, index: number): Promise<number> {
  const cx = await canvas(page).locator(`[data-column="${index}"]`).getAttribute('data-cx');
  return Number(cx);
}

/** 자료 [7,4,9,3,7]을 5번 만에 고르게 하는 옮기기(기둥 번호 0부터). */
const LEVEL_PLAN: readonly (readonly [number, number])[] = [
  [2, 1],
  [2, 1],
  [2, 3],
  [0, 3],
  [4, 3],
];

async function levelByDrag(page: Page): Promise<void> {
  for (const [from, to] of LEVEL_PLAN) {
    const fromX = await columnCx(page, from);
    const toX = await columnCx(page, to);
    await dragLogical(page, { x: fromX, y: 470 }, { x: toX, y: 300 });
  }
}

async function levelByKeyboard(page: Page): Promise<void> {
  await canvas(page).focus();
  let cursor = 0;
  for (const [from, to] of LEVEL_PLAN) {
    const first = from > cursor ? 'ArrowRight' : 'ArrowLeft';
    for (let i = 0; i < Math.abs(from - cursor); i += 1) await page.keyboard.press(first);
    await page.keyboard.press('Enter');
    const second = to > from ? 'ArrowRight' : 'ArrowLeft';
    for (let i = 0; i < Math.abs(to - from); i += 1) await page.keyboard.press(second);
    await page.keyboard.press('Space');
    cursor = to;
  }
}

/** words 판: 칸 5개(0, 1/4, 1/2, 3/4, 1). 칸 가운데 논리 x. */
const wordsSlotX = (i: number): number => 40 + (920 / 5) * (i + 0.5);

async function cardCenter(page: Page, id: string): Promise<{ x: number; y: number }> {
  const box = canvas(page).locator(`[data-card="${id}"]`);
  const x = Number(await box.getAttribute('data-x'));
  const y = Number(await box.locator('[data-part="card-box"]').getAttribute('y'));
  return { x: x + 75, y: y + 35 };
}

async function placeCard(page: Page, id: string, slotIndex: number): Promise<void> {
  await dragLogical(page, await cardCenter(page, id), { x: wordsSlotX(slotIndex), y: 250 });
}

// ---------------------------------------------------------------- 과제별 통과 도우미

async function passA1T1(page: Page): Promise<void> {
  await levelByDrag(page);
  await submit(page);
  await expectPassed(page);
}

async function passA1T2(page: Page): Promise<void> {
  await canvas(page).getByRole('slider').focus();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowRight');
  await submit(page);
  await expectPassed(page);
}

async function passA1T3(page: Page): Promise<void> {
  await typeWhole(page, 'm', '7');
  await submit(page);
  await expectPassed(page);
}

/** 예측(10)을 잠그고 다섯째 점을 7에서 30으로 끈다(키보드 → 23번). */
async function predictAndDrag(page: Page): Promise<void> {
  await act(page, '1').click();
  await act(page, '0').click();
  await act(page, '예측하기').click();
  await canvas(page).getByRole('slider').focus();
  for (let i = 0; i < 23; i += 1) await page.keyboard.press('ArrowRight');
}

async function passA1T4(page: Page): Promise<void> {
  await predictAndDrag(page);
  await submit(page);
  await expectPassed(page);
}

async function passA1T5(page: Page): Promise<void> {
  await choose(page, 'even', '가 모둠');
  await submit(page);
  await expectPassed(page);
}

async function passA2T1(page: Page): Promise<void> {
  await placeCard(page, 'die7', 0);
  await placeCard(page, 'coin', 2);
  await placeCard(page, 'sun', 4);
  await submit(page);
  await expectPassed(page);
}

/** 빨강 1·파랑 2 회전판에서 처음 고른 칸(빨강)을 키워 1/2로 만든다. */
async function passA2T2(page: Page): Promise<void> {
  await press(page, '칸 키우기');
  await submit(page);
  await expectPassed(page);
}

async function runAllBatches(page: Page): Promise<void> {
  for (const n of [10, 1000, 10000]) {
    await press(page, `${n}회 돌리기`);
    await expect(
      canvas(page).locator(`[data-part="column"][data-batch="${n}"] [data-part="bar"]`),
    ).toHaveCount(4);
  }
}

async function passA2T3(page: Page): Promise<void> {
  await runAllBatches(page);
  await choose(page, 'cmp', '가');
  await submit(page);
  await expectPassed(page);
}

async function passA2T4(page: Page): Promise<void> {
  await press(page, '빨강 구슬 빼기', 2);
  await submit(page);
  await expectPassed(page);
}

async function passA2T5(page: Page): Promise<void> {
  await press(page, '파랑 구슬 빼기', 2);
  await submit(page);
  await expectPassed(page);
}

// ---------------------------------------------------------------- A1

test('g5s2u6.A1 — 평균 6과제 흐름·오개념 MIDDLE-VALUE ①②·첫 화면', async ({ page }) => {
  test.slow();
  await openActivity(page, 'g5s2u6.A1', '블록 기둥 평탄화와 평균 시소');
  const main = slot(page, 'main');

  // T1 첫 화면 + 스냅샷(블록 30개), 답이 없다
  await expect(canvas(page).locator('[data-block]')).toHaveCount(30);
  await expectReachable(page, [canvas(page)]);
  await expectNoLeak(page, [/평균\s*6/, /높이\s*6/, /\b6\s*번/]);
  await screenshot(page, 'g5s2u6-a1.png');
  await passA1T1(page);

  // T2: 시소(받침점을 오른쪽으로 4칸)
  await expect(canvas(page)).toHaveAttribute('data-tilt', /.+/);
  await passA1T2(page);

  // T3: 6(가운데 값)을 쓰면 MC-MEAN-MIDDLE-VALUE ① → 다시 → ② level-try → 7 통과
  await expect(canvas(page).locator('[data-block]')).toHaveCount(35);
  await typeWhole(page, 'm', '6');
  await submit(page);
  await expectFailedWithHint(page, '블록을 고르게 했을 때 높이와 같을까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '그 높이로 기둥을 맞추면 블록이 남는지 모자라는지 봐요.', 2);
  await expectOverlayAligned(main, 'level-try');
  await passA1T3(page);

  // T4: 예측 → 끌기. 첫 화면에서는 평균선이 없다
  await expect(canvas(page)).toHaveAttribute('data-locked', 'true');
  await expect(canvas(page).locator('[data-part="mean-line"]')).toHaveCount(0);
  await passA1T4(page);

  // T5: 엔진 화면 없이 응답 칸만. 나 모둠 → 일반 ① → 가 모둠 통과
  await expect(main).toHaveCount(0);
  await choose(page, 'even', '나 모둠');
  await submit(page);
  await expectFailedWithHint(page, '두 모둠의 평균은 같아요.', 1);
  await passA1T5(page);

  // T6: 12쪽 통과
  await expect(canvas(page).locator('[data-block]')).toHaveCount(36);
  await typeWhole(page, 'm', '12');
  await submit(page);
  await expectPassed(page, true);
});

test('g5s2u6.A1 — 과제마다 대표 오답은 일반 힌트 ①이 뜬다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'g5s2u6.A1', '블록 기둥 평탄화와 평균 시소');

  // T1: 옮기지 않고 확인
  await submit(page);
  await expectFailedWithHint(
    page,
    '기둥을 모두 같은 높이로 만들려면 높은 기둥의 블록이 어디로 가야 할까요?',
    1,
  );
  await passA1T1(page);

  // T2: 받침점을 옮기지 않고 확인
  await submit(page);
  await expectFailedWithHint(
    page,
    '받침점을 왼쪽과 오른쪽으로 옮기면 시소가 어느 쪽으로 기우는지 살펴봐요.',
    1,
  );
  await passA1T2(page);

  // T3: 9(어느 오개념도 아닌 값)
  await typeWhole(page, 'm', '9');
  await submit(page);
  await expectFailedWithHint(page, '모두에게 똑같이 나누면 한 사람당 얼마씩일까요?', 1);
  await passA1T3(page);

  // T4: 예측하지 않고 확인
  await submit(page);
  await expectFailedWithHint(
    page,
    '기록 하나가 아주 커지면 평균이 어떻게 될지 먼저 생각해 봐요.',
    1,
  );
  await passA1T4(page);

  // T5: 나 모둠
  await choose(page, 'even', '나 모둠');
  await submit(page);
  await expectFailedWithHint(page, '두 모둠의 평균은 같아요.', 1);
  await passA1T5(page);

  // T6: 15(어느 오개념도 아닌 값) → 일반 ①. 합(36)은 별도 테스트에서 본다
  await typeWhole(page, 'm', '15');
  await submit(page);
  await expectFailedWithHint(page, '하루에 똑같이 읽는다면 하루에 몇 쪽씩일까요?', 1);
  await typeWhole(page, 'm', '12');
  await submit(page);
  await expectPassed(page, true);
});

test('g5s2u6.A1.T3 — 합(35)을 쓰면 MC-MEAN-SUM-ONLY ① → ② sum-tower, T6의 합(36)도 ①', async ({
  page,
}) => {
  test.slow();
  await openActivity(page, 'g5s2u6.A1', '블록 기둥 평탄화와 평균 시소');
  const main = slot(page, 'main');
  await passA1T1(page);
  await passA1T2(page);
  await typeWhole(page, 'm', '35');
  await submit(page);
  await expectFailedWithHint(page, '평균은 한 사람당 기록이었지?', 1);
  await submit(page);
  await expectFailedWithHint(page, '모든 기록을 쌓은 기둥 하나와 다섯 기둥으로 나눈 모습을', 2);
  await expectOverlayAligned(main, 'sum-tower');
  await passA1T3(page);
  await passA1T4(page);
  await passA1T5(page);
  await typeWhole(page, 'm', '36');
  await submit(page);
  await expectFailedWithHint(page, '평균은 하루에 읽은 쪽수처럼 한 날당 값이었지?', 1);
});

test('g5s2u6.A1 — 키보드만으로 A1.T1을 한다', async ({ page }) => {
  test.slow();
  await openActivity(page, 'g5s2u6.A1', '블록 기둥 평탄화와 평균 시소');
  await levelByKeyboard(page);
  await expect(canvas(page).locator('[data-block]')).toHaveCount(30);
  await page.getByRole('button', { name: '확인하기' }).focus();
  await page.keyboard.press('Enter');
  await expectPassed(page);
});

// ---------------------------------------------------------------- A2

test('g5s2u6.A2 — 가능성 6과제 흐름·오개념 SMALL-SAMPLE·GAMBLER ①②·첫 화면', async ({ page }) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openActivity(page, 'g5s2u6.A2', '가상 데이터 확률 공장');
  const main = slot(page, 'main');

  // T1: 상황 카드 세 장. 처음엔 틀리게 놓고 일반 ① → 옮겨서 통과
  await expect(canvas(page).locator('[data-part="card"]')).toHaveCount(3);
  await placeCard(page, 'die7', 4);
  await submit(page);
  await expectFailedWithHint(page, '각 상황이 일어날 가능성이 얼마나 되는지 말로 생각해 봐요.', 1);
  await placeCard(page, 'die7', 0);
  await placeCard(page, 'coin', 2);
  await placeCard(page, 'sun', 4);
  await submit(page);
  await expectPassed(page);

  // T2: 빨강 1·파랑 2 → 그대로 확인하면 일반 ① → 빨강 칸을 키워 통과
  await expect(canvas(page).locator('[data-part="sector"]')).toHaveCount(2);
  await submit(page);
  await expectFailedWithHint(page, '전체 칸 가운데 빨강 칸이 차지하는 몫을 생각해 봐요.', 1);
  await passA2T2(page);

  // T3 첫 화면 + 스냅샷(돌리기 전), 답이 없다
  await expect(canvas(page).locator('[data-part="column"]')).toHaveCount(3);
  await expect(canvas(page).locator('[data-part="bar"]')).toHaveCount(0);
  await expectReachable(page, [canvas(page)]);
  await expectNoLeak(page, [/10000\s*번\s*중/]);
  await screenshot(page, 'g5s2u6-a2.png');

  // T3: 나(10번만 돌려 봐도) → MC-CHANCE-SMALL-SAMPLE ① → 다시 → ② small-batches. 세 칸을 돌리고 가 통과
  await choose(page, 'cmp', '나');
  await submit(page);
  await expectFailedWithHint(page, '더 많이 돌려 보면 어떻게 될까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '돌린 횟수가 적을 때 막대가 얼마나 들쭉날쭉한지', 2);
  await expectOverlayAligned(main, 'small-batches');
  await passA2T3(page);

  // T4·T5: 주머니(빨강 2·파랑 2)에서 빨강을 빼서 0, 파랑을 빼서 1
  await expect(canvas(page).locator('[data-part="marble"]')).toHaveCount(4);
  await passA2T4(page);
  await expect(canvas(page).locator('[data-part="marble"]')).toHaveCount(4);
  await passA2T5(page);

  // T6: 나 → MC-CHANCE-GAMBLER ① → 다시 → ② after-streak → 가 통과
  await expect(canvas(page).locator('[data-part="column"]')).toHaveCount(3);
  await expect(canvas(page).locator('[data-part="expected"]')).toHaveCount(0);
  await choose(page, 'next', '나');
  await submit(page);
  await expectFailedWithHint(page, '회전판이 앞의 결과를 기억할까?', 1);
  await submit(page);
  await expectFailedWithHint(page, '빨강이 이어서 나온 바로 다음 결과만 모아 보고', 2);
  await expectOverlayAligned(main, 'after-streak');
  await choose(page, 'next', '가');
  await submit(page);
  await expectPassed(page, true);
});

test('g5s2u6.A2 — 과제마다 대표 오답은 일반 힌트 ①이 뜬다', async ({ page }) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openActivity(page, 'g5s2u6.A2', '가상 데이터 확률 공장');

  // T1: 카드를 놓지 않고 확인
  await submit(page);
  await expectFailedWithHint(page, '각 상황이 일어날 가능성이 얼마나 되는지 말로 생각해 봐요.', 1);
  await passA2T1(page);

  // T2: 칸을 더해 빨강이 1/4
  await press(page, '칸 더하기');
  await submit(page);
  await expectFailedWithHint(page, '전체 칸 가운데 빨강 칸이 차지하는 몫을 생각해 봐요.', 1);
  await press(page, '처음으로');
  await passA2T2(page);

  // T3: 다(많이 돌릴수록 더 많이 나온다)를 고름(MC-CHANCE-SMALL-SAMPLE이 아닌 일반 ①)
  await choose(page, 'cmp', '다');
  await submit(page);
  await expectFailedWithHint(page, '세 칸을 모두 돌려 보고,', 1);
  await passA2T3(page);

  // T4: 그대로 확인 → 일반 ①
  await submit(page);
  await expectFailedWithHint(page, '주머니에서 빨강 구슬이 나올 수 있는 경우를 생각해 봐요.', 1);
  await passA2T4(page);

  // T5: 그대로 확인 → 일반 ①
  await submit(page);
  await expectFailedWithHint(
    page,
    '꺼낸 구슬이 반드시 빨강이 되려면 주머니 속은 어떤 모습일까요?',
    1,
  );
  await passA2T5(page);

  // T6: 고르지 않고 확인 → 일반 ①
  await submit(page);
  await expectFailedWithHint(page, '회전판은 돌릴 때마다 칸이 어떻게 나뉘어 있는지', 1);
  await choose(page, 'next', '가');
  await submit(page);
  await expectPassed(page, true);
});

// ---------------------------------------------------------------- 오프라인

test('오프라인에서도 g5s2u6.A1 활동이 열린다', async ({ page, context }) => {
  await page.goto(PREVIEW_URL);
  await page.getByRole('button', { name: '1번', exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await page.goto(`${PREVIEW_URL}/#/activity/g5s2u6.A1`);
  await expect(page.getByRole('heading', { name: '블록 기둥 평탄화와 평균 시소' })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: '블록 기둥 평탄화와 평균 시소' })).toBeVisible();
  await expect(page.getByRole('button', { name: '확인하기' })).toBeVisible();
});
