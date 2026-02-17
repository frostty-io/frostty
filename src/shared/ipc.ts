import { TERMINAL_FONT_SIZE_DEFAULT } from './constants'

// Supported shell types
export type ShellType = 'system' | 'zsh' | 'bash' | 'fish'

export const SHELL_OPTIONS: { value: ShellType; label: string; description: string }[] = [
  { value: 'system', label: 'System Default', description: 'Use your system\'s default shell' },
  { value: 'zsh', label: 'Zsh', description: 'Z shell with advanced features' },
  { value: 'bash', label: 'Bash', description: 'Bourne Again Shell' },
  { value: 'fish', label: 'Fish', description: 'Friendly Interactive Shell' }
]

// IPC Channel Names
export const IPC_CHANNELS = {
  PTY_SPAWN: 'pty:spawn',
  PTY_INPUT: 'pty:input',
  PTY_RESIZE: 'pty:resize',
  PTY_KILL: 'pty:kill',
  PTY_DATA: 'pty:data',
  PTY_EXIT: 'pty:exit',
  PTY_CWD: 'pty:cwd',
  PTY_GET_CWD: 'pty:getCwd',
  SYSTEM_STATS: 'system:stats',
  SETTINGS_PICK_DIRECTORY: 'settings:pickDirectory',
  GET_AVAILABLE_SHELLS: 'settings:getAvailableShells',
  // Git channels
  GIT_STATUS: 'git:status',
  GIT_BRANCHES: 'git:branches',
  GIT_CHECKOUT: 'git:checkout',
  GIT_PULL: 'git:pull',
  GIT_PUSH: 'git:push',
  GIT_FETCH: 'git:fetch',
  GIT_COMMIT: 'git:commit',
  GIT_STAGE: 'git:stage',
  GIT_UNSTAGE: 'git:unstage',
  GIT_STASH: 'git:stash',
  GIT_STASH_POP: 'git:stashPop',
  GIT_STASH_LIST: 'git:stashList',
  GIT_DISCARD: 'git:discard',
  GIT_REPO_INFO: 'git:repoInfo',
  SCAN_GIT_REPOS: 'fs:scanGitRepos',
  // Editor channels
  OPEN_IN_VSCODE: 'editor:openVSCode',
  OPEN_IN_CURSOR: 'editor:openCursor',
  // AI channels
  AI_GENERATE_COMMAND: 'ai:generateCommand',
  // Session channels
  SESSION_LOAD: 'session:load',
  SESSION_WINDOW_SAVE: 'session:windowSave',
  SESSION_REQUEST_SAVE: 'session:requestSave',
  // Settings channels
  SETTINGS_LOAD: 'settings:load',
  SETTINGS_SAVE: 'settings:save',
  // Recents channels
  RECENTS_LOAD: 'recents:load',
  RECENTS_SAVE_COMMAND: 'recents:saveCommand',
  RECENTS_SAVE_PROJECT: 'recents:saveProject',
  // Window channels
  WINDOW_NEW: 'window:new',
  WINDOW_CLOSE: 'window:close',
  WINDOW_SET_TITLE: 'window:setTitle',
  WINDOW_RESTORE_LAST: 'window:restoreLast',
  // Menu -> Renderer channels (main sends to focused renderer)
  MENU_NEW_TAB: 'menu:newTab',
  MENU_CLOSE_TAB: 'menu:closeTab',
  MENU_OPEN_SETTINGS: 'menu:openSettings'
} as const

// Git repo scan result
export interface GitRepoInfo {
  path: string
  name: string
}

// Available shell info
export interface AvailableShell {
  type: ShellType
  path: string
  available: boolean
}

// Request Payloads (Renderer -> Main)
export interface PtySpawnRequest {
  tabId: string
  cwd?: string
  shell?: ShellType
}

export interface PtySpawnResponse {
  pid: number
  shell: string
  cwd: string
}

export interface PtyInputPayload {
  tabId: string
  data: string
}

export interface PtyResizePayload {
  tabId: string
  cols: number
  rows: number
}

export interface PtyKillPayload {
  tabId: string
}

// Event Payloads (Main -> Renderer)
export interface PtyDataEvent {
  tabId: string
  data: string
}

export interface PtyExitEvent {
  tabId: string
  exitCode: number
  signal?: number
}

export interface PtyCwdEvent {
  tabId: string
  cwd: string
}

export interface PtyGetCwdPayload {
  tabId: string
}

// System Stats
export interface SystemStats {
  cpuUsage: number // 0-100 percentage
  memoryUsage: number // 0-100 percentage
  memoryUsedGb: number
  memoryTotalGb: number
}

// Git Types
export interface GitFileStatus {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'untracked' | 'ignored'
  staged: boolean
}

export interface GitRepoInfoResult {
  isRepo: boolean
  repoName: string   // basename of the repo root directory
  branch: string     // current branch or 'HEAD' if detached
}

export interface GitStatus {
  isRepo: boolean
  branch: string
  upstream: string | null
  ahead: number
  behind: number
  staged: GitFileStatus[]
  unstaged: GitFileStatus[]
  untracked: GitFileStatus[]
  conflicted: GitFileStatus[]
  stashCount: number
}

export interface GitBranch {
  name: string
  current: boolean
  remote: boolean
  upstream: string | null
}

export interface GitStashEntry {
  index: number
  message: string
  branch: string
}

export interface GitOperationResult {
  success: boolean
  message: string
  error?: string
}

// AI Command Generation Types
export interface AIGenerateCommandRequest {
  instruction: string
  shell: string
  cwd: string
  apiKey: string
  model: string
}

export interface AIGenerateCommandResponse {
  success: boolean
  command?: string
  error?: string
}

