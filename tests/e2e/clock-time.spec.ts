import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { expectControlsAboveFold } from './controls-fold';

/**
 * E14 시계·시간(clock) 샌드박스 E2E. 아이패드(WebKit)·크롬북·전자칠판 뷰포트.
 *
 * - 긴바늘 끌기(12를 지나 감아 돌기 포함), 키보드 한 시간 넘기기
 * - 톱니 회전, 펼치기·다시 감기와 띠 위 표시 이동
 * - 힌트 ② 오버레이 셋이 본 캔버스와 1px 안에 겹침(펼친 상태의 numeral-minutes 포함)
 * - 첫 화면 기준 이미지(톱니 보임, 펼친 상태), 좁은 판에서 최소 배율 0.6 + 판 안 스크롤
 * - time-calc(T211): 키보드로 묶기·풀기·빼기, 올가미 연출, 분·초 단위, 힌트 ② sixty-overflow 정렬
 */

test.describe.configure({ timeout: 120_000 });

interface Observation {
  readonly mode?: string;
  readonly time?: string;
  readonly hour?: number;
  readonly minute?: number;
  readonly moves?: number;
  readonly unrolled?: boolean;
}

async function readObservation(page: Page): Promise<Observation> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as Observation;
}

async function pollObservation(page: Page, check: (o: Observation) => boolean): Promise<void> {
  await expect.poll(async () => check(await readObservation(page))).toBe(true);
}

async function open(
  page: Page,
  config: Record<string, unknown> = {},
  query = 'stage=fit',
): Promise<void> {
  const params = new URLSearchParams({ config: JSON.stringify(config) });
  for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
  await page.goto(`/?${params.toString()}#/sandbox/E14`);
  await expect(page.getByRole('heading', { name: '시계·시간' })).toBeVisible();
  await pollObservation(page, (o) => o.mode === 'clock');
  await settleCanvas(page);
}

/** 판이 칸에 맞춰 크기를 정할 때까지(상자가 두 번 연속 같아질 때까지) 기다린다. */
async function settleCanvas(page: Page): Promise<void> {
  let previous = '';
  await expect
    .poll(async () => {
      const box = await page.getByTestId('clock-canvas').boundingBox();
      const now = JSON.stringify(box);
      const same = now === previous;
      previous = now;
      return same;
    })
    .toBe(true);
}

function button(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true });
}

function canvas(page: Page): Locator {
  return page.getByTestId('clock-canvas');
}

const CENTER = { x: 275, y: 255 };

/** 시계 중심에서 deg(12시 방향 0°, 시계 방향)·반지름 r인 논리 좌표를 화면 좌표로. */
async function polarPoint(
  page: Page,
  deg: number,
  radius: number,
): Promise<{ x: number; y: number }> {
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('캔버스를 찾지 못했습니다.');
  const rad = (deg * Math.PI) / 180;
  const lx = CENTER.x + radius * Math.sin(rad);
  const ly = CENTER.y - radius * Math.cos(rad);
  return { x: box.x + (lx / 1000) * box.width, y: box.y + (ly / 1000) * box.width };
}

/** 원 둘레를 따라 fromDeg에서 toDeg까지 끈다(toDeg는 fromDeg보다 커도 작아도 된다). */
async function dragArc(
  page: Page,
  fromDeg: number,
  toDeg: number,
  radius = 150,
  from: { deg: number; radius: number } = { deg: fromDeg, radius },
): Promise<void> {
  const start = await polarPoint(page, from.deg, from.radius);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const steps = Math.max(2, Math.ceil(Math.abs(toDeg - fromDeg) / 8));
  for (let i = 1; i <= steps; i += 1) {
    const p = await polarPoint(page, fromDeg + ((toDeg - fromDeg) * i) / steps, radius);
    await page.mouse.move(p.x, p.y);
  }
  await page.mouse.up();
}

// ── 끌기·키보드 ──────────────────────────────────────────

test('긴바늘을 끌어 4:25를 만든다(분 단위, 짧은바늘이 따라 돈다)', async ({ page }) => {
  await open(page, { start: '4:00' });
  await dragArc(page, 0, 150);
  await pollObservation(page, (o) => o.time === '4:25' && o.moves === 1);
  await expect(canvas(page).locator('[data-part="short-hand"]')).toHaveAttribute(
    'data-angle',
    '132.50',
  );
  await expect(canvas(page).locator('[data-part="long-hand"]')).toHaveAttribute(
    'data-angle',
    '150.00',
  );
});

test('긴바늘을 12 너머로 끌면 다음 시로 넘어가고, 거꾸로 끌면 이전 시로 돌아간다', async ({
  page,
}) => {
  await open(page, { start: '4:50' });
  // 4:50의 긴바늘은 300°. 시계 방향으로 90° 더 돌려 4:50 → 5:05.
  await dragArc(page, 300, 390);
  await pollObservation(page, (o) => o.time === '5:05');
  // 5:05의 긴바늘(30°)을 반시계로 60° 돌려 5:05 → 4:55.
  await dragArc(page, 30, -30);
  await pollObservation(page, (o) => o.time === '4:55');
});

test('짧은바늘을 끌어도 돌아가고(긴바늘이 그만큼 빨리 돈다) 정시 규칙에 붙는다', async ({
  page,
}) => {
  await open(page, { start: '3:00', granularity: 'hour' });
  // 짧은바늘 3시(90°)를 4시(120°) 쪽으로 끈다.
  await dragArc(page, 90, 118, 80);
  await pollObservation(page, (o) => o.time === '4:00' && o.moves === 1);
});

test('5-weak: 끌다가 4:24에서 놓으면 4:25에 붙고 4:22는 그대로', async ({ page }) => {
  await open(page, { start: '4:00', snapMinuteTo: '5-weak' });
  await dragArc(page, 0, 144);
  await pollObservation(page, (o) => o.time === '4:25');
  await dragArc(page, 150, 132);
  await pollObservation(page, (o) => o.time === '4:22');
});

