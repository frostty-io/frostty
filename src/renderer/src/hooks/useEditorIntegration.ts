import { useCallback } from 'react'
import { toast } from 'sonner'

export function useEditorIntegration(cwd: string | null) {
  const openInVSCode = useCallback(async () => {
    if (!cwd) {
      toast.error('No active directory')
      return
    }
    try {
      await window.electronAPI.openInVSCode(cwd)
      toast.success('Opened in VS Code')
    } catch (err) {
      toast.error('Failed to open in VS Code: ' + (err as Error).message)
    }
  }, [cwd])

  const openInCursor = useCallback(async () => {
    if (!cwd) {
      toast.error('No active directory')
      return
    }
    try {
      await window.electronAPI.openInCursor(cwd)
      toast.success('Opened in Cursor')
    } catch (err) {
      toast.error('Failed to open in Cursor: ' + (err as Error).message)
    }
  }, [cwd])

  return { openInVSCode, openInCursor }
}
