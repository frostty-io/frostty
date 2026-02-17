import { app } from 'electron'
import * as path from 'path'
import { readFile, writeFile, access } from 'fs/promises'
import type { AppSettings, Recents } from '../shared/ipc'
import { DEFAULT_SETTINGS, DEFAULT_PROFILE, MAX_RECENT_ITEMS } from '../shared/ipc'
import { clampShellFontSize } from '../shared/constants'

const SETTINGS_FILE = 'settings.json'
const RECENTS_FILE = 'recents.json'

function getFilePath(filename: string): string {
  return path.join(app.getPath('userData'), filename)
}

// ── Settings ────────────────────────────────────────────────────────────────

export async function loadSettingsFromDisk(): Promise<AppSettings> {
  try {
    const filePath = getFilePath(SETTINGS_FILE)

    try {
      await access(filePath)
    } catch {
      return { ...DEFAULT_SETTINGS, profiles: [...DEFAULT_SETTINGS.profiles] }
    }

    const raw = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppSettings> & { profiles?: unknown }
    const parsedProfiles = Array.isArray(parsed.profiles) ? parsed.profiles : []

    const settings: AppSettings = {
      profiles: parsedProfiles.length > 0
        ? parsedProfiles.map((p) => ({
          ...DEFAULT_PROFILE,
          ...(typeof p === 'object' && p !== null ? p : {}),
          shellFontSize: clampShellFontSize(
            typeof p === 'object' && p !== null ? (p as { shellFontSize?: unknown }).shellFontSize : undefined
          )
        }))
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
