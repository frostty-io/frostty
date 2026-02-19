import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { IPC_CHANNELS, WindowSession, SessionData } from '../shared/ipc'
import { killPtysForWindow, killAllPtys } from './ptyManager'
import { saveSession } from './sessionManager'
import { SESSION_SAVE_TIMEOUT, SESSION_RELOAD_TIMEOUT } from '../shared/constants'

// ── State ────────────────────────────────────────────────────────────────────

// Multi-window tracking
const windows = new Set<BrowserWindow>()

// Maps BrowserWindow -> webContents.id (captured at creation, safe after destroy)
const windowWebContentsIds = new Map<BrowserWindow, number>()

// Maps webContents.id -> WindowSession for restoring tabs on renderer startup
const pendingSessionData = new Map<number, WindowSession>()

// Session save state for quit flow
let isQuitting = false
let quitSaveTimeout: ReturnType<typeof setTimeout> | null = null
const pendingSaveResponses = new Map<number, WindowSession>()
let expectedSaveCount = 0
let quitResolve: (() => void) | null = null

// Session save state for reload flow
const pendingReloadIds = new Set<number>()

// Closed-window tracking (for "Restore Last Window"), capped to avoid unbounded growth
const MAX_CLOSED_WINDOW_SESSIONS = 10
const closedWindowSessions: WindowSession[] = []

// Timeouts keyed by webContentsId so we can clear them when window closes
const reloadTimeouts = new Map<number, ReturnType<typeof setTimeout>>()
const closeTimeouts = new Map<number, ReturnType<typeof setTimeout>>()

// Graceful-close state: windows waiting for renderer to serialize before closing
const pendingCloseIds = new Set<number>()

// ── Window creation ──────────────────────────────────────────────────────────

export function createWindow(
  bounds?: { x: number; y: number; width: number; height: number },
  sessionData?: WindowSession
): BrowserWindow {
  const win = new BrowserWindow({
    width: bounds?.width ?? 1200,
    height: bounds?.height ?? 800,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#1a1b26',
    icon: join(__dirname, '../resources/logo.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      sandbox: false, // Required for node-pty
      nodeIntegration: false
    }
  })

  windows.add(win)

  // Capture webContents.id early -- win.webContents is destroyed before the 'closed' event
  const webContentsId = win.webContents.id
  windowWebContentsIds.set(win, webContentsId)

  // Store session data for this window so renderer can request it on load
  if (sessionData) {
    pendingSessionData.set(webContentsId, sessionData)
  }

  // Load the renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools()
  }

  // Intercept reload shortcuts (Cmd+R, Cmd+Shift+R, F5) to save session before reloading
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return

    const isReload =
      (input.key === 'r' && (input.meta || input.control)) || // Cmd+R / Ctrl+R / Cmd+Shift+R / Ctrl+Shift+R
      (input.key === 'F5') // F5
    if (!isReload) return

    event.preventDefault()

    // Mark this webContents as pending reload
    pendingReloadIds.add(webContentsId)

    // Ask the renderer to serialize its state (reuses existing save flow)
    win.webContents.send(IPC_CHANNELS.SESSION_REQUEST_SAVE)

    // Timeout: if renderer doesn't respond in time, reload anyway
    const reloadTimeoutId = setTimeout(() => {
      reloadTimeouts.delete(webContentsId)
      if (pendingReloadIds.has(webContentsId)) {
        pendingReloadIds.delete(webContentsId)
        killPtysForWindow(webContentsId)
        if (!win.isDestroyed()) {
          win.webContents.reload()
        }
      }
    }, SESSION_RELOAD_TIMEOUT)
    reloadTimeouts.set(webContentsId, reloadTimeoutId)
  })

  // Intercept window close to serialize state for restore / last-window session save
  win.on('close', (event) => {
    if (isQuitting) return // Quit flow handles its own serialization

    // If this close was already initiated by our graceful-close logic, allow it
    if (pendingCloseIds.has(webContentsId)) {
      pendingCloseIds.delete(webContentsId)
      killPtysForWindow(webContentsId)
      return
    }

    // Prevent the default close and ask the renderer to serialize first
    event.preventDefault()
    initiateGracefulClose(win, webContentsId)
  })

  win.on('closed', () => {
    const tid = reloadTimeouts.get(webContentsId)
    if (tid !== undefined) {
      clearTimeout(tid)
      reloadTimeouts.delete(webContentsId)
    }
    const cid = closeTimeouts.get(webContentsId)
    if (cid !== undefined) {
      clearTimeout(cid)
      closeTimeouts.delete(webContentsId)
    }
    windows.delete(win)
    windowWebContentsIds.delete(win)
    pendingSessionData.delete(webContentsId)
  })

  return win
}