test('키보드: ←→는 한 칸, Shift+→는 한 시간(12를 넘어 감아 돈다)', async ({ page }) => {
  await open(page, { start: '11:00', granularity: 'half-hour' });
  await canvas(page).getByRole('slider').focus();
  await page.keyboard.press('ArrowRight');
  await pollObservation(page, (o) => o.time === '11:30');
  await page.keyboard.press('Shift+ArrowRight');
  await pollObservation(page, (o) => o.time === '12:30');
  await page.keyboard.press('ArrowLeft');
  await pollObservation(page, (o) => o.time === '12:00');
  await page.keyboard.press('Shift+ArrowLeft');
  await pollObservation(page, (o) => o.time === '11:00');
});

test('단추: 거꾸로·앞으로·처음으로, 읽기 과제는 조작을 막는다', async ({ page }) => {
  await open(page, { start: '3:00' });
  await button(page, '앞으로 ▶').click();
  await pollObservation(page, (o) => o.time === '3:01');
  await button(page, '◀ 거꾸로').click();
  await button(page, '◀ 거꾸로').click();
  await pollObservation(page, (o) => o.time === '2:59' && o.moves === 3);
  await button(page, '처음으로').click();
  await pollObservation(page, (o) => o.time === '3:00' && o.moves === 0);

  await open(page, { start: '3:00', readOnly: true });
  await expect(button(page, '앞으로 ▶')).toHaveCount(0);
  await expect(page.getByText('시계를 잘 보세요.')).toBeVisible();
  await dragArc(page, 0, 90);
  await pollObservation(page, (o) => o.time === '3:00' && o.moves === 0);
});

test('시각 글은 기본으로 보이지 않고, always면 보인다', async ({ page }) => {
  await open(page, { start: '8:30' });
  await expect(page.getByTestId('clock-digital')).toHaveCount(0);
  await expect(canvas(page).locator('[data-part="long-hand"]')).toHaveAttribute(
    'aria-label',
    '긴바늘이 6을 가리켜요',
  );
  await expect(page.getByRole('slider')).toHaveAttribute(
    'aria-valuetext',
    '긴바늘이 6을 가리켜요. 짧은바늘이 8과 9 사이에 있어요',
  );
  await open(page, { start: '8:30', digitalReadout: 'always' });
  await expect(page.getByTestId('clock-digital')).toHaveText('8:30');
});

// ── 톱니 ────────────────────────────────────────────────

test('톱니: 긴바늘·짧은바늘과 같이 돈다', async ({ page }) => {
  await open(page, { start: '3:00', showGears: true });
  const big = canvas(page).locator('[data-part="gear-big"]');
  const small = canvas(page).locator('[data-part="gear-small"]');
  await expect(big).toHaveAttribute('data-angle', '0.00');
  await expect(small).toHaveAttribute('data-angle', '90.00');
  await expect(page.getByText('긴바늘이 한 바퀴 돌면 짧은바늘은 한 칸')).toBeVisible();
  for (let i = 0; i < 10; i += 1) await button(page, '앞으로 ▶').click();
  await expect(big).toHaveAttribute('data-angle', '60.00');
  await expect(small).toHaveAttribute('data-angle', '95.00');
  // 큰 톱니 그림의 실제 회전 변환도 바뀐다.
  await expect(big.locator(':scope > g')).toHaveAttribute('transform', /rotate\(60 /);
});

// ── 펼치기 ──────────────────────────────────────────────

test('펼치기·다시 감기: 띠가 생기고 표시가 긴바늘을 따라 움직인다', async ({ page }) => {
  await open(page, { start: '4:25', unroll: true });
  await expect(canvas(page).locator('[data-part="strip"]')).toHaveCount(0);
  await button(page, '펼치기').click();
  await pollObservation(page, (o) => o.unrolled === true);
  const strip = canvas(page).locator('[data-part="strip"]');
  await expect(strip).toBeVisible();
  await expect(strip.locator('[data-part="strip-numeral"]')).toHaveCount(12);
  await expect(strip.locator('[data-part="strip-minute"]')).toHaveCount(13);
  const marker = strip.locator('[data-part="strip-marker"]');
  const before = Number(await marker.getAttribute('data-x'));
  expect(before).toBeCloseTo(60 + (25 / 60) * 880, 0);
  // 시계 판은 그대로 있고, 긴바늘을 돌리면 표시가 같이 움직인다.
  await expect(canvas(page).locator('[data-part="long-hand"]')).toBeVisible();
  for (let i = 0; i < 5; i += 1) await button(page, '앞으로 ▶').click();
  await expect(marker).toHaveAttribute('data-x', (60 + (30 / 60) * 880).toFixed(2));
  expect(Number(await marker.getAttribute('data-x'))).toBeGreaterThan(before);
  await button(page, '다시 감기').click();
  await pollObservation(page, (o) => o.unrolled === false);
  await expect(canvas(page).locator('[data-part="strip"]')).toHaveCount(0);
});

test('읽기 과제(readOnly)에서는 펼쳐도 띠 위 표시를 그리지 않는다', async ({ page }) => {
  await open(page, { start: '4:25', unroll: true, readOnly: true });
  await button(page, '펼치기').click();
  await expect(canvas(page).locator('[data-part="strip"]')).toBeVisible();
  await expect(canvas(page).locator('[data-part="strip-marker"]')).toHaveCount(0);
});

// ── 기준 이미지 ──────────────────────────────────────────

async function expectPageSnapshot(page: Page, name: string): Promise<void> {
  test.skip(test.info().project.name === 'board', '기준 이미지는 크롬북·아이패드만 둔다.');
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByTestId('clock-controls').evaluate((element) => {
    element.scrollTo(0, 0);
    // T199 원칙: 좁은 판에서는 엔진 바깥 상자(.wrap)가 세로로 스크롤한다.
    element.closest('[class*="wrap"]')?.scrollTo(0, 0);
  });
  await expect(page).toHaveScreenshot(name, { fullPage: true, animations: 'disabled' });
}

test('화면 기준: 톱니가 보이는 첫 화면', async ({ page }) => {
  await open(page, { start: '4:25', showGears: true, unroll: true });
  await page.getByRole('heading', { name: '시계·시간' }).focus();
  await expectPageSnapshot(page, 'clock-gears.png');
});

test('화면 기준: 펼친 상태', async ({ page }) => {
  await open(page, { start: '4:25', showGears: true, unroll: true });
  await button(page, '펼치기').click();
  await pollObservation(page, (o) => o.unrolled === true);
  await page.getByRole('heading', { name: '시계·시간' }).focus();
  await expectPageSnapshot(page, 'clock-unrolled.png');
});

// ── 오버레이 정렬 ────────────────────────────────────────

/** 오버레이 svg 상자가 clock-canvas 상자와 1px 이내로 같다(overlay-alignment 방식). */
async function expectAligned(page: Page, overlay: string): Promise<Locator> {
  const layer = page.locator(`[data-overlay="${overlay}"]`);
  await expect(layer).toBeVisible();
  await expect
    .poll(async () => {
      const a = await canvas(page).boundingBox();
      const b = await layer.locator('svg').first().boundingBox();
      if (!a || !b) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(a.x - b.x),
        Math.abs(a.y - b.y),
        Math.abs(a.width - b.width),
        Math.abs(a.height - b.height),
      );
    })
    .toBeLessThanOrEqual(1);
  return layer;
}

