import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC_CHANNELS,
  PtySpawnResponse,
  PtyDataEvent,
  PtyExitEvent,
  PtyCwdEvent,
  SystemStats,
  GitStatus,
  GitBranch,
  GitOperationResult,
  GitStashEntry,
  GitRepoInfo,
  ElectronAPI,
  ShellType,
  AvailableShell,
  AIGenerateCommandRequest,
  AIGenerateCommandResponse,
  AppSettings,
  Recents,
  WindowSession
} from '../shared/ipc'

// Expose the electron API to the renderer process
const electronAPI: ElectronAPI = {
  // Spawn a new PTY process
  spawnPty: async (tabId: string, cwd?: string, shell?: ShellType): Promise<PtySpawnResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PTY_SPAWN, { tabId, cwd, shell })
  },

  // Write data to PTY
  writePty: (tabId: string, data: string): void => {
    ipcRenderer.send(IPC_CHANNELS.PTY_INPUT, { tabId, data })
  },

  // Resize PTY
  resizePty: (tabId: string, cols: number, rows: number): void => {
    ipcRenderer.send(IPC_CHANNELS.PTY_RESIZE, { tabId, cols, rows })
  },

  // Kill PTY
  killPty: (tabId: string): void => {
    ipcRenderer.send(IPC_CHANNELS.PTY_KILL, { tabId })
  },

  // Get current working directory
  getCwd: async (tabId: string): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PTY_GET_CWD, { tabId })
  },

  // Get system stats (CPU/Memory)
  getSystemStats: async (): Promise<SystemStats> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_STATS)
  },

  // Pick a directory for settings
  pickDirectory: async (): Promise<string | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_PICK_DIRECTORY)
  },

  // Get available shells
  getAvailableShells: async (): Promise<AvailableShell[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_AVAILABLE_SHELLS)
  },

  // Subscribe to PTY data events
  onPtyData: (callback: (event: PtyDataEvent) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: PtyDataEvent) => {
      callback(data)
    }
    ipcRenderer.on(IPC_CHANNELS.PTY_DATA, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PTY_DATA, handler)
    }
  },

  // Subscribe to PTY exit events
  onPtyExit: (callback: (event: PtyExitEvent) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: PtyExitEvent) => {
      callback(data)
    }
    ipcRenderer.on(IPC_CHANNELS.PTY_EXIT, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PTY_EXIT, handler)
    }
  },

  // Subscribe to CWD change events
  onPtyCwd: (callback: (event: PtyCwdEvent) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: PtyCwdEvent) => {
      callback(data)
    }
    ipcRenderer.on(IPC_CHANNELS.PTY_CWD, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.PTY_CWD, handler)
    }
  },

  // Git APIs
  gitStatus: async (cwd: string): Promise<GitStatus> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_STATUS, cwd)
  },

  gitBranches: async (cwd: string): Promise<GitBranch[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_BRANCHES, cwd)
  },

  gitCheckout: async (cwd: string, branch: string, create?: boolean): Promise<GitOperationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_CHECKOUT, cwd, branch, create)
  },

  gitPull: async (cwd: string): Promise<GitOperationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_PULL, cwd)
  },

  gitPush: async (cwd: string, force?: boolean): Promise<GitOperationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_PUSH, cwd, force)
  },

  gitFetch: async (cwd: string): Promise<GitOperationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_FETCH, cwd)
  },

  gitCommit: async (cwd: string, message: string): Promise<GitOperationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_COMMIT, cwd, message)
  },

  gitStage: async (cwd: string, files: string[]): Promise<GitOperationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_STAGE, cwd, files)
  },

  gitUnstage: async (cwd: string, files: string[]): Promise<GitOperationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_UNSTAGE, cwd, files)
  },

  gitStash: async (cwd: string, message?: string): Promise<GitOperationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_STASH, cwd, message)
  },

  gitStashPop: async (cwd: string, index?: number): Promise<GitOperationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_STASH_POP, cwd, index)
  },

  gitStashList: async (cwd: string): Promise<GitStashEntry[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_STASH_LIST, cwd)
  },

  gitDiscard: async (cwd: string, files: string[]): Promise<GitOperationResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GIT_DISCARD, cwd, files)
  },

  // File system APIs
  scanGitRepos: async (baseDir: string): Promise<GitRepoInfo[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SCAN_GIT_REPOS, baseDir)
  },

  // Editor APIs
  openInVSCode: async (cwd: string): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.OPEN_IN_VSCODE, cwd)
  },

  openInCursor: async (cwd: string): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.OPEN_IN_CURSOR, cwd)
  },

  // AI APIs
  generateAICommand: async (request: AIGenerateCommandRequest): Promise<AIGenerateCommandResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AI_GENERATE_COMMAND, request)
  },

  // Session APIs
  loadSession: async (): Promise<WindowSession | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SESSION_LOAD)
  },

  saveWindowSession: (data: WindowSession): void => {
    ipcRenderer.send(IPC_CHANNELS.SESSION_WINDOW_SAVE, data)
  },

  onSessionRequestSave: (callback: () => void): (() => void) => {
    const handler = () => {
      callback()
    }
    ipcRenderer.on(IPC_CHANNELS.SESSION_REQUEST_SAVE, handler)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.SESSION_REQUEST_SAVE, handler)
    }
  },

  // Settings APIs
  loadSettings: async (): Promise<AppSettings> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_LOAD)
  },

  saveSettings: async (settings: AppSettings): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SAVE, settings)
  },

  // Recents APIs
  loadRecents: async (): Promise<Recents> => {
    return ipcRenderer.invoke(IPC_CHANNELS.RECENTS_LOAD)
  },

  saveRecentCommand: async (commandId: string): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.RECENTS_SAVE_COMMAND, commandId)
  },

  saveRecentProject: async (projectPath: string): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.RECENTS_SAVE_PROJECT, projectPath)
  },

  // Window APIs
  newWindow: (): void => {
    ipcRenderer.send(IPC_CHANNELS.WINDOW_NEW)
  },

  closeWindow: (): void => {
    ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE)
  },

  setWindowTitle: (title: string): void => {
    ipcRenderer.send(IPC_CHANNELS.WINDOW_SET_TITLE, title)
  },

  restoreLastWindow: (): void => {
    ipcRenderer.send(IPC_CHANNELS.WINDOW_RESTORE_LAST)
  },

  // Menu event listeners (main -> renderer)
  onMenuNewTab: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on(IPC_CHANNELS.MENU_NEW_TAB, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_NEW_TAB, handler)
  },

  onMenuCloseTab: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on(IPC_CHANNELS.MENU_CLOSE_TAB, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_CLOSE_TAB, handler)
  },

  onMenuOpenSettings: (callback: () => void): (() => void) => {
    const handler = () => callback()
    ipcRenderer.on(IPC_CHANNELS.MENU_OPEN_SETTINGS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MENU_OPEN_SETTINGS, handler)
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
