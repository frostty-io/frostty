import * as pty from 'node-pty'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { BrowserWindow, app } from 'electron'
import { IPC_CHANNELS, ShellType, AvailableShell } from '../shared/ipc'

const execAsync = promisify(exec)
const readlinkAsync = promisify(fs.readlink)

// Map of tabId -> PTY process
const ptyProcesses = new Map<string, pty.IPty>()

// Map of tabId -> webContents.id (tracks which window owns each PTY)
const ptyWindowMap = new Map<string, number>()

// Batched PTY output: accumulate chunks and flush on interval or size threshold
const PTY_BATCH_FLUSH_MS = 16
const PTY_BATCH_MAX_BYTES = 64 * 1024
const ptyDataPending = new Map<string, { window: BrowserWindow; chunks: string[] }>()
let ptyFlushTimer: ReturnType<typeof setTimeout> | null = null

// Cached shell environment (fetched once from login shell)
let cachedShellEnv: { [key: string]: string } | null = null
let shellEnvPromise: Promise<{ [key: string]: string }> | null = null

/**
 * Get environment variables from the user's login shell (async).
 * This ensures we have the same PATH as other terminals.
 */
async function getShellEnvironment(): Promise<{ [key: string]: string }> {
  if (cachedShellEnv) return cachedShellEnv
  if (shellEnvPromise) return shellEnvPromise

  const homeDir = os.homedir()
  const shell = process.env.SHELL || '/bin/zsh'

  shellEnvPromise = (async () => {
    try {
      const { stdout: envOutput } = await execAsync(`${shell} -l -i -c 'env'`, {
        encoding: 'utf8',
        timeout: 5000,
        maxBuffer: 2 * 1024 * 1024,
        env: {
          HOME: homeDir,
          USER: process.env.USER || '',
          SHELL: shell,
          TERM: 'xterm-256color',
        },
      })

      const env: { [key: string]: string } = {}
      for (const line of envOutput.split('\n')) {
        const eqIndex = line.indexOf('=')
        if (eqIndex > 0) {
          const key = line.substring(0, eqIndex)
          const value = line.substring(eqIndex + 1)
          env[key] = value
        }
      }

      cachedShellEnv = env
      return env
    } catch (error) {
      console.error('Failed to get shell environment:', error)
      return process.env as { [key: string]: string }
    }
  })()

  return shellEnvPromise
}

/**
 * Pre-fetch shell environment at app startup so the first PTY spawn doesn't block.
 */
export function preloadShellEnvironment(): void {
  getShellEnvironment().catch(() => {})
}

// Shell integration directory
let shellIntegrationDir: string | null = null

/**
 * Initialize shell integration scripts that enable OSC 7
 * These are sourced during shell startup, so no commands are visible
 */
function initShellIntegration(): string {
  if (shellIntegrationDir) return shellIntegrationDir

  const hostname = os.hostname()
  const userDataPath = app.getPath('userData')
  shellIntegrationDir = path.join(userDataPath, 'shell-integration')

  // Create the directory
  if (!fs.existsSync(shellIntegrationDir)) {
    fs.mkdirSync(shellIntegrationDir, { recursive: true })
  }

  // Create zsh integration directory with .zshrc
  const zshDir = path.join(shellIntegrationDir, 'zsh')
  if (!fs.existsSync(zshDir)) {
    fs.mkdirSync(zshDir, { recursive: true })
  }

  // .zshenv is sourced first, before .zshrc
  // We set up OSC 7 here and source the user's real config
  const zshEnv = `# Doggo shell integration
# Set up OSC 7 directory reporting
__doggo_osc7() { printf '\\e]7;file://${hostname}%s\\a' "$PWD" }
autoload -Uz add-zsh-hook 2>/dev/null && add-zsh-hook chpwd __doggo_osc7
autoload -Uz add-zsh-hook 2>/dev/null && add-zsh-hook precmd __doggo_osc7

# Restore ZDOTDIR and source user's zsh config
export ZDOTDIR="$HOME"
[[ -f "$HOME/.zshenv" ]] && source "$HOME/.zshenv"
`
  fs.writeFileSync(path.join(zshDir, '.zshenv'), zshEnv)

  // .zshrc sources user's real .zshrc
  const zshRc = `# Doggo: source user's zshrc
[[ -f "$HOME/.zshrc" ]] && source "$HOME/.zshrc"
# Emit initial OSC 7
__doggo_osc7
`
  fs.writeFileSync(path.join(zshDir, '.zshrc'), zshRc)

  // Bash integration script (sourced via BASH_ENV)
  const bashInit = `# Doggo shell integration
__doggo_osc7() { printf '\\e]7;file://${hostname}%s\\a' "$PWD"; }
PROMPT_COMMAND="__doggo_osc7\${PROMPT_COMMAND:+;\$PROMPT_COMMAND}"
__doggo_osc7
`
  fs.writeFileSync(path.join(shellIntegrationDir, 'bash_init.sh'), bashInit)

  // Fish shell integration
  const fishDir = path.join(shellIntegrationDir, 'fish')
  const fishConfDir = path.join(fishDir, 'conf.d')
  if (!fs.existsSync(fishConfDir)) {
    fs.mkdirSync(fishConfDir, { recursive: true })
  }

  // Fish config that sources user config and sets up OSC 7
  const fishConfig = `# Doggo fish shell integration
# Emit OSC 7 for directory tracking
function __doggo_osc7 --on-variable PWD --description 'Emit OSC 7 escape sequence'
    printf '\\e]7;file://${hostname}%s\\a' "$PWD"
end

# Emit initial OSC 7
__doggo_osc7
`
  fs.writeFileSync(path.join(fishConfDir, 'doggo.fish'), fishConfig)

  return shellIntegrationDir
}

