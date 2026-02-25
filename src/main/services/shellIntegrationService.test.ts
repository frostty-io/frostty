import { describe, it, expect, beforeEach } from 'vitest'
import {
  __resetShellIntegrationServiceForTests,
  buildShellIntegrationFiles,
  parseEnvironmentOutput
} from './shellIntegrationService'

describe('shellIntegrationService helpers', () => {
  beforeEach(() => {
    __resetShellIntegrationServiceForTests()
  })

  it('parses environment key/value output', () => {
    const parsed = parseEnvironmentOutput('PATH=/usr/bin\nSHELL=/bin/zsh\nEMPTY=\ninvalid-line')
    expect(parsed.PATH).toBe('/usr/bin')
    expect(parsed.SHELL).toBe('/bin/zsh')
    expect(parsed.EMPTY).toBe('')
    expect(parsed['invalid-line']).toBeUndefined()
  })

  it('builds integration scripts with expected shell hooks', () => {
    const files = buildShellIntegrationFiles('example-host', '/Users/test/.config/fish/config.fish')
    expect(files.zshEnv).toContain('__frostty_osc7')
    expect(files.zshRc).toContain('133;A')
    expect(files.zshRc).toContain('133;B')
    expect(files.bashInit).toContain('__frostty_prompt_command')
    expect(files.bashCombinedRc).toContain('133;B')
    expect(files.fishHook).toContain('--on-variable PWD')
    expect(files.fishWrapperConfig).toContain('/Users/test/.config/fish/config.fish')
  })
})
