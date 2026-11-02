/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages는 https://<user>.github.io/<repo>/ 아래에서 서비스된다.
// CI가 BASE_PATH=/<repo>/ 를 넘긴다. 로컬 개발은 '/'.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  // E2E가 저장소 모듈을 직접 import한다. 첫 요청 때 의존성 최적화가 일어나
  // 페이지가 다시 로드되면 테스트가 흔들리므로 미리 묶어 둔다.
  optimizeDeps: {
    include: ['dexie', 'lz-string', 'qrcode-generator'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'MathExplorer',
        short_name: 'MathExplorer',
        description: '초등 수학 디지털 교구',
        lang: 'ko',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2f6fde',
        // 자리표시 아이콘. 정식 아이콘(PNG 192/512, maskable)은 나중에 교체한다.
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'eslint/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/core/math/**/*.ts'],
      exclude: ['src/core/math/**/__tests__/**'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
});
