import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

const buildSha = process.env.FROSTTY_BUILD_SHA ?? process.env.GITHUB_SHA?.slice(0, 7) ?? 'local'
const buildDate = process.env.FROSTTY_BUILD_DATE ?? new Date().toISOString()

export default defineConfig({
  main: {
    define: {
      __FROSTTY_BUILD_SHA__: JSON.stringify(buildSha),
      __FROSTTY_BUILD_DATE__: JSON.stringify(buildDate)
    },
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
          const srcIcon = resolve(__dirname, 'resources/logo.png')
          const destIcon = resolve(__dirname, 'out/resources/logo.png')
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
    define: {
      __FROSTTY_BUILD_SHA__: JSON.stringify(buildSha),
      __FROSTTY_BUILD_DATE__: JSON.stringify(buildDate)
    },
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
    define: {
      __FROSTTY_BUILD_SHA__: JSON.stringify(buildSha),
      __FROSTTY_BUILD_DATE__: JSON.stringify(buildDate)
    },
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
