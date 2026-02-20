import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

const buildSha = process.env.FROSTTY_BUILD_SHA ?? process.env.GITHUB_SHA?.slice(0, 7) ?? 'local'
const buildDate = process.env.FROSTTY_BUILD_DATE ?? new Date().toISOString()
const releaseChannel = process.env.FROSTTY_RELEASE_CHANNEL === 'canary' ? 'canary' : 'stable'

export default defineConfig({
  main: {
    define: {
      __FROSTTY_BUILD_SHA__: JSON.stringify(buildSha),
      __FROSTTY_BUILD_DATE__: JSON.stringify(buildDate),
      __FROSTTY_RELEASE_CHANNEL__: JSON.stringify(releaseChannel)
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

          const logoFiles = ['logo.png', 'logo_canary.png']
          for (const logoFile of logoFiles) {
            const srcPath = resolve(__dirname, `resources/${logoFile}`)
            const destPath = resolve(__dirname, `out/resources/${logoFile}`)
            if (existsSync(srcPath)) {
              copyFileSync(srcPath, destPath)
            }
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
      __FROSTTY_BUILD_DATE__: JSON.stringify(buildDate),
      __FROSTTY_RELEASE_CHANNEL__: JSON.stringify(releaseChannel)
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
      __FROSTTY_BUILD_DATE__: JSON.stringify(buildDate),
      __FROSTTY_RELEASE_CHANNEL__: JSON.stringify(releaseChannel)
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