async function toggleOverlay(page: Page): Promise<void> {
  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
}

/** 오버레이 요소의 화면 중심이 본 바늘의 화면 중심(같은 각도·반지름)과 1px 안인지 본다. */
async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('상자를 찾지 못했습니다.');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('힌트 ② hour-hand-focus: 긴바늘 점선 윤곽과 짧은바늘 굵은 윤곽', async ({ page }) => {
  await open(page, { start: '3:25' }, 'stage=fit&overlay=hour-hand-focus');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'hour-hand-focus');
  await expect(layer.locator('[data-part="short-focus"]')).toHaveAttribute('data-angle', '102.50');
  await expect(layer.locator('[data-part="long-ghost"]')).toHaveAttribute('data-angle', '150.00');
  await expect(layer).toContainText('몇 시는 짧은바늘이 알려 줘요');
  // 짧은바늘 윤곽은 본 짧은바늘 그림과 같은 자리에 겹친다.
  const mine = await centerOf(canvas(page).locator('[data-part="short-hand"] polygon'));
  const focus = await centerOf(layer.locator('[data-part="short-focus"] polygon'));
  expect(Math.abs(mine.x - focus.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(mine.y - focus.y)).toBeLessThanOrEqual(1);
});

test('힌트 ② rewind-to-hour: 정시로 되감은 유령 바늘과 12까지의 호', async ({ page }) => {
  await open(page, { start: '8:30' }, 'stage=fit&overlay=rewind-to-hour');
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'rewind-to-hour');
  await expect(layer.locator('[data-part="ghost-short"]')).toHaveAttribute('data-angle', '240.00');
  await expect(layer.locator('[data-part="ghost-long"]')).toHaveAttribute('data-angle', '0.00');
  await expect(layer.locator('[data-part="rewind-arc"]')).toHaveCount(1);
  // 둘러싼 원은 시계의 숫자 8 자리(240°, 반지름 170)에 놓인다.
  const ring = await centerOf(layer.locator('[data-part="hour-ring"]'));
  const eight = await polarPoint(page, 240, 170);
  expect(Math.abs(ring.x - eight.x)).toBeLessThanOrEqual(6);
  expect(Math.abs(ring.y - eight.y)).toBeLessThanOrEqual(6);
});

test('힌트 ② rewind-to-hour: 분이 0이면 그리지 않는다', async ({ page }) => {
  await open(page, { start: '8:00' }, 'stage=fit&overlay=rewind-to-hour');
  await toggleOverlay(page);
  await expect(page.locator('[data-overlay="rewind-to-hour"] svg')).toHaveCount(0);
});

test('힌트 ② numeral-minutes: 시계 바깥과 펼친 띠 위에 같은 이름표', async ({ page }) => {
  await open(
    page,
    { start: '4:25', unroll: true },
    `stage=fit&overlay=numeral-minutes&overlayArgs=${encodeURIComponent('{"numeral":5}')}`,
  );
  await button(page, '펼치기').click();
  await pollObservation(page, (o) => o.unrolled === true);
  await page.waitForTimeout(500); // 펼치기 보간(300ms)이 끝난 뒤에 잰다.
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'numeral-minutes');
  await expect(layer.locator('[data-part="clock-label"]')).toContainText('25분');
  await expect(layer.locator('[data-part="strip-label"]')).toContainText('25분');
  // 띠 이름표는 띠의 25분 눈금 위에 놓인다.
  const label = await centerOf(layer.locator('[data-part="strip-label"] line'));
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('캔버스를 찾지 못했습니다.');
  const tickX = box.x + ((60 + (25 / 60) * 880) / 1000) * box.width;
  expect(Math.abs(label.x - tickX)).toBeLessThanOrEqual(1);
});

// ── 판 크기·터치 타깃 ────────────────────────────────────

