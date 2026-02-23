import { app, BrowserWindow, dialog, type MessageBoxOptions, type MessageBoxReturnValue } from 'electron'
import electronUpdater from 'electron-updater'
import { getUpdaterChannel, shouldAllowPrerelease } from '../../shared/releaseChannel'

const { autoUpdater } = electronUpdater

const STARTUP_UPDATE_CHECK_DELAY_MS = 15_000
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

export interface AppUpdaterLike {
  channel?: string | null
  allowPrerelease: boolean
  autoDownload: boolean
  checkForUpdates: () => Promise<unknown>
  quitAndInstall: () => void
  on: (event: string, listener: (...args: unknown[]) => void) => unknown
}

interface UpdateServiceDependencies {
  updater: AppUpdaterLike
  isPackaged: () => boolean
  platform: NodeJS.Platform
  showMessageBox: (options: MessageBoxOptions) => Promise<MessageBoxReturnValue>
  logger: Pick<Console, 'info' | 'warn' | 'error'>
  setTimeoutFn: typeof setTimeout
  setIntervalFn: typeof setInterval
}

const defaultDependencies: UpdateServiceDependencies = {
  updater: autoUpdater as unknown as AppUpdaterLike,
  isPackaged: () => app.isPackaged,
  platform: process.platform,
  showMessageBox: (options) => {
    const win = BrowserWindow.getFocusedWindow() ?? undefined
    return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)
  },
  logger: console,
  setTimeoutFn: setTimeout,
  setIntervalFn: setInterval
}

let updatesEnabled = false
let initialized = false
let listenersAttached = false
let updateCheckTimer: ReturnType<typeof setInterval> | null = null
let manualCheckRequested = false
let checkInFlight = false

function getUpdateChannelConfiguration(releaseChannel: string): { updaterChannel: string; allowPrerelease: boolean } {
  return {
    updaterChannel: getUpdaterChannel(releaseChannel),
    allowPrerelease: shouldAllowPrerelease(releaseChannel)
  }
}

function getUpdatesDisabledMessage(): MessageBoxOptions {
  return {
    type: 'info',
    buttons: ['OK'],
    defaultId: 0,
    message: 'Updates are unavailable in this build.',
    detail: 'Automatic updates currently run only on packaged macOS builds.'
  }
}

function getNoUpdatesFoundMessage(): MessageBoxOptions {
  return {
    type: 'info',
    buttons: ['OK'],
    defaultId: 0,
    message: 'You are up to date.',
    detail: 'No updates are available at this time.'
  }
}

function getUpdateAvailableMessage(): MessageBoxOptions {
  return {
    type: 'info',
    buttons: ['OK'],
    defaultId: 0,
    message: 'Update found.',
    detail: 'The new version is downloading in the background.'
  }
}

function getUpdateCheckErrorMessage(error: unknown): MessageBoxOptions {
  const detail = error instanceof Error ? error.message : 'Unknown updater error.'
  return {
    type: 'error',
    buttons: ['OK'],
    defaultId: 0,
    message: 'Unable to check for updates.',
    detail
  }
}

export function shouldEnableAutoUpdates(isPackaged: boolean, platform: NodeJS.Platform): boolean {
  return isPackaged && platform === 'darwin'
}

export function configureUpdaterForChannel(updater: AppUpdaterLike, releaseChannel: string): void {
  const config = getUpdateChannelConfiguration(releaseChannel)
  updater.channel = config.updaterChannel
  updater.allowPrerelease = config.allowPrerelease
  updater.autoDownload = true
}

export async function promptAndInstallUpdate(
  showMessageBox: (options: MessageBoxOptions) => Promise<MessageBoxReturnValue>,
  quitAndInstall: () => void
): Promise<boolean> {
  const result = await showMessageBox({
    type: 'info',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    message: 'An update is ready to install.',
    detail: 'Restart Frostty to apply the update now.'
  })

  if (result.response === 0) {
    quitAndInstall()
    return true
  }

  return false
}

function attachUpdaterListeners(deps: UpdateServiceDependencies): void {
  if (listenersAttached) return
  listenersAttached = true

  deps.updater.on('update-available', () => {
    if (!manualCheckRequested) return
    manualCheckRequested = false
    void deps.showMessageBox(getUpdateAvailableMessage())
  })

  deps.updater.on('update-not-available', () => {
    if (!manualCheckRequested) return
    manualCheckRequested = false
    void deps.showMessageBox(getNoUpdatesFoundMessage())
  })

  deps.updater.on('error', (error: unknown) => {
    deps.logger.error('[updater] error:', error)
    if (!manualCheckRequested) return
    manualCheckRequested = false
    void deps.showMessageBox(getUpdateCheckErrorMessage(error))
  })

  deps.updater.on('update-downloaded', () => {
    void promptAndInstallUpdate(deps.showMessageBox, () => deps.updater.quitAndInstall())
  })
}

async function checkForUpdates(deps: UpdateServiceDependencies, manual: boolean): Promise<void> {
  if (!updatesEnabled) {
    if (manual) {
      await deps.showMessageBox(getUpdatesDisabledMessage())
    }
    return
  }

  if (checkInFlight) {
    deps.logger.info('[updater] update check already in progress, skipping duplicate request')
    return
  }

  checkInFlight = true
  manualCheckRequested = manual
  try {
    await deps.updater.checkForUpdates()
  } catch (error) {
    deps.logger.error('[updater] check failed:', error)
    if (manual && manualCheckRequested) {
      manualCheckRequested = false
      await deps.showMessageBox(getUpdateCheckErrorMessage(error))
    }
  } finally {
    checkInFlight = false
  }
}

export function initializeAutoUpdates(
  releaseChannel: string = __FROSTTY_RELEASE_CHANNEL__,
  dependencies: Partial<UpdateServiceDependencies> = {}
): void {
  if (initialized) return
  initialized = true

  const deps: UpdateServiceDependencies = { ...defaultDependencies, ...dependencies }
  updatesEnabled = shouldEnableAutoUpdates(deps.isPackaged(), deps.platform)
  if (!updatesEnabled) {
    deps.logger.info('[updater] auto-updates disabled for this environment')
    return
  }

  configureUpdaterForChannel(deps.updater, releaseChannel)
  attachUpdaterListeners(deps)

  deps.logger.info(
    `[updater] enabled: channel=${deps.updater.channel ?? 'unknown'} allowPrerelease=${deps.updater.allowPrerelease}`
  )

  deps.setTimeoutFn(() => {
    void checkForUpdates(deps, false)
  }, STARTUP_UPDATE_CHECK_DELAY_MS)

  updateCheckTimer = deps.setIntervalFn(() => {
    void checkForUpdates(deps, false)
  }, UPDATE_CHECK_INTERVAL_MS)
}

export async function checkForUpdatesManual(
  dependencies: Partial<UpdateServiceDependencies> = {}
): Promise<void> {
  const deps: UpdateServiceDependencies = { ...defaultDependencies, ...dependencies }
  await checkForUpdates(deps, true)
}

export function __resetUpdateServiceForTests(): void {
  updatesEnabled = false
  initialized = false
  listenersAttached = false
  manualCheckRequested = false
  checkInFlight = false
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer)
    updateCheckTimer = null
  }
}