// ── Graceful window close ─────────────────────────────────────────────────────

/**
 * Ask the renderer to serialize its state, stash it in closedWindowSessions,
 * then actually close the window.  If the renderer doesn't respond within the
 * timeout, we close anyway.
 */
function initiateGracefulClose(win: BrowserWindow, webContentsId: number): void {
  // Mark this window as waiting for a graceful-close response
  pendingCloseIds.add(webContentsId)

  // Ask renderer to serialize
  if (!win.isDestroyed()) {
    win.webContents.send(IPC_CHANNELS.SESSION_REQUEST_SAVE)
  }

  // Timeout: close even if the renderer doesn't respond
  const closeTimeoutId = setTimeout(() => {
    closeTimeouts.delete(webContentsId)
    if (pendingCloseIds.has(webContentsId)) {
      if (!win.isDestroyed()) {
        win.close()
      } else {
        pendingCloseIds.delete(webContentsId)
      }
    }
  }, SESSION_SAVE_TIMEOUT)
  closeTimeouts.set(webContentsId, closeTimeoutId)
}

/**
 * Handle a serialized session from the renderer during a graceful close.
 * Stores the session for restore, optionally saves to disk if this is the
 * last window on macOS, then finishes closing the window.
 */
async function finalizeGracefulClose(
  wcId: number,
  data: WindowSession
): Promise<void> {
  // Find the window
  let win: BrowserWindow | null = null
  for (const w of Array.from(windows)) {
    if (windowWebContentsIds.get(w) === wcId) {
      win = w
      break
    }
  }

  // Capture bounds
  let bounds = { x: 0, y: 0, width: 1200, height: 800 }
  if (win && !win.isDestroyed()) {
    try { bounds = win.getBounds() } catch { /* use defaults */ }
  }

  const closedSession: WindowSession = {
    bounds,
    tabs: data.tabs,
    activeTabIndex: data.activeTabIndex
  }

  // Save to closed-window stack so it can be restored (cap size)
  closedWindowSessions.push(closedSession)
  if (closedWindowSessions.length > MAX_CLOSED_WINDOW_SESSIONS) {
    closedWindowSessions.shift()
  }

  // If this is the last window on macOS, persist session to disk
  if (process.platform === 'darwin' && windows.size === 1) {
    const session: SessionData = {
      version: 1,
      windows: [closedSession],
      focusedWindowIndex: 0
    }
    await saveSession(session)
  }

  // Now actually close the window (the 'close' handler will see pendingCloseIds
  // and allow it through)
  if (win && !win.isDestroyed()) {
    win.close()
  } else {
    pendingCloseIds.delete(wcId)
  }
}

// ── Session save / quit flow ─────────────────────────────────────────────────

/**
 * Collect window bounds and save session, then proceed with quit.
 */