test('넓은 판은 줄여서 맞추고, 좁은 판은 최소 배율 0.6에서 멈추고 판 안에서 스크롤한다', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'chromebook', '크롬북 뷰포트에서만 판 크기를 바꿔 본다.');
  await open(page, { start: '3:00', unroll: true });
  const wide = await canvas(page).boundingBox();
  if (!wide) throw new Error('캔버스를 찾지 못했습니다.');
  expect(wide.width / 1000).toBeGreaterThanOrEqual(0.6);
  await expect(page.getByTestId('clock-board')).toHaveAttribute('data-scroll', 'false');

  await page.setViewportSize({ width: 520, height: 700 });
  await expect(page.getByTestId('clock-board')).toHaveAttribute('data-scroll', 'true');
  const narrow = await canvas(page).boundingBox();
  if (!narrow) throw new Error('캔버스를 찾지 못했습니다.');
  expect(narrow.width).toBeGreaterThanOrEqual(599);
  expect(narrow.width).toBeLessThanOrEqual(601);
  // 펼치지 않은 판은 시계만 담는 논리 1000×510이라 최소 배율 0.6에서 306px다.
  expect(narrow.height).toBeGreaterThanOrEqual(305);
  const scrolls = await page
    .getByTestId('clock-board')
    .evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(scrolls).toBe(true);
  // 조작 칸은 스크롤 상자 밖이고 눌리지 않는다(T199).
  await expect(button(page, '앞으로 ▶')).toBeVisible();
  const outside = await button(page, '앞으로 ▶').evaluate(
    (el) => !document.querySelector('[data-testid="clock-board"]')?.contains(el),
  );
  expect(outside).toBe(true);
  const height = (await button(page, '앞으로 ▶').boundingBox())?.height ?? 0;
  expect(height).toBeGreaterThanOrEqual(47.5);
});

async function expectMin(locator: Locator, min: number, label: string): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label}: 상자를 찾지 못했습니다.`);
  expect(Math.min(box.width, box.height), label).toBeGreaterThanOrEqual(min - 0.5);
}

for (const size of [48, 64] as const) {
  test(`터치 타깃 ${size}: 모든 단추가 ${size}px 이상`, async ({ page }) => {
    await open(page, { start: '3:00', unroll: true });
    // 설정은 저장되므로 아직 48px일 때만 눌러 64px로 바꾼다.
    const toggle = page.getByRole('button', { name: '터치 48px' });
    if (size === 64 && (await toggle.count()) > 0) await toggle.click();
    const controls = page.getByTestId('clock-controls').getByRole('button');
    const count = await controls.count();
    expect(count).toBe(4);
    for (let i = 0; i < count; i += 1) {
      await controls.nth(i).scrollIntoViewIfNeeded();
      await expectMin(controls.nth(i), size, `단추 ${i}`);
    }
  });
}

// ── duration·calendar ───────────────────────────────────

interface ModeObservation {
  readonly mode?: string;
  readonly start?: string | null;
  readonly end?: string | null;
  readonly elapsed?: number | null;
  readonly selected?: number[];
  readonly filled?: Record<string, number>;
  readonly hiddenCorrect?: boolean;
  readonly arrows?: number;
}

async function readMode(page: Page): Promise<ModeObservation> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as ModeObservation;
}

async function pollMode(page: Page, check: (o: ModeObservation) => boolean): Promise<void> {
  await expect.poll(async () => check(await readMode(page))).toBe(true);
}

/** 샌드박스를 열고 모드 상자에서 모드를 고른다(설정은 주소로 넘긴 값 그대로). */
async function openMode(
  page: Page,
  mode: 'duration' | 'calendar',
  config: Record<string, unknown> = {},
  query = 'stage=fit',
): Promise<void> {
  const params = new URLSearchParams({ config: JSON.stringify(config) });
  for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
  await page.goto(`/?${params.toString()}#/sandbox/E14`);
  await expect(page.getByRole('heading', { name: '시계·시간' })).toBeVisible();
  await page.getByRole('combobox', { name: '모드' }).selectOption(mode);
  await pollMode(page, (o) => o.mode === mode);
  await settleCanvas(page);
}

/** 논리 좌표(1000×600)를 화면 좌표로. */
async function logicalPoint(page: Page, lx: number, ly: number): Promise<{ x: number; y: number }> {
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('캔버스를 찾지 못했습니다.');
  return { x: box.x + (lx / 1000) * box.width, y: box.y + (ly / 1000) * box.width };
}

async function dragLogical(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  const a = await logicalPoint(page, from.x, from.y);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i += 1) {
    const p = await logicalPoint(
      page,
      from.x + ((to.x - from.x) * i) / 6,
      from.y + ((to.y - from.y) * i) / 6,
    );
    await page.mouse.move(p.x, p.y);
  }
  await page.mouse.up();
}

// from 2:00, to 4:00 의 띠: 블록 둘(60~493, 507~940). 2:40 → 348.67, 3:20 → 651.33.
const X_2_40 = 60 + (40 / 60) * 433;
const X_3_20 = 507 + (20 / 60) * 433;
// 놓지 않은 표시가 쉬는 자리(꼭짓점 130/250, 150)에서 몸통 한가운데(위로 40)를 잡는다.
const TRAY_START = { x: 130, y: 110 };
const TRAY_END = { x: 250, y: 110 };
const BAR_MID = 290;

async function placeSpan(page: Page): Promise<void> {
  await dragLogical(page, TRAY_START, { x: X_2_40, y: BAR_MID });
  await pollMode(page, (o) => o.start === '2:40');
  await dragLogical(page, TRAY_END, { x: X_3_20, y: BAR_MID });
  await pollMode(page, (o) => o.end === '3:20');
}

function cellOf(page: Page, col: number, row: number): Locator {
  return canvas(page).locator(`[data-part="cell"][data-col="${col}"][data-row="${row}"]`);
}

