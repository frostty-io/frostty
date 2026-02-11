import { useCallback } from 'react'
import { useSensor, useSensors, PointerSensor, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core'
import { useTabStore } from '../stores/useTabStore'
import { useUIStore } from '../stores/useUIStore'
import { DND_ACTIVATION_DISTANCE } from '../../../shared/constants'

/**
 * Hook for handling tab drag-and-drop interactions.
 */
export function useDragAndDrop() {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DND_ACTIVATION_DISTANCE }
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    useUIStore.getState().setActiveDragId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    const activeId = active.id as string
    const overId = over?.id as string | undefined
    const tabStore = useTabStore.getState()

    if (overId && activeId !== overId) {
      if (overId === 'drop-left' || overId === 'drop-right') {
        const position = overId === 'drop-left' ? 'left' : 'right'
        tabStore.splitDropTab(activeId, position)
      } else {
        const activeIndex = tabStore.tabs.findIndex((t) => t.id === activeId)
        const overIndex = tabStore.tabs.findIndex((t) => t.id === overId)
        if (activeIndex !== -1 && overIndex !== -1) {
          tabStore.reorderTabs(activeIndex, overIndex)
        }
      }
    }

    useUIStore.getState().setActiveDragId(null)
  }, [])

  const handleDragCancel = useCallback(() => {
    useUIStore.getState().setActiveDragId(null)
  }, [])

  return { sensors, handleDragStart, handleDragEnd, handleDragCancel }
}
