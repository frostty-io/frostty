import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IPC_CHANNELS } from '../../../shared/ipc'

describe('preload scoped PTY subscriptions', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('uses a single underlying PTY_DATA listener and routes by tabId', async () => {
    const on = vi.fn()
    const removeListener = vi.fn()
    let exposedApi: Record<string, unknown> | null = null

    vi.doMock('electron', () => ({
      contextBridge: {
        exposeInMainWorld: (_key: string, api: Record<string, unknown>) => {
          exposedApi = api
        }
      },
      ipcRenderer: {
        on,
        removeListener,
        invoke: vi.fn(),
        send: vi.fn()
      }
    }))

    await import('../../../preload/index')
    expect(exposedApi).toBeTruthy()

    const onPtyDataForTab = exposedApi?.['onPtyDataForTab'] as unknown as (tabId: string, cb: (e: { tabId: string; data: string }) => void) => () => void
    const tabACallback1 = vi.fn()
    const tabACallback2 = vi.fn()
    const tabBCallback = vi.fn()

    const unsubA1 = onPtyDataForTab('tab-a', tabACallback1)
    const unsubA2 = onPtyDataForTab('tab-a', tabACallback2)
    const unsubB = onPtyDataForTab('tab-b', tabBCallback)

    const dataRegistrations = on.mock.calls.filter(([channel]) => channel === IPC_CHANNELS.PTY_DATA)
    expect(dataRegistrations).toHaveLength(1)

    const handler = dataRegistrations[0][1] as (_event: unknown, payload: { tabId: string; data: string }) => void
    handler(null, { tabId: 'tab-a', data: 'A' })

    expect(tabACallback1).toHaveBeenCalledWith({ tabId: 'tab-a', data: 'A' })
    expect(tabACallback2).toHaveBeenCalledWith({ tabId: 'tab-a', data: 'A' })
    expect(tabBCallback).not.toHaveBeenCalled()

    unsubA1()
    unsubA2()
    unsubB()
    expect(removeListener).not.toHaveBeenCalled()
  })

  it('uses a single underlying PTY_EXIT listener and routes by tabId', async () => {
    const on = vi.fn()
    let exposedApi: Record<string, unknown> | null = null

    vi.doMock('electron', () => ({
      contextBridge: {
        exposeInMainWorld: (_key: string, api: Record<string, unknown>) => {
          exposedApi = api
        }
      },
      ipcRenderer: {
        on,
        removeListener: vi.fn(),
        invoke: vi.fn(),
        send: vi.fn()
      }
    }))

    await import('../../../preload/index')
    const onPtyExitForTab = exposedApi?.['onPtyExitForTab'] as unknown as (tabId: string, cb: (e: { tabId: string; exitCode: number }) => void) => () => void

    const tabACallback = vi.fn()
    const tabBCallback = vi.fn()
    onPtyExitForTab('tab-a', tabACallback)
    onPtyExitForTab('tab-b', tabBCallback)

    const exitRegistrations = on.mock.calls.filter(([channel]) => channel === IPC_CHANNELS.PTY_EXIT)
    expect(exitRegistrations).toHaveLength(1)

    const handler = exitRegistrations[0][1] as (_event: unknown, payload: { tabId: string; exitCode: number }) => void
    handler(null, { tabId: 'tab-b', exitCode: 0 })

    expect(tabACallback).not.toHaveBeenCalled()
    expect(tabBCallback).toHaveBeenCalledWith({ tabId: 'tab-b', exitCode: 0 })
  })
})
