import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePlatform } from '../../hooks/usePlatform'

describe('usePlatform', () => {
  it('returns platform info', () => {
    const { result } = renderHook(() => usePlatform())
    expect(result.current).toHaveProperty('isMac')
    expect(result.current).toHaveProperty('modKey')
    expect(result.current).toHaveProperty('modSymbol')
  })

  it('returns consistent values across renders', () => {
    const { result, rerender } = renderHook(() => usePlatform())
    const first = result.current
    rerender()
    expect(result.current).toEqual(first)
  })
})