/**
 * Parse OSC 7 escape sequences from terminal data to extract CWD changes.
 * Uses a new regex instance per call to avoid global state and allow safe concurrent use.
 */
function parseOsc7(data: string): string | null {
  const regex = /\x1b\]7;(?:file:\/\/[^\/]*)?([^\x07\x1b]+)(?:\x07|\x1b\\)/g
  let lastPath: string | null = null
  let match: RegExpExecArray | null
  while ((match = regex.exec(data)) !== null) {
    lastPath = match[1]
  }

  if (lastPath) {
    try {
      lastPath = decodeURIComponent(lastPath)
    } catch {
      // Keep original if decode fails
    }

    const homeDir = os.homedir()
    return lastPath.startsWith(homeDir) ? lastPath.replace(homeDir, '~') : lastPath
  }
  return null
}

function flushPtyData(): void {
  ptyFlushTimer = null
  for (const [tabId, entry] of Array.from(ptyDataPending.entries())) {
    if (entry.chunks.length === 0) continue
    if (entry.window.isDestroyed()) {
      entry.chunks = []
      continue
    }
    const data = entry.chunks.join('')
    entry.chunks = []
    const cwd = parseOsc7(data)
    if (cwd) {
      entry.window.webContents.send(IPC_CHANNELS.PTY_CWD, { tabId, cwd })
    }
    entry.window.webContents.send(IPC_CHANNELS.PTY_DATA, { tabId, data })
  }
}

function schedulePtyFlush(): void {
  if (ptyFlushTimer !== null) return
  ptyFlushTimer = setTimeout(flushPtyData, PTY_BATCH_FLUSH_MS)
}

/**
 * Check if a file exists and is executable
 */