/** 달력 칸 한가운데(논리 좌표). */
function cellCenter(col: number, row: number): { x: number; y: number } {
  return { x: 80 + col * 120 + 60, y: 64 + row * 88 + 44 };
}

test('duration: 시작·끝 표시를 끌어 2:40·3:20에 놓으면 구간이 칠해지고 걸린 시간은 40분이다', async ({
  page,
}) => {
  await openMode(page, 'duration', { from: '2:00', to: '4:00' });
  await expect(canvas(page).locator('[data-part="block"]')).toHaveCount(2);
  await expect(canvas(page).locator('[data-part="hour-name"]')).toHaveText(['2시', '3시', '4시']);
  await expect(canvas(page).locator('[data-part="span-piece"]')).toHaveCount(0);
  await placeSpan(page);
  await pollMode(page, (o) => o.elapsed === 40);
  await expect(canvas(page).locator('[data-part="span-piece"]')).toHaveCount(2);
  // 걸린 시간은 화면 글에 없다(Observation에만 있다).
  await expect(canvas(page)).not.toContainText(/걸린|40분|80분/);
  await expect(page.getByTestId('clock-controls')).not.toContainText(/40분|80분/);
  // 놓은 표시는 눈금 자리에 있다.
  const mark = await canvas(page).locator('[data-part="mark-start"]').getAttribute('data-x');
  expect(Number(mark)).toBeCloseTo(X_2_40, 1);
});

test('duration: 띠 밖에 놓으면 취소되고, 끝이 시작보다 앞이면 거절한다', async ({ page }) => {
  await openMode(page, 'duration', { from: '2:00', to: '4:00' });
  await dragLogical(page, TRAY_START, { x: 600, y: 520 });
  await pollMode(page, (o) => o.start === null);
  await dragLogical(page, TRAY_START, { x: X_3_20, y: BAR_MID });
  await pollMode(page, (o) => o.start === '3:20');
  await dragLogical(page, TRAY_END, { x: X_2_40, y: BAR_MID });
  await expect(page.getByTestId('clock-message')).toHaveText('끝은 시작보다 앞에 놓을 수 없어요.');
  await pollMode(page, (o) => o.end === null);
});

test('duration: 키보드로 표시를 고르고 ←→로 5분씩 옮긴다', async ({ page }) => {
  await openMode(page, 'duration', { from: '2:00', to: '4:00', start: '2:40' });
  await pollMode(page, (o) => o.start === '2:40' && o.end === null);
  const end = page.getByRole('slider', { name: '끝 표시' });
  await end.focus();
  await page.keyboard.press('ArrowRight'); // 처음 누르면 시작 자리에 놓는다
  await pollMode(page, (o) => o.end === '2:40' && o.elapsed === 0);
  for (let i = 0; i < 8; i += 1) await page.keyboard.press('ArrowRight');
  await pollMode(page, (o) => o.end === '3:20' && o.elapsed === 40);
  await page.keyboard.press('ArrowLeft');
  await pollMode(page, (o) => o.end === '3:15');
  // 같은 일을 하는 조작 칸 단추
  await button(page, '끝 ▶').click();
  await pollMode(page, (o) => o.end === '3:20');
  await button(page, '시작 ◀').click();
  await pollMode(page, (o) => o.start === '2:35' && o.elapsed === 45);
  await button(page, '처음으로').click();
  await pollMode(page, (o) => o.start === '2:40' && o.end === null);
});

test('duration: startFixed는 시작 표시를 끌어도 못 움직이고 끝만 놓는다', async ({ page }) => {
  await openMode(page, 'duration', { from: '2:00', to: '4:00', start: '2:40', startFixed: true });
  await expect(button(page, '시작 ▶')).toHaveCount(0);
  await dragLogical(page, { x: X_2_40, y: 200 }, { x: X_3_20, y: BAR_MID });
  await pollMode(page, (o) => o.start === '2:40');
  await dragLogical(page, TRAY_END, { x: X_3_20, y: BAR_MID });
  await pollMode(page, (o) => o.end === '3:20' && o.elapsed === 40);
});

test('calendar: 날짜 고르기·풀기, 가려진 칸 채우기, 세로줄 쓸기', async ({ page }) => {
  await openMode(page, 'calendar', {});
  await expect(canvas(page).locator('[data-part="weekday"]')).toHaveText([
    '일',
    '월',
    '화',
    '수',
    '목',
    '금',
    '토',
  ]);
  // 5일은 목요일(열 4, 줄 0)
  await expect(cellOf(page, 4, 0)).toHaveAttribute('data-day', '5');
  await cellOf(page, 4, 0).click();
  await pollMode(page, (o) => (o.selected ?? []).join() === '5');
  await cellOf(page, 3, 0).click(); // 4일
  await pollMode(page, (o) => (o.selected ?? []).join() === '4,5');
  await cellOf(page, 4, 0).click();
  await pollMode(page, (o) => (o.selected ?? []).join() === '4');
  await expect(cellOf(page, 3, 0)).toHaveAttribute('data-selected', 'true');

  // 가려진 칸(8·12·19·26)은 값이 DOM에 없고 눌러서 수를 넣는다.
  for (const day of [8, 12, 19, 26]) {
    await expect(canvas(page).locator(`[data-day="${day}"]`)).toHaveCount(0);
  }
  await expect(cellOf(page, 0, 1)).toHaveText('?');
  await cellOf(page, 0, 1).click();
  await button(page, '8').click();
  await button(page, '넣기').click();
  await pollMode(page, (o) => o.filled?.['8'] === 8 && o.hiddenCorrect === false);
  await expect(cellOf(page, 0, 1)).toHaveText('8');
  const fills: [number, number, string[]][] = [
    [4, 1, ['1', '2']],
    [4, 2, ['1', '9']],
    [4, 3, ['2', '6']],
  ];
  for (const [col, row, digits] of fills) {
    await cellOf(page, col, row).click();
    for (const d of digits) await button(page, d).click();
    await button(page, '넣기').click();
  }
  await pollMode(page, (o) => o.hiddenCorrect === true);

  // 같은 세로줄을 위에서 아래로 쓸면 +7 화살표가 마디마다 생긴다.
  await dragLogical(page, cellCenter(4, 0), cellCenter(4, 2));
  await pollMode(page, (o) => o.arrows === 2);
  await expect(canvas(page).locator('[data-part="arrow"]')).toHaveCount(2);
  // 다른 세로줄로 벗어난 쓸기는 거절한다.
  await dragLogical(page, cellCenter(1, 0), cellCenter(2, 2));
  await expect(page.getByTestId('clock-message')).toHaveText(
    '같은 세로줄에서 위에서 아래로 쓸어 보세요.',
  );
  expect((await readMode(page)).arrows).toBe(2);
  // 키보드: 칸에서 A 키
  await cellOf(page, 1, 0).focus();
  await page.keyboard.press('a');
  await pollMode(page, (o) => o.arrows === 3);
  await button(page, '처음으로').click();
  await pollMode(page, (o) => o.arrows === 0 && (o.selected ?? []).length === 0);
});