// Profile types
export interface Profile {
  id: string           // UUID or slug
  name: string         // User-facing name (e.g., "Default", "Work", "Server")
  shell: ShellType     // 'system' | 'zsh' | 'bash' | 'fish'
  homeDirectory: string // e.g., '~', '/srv/myproject'
  tabColor: string     // CSS color for the tab border, e.g. '#3b82f6'
  shellFontSize: number
}

export const DEFAULT_PROFILE: Profile = {
  id: 'default',
  name: 'Default',
  shell: 'system',
  homeDirectory: '~',
  tabColor: '#3b82f6',
  shellFontSize: TERMINAL_FONT_SIZE_DEFAULT
}

// App settings types
export interface AppSettings {
  profiles: Profile[]
  defaultProfileId: string  // ID of the "Default Profile" used for new tabs
  openRouterApiKey: string
  openRouterModel: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  profiles: [DEFAULT_PROFILE],
  defaultProfileId: 'default',
  openRouterApiKey: '',
  openRouterModel: 'openai/gpt-oss-120b'
}

export function normalizeHomeDirectory(input: string): string {
  const trimmed = input.trim()
  return trimmed.length > 0 ? trimmed : DEFAULT_PROFILE.homeDirectory
}

// Recents types
export interface Recents {
  recentCommands: string[]
  recentProjects: string[]
}

export const MAX_RECENT_ITEMS = 3

// Pane and TabEntry types (renderer-side tab model)
export interface Pane {
  id: string          // Unique ID for PTY association
  title: string
  shell: string
  cwd: string
  shellType?: ShellType
  profileId?: string  // Profile that created this pane
}

export interface TabEntry {
  id: string          // Unique tab entry ID (for tab bar, active tracking)
  type: 'single' | 'split'
  panes: Pane[]       // 1 for single, 2 for split
  activePaneId: string // Which pane is focused within this tab
}

// Session persistence types
export interface SavedPane {
  title: string
  cwd: string
  shellType?: ShellType
  scrollback?: string
  profileId?: string  // Profile that created this pane
}

export interface SavedTab {
  // New split-aware format
  type?: 'single' | 'split'  // Optional for backward compat (undefined = single)
  panes?: SavedPane[]
  activePaneIndex?: number
  // Legacy fields (for backward compat with old sessions)
  title?: string
  cwd?: string
  shellType?: ShellType
  scrollback?: string
}

export interface WindowSession {
  bounds: { x: number; y: number; width: number; height: number }
  tabs: SavedTab[]
  activeTabIndex: number
}

export interface SessionData {
  version: 1
  windows: WindowSession[]
  focusedWindowIndex: number
}

// Electron API exposed via contextBridge
export interface ElectronAPI {
  spawnPty: (tabId: string, cwd?: string, shell?: ShellType) => Promise<PtySpawnResponse>
  writePty: (tabId: string, data: string) => void
  resizePty: (tabId: string, cols: number, rows: number) => void
  killPty: (tabId: string) => void
  getCwd: (tabId: string) => Promise<string>
  getSystemStats: () => Promise<SystemStats>
  pickDirectory: () => Promise<string | null>
  getAvailableShells: () => Promise<AvailableShell[]>
  onPtyData: (callback: (event: PtyDataEvent) => void) => () => void
  onPtyExit: (callback: (event: PtyExitEvent) => void) => () => void
  onPtyCwd: (callback: (event: PtyCwdEvent) => void) => () => void
  // Git APIs
  gitRepoInfo: (cwd: string) => Promise<GitRepoInfoResult>
  gitStatus: (cwd: string) => Promise<GitStatus>
  gitBranches: (cwd: string) => Promise<GitBranch[]>
  gitCheckout: (cwd: string, branch: string, create?: boolean) => Promise<GitOperationResult>
  gitPull: (cwd: string) => Promise<GitOperationResult>
  gitPush: (cwd: string, force?: boolean) => Promise<GitOperationResult>
  gitFetch: (cwd: string) => Promise<GitOperationResult>
  gitCommit: (cwd: string, message: string) => Promise<GitOperationResult>
  gitStage: (cwd: string, files: string[]) => Promise<GitOperationResult>
  gitUnstage: (cwd: string, files: string[]) => Promise<GitOperationResult>
  gitStash: (cwd: string, message?: string) => Promise<GitOperationResult>
  gitStashPop: (cwd: string, index?: number) => Promise<GitOperationResult>
  gitStashList: (cwd: string) => Promise<GitStashEntry[]>
  gitDiscard: (cwd: string, files: string[]) => Promise<GitOperationResult>
  // File system APIs
  scanGitRepos: (baseDir: string) => Promise<GitRepoInfo[]>
  // Editor APIs
  openInVSCode: (cwd: string) => Promise<void>
  openInCursor: (cwd: string) => Promise<void>
  // AI APIs
  generateAICommand: (request: AIGenerateCommandRequest) => Promise<AIGenerateCommandResponse>
  // Session APIs
  loadSession: () => Promise<WindowSession | null>
  saveWindowSession: (data: WindowSession) => void
  onSessionRequestSave: (callback: () => void) => () => void
  // Settings APIs
  loadSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<void>
  // Recents APIs
  loadRecents: () => Promise<Recents>
  saveRecentCommand: (commandId: string) => Promise<void>
  saveRecentProject: (projectPath: string) => Promise<void>
  // Window APIs
  newWindow: () => void
  closeWindow: () => void
  setWindowTitle: (title: string) => void
  restoreLastWindow: () => void
  // Menu event listeners (main -> renderer)
  onMenuNewTab: (callback: () => void) => () => void
  onMenuCloseTab: (callback: () => void) => () => void
  onMenuOpenSettings: (callback: () => void) => () => void
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI
    __doggo_cleanup_pty?: (tabId: string) => void
  }
}
