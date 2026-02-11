import { app } from 'electron'
import * as path from 'path'
import { readFile, writeFile, access } from 'fs/promises'
import type { AppSettings, Recents, Profile, ShellType } from '../shared/ipc'
import { DEFAULT_SETTINGS, DEFAULT_PROFILE, MAX_RECENT_ITEMS } from '../shared/ipc'

const SETTINGS_FILE = 'settings.json'
const RECENTS_FILE = 'recents.json'

function getFilePath(filename: string): string {
  return path.join(app.getPath('userData'), filename)
}

// ── Settings ────────────────────────────────────────────────────────────────

// Legacy settings shape (pre-profiles) for migration detection
interface LegacyAppSettings {
  defaultHomeDirectory?: string
  defaultShell?: ShellType
  openRouterApiKey?: string
  openRouterModel?: string
}

export async function loadSettingsFromDisk(): Promise<AppSettings> {
  try {
    const filePath = getFilePath(SETTINGS_FILE)

    try {
      await access(filePath)
    } catch {
      return { ...DEFAULT_SETTINGS, profiles: [...DEFAULT_SETTINGS.profiles] }
    }

    const raw = await readFile(filePath, 'utf-8')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(raw) as any

    // Detect old format: has defaultShell/defaultHomeDirectory but no profiles array
    if (!Array.isArray(parsed.profiles)) {
      const legacy = parsed as LegacyAppSettings
      const migratedProfile: Profile = {
        id: 'default',
        name: 'Default',
        shell: legacy.defaultShell ?? DEFAULT_PROFILE.shell,
        homeDirectory: legacy.defaultHomeDirectory ?? DEFAULT_PROFILE.homeDirectory,
        tabColor: DEFAULT_PROFILE.tabColor
      }
      const migrated: AppSettings = {
        profiles: [migratedProfile],
        defaultProfileId: 'default',
        openRouterApiKey: legacy.openRouterApiKey ?? DEFAULT_SETTINGS.openRouterApiKey,
        openRouterModel: legacy.openRouterModel ?? DEFAULT_SETTINGS.openRouterModel
      }
      // Write migrated settings back to disk immediately
      await saveSettingsToDisk(migrated)
      return migrated
    }

    // New format — load with defaults
    const settings: AppSettings = {
      profiles: parsed.profiles.length > 0
        ? parsed.profiles.map((p: Record<string, unknown>) => ({ ...DEFAULT_PROFILE, ...p }))
        : [...DEFAULT_SETTINGS.profiles],
      defaultProfileId: parsed.defaultProfileId ?? DEFAULT_SETTINGS.defaultProfileId,
      openRouterApiKey: parsed.openRouterApiKey ?? DEFAULT_SETTINGS.openRouterApiKey,
      openRouterModel: parsed.openRouterModel ?? DEFAULT_SETTINGS.openRouterModel
    }
    return settings
  } catch (err) {
    console.error('Failed to load settings:', err)
    return { ...DEFAULT_SETTINGS, profiles: [...DEFAULT_SETTINGS.profiles] }
  }
}

export async function saveSettingsToDisk(settings: AppSettings): Promise<void> {
  try {
    const filePath = getFilePath(SETTINGS_FILE)
    await writeFile(filePath, JSON.stringify(settings), 'utf-8')
  } catch (err) {
    console.error('Failed to save settings:', err)
  }
}

// ── Recents ─────────────────────────────────────────────────────────────────

const DEFAULT_RECENTS: Recents = {
  recentCommands: [],
  recentProjects: []
}

export async function loadRecentsFromDisk(): Promise<Recents> {
  try {
    const filePath = getFilePath(RECENTS_FILE)

    try {
      await access(filePath)
    } catch {
      return { ...DEFAULT_RECENTS }
    }

    const raw = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Recents>
    return {
      recentCommands: Array.isArray(parsed.recentCommands)
        ? parsed.recentCommands.slice(0, MAX_RECENT_ITEMS)
        : [],
      recentProjects: Array.isArray(parsed.recentProjects)
        ? parsed.recentProjects.slice(0, MAX_RECENT_ITEMS)
        : []
    }
  } catch (err) {
    console.error('Failed to load recents:', err)
    return { ...DEFAULT_RECENTS }
  }
}

export async function saveRecentCommandToDisk(commandId: string): Promise<void> {
  const recents = await loadRecentsFromDisk()
  const filtered = recents.recentCommands.filter((id) => id !== commandId)
  recents.recentCommands = [commandId, ...filtered].slice(0, MAX_RECENT_ITEMS)
  await saveRecentsToDisk(recents)
}

export async function saveRecentProjectToDisk(projectPath: string): Promise<void> {
  const recents = await loadRecentsFromDisk()
  const filtered = recents.recentProjects.filter((p) => p !== projectPath)
  recents.recentProjects = [projectPath, ...filtered].slice(0, MAX_RECENT_ITEMS)
  await saveRecentsToDisk(recents)
}

async function saveRecentsToDisk(recents: Recents): Promise<void> {
  try {
    const filePath = getFilePath(RECENTS_FILE)
    await writeFile(filePath, JSON.stringify(recents), 'utf-8')
  } catch (err) {
    console.error('Failed to save recents:', err)
  }
}
