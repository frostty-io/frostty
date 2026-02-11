import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/renderer/src/__tests__/setup.ts'],
    include: ['src/renderer/src/**/*.{test,spec}.{ts,tsx}'],
    css: true
  }
})