function shellExists(shellPath: string): boolean {
  try {
    fs.accessSync(shellPath, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Shell paths by type
 */
const SHELL_PATHS: Record<Exclude<ShellType, 'system'>, string[]> = {
  zsh: ['/bin/zsh', '/usr/bin/zsh', '/usr/local/bin/zsh', '/opt/homebrew/bin/zsh'],
  bash: ['/bin/bash', '/usr/bin/bash', '/usr/local/bin/bash', '/opt/homebrew/bin/bash'],
  fish: ['/usr/local/bin/fish', '/opt/homebrew/bin/fish', '/usr/bin/fish', '/bin/fish']
}

/**
 * Get the path for a specific shell type
 */
function getShellPath(shellType: Exclude<ShellType, 'system'>): string | null {
  const paths = SHELL_PATHS[shellType]
  for (const shellPath of paths) {
    if (shellExists(shellPath)) {
      return shellPath
    }
  }
  return null
}

/**
 * Get all available shells on the system
 */
export function getAvailableShells(): AvailableShell[] {
  const shells: AvailableShell[] = [
    { type: 'system', path: getSystemShell(), available: true }
  ]

  for (const shellType of ['zsh', 'bash', 'fish'] as const) {
    const shellPath = getShellPath(shellType)
    shells.push({
      type: shellType,
      path: shellPath || '',
      available: shellPath !== null
    })
  }

  return shells
}

/**
 * Get the system's default shell
 */
function getSystemShell(): string {
  if (process.platform === 'win32') {
    const pwshPath = `${process.env.PROGRAMFILES}\\PowerShell\\7\\pwsh.exe`
    if (shellExists(pwshPath)) {
      return pwshPath
    }
    return process.env.COMSPEC || 'cmd.exe'
  }

  const envShell = process.env.SHELL
  if (envShell && shellExists(envShell)) {
    return envShell
  }

  const fallbackShells = ['/bin/zsh', '/bin/bash', '/bin/sh']
  for (const shell of fallbackShells) {
    if (shellExists(shell)) {
      return shell
    }
  }

  return '/bin/sh'
}

/**
 * Get the shell path based on requested shell type
 */
function getShellForType(shellType?: ShellType): string {
  if (!shellType || shellType === 'system') {
    return getSystemShell()
  }

  const shellPath = getShellPath(shellType)
  if (shellPath) {
    return shellPath
  }

  // Fall back to system shell if requested shell is not available
  return getSystemShell()
}

function resolveInitialCwd(requestedCwd?: string): string {
  const homeDir = os.homedir()
  if (!requestedCwd) return homeDir

  const trimmed = requestedCwd.trim()
  if (!trimmed) return homeDir

  const expanded = trimmed.replace(/^~(?=\/|$)/, homeDir)
  try {
    if (fs.existsSync(expanded) && fs.statSync(expanded).isDirectory()) {
      return expanded
    }
  } catch {
    // Fall back to home
  }

  return homeDir
}

/**
 * Spawn a new PTY process for a tab
 */
export async function spawnPty(tabId: string, window: BrowserWindow, requestedCwd?: string, requestedShell?: ShellType): Promise<{ pid: number; shell: string; cwd: string }> {
  const shell = getShellForType(requestedShell)
  const homeDir = os.homedir()
  const shellName = shell.split('/').pop() || 'sh'
  const resolvedCwd = resolveInitialCwd(requestedCwd)
  const reportedCwd = resolvedCwd.startsWith(homeDir)
    ? resolvedCwd.replace(homeDir, '~')
    : resolvedCwd

  // Initialize shell integration scripts
  const integrationDir = initShellIntegration()

  // Get environment from the user's login shell (async, non-blocking)
  const shellEnv = await getShellEnvironment()

  const env: { [key: string]: string } = {
    ...shellEnv,
    DOGGO: '1',
    COLORTERM: 'truecolor',
    // Ensure UTF-8 locale for correct Unicode character width calculations
    // Without this, apps launched from Dock/Finder use C locale and wcwidth()
    // returns wrong values for multi-cell glyphs (like Nerd Font icons)
    LANG: shellEnv.LANG || 'en_US.UTF-8',
    LC_ALL: shellEnv.LC_ALL || shellEnv.LANG || 'en_US.UTF-8'
  }

  // Configure shell to use our integration scripts
  let args: string[] = []

  if (shellName === 'zsh') {
    // ZDOTDIR tells zsh where to look for .zshrc, .zshenv, etc.
    env.ZDOTDIR = path.join(integrationDir, 'zsh')
  } else if (shellName === 'bash') {
    // For bash, use --rcfile to source our integration script
    const bashRcFile = path.join(integrationDir, 'bash_init.sh')
    // Create a combined rcfile that sources both our init and user's bashrc
    const combinedBashRc = `# Doggo bash integration
source "${bashRcFile}"
[[ -f "$HOME/.bashrc" ]] && source "$HOME/.bashrc"
`
    const combinedRcPath = path.join(integrationDir, 'bashrc_combined')
    fs.writeFileSync(combinedRcPath, combinedBashRc)
    args = ['--rcfile', combinedRcPath]
  } else if (shellName === 'fish') {
    // For fish, use XDG_CONFIG_HOME to point to our config directory
    // Fish will source conf.d/doggo.fish automatically
    const fishConfigDir = path.join(integrationDir, 'fish')
    env.XDG_CONFIG_HOME = integrationDir
    // Also copy any existing fish config
    const userFishConfig = path.join(homeDir, '.config', 'fish', 'config.fish')
    const doggoFishConfig = path.join(fishConfigDir, 'config.fish')
    if (fs.existsSync(userFishConfig) && !fs.existsSync(doggoFishConfig)) {
      try {
        // Create a config.fish that sources the user's config
        const wrapperConfig = `# Doggo fish config wrapper
# Source user's fish config
if test -f "${userFishConfig}"
    source "${userFishConfig}"
end
`
        fs.writeFileSync(doggoFishConfig, wrapperConfig)
      } catch {
        // Ignore errors
      }
    }
  }

  const ptyProcess = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: resolvedCwd,
    env
  })

  // Handle PTY data output (batched to reduce IPC volume)
  ptyProcess.onData((data) => {
    if (window.isDestroyed()) return

    let entry = ptyDataPending.get(tabId)
    if (!entry) {
      entry = { window, chunks: [] }
      ptyDataPending.set(tabId, entry)
    }
    entry.chunks.push(data)
    const totalSize = entry.chunks.reduce((sum, s) => sum + s.length, 0)

    if (totalSize >= PTY_BATCH_MAX_BYTES) {
      const joined = entry.chunks.join('')
      entry.chunks = []
      const cwd = parseOsc7(joined)
      if (cwd) {
        window.webContents.send(IPC_CHANNELS.PTY_CWD, { tabId, cwd })
      }
      window.webContents.send(IPC_CHANNELS.PTY_DATA, { tabId, data: joined })
    } else {
      schedulePtyFlush()
    }
  })

  // Handle PTY exit
  ptyProcess.onExit(({ exitCode, signal }) => {
    ptyDataPending.delete(tabId)
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.PTY_EXIT, { tabId, exitCode, signal })
    }
    ptyProcesses.delete(tabId)
    ptyWindowMap.delete(tabId)
  })

  ptyProcesses.set(tabId, ptyProcess)
  ptyWindowMap.set(tabId, window.webContents.id)
  return { pid: ptyProcess.pid, shell, cwd: reportedCwd }
}

