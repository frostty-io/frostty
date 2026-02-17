import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock the electronAPI globally for all renderer tests
const mockElectronAPI = {
  spawnPty: vi.fn(),
  writePty: vi.fn(),
  resizePty: vi.fn(),
  killPty: vi.fn(),
  getCwd: vi.fn().mockResolvedValue('~'),
  getSystemStats: vi.fn().mockResolvedValue({ cpuUsage: 0, memoryUsage: 0, memoryUsedGb: 0, memoryTotalGb: 0 }),
  pickDirectory: vi.fn().mockResolvedValue(null),
  getAvailableShells: vi.fn().mockResolvedValue([]),
  onPtyData: vi.fn().mockReturnValue(() => {}),
  onPtyExit: vi.fn().mockReturnValue(() => {}),
  onPtyCwd: vi.fn().mockReturnValue(() => {}),
  gitRepoInfo: vi.fn().mockResolvedValue({ isRepo: false, repoName: '', branch: '' }),
  gitStatus: vi.fn().mockResolvedValue({ isRepo: false, branch: '', upstream: null, ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [], conflicted: [], stashCount: 0 }),
  gitBranches: vi.fn().mockResolvedValue([]),
  gitCheckout: vi.fn().mockResolvedValue({ success: true, message: '' }),
  gitPull: vi.fn().mockResolvedValue({ success: true, message: '' }),
  gitPush: vi.fn().mockResolvedValue({ success: true, message: '' }),
  gitFetch: vi.fn().mockResolvedValue({ success: true, message: '' }),
  gitCommit: vi.fn().mockResolvedValue({ success: true, message: '' }),
  gitStage: vi.fn().mockResolvedValue({ success: true, message: '' }),
  gitUnstage: vi.fn().mockResolvedValue({ success: true, message: '' }),
  gitStash: vi.fn().mockResolvedValue({ success: true, message: '' }),
  gitStashPop: vi.fn().mockResolvedValue({ success: true, message: '' }),
  gitStashList: vi.fn().mockResolvedValue([]),
  gitDiscard: vi.fn().mockResolvedValue({ success: true, message: '' }),
  scanGitRepos: vi.fn().mockResolvedValue([]),
  openInVSCode: vi.fn().mockResolvedValue(undefined),
  openInCursor: vi.fn().mockResolvedValue(undefined),
  generateAICommand: vi.fn().mockResolvedValue({ success: false, error: 'not configured' }),
  loadSession: vi.fn().mockResolvedValue(null),
  saveWindowSession: vi.fn(),
  onSessionRequestSave: vi.fn().mockReturnValue(() => {}),
  loadSettings: vi.fn().mockResolvedValue({
    profiles: [{ id: 'default', name: 'Default', shell: 'system', homeDirectory: '~', tabColor: '#3b82f6', shellFontSize: 12 }],
    defaultProfileId: 'default',
    openRouterApiKey: '',
    openRouterModel: 'openai/gpt-oss-120b'
  }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  loadRecents: vi.fn().mockResolvedValue({ recentCommands: [], recentProjects: [] }),
  saveRecentCommand: vi.fn().mockResolvedValue(undefined),
  saveRecentProject: vi.fn().mockResolvedValue(undefined),
  newWindow: vi.fn(),
  closeWindow: vi.fn(),
  setWindowTitle: vi.fn(),
  restoreLastWindow: vi.fn()
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
})

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

Object.defineProperty(window, 'ResizeObserver', {
  value: MockResizeObserver
})
