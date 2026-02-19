import { describe, it, expect } from 'vitest'
import { appendPtyChunk } from './ptyBatching'

describe('ptyBatching', () => {
  it('tracks cumulative bytes incrementally', () => {
    const entry = { chunks: [] as string[], bytes: 0 }

    const first = appendPtyChunk(entry, 'hello')
    const second = appendPtyChunk(entry, 'world')

    expect(first).toBe(5)
    expect(second).toBe(10)
    expect(entry.chunks).toEqual(['hello', 'world'])
    expect(entry.bytes).toBe(10)
  })
})
