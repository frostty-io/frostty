import { app } from 'electron'
import * as os from 'os'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { access, mkdir, writeFile } from 'fs/promises'

const execAsync = promisify(exec)

export interface ShellIntegrationPaths {
  integrationDir: string
  zshDir: string
  bashInitPath: string
  bashCombinedRcPath: string
  fishDir: string
  fishConfigPath: string
}

export interface ShellIntegrationFiles {
  zshEnv: string
  zshRc: string
  bashInit: string
  bashCombinedRc: string
  fishHook: string
  fishWrapperConfig: string
}

let shellIntegrationPaths: ShellIntegrationPaths | null = null
let shellIntegrationPromise: Promise<ShellIntegrationPaths> | null = null

let cachedShellEnv: { [key: string]: string } | null = null
let shellEnvPromise: Promise<{ [key: string]: string }> | null = null

function fileExists(filePath: string): Promise<boolean> {
  return access(filePath).then(() => true).catch(() => false)
}

export function parseEnvironmentOutput(output: string): { [key: string]: string } {
  const env: { [key: string]: string } = {}
  for (const line of output.split('\n')) {
    const eqIndex = line.indexOf('=')
    if (eqIndex <= 0) continue
    const key = line.slice(0, eqIndex)
    const value = line.slice(eqIndex + 1)
    env[key] = value
  }
  return env
}

export function buildShellIntegrationFiles(hostname: string, userFishConfigPath: string): ShellIntegrationFiles {
  const zshEnv = `# Frostty shell integration
# Set up OSC 7 directory reporting
__frostty_osc7() { printf '\\e]7;file://${hostname}%s\\a' "$PWD" }
autoload -Uz add-zsh-hook 2>/dev/null && add-zsh-hook chpwd __frostty_osc7
autoload -Uz add-zsh-hook 2>/dev/null && add-zsh-hook precmd __frostty_osc7

# Restore ZDOTDIR and source user's zsh config
export ZDOTDIR="$HOME"
[[ -f "$HOME/.zshenv" ]] && source "$HOME/.zshenv"
`

  const zshRc = `# Frostty: source user's zshrc
[[ -f "$HOME/.zshrc" ]] && source "$HOME/.zshrc"

# Prompt markers for keyboard selection boundaries.
if [[ -z "\${__FROSTTY_OSC133_INITIALIZED:-}" ]]; then
  __frostty_osc133_prompt_start() { printf '\\e]133;A\\a' }
  __frostty_osc133_command_start() { printf '\\e]133;C\\a' }
  autoload -Uz add-zsh-hook 2>/dev/null
  add-zsh-hook precmd __frostty_osc133_prompt_start
  add-zsh-hook preexec __frostty_osc133_command_start
  PROMPT="\${PROMPT}%{\\e]133;B\\a%}"
  export __FROSTTY_OSC133_INITIALIZED=1
fi

# Emit initial OSC 7
__frostty_osc7
`

  const bashInit = `# Frostty shell integration
__frostty_osc7() { printf '\\e]7;file://${hostname}%s\\a' "$PWD"; }
__frostty_osc133_prompt_start() { printf '\\e]133;A\\a'; }
__frostty_prompt_command() {
  __frostty_osc7
  __frostty_osc133_prompt_start
}
`

  const bashCombinedRc = `# Frostty bash integration
source "$FROSTTY_BASH_INIT"
[[ -f "$HOME/.bashrc" ]] && source "$HOME/.bashrc"

# Install hooks after user bashrc so user prompt customizations are preserved.
if [[ -n "$PROMPT_COMMAND" ]]; then
  PROMPT_COMMAND="__frostty_prompt_command;$PROMPT_COMMAND"
else
  PROMPT_COMMAND="__frostty_prompt_command"
fi

case "$PS1" in
  *$'\\e]133;B\\a'*) ;;
  *) PS1="\${PS1}\\[\\e]133;B\\a\\]" ;;
esac

__frostty_osc7
`

  const fishHook = `# Frostty fish shell integration
# Emit OSC 7 for directory tracking
function __frostty_osc7 --on-variable PWD --description 'Emit OSC 7 escape sequence'
    printf '\\e]7;file://${hostname}%s\\a' "$PWD"
end

# Emit initial OSC 7
__frostty_osc7
`

  const fishWrapperConfig = `# Frostty fish config wrapper
if test -f "${userFishConfigPath}"
    source "${userFishConfigPath}"
end
`

  return { zshEnv, zshRc, bashInit, bashCombinedRc, fishHook, fishWrapperConfig }
}

