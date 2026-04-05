import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateCommand } from './aiService'

describe('generateCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('extracts command from nu code fences when response is not JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '```nu\nls | where type == dir\n```'
            }
          }
        ]
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await generateCommand({
      instruction: 'list directories',
      shell: 'nu',
      cwd: '~',
      apiKey: 'test-key',
      model: 'test-model'
    })

    expect(result).toEqual({
      success: true,
      command: 'ls | where type == dir'
    })
  })
})
