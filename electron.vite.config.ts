import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin(),
      {
        name: 'copy-resources',
        closeBundle() {
          // Copy resources directory to build output
          const resourcesDir = resolve(__dirname, 'out/resources')
          if (!existsSync(resourcesDir)) {
            mkdirSync(resourcesDir, { recursive: true })
          }

          // Copy icon file
          const srcIcon = resolve(__dirname, 'resources/doggo.png')
          const destIcon = resolve(__dirname, 'out/resources/doggo.png')
          if (existsSync(srcIcon)) {
            copyFileSync(srcIcon, destIcon)
          }
        }
      }
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        '@resources': resolve(__dirname, 'resources')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    plugins: [react()]
  }
})
