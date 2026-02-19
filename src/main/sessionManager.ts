import { app } from 'electron'
import * as path from 'path'
import { readFile, writeFile, unlink, access } from 'fs/promises'
import type { SessionData } from '../shared/ipc'

const SESSION_FILE = 'session.json'

function getSessionPath(): string {
  return path.join(app.getPath('userData'), SESSION_FILE)
}

export async function saveSession(data: SessionData): Promise<void> {
  try {
    const filePath = getSessionPath()
    await writeFile(filePath, JSON.stringify(data), 'utf-8')
  } catch (err) {
    console.error('Failed to save session:', err)
  }
}

export async function loadSession(): Promise<SessionData | null> {
  try {
    const filePath = getSessionPath()

    // Check if file exists
    try {
      await access(filePath)
    } catch {
      return null
    }

    const raw = await readFile(filePath, 'utf-8')
    const data = JSON.parse(raw) as SessionData

    // Basic validation
    if (!data || data.version !== 1 || !Array.isArray(data.windows)) {
      return null
    }

    return data
  } catch (err) {
    console.error('Failed to load session:', err)
    return null
  }
}

export async function clearSession(): Promise<void> {
  try {
    const filePath = getSessionPath()
    await unlink(filePath)
  } catch (err) {
    // File might not exist — that's fine
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Failed to clear session:', err)
    }
  }
}
