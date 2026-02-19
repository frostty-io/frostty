import { describe, it, expect, beforeEach } from 'vitest'
import {
  clearAllPtyCwd,
  clearPtyCwd,
  getCachedPtyCwd,
  getPtyCwdUpdatedAt,
  isPtyCwdFresh,
  updatePtyCwd
} from './ptyCwdService'

describe('ptyCwdService', () => {
  beforeEach(() => {
    clearAllPtyCwd()
  })

  it('stores and reads cached cwd values', () => {
    updatePtyCwd('pane-1', '~/repo', 1000)
    expect(getCachedPtyCwd('pane-1')).toBe('~/repo')
    expect(getPtyCwdUpdatedAt('pane-1')).toBe(1000)
  })

  it('reports freshness based on max age', () => {
    updatePtyCwd('pane-1', '~/repo', 1000)
    expect(isPtyCwdFresh('pane-1', 5000, 4000)).toBe(true)
    expect(isPtyCwdFresh('pane-1', 2000, 4000)).toBe(false)
  })

  it('clears tab entries', () => {
    updatePtyCwd('pane-1', '~/repo', 1000)
    clearPtyCwd('pane-1')
    expect(getCachedPtyCwd('pane-1')).toBeNull()
  })
})
