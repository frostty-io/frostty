import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MessageBoxOptions, MessageBoxReturnValue } from 'electron'

vi.mock('electron', () => ({
  app: { isPackaged: false },
  BrowserWindow: { getFocusedWindow: vi.fn(() => null) },
  dialog: { showMessageBox: vi.fn(async () => ({ response: 1, checkboxChecked: false })) }
}))

vi.mock('electron-updater', () => ({
  default: {
    channel: 'latest',
    allowPrerelease: false,
    autoDownload: true,
    checkForUpdates: vi.fn(async () => undefined),
    quitAndInstall: vi.fn(),
    on: vi.fn()
  },
  autoUpdater: {
    channel: 'latest',
    allowPrerelease: false,
    autoDownload: true,
    checkForUpdates: vi.fn(async () => undefined),
    quitAndInstall: vi.fn(),
    on: vi.fn()
  }
}))

import {
  __resetUpdateServiceForTests,
  shouldEnableAutoUpdates,
  configureUpdaterForChannel,
  promptAndInstallUpdate,
  initializeAutoUpdates,
  checkForUpdatesManual,
  type AppUpdaterLike
} from './updateService'

interface UpdaterMock extends AppUpdaterLike {
  emit: (event: string, ...args: unknown[]) => void
  onSpy: ReturnType<typeof vi.fn>
  checkForUpdatesSpy: ReturnType<typeof vi.fn>
  quitAndInstallSpy: ReturnType<typeof vi.fn>
}

function createMessageBoxResult(response: number): MessageBoxReturnValue {
  return { response, checkboxChecked: false }
}

function createShowMessageBoxMock(
  response: number
): {
  showMessageBox: (options: MessageBoxOptions) => Promise<MessageBoxReturnValue>
  spy: ReturnType<typeof vi.fn>
} {
  const spy = vi.fn(async (_options: MessageBoxOptions) => createMessageBoxResult(response))
  return {
    showMessageBox: spy,
    spy
  }
}

function createUpdaterMock(): UpdaterMock {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>()
  const checkForUpdatesSpy = vi.fn(async () => undefined)
  const quitAndInstallSpy = vi.fn(() => undefined)
  const onSpy = vi.fn((event: string, listener: (...args: unknown[]) => void) => {
    const eventListeners = listeners.get(event) ?? []
    eventListeners.push(listener)
    listeners.set(event, eventListeners)
  })

  return {
    channel: undefined,
    allowPrerelease: false,
    autoDownload: false,
    checkForUpdates: () => checkForUpdatesSpy(),
    quitAndInstall: () => {
      quitAndInstallSpy()
    },
    on: onSpy,
    emit: (event: string, ...args: unknown[]) => {
      for (const listener of listeners.get(event) ?? []) {
        listener(...args)
      }
    },
    onSpy,
    checkForUpdatesSpy,
    quitAndInstallSpy
  }
}

describe('updateService', () => {
  beforeEach(() => {
    __resetUpdateServiceForTests()
  })

  it('enables updater only for packaged macOS builds', () => {
    expect(shouldEnableAutoUpdates(true, 'darwin')).toBe(true)
    expect(shouldEnableAutoUpdates(false, 'darwin')).toBe(false)
    expect(shouldEnableAutoUpdates(true, 'win32')).toBe(false)
  })

  it('configures update channel and prerelease behavior', () => {
    const stableUpdater = createUpdaterMock()
    configureUpdaterForChannel(stableUpdater, 'stable')
    expect(stableUpdater.channel).toBe('latest')
    expect(stableUpdater.allowPrerelease).toBe(false)

    const canaryUpdater = createUpdaterMock()
    configureUpdaterForChannel(canaryUpdater, 'canary')
    expect(canaryUpdater.channel).toBe('canary')
    expect(canaryUpdater.allowPrerelease).toBe(true)
  })

  it('prompts and installs when restart is confirmed', async () => {
    const { showMessageBox } = createShowMessageBoxMock(0)
    const quitAndInstall = vi.fn(() => undefined)

    const installed = await promptAndInstallUpdate(showMessageBox, quitAndInstall)

    expect(installed).toBe(true)
    expect(quitAndInstall).toHaveBeenCalledTimes(1)
  })

  it('prompts and defers install when user chooses later', async () => {
    const { showMessageBox } = createShowMessageBoxMock(1)
    const quitAndInstall = vi.fn(() => undefined)

    const installed = await promptAndInstallUpdate(showMessageBox, quitAndInstall)

    expect(installed).toBe(false)
    expect(quitAndInstall).not.toHaveBeenCalled()
  })

  it('shows disabled message for manual checks outside packaged macOS', async () => {
    const updater = createUpdaterMock()
    const { showMessageBox, spy } = createShowMessageBoxMock(0)
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

    await checkForUpdatesManual({
      updater,
      platform: 'linux',
      isPackaged: () => false,
      showMessageBox,
      logger
    })

    expect(updater.checkForUpdatesSpy).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Updates are unavailable in this build.'
    }))
  })

  it('prompts restart when an update is downloaded', async () => {
    const updater = createUpdaterMock()
    const { showMessageBox } = createShowMessageBoxMock(0)
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

    const setTimeoutFn: typeof setTimeout = ((handler: TimerHandler) => {
      if (typeof handler === 'function') {
        handler()
      }
      return 1 as unknown as ReturnType<typeof setTimeout>
    }) as unknown as typeof setTimeout

    const setIntervalFn: typeof setInterval = ((handler: TimerHandler) => {
      void handler
      return 1 as unknown as ReturnType<typeof setInterval>
    }) as unknown as typeof setInterval

    initializeAutoUpdates('canary', {
      updater,
      platform: 'darwin',
      isPackaged: () => true,
      showMessageBox,
      logger,
      setTimeoutFn,
      setIntervalFn
    })

    updater.emit('update-downloaded')
    await Promise.resolve()

    expect(updater.quitAndInstallSpy).toHaveBeenCalledTimes(1)
  })

  it('shows a single error dialog when updater emits error and rejects during manual check', async () => {
    const updater = createUpdaterMock()
    const { showMessageBox, spy } = createShowMessageBoxMock(0)
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const error = new Error('No published versions on GitHub')

    updater.checkForUpdatesSpy.mockImplementation(async () => {
      updater.emit('error', error)
      throw error
    })

    const setTimeoutFn: typeof setTimeout = (() => {
      return 1 as unknown as ReturnType<typeof setTimeout>
    }) as unknown as typeof setTimeout

    const setIntervalFn: typeof setInterval = (() => {
      return 1 as unknown as ReturnType<typeof setInterval>
    }) as unknown as typeof setInterval

    initializeAutoUpdates('canary', {
      updater,
      platform: 'darwin',
      isPackaged: () => true,
      showMessageBox,
      logger,
      setTimeoutFn,
      setIntervalFn
    })

    await checkForUpdatesManual({
      updater,
      platform: 'darwin',
      isPackaged: () => true,
      showMessageBox,
      logger
    })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Unable to check for updates.',
      detail: 'No published versions on GitHub'
    }))
  })
})
