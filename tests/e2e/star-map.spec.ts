import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * T008 S2 별자리 E2E.
 * 숙달 밝기 3단계, 부스터 반짝임, 별 → 활동 목록 → 활동 화면,
 * 확대·이동, 교사 단원 끄기를 세 뷰포트에서 확인한다.
 */

test.describe.configure({ timeout: 120_000 });

async function enterAsStudent(page: Page, number: string) {
  await page.goto('/');
  await page.getByRole('button', { name: `${number}번`, exact: true }).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page).toHaveURL(/#\/map$/);
  await expect(page.getByTestId('map-canvas')).toBeVisible();
  await expect(page.getByRole('heading', { name: '나의 수학 별자리' })).toBeVisible();
}

interface SeedOptions {
  readonly learner: string;
  readonly mastery: ReadonlyArray<{
    readonly conceptId: string;
    readonly p: number;
    readonly passedTasks: readonly string[];
  }>;
  readonly events: ReadonlyArray<{
    readonly unit: string;
    readonly task: string;
    readonly engine: string;
    readonly verb: string;
    readonly data: Readonly<Record<string, unknown>>;
  }>;
}

async function seedLearner(page: Page, options: SeedOptions) {
  await page.evaluate(async (seed) => {
    const modulePath = '/src/core/storage/index.ts';
    const storageModule = (await import(/* @vite-ignore */ modulePath)) as {
      openStorage: (options?: { requestPersist?: boolean }) => Promise<{
        putMasteryRecords: (records: unknown[]) => Promise<void>;
        putEvents: (events: unknown[]) => Promise<void>;
        close: () => Promise<void>;
      }>;
    };
    const now = Date.now();
    const storage = await storageModule.openStorage({ requestPersist: false });
    await storage.putMasteryRecords(
      seed.mastery.map((record, index) => ({
        id: `${seed.learner}:${record.conceptId}`,
        learner: seed.learner,
        conceptId: record.conceptId,
        p: record.p,
        passedTasks: [...record.passedTasks],
        updatedAt: now + index,
      })),
    );
    await storage.putEvents(
      seed.events.map((event, index) => ({
        ...event,
        id: `seed-${now}-${index}`,
        learner: seed.learner,
        t: now + index,
      })),
    );
    await storage.close();
  }, options);
}

test('숙달 기록으로 별 밝기 3단계와 부스터 반짝임을 보여 주고 학년·단원 ID를 숨긴다', async ({
  page,
}) => {
  await enterAsStudent(page, '7');
  await seedLearner(page, {
    learner: '7',
    mastery: [
      {
        conceptId: 'g3s1u6.equal-parts',
        p: 0.9,
        passedTasks: ['g3s1u6.A1.T1', 'g3s1u6.A1.T2'],
      },
      {
        conceptId: 'g3s1u6.part-of-whole',
        p: 0.5,
        passedTasks: ['g3s1u6.A1.T4'],
      },
    ],
    events: [
      {
        unit: 'g3s1u6',
        task: 'g3s1u6.A1.T4',
        engine: 'E05',
        verb: 'backtracked',
        data: {
          from: 'g3s1u6.part-of-whole',
          to: 'g3s1u6.unit-fraction',
          depth: 1,
          outcome: 'passed',
        },
      },
    ],
  });

  await page.reload();
  await expect(page.getByTestId('map-canvas')).toBeVisible();

  // 밝기 3단계: 숙달 1개, 연습 중 1개, 나머지는 아직.
  await expect(page.locator('[data-brightness="mastered"]')).toHaveCount(1);
  await expect(page.locator('[data-brightness="practicing"]')).toHaveCount(1);
  expect(await page.locator('[data-brightness="missing"]').count()).toBeGreaterThan(0);
  await expect(page.getByTestId('legend-missing')).toBeVisible();
  await expect(page.getByTestId('legend-practicing')).toBeVisible();
  await expect(page.getByTestId('legend-mastered')).toBeVisible();

  // 부스터로 다시 해 낸 개념에는 반짝임이 붙는다.
  await expect(page.locator('[data-sparkle="true"]')).toHaveCount(1);

  // 학생 화면에는 학년 표시와 단원 ID가 없다.
  const html = await page.locator('body').innerHTML();
  expect(html).not.toMatch(/g\d s\d u\d/i);
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/\d\s*학년/);
});

