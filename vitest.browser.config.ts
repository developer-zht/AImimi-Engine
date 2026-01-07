// vitest.browser.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chrome',
      // 📌 根据环境自动切换
      headless: process.env.CI === 'true',
      providerOptions: {
        launch: {
          // CI环境不需要这些
          devtools: !process.env.CI,
          slowMo: process.env.DEBUG ? 500 : 0
        }
      }
    }
  }
})
