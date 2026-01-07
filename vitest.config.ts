import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom', // ← 提供 DOM API (document, canvas 等)
    globals: true,
    // 定义环境变量
    env: {
      VITE_BASE_URL: '/',
      VITE_SHADER_BASE: '/assets/shaders',
      VITE_TEXTURE_BASE: '/assets/textures'
    },
    browser: {
      enabled: true,
      provider: 'playwright', // ← 使用Playwright驱动
      name: 'chrome'
    }
  },
  define: {}
})
