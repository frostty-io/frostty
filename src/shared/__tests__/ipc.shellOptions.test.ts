import { describe, it, expect } from 'vitest'
import { SHELL_OPTIONS } from '../ipc'

describe('SHELL_OPTIONS', () => {
  it('includes Nushell option', () => {
    const nuOption = SHELL_OPTIONS.find((option) => option.value === 'nu')
    expect(nuOption).toBeDefined()
    expect(nuOption?.label).toBe('Nushell')
  })
})