async function finalizeSaveAndQuit(): Promise<void> {
  if (quitSaveTimeout) {
    clearTimeout(quitSaveTimeout)
    quitSaveTimeout = null
  }

  // Build session data from responses + window bounds
  const windowSessions: WindowSession[] = []
  let focusedWindowIndex = 0

  const allWindows = Array.from(windows)
  for (let i = 0; i < allWindows.length; i++) {
    const win = allWindows[i]
    const wcId = windowWebContentsIds.get(win)
    if (!wcId) continue

    const savedData = pendingSaveResponses.get(wcId)

    // Get bounds safely -- fall back to defaults if window is already destroyed
    let bounds = { x: 0, y: 0, width: 1200, height: 800 }
    try {
      if (!win.isDestroyed()) {
        bounds = win.getBounds()
        if (win.isFocused()) {
          focusedWindowIndex = windowSessions.length
        }
      }
    } catch {
      // Window already destroyed, use defaults
    }

    windowSessions.push({
      bounds,
      tabs: savedData?.tabs ?? [],
      activeTabIndex: savedData?.activeTabIndex ?? 0
    })
  }

  const session: SessionData = {
    version: 1,
    windows: windowSessions,
    focusedWindowIndex
  }

  await saveSession(session)
  pendingSaveResponses.clear()

  // Now kill all PTYs and allow quit to proceed
  killAllPtys()

  if (quitResolve) {
    quitResolve()
    quitResolve = null
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Get the set of open BrowserWindows */
export function getWindows(): Set<BrowserWindow> {
  return windows
}

/** Mark the app as entering the quit flow */
export function setIsQuitting(value: boolean): void {
  isQuitting = value
}

/**
 * Gracefully close a window: serialize state, stash for restore, then close.
 * Called from the application menu (Close Window) or renderer IPC.
 */
export function closeWindowGracefully(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  const wcId = windowWebContentsIds.get(win)
  if (!wcId) { win.close(); return }

  // If already in a graceful-close flow, don't double-initiate
  if (pendingCloseIds.has(wcId)) return

  initiateGracefulClose(win, wcId)
}

/**
 * Restore the most recently closed window.
 * Creates a new BrowserWindow with the saved session data.
 */
export function restoreLastClosedWindow(): void {
  const session = closedWindowSessions.pop()
  if (!session) return
  createWindow(session.bounds, session)
}

/**
 * Begin the quit flow: ask all windows to serialize their state, wait for
 * responses, save session, then resolve the returned promise so the caller
 * can call `app.quit()`.
 *
 * Returns `null` when no waiting is required (already quitting, or no windows).
 */
export function startQuitFlow(): Promise<void> | null {
  if (isQuitting) return null // Already in quit flow

  const allWindows = Array.from(windows)
  if (allWindows.length === 0) {
    killAllPtys()
    return null
  }

  isQuitting = true
  expectedSaveCount = allWindows.length
  pendingSaveResponses.clear()

  // Ask all windows to serialize their state
  for (const win of allWindows) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.SESSION_REQUEST_SAVE)
    }
  }

  // Timeout: if not all windows respond in time, save what we have and quit
  quitSaveTimeout = setTimeout(() => {
    console.warn('Session save timeout - saving partial data')
    finalizeSaveAndQuit()
  }, SESSION_SAVE_TIMEOUT)

  // Return a promise that resolves when save is complete
  return new Promise<void>((resolve) => {
    quitResolve = resolve
  })
}

/** Create windows from saved session data, or a fresh window if none */
export function initWindows(session: SessionData | null): void {
  if (session && session.windows.length > 0) {
    const created: BrowserWindow[] = []
    for (const winSession of session.windows) {
      created.push(createWindow(winSession.bounds, winSession))
    }
    // Focus the previously focused window
    const idx = Math.min(
      Math.max(session.focusedWindowIndex, 0),
      created.length - 1
    )
    created[idx]?.focus()
  } else {
    createWindow()
  }
}

// ── IPC registration ─────────────────────────────────────────────────────────

export function registerWindowHandlers(): void {
  // Create new window
  ipcMain.on(IPC_CHANNELS.WINDOW_NEW, () => {
    createWindow()
  })

  // Close window gracefully (from renderer)
  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) closeWindowGracefully(win)
  })

  // Set window title (from renderer)
  ipcMain.on(IPC_CHANNELS.WINDOW_SET_TITLE, (event, title: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.setTitle(title)
    }
  })

  // Restore last closed window
  ipcMain.on(IPC_CHANNELS.WINDOW_RESTORE_LAST, () => {
    restoreLastClosedWindow()
  })

  // Renderer requests its saved session data on startup
  ipcMain.handle(IPC_CHANNELS.SESSION_LOAD, (event) => {
    const wcId = event.sender.id
    const data = pendingSessionData.get(wcId)
    if (data) {
      pendingSessionData.delete(wcId)
      return data
    }
    return null
  })

  // Renderer sends its serialized window session during quit, reload, or graceful close
  ipcMain.on(IPC_CHANNELS.SESSION_WINDOW_SAVE, (event, data: WindowSession) => {
    const wcId = event.sender.id

    // Check if this is a reload save (not a quit save)
    if (pendingReloadIds.has(wcId)) {
      pendingReloadIds.delete(wcId)
      // Store session data so the renderer can restore after reload
      pendingSessionData.set(wcId, data)
      // Kill PTY processes for this window (they'll be re-spawned on restore)
      killPtysForWindow(wcId)
      // Reload the renderer
      if (!event.sender.isDestroyed()) {
        event.sender.reload()
      }
      return
    }

    // Check if this is a graceful-close save
    if (pendingCloseIds.has(wcId)) {
      finalizeGracefulClose(wcId, data)
      return
    }

    // Otherwise, it's a quit save — existing flow
    pendingSaveResponses.set(wcId, data)

    // Check if all windows have responded
    if (pendingSaveResponses.size >= expectedSaveCount) {
      finalizeSaveAndQuit()
    }
  })
}