test('별을 누르면 활동 목록이 나오고 활동 화면으로 간다', async ({ page }) => {
  await enterAsStudent(page, '7');

  const star = page.getByRole('button', { name: '똑같이 나누기(등분), 아직' });
  await expect(star).toHaveCount(1);
  await star.click();

  await expect(page.getByTestId('star-detail')).toBeVisible();
  await expect(page.getByTestId('star-detail')).toContainText('똑같이 나누기(등분)');
  await expect(page.getByTestId('star-detail')).toContainText('등분 레이저 커터');

  // 활동이 하나뿐이어도 바로 가지 않고 목록을 보여 준 뒤 누르게 한다.
  await page.getByRole('button', { name: /등분 레이저 커터/ }).click();
  await expect(page).toHaveURL(/#\/activity\/g3s1u6\.A1$/);
  await expect(page.getByRole('heading', { name: '등분 레이저 커터' })).toBeVisible();
});

test('확대·이동하고 처음 보기로 돌아온다', async ({ page }) => {
  await enterAsStudent(page, '7');

  const canvas = page.getByTestId('map-canvas');
  const transform = page.getByTestId('map-transform');
  // 처음 보기는 켜진 단원 별이 화면 가운데 크게 보이도록 맞춘 배율이다.
  await expect(page.getByTestId('map-zoom')).toHaveText('400%');
  const initialTransform = await transform.getAttribute('transform');
  expect(initialTransform).toContain('scale(4)');

  await page.getByRole('button', { name: '축소' }).click();
  await expect(page.getByTestId('map-zoom')).toHaveText('375%');
  await expect.poll(async () => transform.getAttribute('transform')).toContain('scale(3.75)');

  // 키보드 + 로 다시 확대한다.
  await canvas.focus();
  await page.keyboard.press('+');
  await expect(page.getByTestId('map-zoom')).toHaveText('400%');
  await page.keyboard.press('0');
  await expect.poll(async () => transform.getAttribute('transform')).toBe(initialTransform);

  // 한 손가락 끌기로 이동한다.
  const box = await canvas.boundingBox();
  if (!box) throw new Error('별자리 영역을 찾지 못했습니다.');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 50, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => transform.getAttribute('transform')).not.toBe(initialTransform);

  await page.getByRole('button', { name: '처음 보기' }).click();
  await expect(page.getByTestId('map-zoom')).toHaveText('400%');
  await expect.poll(async () => transform.getAttribute('transform')).toBe(initialTransform);
});

test('크롬북 첫 화면에 범례가 들어오고 처음 보기에 켜진 별이 지도 안에 있다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '크롬북 뷰포트 전용 확인');
  await enterAsStudent(page, '7');

  const canvas = page.getByTestId('map-canvas');
  await expect(canvas).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('legend-missing')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('legend-practicing')).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('legend-mastered')).toBeInViewport({ ratio: 1 });

  // 페이지 전체가 첫 화면 안에 들어와 스크롤이 없다.
  const scrollable = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  expect(scrollable).toBeLessThanOrEqual(1);

  // 처음 보기에서 켜진 g3s1u6 개념 별 5개가 지도 영역 안에 있다.
  const stars = canvas.locator('[data-enabled="true"]');
  await expect(stars).toHaveCount(5);
  const mapBox = await canvas.boundingBox();
  if (!mapBox) throw new Error('별자리 영역을 찾지 못했습니다.');
  for (let index = 0; index < 5; index += 1) {
    const starBox = await stars.nth(index).boundingBox();
    if (!starBox) throw new Error(`별 ${index + 1}의 자리를 찾지 못했습니다.`);
    expect(starBox.x).toBeGreaterThanOrEqual(mapBox.x);
    expect(starBox.y).toBeGreaterThanOrEqual(mapBox.y);
    expect(starBox.x + starBox.width).toBeLessThanOrEqual(mapBox.x + mapBox.width);
    expect(starBox.y + starBox.height).toBeLessThanOrEqual(mapBox.y + mapBox.height);
  }

  // 꺼진 단원 개념은 별 모양이 아니라 작은 점으로 그린다.
  const disabled = canvas.locator('[data-enabled="false"]').first();
  await expect(disabled.locator('circle')).toHaveCount(1);
  await expect(disabled.locator('path')).toHaveCount(0);
});

test('교사가 단원을 끄면 별이 흐려지고 누를 수 없다', async ({ page }) => {
  await enterAsStudent(page, '7');

  await page.goto('/#/teacher');
  await expect(page.getByRole('heading', { name: '선생님 PIN 만들기' })).toBeVisible();
  await page.getByLabel('새 PIN', { exact: true }).fill('1234');
  await page.getByLabel('새 PIN 확인', { exact: true }).fill('1234');
  await page.getByRole('button', { name: '만들기' }).click();

  await expect(page.getByRole('heading', { name: '단원 켜기·끄기' })).toBeVisible();
  const checkbox = page.getByRole('checkbox', { name: /분수와 소수/ });
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await expect(checkbox).not.toBeChecked();
  // 저장이 끝날 때까지 기다린다(버튼이 다시 활성화된다).
  await expect(checkbox).toBeEnabled();

  await page.goto('/#/map');
  const star = page.getByRole('button', { name: '똑같이 나누기(등분), 아직' });
  await expect(star).toHaveAttribute('data-enabled', 'false');
  await expect(star).toHaveAttribute('aria-disabled', 'true');
  await star.click({ force: true });
  await expect(page.getByTestId('star-detail')).toHaveCount(0);
});
