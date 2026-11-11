import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { expectChromeBookCanvasSize, expectSandboxCanvasVisible } from './panel-layout';

/**
 * T122 E09·E10·E11·E17 판 높이 맞춤 E2E.
 *
 * ㉕ 검수에서 네 엔진 판이 실행기 슬롯 높이에 맞춰 줄어들지 않아 크롬북·아이패드·
 * 전자칠판에서 교구가 첫 화면 밖으로 나가거나 조작 패널 밑에 깔렸다.
 * 엔진마다 모든 모드를 세 뷰포트에서 열어
 * (a) 캔버스가 판 viewport 안에 판 안 스크롤 없이 들어오고,
 * (b) 판 안의 단추·안내 글·패널과 겹치지 않는지 본다.
 * 크롬북에서는 캔버스 짧은 변이 200px 이상인지도 본다.
 */

test.describe.configure({ timeout: 120_000 });

interface EngineCase {
  readonly label: string;
  readonly heading: string;
  readonly modes: readonly string[];
}

const ENGINES: readonly EngineCase[] = [
  {
    label: 'E09',
    heading: '기하판',
    modes: ['geoboard', 'construct', 'classify', 'drag-test', 'circle', 'angle', 'diagonal'],
  },
  {
    label: 'E10',
    heading: '도형 이동',
    modes: [
      'slide-flip-turn',
      'predict',
      'tessellation',
      'congruence',
      'line-symmetry',
      'point-symmetry',
    ],
  },
  {
    label: 'E11',
    heading: '자르고 붙이기',
    modes: ['slice', 'formula-derive', 'angle-gather', 'tangram', 'circle-sectors'],
  },
  {
    label: 'E17',
    heading: '분류기',
    modes: ['venn', 'secret-rule', 'hierarchy'],
  },
];

async function openMode(page: Page, engine: string, heading: string, mode: string): Promise<void> {
  await page.goto(`/?stage=fit#/sandbox/${engine}`);
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await page.getByLabel('모드').selectOption(mode);
  await expect(page.locator('[data-testid="observation"]')).toContainText(`"mode":"${mode}"`);
}

for (const engine of ENGINES) {
  test.describe(`${engine.label} 모든 모드`, () => {
    for (const mode of engine.modes) {
      test(`${mode} — 캔버스가 판 안에 다 보이고 패널과 겹치지 않는다`, async ({
        page,
      }, testInfo) => {
        await openMode(page, engine.label, engine.heading, mode);
        const box = await expectSandboxCanvasVisible(page);
        console.log('T122', {
          project: testInfo.project.name,
          engine: engine.label,
          mode,
          width: Math.round(box.width),
          height: Math.round(box.height),
        });
        if (testInfo.project.name === 'chromebook') {
          expectChromeBookCanvasSize([box]);
        }
      });
    }
  });
}