test('calendar: 가려진 날짜 값이 DOM·data-·aria 어디에도 없다', async ({ page }) => {
  await openMode(page, 'calendar', {});
  const leaked = await canvas(page).evaluate((svg) => {
    const found: string[] = [];
    for (const cell of svg.querySelectorAll('[data-part="cell"][data-hidden="true"]')) {
      if (cell.textContent !== '?') found.push(`text:${cell.textContent}`);
      for (const attribute of cell.attributes) {
        if (['data-col', 'data-row', 'tabindex'].includes(attribute.name)) continue;
        if (/\d/.test(attribute.value) || attribute.name === 'data-day') {
          found.push(`${attribute.name}=${attribute.value}`);
        }
      }
    }
    for (const day of [8, 12, 19, 26]) {
      if (svg.querySelector(`[data-day="${day}"]`)) found.push(`day:${day}`);
    }
    return found;
  });
  expect(leaked).toEqual([]);
});

test('calendar: 칸이 48px 이상이다', async ({ page }) => {
  await openMode(page, 'calendar', {});
  const cells = canvas(page).locator('[data-part="cell"] rect');
  expect(await cells.count()).toBe(30);
  for (const index of [0, 12, 29]) {
    await expectMin(cells.nth(index), 48, `칸 ${index}`);
  }
});

test('모드 상자에서 duration·calendar를 고르면 판이 바뀐다', async ({ page }) => {
  await open(page, {});
  await page.getByRole('combobox', { name: '모드' }).selectOption('duration');
  await pollMode(page, (o) => o.mode === 'duration');
  await expect(canvas(page).locator('[data-part="band"]')).toBeVisible();
  await page.getByRole('combobox', { name: '모드' }).selectOption('calendar');
  await pollMode(page, (o) => o.mode === 'calendar');
  await expect(canvas(page).locator('[data-part="cell"]')).toHaveCount(30);
});

test('화면 기준: duration 첫 화면(시작·끝을 놓은 뒤)', async ({ page }) => {
  await openMode(page, 'duration', { from: '2:00', to: '4:00' });
  await placeSpan(page);
  await page.getByRole('heading', { name: '시계·시간' }).focus();
  await expectPageSnapshot(page, 'clock-duration.png');
});

test('화면 기준: calendar 첫 화면(고른 날과 화살표)', async ({ page }) => {
  await openMode(page, 'calendar', {});
  await cellOf(page, 4, 0).click();
  await dragLogical(page, cellCenter(4, 0), cellCenter(4, 2));
  await pollMode(page, (o) => o.arrows === 2);
  await page.getByRole('heading', { name: '시계·시간' }).focus();
  await expectPageSnapshot(page, 'clock-calendar.png');
});

test('힌트 ② hour-60-split: 지나는 경계마다 말풍선·강조선, 조각마다 괄호', async ({ page }) => {
  await openMode(page, 'duration', { from: '2:00', to: '4:00' }, 'stage=fit&overlay=hour-60-split');
  await placeSpan(page);
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'hour-60-split');
  await expect(layer).toContainText('60분이 되면 다음 시');
  await expect(layer.locator('[data-part="piece-bracket"]')).toHaveCount(2);
  // 강조선은 블록 사이 틈(500)의 한가운데에 놓인다.
  const line = await centerOf(layer.locator('[data-part="split-boundary"] line').first());
  const want = await logicalPoint(page, 500, 290);
  expect(Math.abs(line.x - want.x)).toBeLessThanOrEqual(1);
});

test('힌트 ② hour-60-split: 표시가 하나뿐이면 그리지 않는다', async ({ page }) => {
  await openMode(page, 'duration', { from: '2:00', to: '4:00' }, 'stage=fit&overlay=hour-60-split');
  await dragLogical(page, TRAY_START, { x: X_2_40, y: BAR_MID });
  await pollMode(page, (o) => o.start === '2:40');
  await toggleOverlay(page);
  await expect(page.locator('[data-overlay="hour-60-split"] svg')).toHaveCount(0);
});

