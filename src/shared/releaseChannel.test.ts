import { describe, expect, it } from 'vitest'
import {
  normalizeReleaseChannel,
  getUpdaterChannel,
  shouldAllowPrerelease,
  getRuntimeLogoFilename
} from './releaseChannel'

describe('releaseChannel', () => {
  it('normalizes channel values to stable or canary', () => {
    expect(normalizeReleaseChannel('stable')).toBe('stable')
    expect(normalizeReleaseChannel('canary')).toBe('canary')
    expect(normalizeReleaseChannel('random-value')).toBe('stable')
    expect(normalizeReleaseChannel(undefined)).toBe('stable')
  })

  it('maps release channels to updater channels', () => {
    expect(getUpdaterChannel('stable')).toBe('latest')
    expect(getUpdaterChannel('canary')).toBe('canary')
    expect(getUpdaterChannel(undefined)).toBe('latest')
  })

  it('sets prerelease allowance for canary only', () => {
    expect(shouldAllowPrerelease('canary')).toBe(true)
    expect(shouldAllowPrerelease('stable')).toBe(false)
    expect(shouldAllowPrerelease(undefined)).toBe(false)
  })

  it('returns runtime logo filenames by channel', () => {
    expect(getRuntimeLogoFilename('stable')).toBe('logo.png')
    expect(getRuntimeLogoFilename('canary')).toBe('logo_canary.png')
    expect(getRuntimeLogoFilename(undefined)).toBe('logo.png')
  })
})
