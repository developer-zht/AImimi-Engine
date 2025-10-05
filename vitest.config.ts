import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom', // ← 提供 DOM API (document, canvas 等)
    globals: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  // 定义环境变量
  define: {
    'import.meta.env.BASE_URL': JSON.stringify('/'),
    'import.meta.env.VITE_SHADER_BASE': JSON.stringify('/assets/shaders/'),
    'import.meta.env.VITE_TEXTURE_BASE': JSON.stringify('/assets/textures/')
  }
})