test('힌트 ② plus-seven: 그 칸에서 같은 열 아래로 끝까지 +7 점선 화살표', async ({ page }) => {
  await openMode(
    page,
    'calendar',
    {},
    `stage=fit&overlay=plus-seven&overlayArgs=${encodeURIComponent('{"day":5}')}`,
  );
  await toggleOverlay(page);
  const layer = await expectAligned(page, 'plus-seven');
  await expect(layer.locator('[data-part="plus-seven"]')).toHaveCount(3);
  // 첫 화살표는 5일 칸(열 4, 줄 0) 안쪽 세로선 자리(칸 가운데에서 왼쪽 22)에 놓인다.
  const arrow = await centerOf(layer.locator('[data-part="plus-seven"] line').first());
  const want = await logicalPoint(page, cellCenter(4, 0).x - 22, 64 + 88 - 4 - 9 + 20);
  expect(Math.abs(arrow.x - want.x)).toBeLessThanOrEqual(1);
  // 오버레이는 칸 숫자를 새로 쓰지 않는다.
  await expect(layer).toHaveText('+7+7+7');
});

// ══ T211: time-calc(시·분·초 블록 60 묶기·풀기) ═══════════════════════

const TIME_ADD = {
  op: 'add',
  a: { h: 1, m: 45, s: 0 },
  b: { h: 0, m: 30, s: 0 },
  units: ['h', 'm'],
};
const TIME_SUB = {
  op: 'sub',
  a: { h: 3, m: 10, s: 0 },
  b: { h: 1, m: 40, s: 0 },
  units: ['h', 'm'],
};
const TIME_SEC = { op: 'add', a: { m: 1, s: 40 }, b: { m: 0, s: 50 }, units: ['m', 's'] };

interface TimeObservation {
  readonly mode?: string;
  readonly big?: number;
  readonly small?: number;
  readonly normalized?: boolean;
  readonly bundles?: number;
  readonly unbundles?: number;
  readonly tookAway?: boolean;
  readonly misconceptions?: string[];
}

async function readTime(page: Page): Promise<TimeObservation> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as TimeObservation;
}

async function pollTime(page: Page, check: (o: TimeObservation) => boolean): Promise<void> {
  await expect.poll(async () => check(await readTime(page))).toBe(true);
}

function timeCanvas(page: Page): Locator {
  return page.getByTestId('timecalc-canvas');
}

async function openTime(
  page: Page,
  config: Record<string, unknown> = {},
  query = 'stage=fit',
): Promise<void> {
  const params = new URLSearchParams({ config: JSON.stringify(config) });
  for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
  await page.goto(`/?${params.toString()}#/sandbox/E14`);
  await expect(page.getByRole('heading', { name: '시계·시간' })).toBeVisible();
  await page.getByRole('combobox', { name: '모드' }).selectOption('time-calc');
  await pollTime(page, (o) => o.mode === 'time-calc');
  let previous = '';
  await expect
    .poll(async () => {
      const now = JSON.stringify(await timeCanvas(page).boundingBox());
      const same = now === previous;
      previous = now;
      return same;
    })
    .toBe(true);
}

/** 올가미가 한 번이라도 그려졌는지 기록한다(400ms 동안만 보이므로 DOM 변화를 지켜본다). */
async function watchLasso(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __lasso?: boolean };
    w.__lasso = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-part="lasso"]')) w.__lasso = true;
    }).observe(document.body, { subtree: true, childList: true });
  });
}

async function sawLasso(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as { __lasso?: boolean }).__lasso === true);
}

test('time-calc: 1시간 45분 + 30분은 처음부터 한 줄(1시간 75분)이고, 키보드로 묶으면 2시간 15분이 된다', async ({
  page,
}) => {
  await openTime(page, TIME_ADD);
  const board = timeCanvas(page);
  expect(await readTime(page)).toMatchObject({
    big: 1,
    small: 75,
    normalized: false,
    misconceptions: ['MC-TIME-BASE-100'],
  });
  await expect(board.locator('[data-part="big-block"]')).toHaveCount(1);
  await expect(board.locator('[data-part="rod"]')).toHaveCount(7);
  await expect(board.locator('[data-part="single"]')).toHaveCount(5);
  await watchLasso(page);
  await button(page, '1시간으로 묶기').focus();
  await page.keyboard.press('Enter');
  await pollTime(page, (o) => o.big === 2 && o.small === 15 && o.normalized === true);
  expect(await readTime(page)).toMatchObject({ bundles: 1, misconceptions: [] });
  expect(await sawLasso(page)).toBe(true);
  await expect(board.locator('[data-part="lasso"]')).toHaveCount(0);
  await expect(board.locator('[data-part="big-block"]')).toHaveCount(2);
  await expect(board.locator('[data-part="rod"]')).toHaveCount(1);
  await expect(board.locator('[data-part="single"]')).toHaveCount(5);
  // 60 미만이면 더 묶을 수 없다.
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('clock-message')).toContainText('60개');
  await button(page, '처음으로').focus();
  await page.keyboard.press('Space');
  await pollTime(page, (o) => o.big === 1 && o.small === 75 && o.bundles === 0);
});

test('time-calc: 움직임 줄이기를 켜면 올가미 없이 바로 묶인다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTime(page, TIME_ADD);
  await watchLasso(page);
  await button(page, '1시간으로 묶기').click();
  await pollTime(page, (o) => o.big === 2 && o.small === 15);
  expect(await sawLasso(page)).toBe(false);
});

test('time-calc: 3시간 10분 − 1시간 40분은 칸이 모자라 풀고 빼면 1시간 30분이다(키보드)', async ({
  page,
}) => {
  await openTime(page, TIME_SUB);
  const board = timeCanvas(page);
  await expect(board.locator('[data-part="subtrahend"]')).toHaveText('뺄 시간 1시간 40분');
  await expect(board.locator('[data-part="big-block"]')).toHaveCount(3);
  await button(page, '빼기').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('clock-message')).toHaveText('칸이 모자라요.');
  expect((await readTime(page)).tookAway).toBe(false);
  await button(page, '60분으로 풀기').focus();
  await page.keyboard.press('Space');
  await pollTime(page, (o) => o.big === 2 && o.small === 70 && o.unbundles === 1);
  // 분 칸이 70개: 막대 7개
  await expect(board.locator('[data-part="rod"]')).toHaveCount(7);
  await expect(board.locator('[data-part="single"]')).toHaveCount(0);
  await button(page, '빼기').focus();
  await page.keyboard.press('Enter');
  await pollTime(page, (o) => o.tookAway === true);
  expect(await readTime(page)).toMatchObject({
    big: 1,
    small: 30,
    normalized: true,
    unbundles: 1,
    misconceptions: [],
  });
  // 이미 뺐으면 거절한다.
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('clock-message')).toHaveText('이미 뺐어요.');
});