async function initializeShellIntegration(): Promise<ShellIntegrationPaths> {
  const hostname = os.hostname()
  const homeDir = os.homedir()
  const userDataPath = app.getPath('userData')
  const integrationDir = path.join(userDataPath, 'shell-integration')
  const zshDir = path.join(integrationDir, 'zsh')
  const bashInitPath = path.join(integrationDir, 'bash_init.sh')
  const bashCombinedRcPath = path.join(integrationDir, 'bashrc_combined')
  const fishDir = path.join(integrationDir, 'fish')
  const fishConfDir = path.join(fishDir, 'conf.d')
  const fishConfigPath = path.join(fishDir, 'config.fish')
  const fishHookPath = path.join(fishConfDir, 'frostty.fish')
  const userFishConfigPath = path.join(homeDir, '.config', 'fish', 'config.fish')

  const files = buildShellIntegrationFiles(hostname, userFishConfigPath)

  await mkdir(zshDir, { recursive: true })
  await mkdir(fishConfDir, { recursive: true })

  await writeFile(path.join(zshDir, '.zshenv'), files.zshEnv, 'utf8')
  await writeFile(path.join(zshDir, '.zshrc'), files.zshRc, 'utf8')
  await writeFile(bashInitPath, files.bashInit, 'utf8')
  await writeFile(
    bashCombinedRcPath,
    files.bashCombinedRc.replace('$FROSTTY_BASH_INIT', bashInitPath),
    'utf8'
  )
  await writeFile(fishHookPath, files.fishHook, 'utf8')

  if (await fileExists(userFishConfigPath)) {
    await writeFile(fishConfigPath, files.fishWrapperConfig, 'utf8')
  }

  return {
    integrationDir,
    zshDir,
    bashInitPath,
    bashCombinedRcPath,
    fishDir,
    fishConfigPath
  }
}

export async function ensureShellIntegration(): Promise<ShellIntegrationPaths> {
  if (shellIntegrationPaths) return shellIntegrationPaths
  if (shellIntegrationPromise) return shellIntegrationPromise

  shellIntegrationPromise = initializeShellIntegration()
    .then((paths) => {
      shellIntegrationPaths = paths
      return paths
    })
    .finally(() => {
      shellIntegrationPromise = null
    })

  return shellIntegrationPromise
}

export async function getShellEnvironment(): Promise<{ [key: string]: string }> {
  if (cachedShellEnv) return cachedShellEnv
  if (shellEnvPromise) return shellEnvPromise

  const homeDir = os.homedir()
  const shell = process.env.SHELL || '/bin/zsh'

  shellEnvPromise = (async () => {
    try {
      const { stdout } = await execAsync(`${shell} -l -i -c 'env'`, {
        encoding: 'utf8',
        timeout: 5000,
        maxBuffer: 2 * 1024 * 1024,
        env: {
          HOME: homeDir,
          USER: process.env.USER || '',
          SHELL: shell,
          TERM: 'xterm-256color'
        }
      })
      const env = parseEnvironmentOutput(stdout)
      cachedShellEnv = env
      return env
    } catch (error) {
      console.error('Failed to get shell environment:', error)
      return process.env as { [key: string]: string }
    }
  })()

  return shellEnvPromise
}

export function preloadShellEnvironment(): void {
  getShellEnvironment().catch(() => {})
  ensureShellIntegration().catch(() => {})
}

export function __resetShellIntegrationServiceForTests(): void {
  shellIntegrationPaths = null
  shellIntegrationPromise = null
  cachedShellEnv = null
  shellEnvPromise = null
}
