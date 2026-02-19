import { describe, it, expect } from 'vitest'
import {
  SYSTEM_STATS_POLL_INTERVAL,
  SYSTEM_STATS_CACHE_MS,
  GIT_STATUS_POLL_INTERVAL,
  GIT_REPO_INFO_CACHE_MS,
  CWD_POLL_INTERVAL,
  CWD_POLL_STALE_MS,
  SESSION_SAVE_TIMEOUT,
  GIT_MAX_BUFFER,
  TERMINAL_SCROLLBACK,
  REPO_SCAN_CONCURRENCY,
  SPLIT_PANE_MIN_PCT,
  SPLIT_PANE_MAX_PCT,
  SPLIT_PANE_DEFAULT_PCT,
  DND_ACTIVATION_DISTANCE,
  AI_SPINNER_FRAMES,
  AI_SPINNER_INTERVAL
} from '../constants'

describe('shared/constants', () => {
  it('defines polling intervals as positive numbers', () => {
    expect(SYSTEM_STATS_POLL_INTERVAL).toBeGreaterThan(0)
    expect(SYSTEM_STATS_CACHE_MS).toBeGreaterThan(0)
    expect(GIT_STATUS_POLL_INTERVAL).toBeGreaterThan(0)
    expect(GIT_REPO_INFO_CACHE_MS).toBeGreaterThan(0)
    expect(CWD_POLL_INTERVAL).toBeGreaterThan(0)
    expect(CWD_POLL_STALE_MS).toBeGreaterThan(0)
  })

  it('defines timeouts as positive numbers', () => {
    expect(SESSION_SAVE_TIMEOUT).toBeGreaterThan(0)
  })

  it('defines buffer size as positive', () => {
    expect(GIT_MAX_BUFFER).toBeGreaterThan(0)
  })

  it('defines terminal scrollback as positive', () => {
    expect(TERMINAL_SCROLLBACK).toBeGreaterThan(0)
  })

  it('defines valid split pane constraints', () => {
    expect(SPLIT_PANE_MIN_PCT).toBeGreaterThan(0)
    expect(SPLIT_PANE_MAX_PCT).toBeLessThan(100)
    expect(SPLIT_PANE_MIN_PCT).toBeLessThan(SPLIT_PANE_MAX_PCT)
    expect(SPLIT_PANE_DEFAULT_PCT).toBeGreaterThanOrEqual(SPLIT_PANE_MIN_PCT)
    expect(SPLIT_PANE_DEFAULT_PCT).toBeLessThanOrEqual(SPLIT_PANE_MAX_PCT)
  })

  it('defines DnD activation distance', () => {
    expect(DND_ACTIVATION_DISTANCE).toBeGreaterThan(0)
  })

  it('defines repo scan concurrency as positive', () => {
    expect(REPO_SCAN_CONCURRENCY).toBeGreaterThan(0)
  })

  it('defines AI spinner frames as non-empty array', () => {
    expect(AI_SPINNER_FRAMES.length).toBeGreaterThan(0)
    expect(AI_SPINNER_INTERVAL).toBeGreaterThan(0)
  })
})