/**
 * Write data to a PTY process
 */
export function writePty(tabId: string, data: string): void {
  const ptyProcess = ptyProcesses.get(tabId)
  if (ptyProcess) {
    ptyProcess.write(data)
  }
}

/**
 * Resize a PTY process
 */
export function resizePty(tabId: string, cols: number, rows: number): void {
  const ptyProcess = ptyProcesses.get(tabId)
  if (ptyProcess) {
    ptyProcess.resize(cols, rows)
  }
}

/**
 * Kill a PTY process
 */
export function killPty(tabId: string): void {
  const ptyProcess = ptyProcesses.get(tabId)
  if (ptyProcess) {
    ptyProcess.kill()
    ptyProcesses.delete(tabId)
  }
  ptyWindowMap.delete(tabId)
}

/**
 * Kill all PTY processes (cleanup on app quit)
 */
export function killAllPtys(): void {
  ptyProcesses.forEach((ptyProcess, tabId) => {
    ptyProcess.kill()
    ptyProcesses.delete(tabId)
  })
  ptyWindowMap.clear()
}

/**
 * Kill all PTY processes belonging to a specific window
 */
export function killPtysForWindow(webContentsId: number): void {
  const tabsToKill: string[] = []
  ptyWindowMap.forEach((wcId, tabId) => {
    if (wcId === webContentsId) {
      tabsToKill.push(tabId)
    }
  })
  tabsToKill.forEach((tabId) => {
    killPty(tabId)
  })
}

/**
 * Get the current working directory of a PTY process (fallback method, async).
 */
export async function getCwd(tabId: string): Promise<string> {
  const ptyProcess = ptyProcesses.get(tabId)
  if (!ptyProcess) {
    return '~'
  }

  try {
    const ptyPid = ptyProcess.pid
    const homeDir = os.homedir()

    if (process.platform === 'darwin') {
      try {
        const { stdout: psOutput } = await execAsync(
          `ps -axo pid,ppid,comm | awk 'NR==1 {next} {pid[$1]=$2; comm[$1]=$3} END {for(p in pid) print p, pid[p], comm[p]}'`,
          { encoding: 'utf8', maxBuffer: 1024 * 1024 }
        )

        const processes = new Map<number, number>()
        psOutput.trim().split('\n').forEach((line: string) => {
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 2) {
            const pid = parseInt(parts[0], 10)
            const ppid = parseInt(parts[1], 10)
            if (!isNaN(pid) && !isNaN(ppid)) {
              processes.set(pid, ppid)
            }
          }
        })

        const descendants: number[] = []
        const findDescendants = (parentPid: number) => {
          processes.forEach((ppid, pid) => {
            if (ppid === parentPid) {
              descendants.push(pid)
              findDescendants(pid)
            }
          })
        }
        findDescendants(ptyPid)

        const targetPid = descendants.length > 0 ? descendants[descendants.length - 1] : ptyPid

        const { stdout: lsofOutput } = await execAsync(`lsof -a -d cwd -p ${targetPid} -Fn 2>/dev/null`, {
          encoding: 'utf8',
          maxBuffer: 4096
        })

        const match = lsofOutput.trim().match(/n(.+)/)
        if (match && match[1]) {
          const cwd = match[1]
          return cwd.startsWith(homeDir) ? cwd.replace(homeDir, '~') : cwd
        }
      } catch {
        // Fall through
      }
    } else if (process.platform === 'linux') {
      try {
        const cwd = await readlinkAsync(`/proc/${ptyPid}/cwd`)
        return cwd.startsWith(homeDir) ? cwd.replace(homeDir, '~') : cwd
      } catch {
        // Fall through
      }
    }
  } catch {
    // Fall through
  }

  return '~'
}
