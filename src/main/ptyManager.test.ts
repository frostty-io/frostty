import { afterEach, describe, expect, it, vi } from 'vitest'
import * as path from 'path'
import type { PathLike } from 'fs'

const { accessSyncMock } = vi.hoisted(() => ({ accessSyncMock: vi.fn() }))

vi.mock('node-pty', () => ({
  spawn: vi.fn()
}))

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    accessSync: accessSyncMock
  }
})

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {},
  app: {
    getPath: vi.fn()
  }
}))

import { getAvailableShells } from './ptyManager'

const ORIGINAL_ENV = {
  PATH: process.env.PATH,
  SHELL: process.env.SHELL,
  COMSPEC: process.env.COMSPEC,
  PROGRAMFILES: process.env.PROGRAMFILES
}

function setSystemShellEnv(systemShellPath: string): void {
  if (process.platform === 'win32') {
    process.env.PROGRAMFILES = 'C:\\Program Files'
    process.env.COMSPEC = systemShellPath
  } else {
    process.env.SHELL = systemShellPath
  }
}

function mockAccessibleExecutables(paths: Set<string>): void {
  accessSyncMock.mockImplementation((candidate: PathLike) => {
    const candidatePath = candidate.toString()
    if (paths.has(candidatePath)) return
    throw new Error(`ENOENT: ${candidatePath}`)
  })
}

describe('ptyManager shell discovery', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    accessSyncMock.mockReset()
    process.env.PATH = ORIGINAL_ENV.PATH
    process.env.SHELL = ORIGINAL_ENV.SHELL
    process.env.COMSPEC = ORIGINAL_ENV.COMSPEC
    process.env.PROGRAMFILES = ORIGINAL_ENV.PROGRAMFILES
  })

  it('finds nushell from PATH when hard-coded locations are missing', () => {
    const customBin = process.platform === 'win32' ? 'C:\\custom-bin' : '/tmp/custom-bin'
    const nuExecutableName = process.platform === 'win32' ? 'nu.exe' : 'nu'
    const nuPath = path.join(customBin, nuExecutableName)
    const systemShellPath = process.platform === 'win32' ? 'C:\\system-shell.exe' : '/tmp/system-shell'

    process.env.PATH = customBin
    setSystemShellEnv(systemShellPath)
    mockAccessibleExecutables(new Set([systemShellPath, nuPath]))

    const shells = getAvailableShells()
    const nuShell = shells.find((shell) => shell.type === 'nu')

    expect(nuShell).toBeDefined()
    expect(nuShell?.available).toBe(true)
    expect(nuShell?.path).toBe(nuPath)
  })

  it('falls back to system shell when nushell is unavailable', () => {
    const customBin = process.platform === 'win32' ? 'C:\\custom-bin' : '/tmp/custom-bin'
    const systemShellPath = process.platform === 'win32' ? 'C:\\system-shell.exe' : '/tmp/system-shell'

    process.env.PATH = customBin
    setSystemShellEnv(systemShellPath)
    mockAccessibleExecutables(new Set([systemShellPath]))

    const shells = getAvailableShells()
    const nuShell = shells.find((shell) => shell.type === 'nu')

    expect(nuShell).toBeDefined()
    expect(nuShell?.available).toBe(false)
    expect(nuShell?.path).toBe('')
  })
})
