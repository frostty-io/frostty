import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import * as os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import {
  IPC_CHANNELS,
  PtySpawnRequest,
  PtyInputPayload,
  PtyResizePayload,
  PtyKillPayload,
  PtyGetCwdPayload,
  AIGenerateCommandRequest,
  AppSettings
} from '../shared/ipc'
import { generateCommand } from './aiService'
import { spawnPty, writePty, resizePty, killPty, killAllPtys, getCwd, getAvailableShells, preloadShellEnvironment } from './ptyManager'
import { loadSession } from './sessionManager'
import {
  loadSettingsFromDisk,
  saveSettingsToDisk,
  loadRecentsFromDisk,
  saveRecentCommandToDisk,
  saveRecentProjectToDisk
} from './storeManager'
import { registerGitHandlers } from './gitManager'
import { registerSystemHandlers } from './systemManager'
import {
  registerWindowHandlers,
  initWindows,
  createWindow,
  startQuitFlow
} from './windowManager'
import { setupApplicationMenu } from './menuManager'
import { initializeAutoUpdates } from './services/updateService'
import { getRuntimeLogoFilename } from '../shared/releaseChannel'

const execAsync = promisify(exec)
const BUILD_SHA = __FROSTTY_BUILD_SHA__
const BUILD_DATE = __FROSTTY_BUILD_DATE__
const BUILD_INFO = `Build ${BUILD_SHA} (${BUILD_DATE})`
const RELEASE_CHANNEL = __FROSTTY_RELEASE_CHANNEL__
const RUNTIME_LOGO = getRuntimeLogoFilename(RELEASE_CHANNEL)

// ── IPC Handlers (remaining) ─────────────────────────────────────────────────

function setupIpcHandlers(): void {
  // Register handlers from extracted modules
  registerGitHandlers()
  registerSystemHandlers()
  registerWindowHandlers()

  // PTY handlers
  ipcMain.handle(IPC_CHANNELS.PTY_SPAWN, (event, payload: PtySpawnRequest) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { pid: -1, shell: '', cwd: '' }
    return spawnPty(payload.tabId, win, payload.cwd, payload.shell)
  })

  ipcMain.on(IPC_CHANNELS.PTY_INPUT, (_event, payload: PtyInputPayload) => {
    writePty(payload.tabId, payload.data)
  })

  ipcMain.on(IPC_CHANNELS.PTY_RESIZE, (_event, payload: PtyResizePayload) => {
    resizePty(payload.tabId, payload.cols, payload.rows)
  })

  ipcMain.on(IPC_CHANNELS.PTY_KILL, (_event, payload: PtyKillPayload) => {
    killPty(payload.tabId)
  })

  ipcMain.handle(IPC_CHANNELS.PTY_GET_CWD, (_event, payload: PtyGetCwdPayload) => {
    return getCwd(payload.tabId)
  })

  // Directory picker
  ipcMain.handle(IPC_CHANNELS.SETTINGS_PICK_DIRECTORY, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: 'Select default home directory',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // Available shells
  ipcMain.handle(IPC_CHANNELS.GET_AVAILABLE_SHELLS, () => {
    return getAvailableShells()
  })

  // Editor handlers
  ipcMain.handle(IPC_CHANNELS.OPEN_IN_VSCODE, async (_event, cwd: string) => {
    const expandedCwd = cwd.replace(/^~/, os.homedir())
    if (process.platform === 'darwin') {
      await execAsync(`open -a "Visual Studio Code" "${expandedCwd}"`)
    } else {
      await execAsync(`code "${expandedCwd}"`)
    }
  })

  ipcMain.handle(IPC_CHANNELS.OPEN_IN_CURSOR, async (_event, cwd: string) => {
    const expandedCwd = cwd.replace(/^~/, os.homedir())
    if (process.platform === 'darwin') {
      await execAsync(`open -a "Cursor" "${expandedCwd}"`)
    } else {
      await execAsync(`cursor "${expandedCwd}"`)
    }
  })

  // AI handler
  ipcMain.handle(IPC_CHANNELS.AI_GENERATE_COMMAND, async (_event, request: AIGenerateCommandRequest) => {
    return generateCommand(request)
  })

  // Settings handlers
  ipcMain.handle(IPC_CHANNELS.SETTINGS_LOAD, () => {
    return loadSettingsFromDisk()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE, (_event, settings: AppSettings) => {
    return saveSettingsToDisk(settings)
  })

  // Recents handlers
  ipcMain.handle(IPC_CHANNELS.RECENTS_LOAD, () => {
    return loadRecentsFromDisk()
  })

  ipcMain.handle(IPC_CHANNELS.RECENTS_SAVE_COMMAND, (_event, commandId: string) => {
    return saveRecentCommandToDisk(commandId)
  })

  ipcMain.handle(IPC_CHANNELS.RECENTS_SAVE_PROJECT, (_event, projectPath: string) => {
    return saveRecentProjectToDisk(projectPath)
  })
}

// ── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  app.setAboutPanelOptions({
    applicationName: app.getName(),
    applicationVersion: app.getVersion(),
    copyright: '© Frostty Contributors',
    credits: `A modern GPU accelerated terminal emulator.\n${BUILD_INFO}`,
    iconPath: join(__dirname, `../../resources/${RUNTIME_LOGO}`)
  })

  setupIpcHandlers()
  setupApplicationMenu()
  initializeAutoUpdates(RELEASE_CHANNEL)
  preloadShellEnvironment()

  // Restore session or create a fresh window
  const session = await loadSession()
  initWindows(session)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  killAllPtys()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', (event) => {
  const quitPromise = startQuitFlow()
  if (quitPromise) {
    event.preventDefault()
    quitPromise.then(() => app.quit())
  }
})
