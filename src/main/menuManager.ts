import { Menu, app, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc'
import { createWindow, closeWindowGracefully, restoreLastClosedWindow } from './windowManager'
import { checkForUpdatesManual } from './services/updateService'

const isMac = process.platform === 'darwin'

function createCheckForUpdatesMenuItem(): Electron.MenuItemConstructorOptions {
  return {
    label: 'Check for Updates...',
    click: (): void => {
      void checkForUpdatesManual()
    }
  }
}

/**
 * Build and set the native application menu.
 * Call once after app.whenReady().
 *
 * Shortcuts like Cmd+T, Cmd+W, Cmd+Shift+W, Cmd+, are already handled by the
 * renderer's keyboard-shortcuts hook (which has richer context, e.g. checking
 * whether the settings pane is open).  We still list the accelerators in the
 * menu for discoverability, but set `registerAccelerator: false` so that
 * Electron doesn't intercept the key events before they reach the renderer.
 *
 * The menu `click` handlers act as fallbacks when the user clicks the menu
 * item directly (rather than using the keyboard shortcut).
 */
export function setupApplicationMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    // ── macOS app menu ──────────────────────────────────────────────────────
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              createCheckForUpdatesMenuItem(),
              { type: 'separator' as const },
              {
                label: 'Settings...',
                accelerator: 'CmdOrCtrl+,',
                registerAccelerator: false,
                click: (): void => {
                  const win = BrowserWindow.getFocusedWindow()
                  if (win) win.webContents.send(IPC_CHANNELS.MENU_OPEN_SETTINGS)
                }
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ] as Electron.MenuItemConstructorOptions[]
          }
        ]
      : []),

    // ── File menu ───────────────────────────────────────────────────────────
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          registerAccelerator: false,
          click: (): void => {
            createWindow()
          }
        },
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          registerAccelerator: false,
          click: (): void => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send(IPC_CHANNELS.MENU_NEW_TAB)
          }
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          registerAccelerator: false,
          click: (): void => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send(IPC_CHANNELS.MENU_CLOSE_TAB)
          }
        },
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+Shift+W',
          registerAccelerator: false,
          click: (): void => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) closeWindowGracefully(win)
          }
        },
        {
          label: 'Restore Last Window',
          click: (): void => {
            restoreLastClosedWindow()
          }
        },
        ...(!isMac
          ? [{ type: 'separator' as const }, { role: 'quit' as const }]
          : [])
      ]
    },

    // ── Edit menu ───────────────────────────────────────────────────────────
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },

    // ── Window menu ─────────────────────────────────────────────────────────
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const }
            ]
          : [
              { role: 'close' as const }
            ])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