test('time-calc: 분·초 단위(1분 40초 + 50초)는 묶으면 2분 30초(150초)다', async ({ page }) => {
  await openTime(page, TIME_SEC);
  expect(await readTime(page)).toMatchObject({ big: 1, small: 90 });
  await expect(page.getByText('초 칸', { exact: true })).toBeVisible();
  await button(page, '1분으로 묶기').click();
  await pollTime(page, (o) => o.big === 2 && o.small === 30 && o.normalized === true);
});

test('time-calc: 모드 상자에 time-calc가 있고, 단추가 모두 48px 이상이다', async ({ page }) => {
  await openTime(page, TIME_SUB);
  const buttons = page.getByTestId('clock-controls').getByRole('button');
  const count = await buttons.count();
  // 묶기·풀기·빼기·처음으로
  expect(count).toBe(4);
  for (let i = 0; i < count; i += 1) {
    await buttons.nth(i).scrollIntoViewIfNeeded();
    await expectMin(buttons.nth(i), 48, `단추 ${i}`);
  }
});

test('T211 time-calc 조작 칸 첫 단추 줄이 첫 화면에 보인다', async ({ page }) => {
  await openTime(page, TIME_ADD);
  await expectControlsAboveFold(page, 'time-calc add', 0, 'clock-controls', 'page');
  await openTime(page, TIME_SUB);
  await expectControlsAboveFold(page, 'time-calc sub', 0, 'clock-controls', 'page');
});

test('힌트 ② sixty-overflow: 처음 60칸 둘레에 큰 블록 크기의 점선 상자, "60분 = 1시간", 시계 아이콘', async ({
  page,
}) => {
  await openTime(page, TIME_ADD, 'stage=fit&overlay=sixty-overflow');
  await toggleOverlayTime(page);
  const layer = await expectAlignedTime(page, 'sixty-overflow');
  await expect(layer.locator('[data-part="label"]')).toHaveText('60분 = 1시간');
  await expect(layer.locator('[data-part="clock"]')).toHaveCount(1);
  const box = await layer.locator('[data-part="box"]').boundingBox();
  const group = await timeCanvas(page).locator('[data-part="rod-group"]').first().boundingBox();
  const big = await timeCanvas(page).locator('[data-part="big-block"] rect').first().boundingBox();
  if (!box || !group || !big) throw new Error('상자를 찾지 못했습니다.');
  // 상자 중심이 처음 60칸(막대 6개) 묶음의 중심과 같다.
  expect(Math.abs(box.x + box.width / 2 - (group.x + group.width / 2))).toBeLessThanOrEqual(1.5);
  expect(Math.abs(box.y + box.height / 2 - (group.y + group.height / 2))).toBeLessThanOrEqual(1.5);
  // 큰 블록과 같은 크기(바깥 여백 6px씩만 더 크다).
  const scale = big.width / 96;
  expect(Math.abs(box.width - big.width - 12 * scale)).toBeLessThanOrEqual(2);
  expect(Math.abs(box.height - big.height - 12 * scale)).toBeLessThanOrEqual(2);
  // 묶으면 사라진다.
  await button(page, '1시간으로 묶기').click();
  await pollTime(page, (o) => o.normalized === true);
  await expect(page.locator('[data-overlay="sixty-overflow"] svg')).toHaveCount(0);
});

test('힌트 ② sixty-overflow: 분·초 단위는 "60초 = 1분"', async ({ page }) => {
  await openTime(page, TIME_SEC, 'stage=fit&overlay=sixty-overflow');
  await toggleOverlayTime(page);
  const layer = await expectAlignedTime(page, 'sixty-overflow');
  await expect(layer.locator('[data-part="label"]')).toHaveText('60초 = 1분');
});

/** 오버레이 svg 상자가 timecalc-canvas 상자와 1px 이내로 같다. */
async function expectAlignedTime(page: Page, overlay: string): Promise<Locator> {
  const layer = page.locator(`[data-overlay="${overlay}"]`);
  await expect(layer).toBeVisible();
  await expect
    .poll(async () => {
      const a = await timeCanvas(page).boundingBox();
      const b = await layer.locator('svg').first().boundingBox();
      if (!a || !b) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(a.x - b.x),
        Math.abs(a.y - b.y),
        Math.abs(a.width - b.width),
        Math.abs(a.height - b.height),
      );
    })
    .toBeLessThanOrEqual(1);
  return layer;
}

async function toggleOverlayTime(page: Page): Promise<void> {
  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
}

test('화면 기준: time-calc 덧셈 첫 화면(1시간 75분)', async ({ page }) => {
  await openTime(page, TIME_ADD);
  await page.getByRole('heading', { name: '시계·시간' }).focus();
  await expectPageSnapshot(page, 'clock-timecalc.png');
});

test('화면 기준: time-calc 뺄셈에서 1시간을 풀어 분 칸 70개가 된 화면', async ({ page }) => {
  await openTime(page, TIME_SUB);
  await button(page, '60분으로 풀기').click();
  await pollTime(page, (o) => o.unbundles === 1);
  await page.getByRole('heading', { name: '시계·시간' }).focus();
  await expectPageSnapshot(page, 'clock-timecalc-sub.png');
});
