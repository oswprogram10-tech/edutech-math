import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * E12 T135 세 투영 맞춤·찾은 개수 기록·보기 카드·views-twins 오버레이 E2E.
 */

interface ObservationRecord {
  readonly count?: number;
  readonly viewsMin?: number | null;
  readonly viewsMax?: number | null;
  readonly viewsMatch?: boolean;
  readonly matchedCounts?: readonly number[];
}

const SPEC_VIEWS = {
  top: [
    [1, 1, 1],
    [1, 1, 0],
    [1, 0, 0],
  ],
  front: [
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  side: [
    [0, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
  ],
};

async function openSandbox(
  page: Page,
  config: Record<string, unknown>,
  extraParams = '',
): Promise<{ canvas: Locator }> {
  const merged = { stage: 'isometric', ...config };
  const query = `?config=${encodeURIComponent(JSON.stringify(merged))}${extraParams}`;
  await page.goto(`/${query}#/sandbox/E12`);
  await expect(page.getByRole('heading', { name: '3D 입체' })).toBeVisible();
  const canvas = page.getByTestId('cubes-canvas');
  await expect(canvas).toBeVisible();
  return { canvas };
}

async function readObservation(page: Page): Promise<ObservationRecord> {
  const text = await page.getByTestId('observation').textContent();
  return JSON.parse(text ?? '{}') as ObservationRecord;
}

async function pollObservation(
  page: Page,
  check: (observation: ObservationRecord) => boolean,
): Promise<void> {
  await expect.poll(async () => check(await readObservation(page))).toBe(true);
}

test('키보드로 10개(최대)와 9개(최소) 해를 차례로 만들면 맞춤 표시와 기록이 뜬다', async ({
  page,
}) => {
  const { canvas } = await openSandbox(page, {
    grid: [3, 3],
    maxHeight: 3,
    attemptLog: true,
    referenceViews: SPEC_VIEWS,
  });

  await pollObservation(page, (obs) => obs.viewsMin === 9 && obs.viewsMax === 10);

  await canvas.focus();
  // (0,0)=1 -> (0,1)=2 -> (0,2)=2 -> (1,2)=1 -> (1,1)=1 -> (2,2)=3 순서로 쌓으면
  // 중간에 9개 해를 거치지 않고 바로 10개(최대) 해에 닿는다.
  const keys = [
    'Enter',
    'ArrowUp',
    'Enter',
    'Enter',
    'ArrowUp',
    'Enter',
    'Enter',
    'ArrowRight',
    'Enter',
    'ArrowDown',
    'Enter',
    'ArrowUp',
    'ArrowRight',
    'Enter',
    'Enter',
    'Enter',
  ];
  for (const key of keys) {
    await page.keyboard.press(key);
  }

  await pollObservation(
    page,
    (obs) =>
      obs.count === 10 && obs.viewsMatch === true && JSON.stringify(obs.matchedCounts) === '[10]',
  );

  await expect(page.getByTestId('cubes-stage')).toHaveAttribute('data-views-match', 'true');
  await expect(page.getByTestId('cubes-status')).toContainText('세 모양이 모두 같아요');
  const attempt10 = page.locator('[data-testid="cubes-attempts"] [data-attempt="10"]');
  await expect(attempt10).toContainText('10개');
  await expect(attempt10).toContainText('★ 가장 많아요');

  // (2,2) -> (0,2)로 돌아가 한 개 빼서 9개(최소) 만들기
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Backspace');
  await pollObservation(
    page,
    (obs) =>
      obs.count === 9 && obs.viewsMatch === true && JSON.stringify(obs.matchedCounts) === '[9,10]',
  );

  const attempt9 = page.locator('[data-testid="cubes-attempts"] [data-attempt="9"]');
  await expect(attempt9).toContainText('9개');
  await expect(attempt9).toContainText('★ 가장 적어요');
  await expect(attempt10).toContainText('★ 가장 많아요');
});

test('크롬북 두 칸 폭(900×768)에서 보기 카드 4장이 첫 화면에 모두 들어온다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '크롬북 첫 화면 카드 배치 검증');

  // ActivityRunner 두 칸 배치(응답 칸 제외 엔진 영역 폭)를 재현하기 위해 폭을 900px로 줄여 잰다.
  await page.setViewportSize({ width: 900, height: 768 });
  const config = {
    stage: 'isometric',
    grid: [3, 3],
    maxHeight: 3,
    editable: false,
    rotationLocked: true,
    translucentToggle: false,
    views: [],
    initial: [
      { at: [0, 0, 0] },
      { at: [0, 1, 0] },
      { at: [0, 1, 1] },
      { at: [1, 1, 0] },
      { at: [0, 2, 0] },
      { at: [1, 2, 0] },
      { at: [2, 2, 0] },
      { at: [2, 2, 1] },
      { at: [2, 2, 2] },
    ],
    referenceCards: [
      {
        id: 'ga',
        kind: 'top',
        label: '가',
        cells: SPEC_VIEWS.top,
      },
      {
        id: 'na',
        kind: 'front',
        label: '나',
        cells: SPEC_VIEWS.front,
      },
      {
        id: 'da',
        kind: 'layers',
        label: '다',
        layers: [
          [
            [1, 1, 1],
            [1, 1, 0],
            [1, 0, 0],
          ],
          [
            [1, 0, 1],
            [1, 0, 0],
            [0, 0, 0],
          ],
        ],
      },
      {
        id: 'ra',
        kind: 'numbers',
        label: '라',
        cells: [
          [2, 1, 3],
          [2, 1, 0],
          [1, 0, 0],
        ],
      },
    ],
  };

  const query = `?stage=fit&config=${encodeURIComponent(JSON.stringify(config))}`;
  await page.goto(`/${query}#/sandbox/E12`);
  await expect(page.getByTestId('cubes-cards')).toBeVisible();
  await expect(page.locator('[data-testid^="cubes-card-"]')).toHaveCount(4);
  await expect(page.locator('[data-testid="cubes-cards"] button')).toHaveCount(0);

  const metrics = await page.evaluate(() => {
    const wrap = document.querySelector('div[data-cpa]') as HTMLElement | null;
    const host = wrap?.parentElement ?? null;
    const sideStack = wrap?.querySelector('[class*="sideStack"]') as HTMLElement | null;
    const cardsPanel = wrap?.querySelector('[data-testid="cubes-cards"]') as HTMLElement | null;
    const hostRect = host?.getBoundingClientRect();
    const cards = Array.from(document.querySelectorAll('[data-testid^="cubes-card-"]'));
    const maxCardBottom = Math.max(...cards.map((el) => el.getBoundingClientRect().bottom));
    return {
      hostHeight: Math.round(hostRect?.height ?? 0),
      hostBottom: Math.round(hostRect?.bottom ?? 0),
      wrapOverflowY: Math.round((host?.scrollHeight ?? 0) - (host?.clientHeight ?? 0)),
      sideStackOverflowY: Math.round(
        (sideStack?.scrollHeight ?? 0) - (sideStack?.clientHeight ?? 0),
      ),
      sideStackOverflowX: Math.round((sideStack?.scrollWidth ?? 0) - (sideStack?.clientWidth ?? 0)),
      cardsBottom: Math.round(cardsPanel?.getBoundingClientRect().bottom ?? 0),
      maxCardBottom: Math.round(maxCardBottom),
    };
  });

  testInfo.annotations.push({
    type: 'cards-first-screen',
    description: JSON.stringify(metrics),
  });
  expect(metrics.wrapOverflowY).toBeLessThanOrEqual(1);
  expect(metrics.sideStackOverflowX).toBeLessThanOrEqual(2);
  expect(metrics.sideStackOverflowY).toBeLessThanOrEqual(1);
  expect(metrics.maxCardBottom).toBeLessThanOrEqual(metrics.hostBottom + 1);
});

test('크롬북에서 힌트 겹쳐 보기 views-twins svg가 1px 안으로 정렬되고 숫자가 없다', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromebook', '크롬북 오버레이 정렬 테스트');
  const { canvas } = await openSandbox(
    page,
    {
      grid: [3, 3],
      maxHeight: 3,
      referenceViews: SPEC_VIEWS,
    },
    '&overlay=views-twins',
  );

  await page.getByRole('button', { name: '힌트 겹쳐 보기' }).click();
  const overlay = page.locator('[data-overlay="views-twins"]');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('svg')).toHaveCount(1);
  const text = (await overlay.textContent()) ?? '';
  expect(text).toContain('같은 세 모양');
  expect(/\d/.test(text)).toBe(false);

  await expect
    .poll(
      async () => {
        const canvasBox = await canvas.boundingBox();
        const overlayBox = await overlay.locator('svg').boundingBox();
        if (!canvasBox || !overlayBox) return Number.POSITIVE_INFINITY;
        return Math.max(
          Math.abs(overlayBox.x - canvasBox.x),
          Math.abs(overlayBox.y - canvasBox.y),
          Math.abs(overlayBox.width - canvasBox.width),
          Math.abs(overlayBox.height - canvasBox.height),
        );
      },
      { message: 'views-twins 오버레이가 본 캔버스와 1px 넘게 어긋납니다.' },
    )
    .toBeLessThanOrEqual(1);
});
