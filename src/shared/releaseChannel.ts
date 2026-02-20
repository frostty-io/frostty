export type ReleaseChannel = 'stable' | 'canary'
export type UpdaterChannel = 'latest' | 'canary'

export function normalizeReleaseChannel(value: string | undefined): ReleaseChannel {
  return value === 'canary' ? 'canary' : 'stable'
}

export function getUpdaterChannel(value: string | undefined): UpdaterChannel {
  return normalizeReleaseChannel(value) === 'canary' ? 'canary' : 'latest'
}

export function shouldAllowPrerelease(value: string | undefined): boolean {
  return normalizeReleaseChannel(value) === 'canary'
}

export function getRuntimeLogoFilename(value: string | undefined): 'logo.png' | 'logo_canary.png' {
  return normalizeReleaseChannel(value) === 'canary' ? 'logo_canary.png' : 'logo.png'
}
