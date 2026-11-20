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
  { label: 'E06', heading: '양팔저울', modes: ['equation', 'proportion', 'compare'] },
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
  { label: 'E12', heading: '3D 입체', modes: ['cubes'] },
  { label: 'E13', heading: '측정 실험실', modes: ['compare-direct', 'length', 'estimate'] },
  { label: 'E14', heading: '시계·시간', modes: ['clock', 'duration', 'calendar'] },
  { label: 'E15', heading: '규칙·패턴', modes: ['sequence', 'calc-pattern', 'growth', 'gears'] },
  { label: 'E16', heading: '대응 관계', modes: ['black-box', 'table', 'covary', 'rule-shooter'] },
  {
    label: 'E17',
    heading: '분류기',
    modes: ['venn', 'secret-rule', 'hierarchy'],
  },
  {
    label: 'E19',
    heading: '평균·가능성 실험실',
    modes: ['leveling', 'seesaw', 'outlier', 'words', 'spinner', 'simulate'],
  },
  {
    label: 'E20',
    heading: '비·비율 실험실',
    modes: ['mix', 'resize', 'rate', 'percent', 'bar-model'],
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
        const box = await expectSandboxCanvasVisible(page, {
          buttons: testInfo.project.name !== 'ipad',
          // T199: E06·E13·E14·E19·E20은 칸이 낮으면 조작 칸을 누르지 않고 바깥 상자가 세로로 스크롤한다.
          outerScrollY: ['E06', 'E13', 'E14', 'E19', 'E20'].includes(engine.label),
        });
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
