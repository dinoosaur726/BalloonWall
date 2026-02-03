import { useEffect, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
  pointerWithin
} from '@dnd-kit/core'
import { useStore } from './store'
import { Stack } from './components/Stack'
import { Card } from './components/Card'
import { SettingsModal } from './components/SettingsModal'

// Global window type is handled by electron-env.d.ts

function App() {
  const { stacks, cards, addCard, moveCardsToStack, moveCardsToCanvas, settings, initSettings, updateStackScale } = useStore()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [dragStartPos, setDragStartPos] = useState<{ x: number, y: number } | null>(null)

  // Interaction State for Dynamic Background
  const [isInteracting, setIsInteracting] = useState(false)
  const [interactionTimer, setInteractionTimer] = useState<NodeJS.Timeout | null>(null)

  const triggerInteraction = () => {
    setIsInteracting(true)
    if (interactionTimer) clearTimeout(interactionTimer)
    const timer = setTimeout(() => {
      setIsInteracting(false)
    }, 1000) // Keep background for 1s after action
    setInteractionTimer(timer)
  }

  const { setNodeRef: setCanvasRef } = useDroppable({
    id: 'canvas'
  })

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor)
  )

  // Initialize and Listeners
  useEffect(() => {
    window.ipcRenderer.invoke('get-settings').then((savedSettings) => {
      if (savedSettings) initSettings(savedSettings)
    }).catch(err => console.error(err))

    const handleNewDonation = (_event: any, data: { nickname: string, amount: number }) => {
      addCard(data.nickname, data.amount)
    }

    window.ipcRenderer.on('new-donation', handleNewDonation)

    // Global Hotkey: Escape opens settings (Exit Broadcast Mode)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSettings(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.ipcRenderer.off('new-donation', handleNewDonation)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Drag Logic
  const handleDragStart = (event: DragStartEvent) => {
    setIsInteracting(true) // Keep on while dragging
    if (interactionTimer) clearTimeout(interactionTimer)

    setActiveId(event.active.id as string)

    // Store initial position of the stack/card being dragged to apply delta?
    // Actually dnd-kit delta is relative to start.
    // We need the *original* stack position to calculate new absolute position.

    // Find source stack
    const sourceStackEntry = Object.values(stacks).find(s => s.cardIds.includes(event.active.id as string))
    if (sourceStackEntry) {
      setDragStartPos({ x: sourceStackEntry.x, y: sourceStackEntry.y })
    }
  }

  // Helper to find dragged group
  const getDraggedGroup = (activeId: string | null) => {
    if (!activeId) return []
    const sourceStackEntry = Object.values(stacks).find(s => s.cardIds.includes(activeId))
    if (!sourceStackEntry) return []
    const index = sourceStackEntry.cardIds.indexOf(activeId)
    // Logic: Select index and everything BEFORE it (Top of stack)
    // Array: [Top (0), ..., Selected (i), ..., Bottom (n)]
    // We want [0...i]
    return sourceStackEntry.cardIds.slice(0, index + 1)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    triggerInteraction() // Trigger timeout on release
    const { active, over, delta } = event
    setActiveId(null)
    setDragStartPos(null)

    const draggedGroup = getDraggedGroup(active.id as string)
    if (draggedGroup.length === 0) return

    // Case 1: Dropped on another Stack (Merge)
    if (over && over.id !== 'canvas') {
      // Find which stack we dropped on
      // over.id might be a card inside a stack or the stack itself
      let targetStackId = over.id as string

      // If dropped on a card, find its stack
      const targetStackEntry = Object.entries(stacks).find(([sId, s]) => sId === targetStackId || s.cardIds.includes(targetStackId))
      if (targetStackEntry) {
        targetStackId = targetStackEntry[0]
        moveCardsToStack(draggedGroup, targetStackId)
        return
      }
    }

    // Case 2: Dropped on Canvas (or null/empty space) -> Move/Create Stack
    // Default to canvas drop if no other target found, and we have a start pos
    if (dragStartPos) {
      // Calculate new X, Y
      const newX = dragStartPos.x + delta.x
      const newY = dragStartPos.y + delta.y

      // Snapping Logic
      const SNAP_DIST = 20
      const WINDOW_W = window.innerWidth
      const WINDOW_H = window.innerHeight

      // Calculate Dimensions of Dragged Group
      // 1rem = 16px.
      const REM = 16
      // We need source stack scale.
      const sourceStackEntry = Object.values(stacks).find(s => s.cardIds.includes(active.id as string))
      const currentScale = sourceStackEntry ? sourceStackEntry.scale : 1

      const cardWidth = 8 * REM * currentScale
      const cardCount = draggedGroup.length
      const totalHeight = ((cardCount - 1) * 2.5 + 9) * REM * currentScale

      let finalX = newX
      let finalY = newY

      // --- Window Edge Snapping ---
      if (finalX < SNAP_DIST) finalX = 0
      if (finalY < SNAP_DIST) finalY = 0
      if (finalX + cardWidth > WINDOW_W - SNAP_DIST) finalX = WINDOW_W - cardWidth
      if (finalY + totalHeight > WINDOW_H - SNAP_DIST) finalY = WINDOW_H - totalHeight

      // --- Stack-to-Stack Side Snapping ---
      // Iterate all OTHER stacks
      for (const stack of Object.values(stacks)) {
        // Skip self (if moving whole stack)
        // If splitting, we are creating a NEW stack, so we shouldn't snap to "source stack"? 
        // Actually, if we split, the source stack is at original pos. We CAN snap to it side-by-side. 
        // But we must skip snapping to ourself if we are moving the WHOLE stack.
        if (activeId && stack.cardIds.includes(activeId) && draggedGroup.length === stack.cardIds.length) {
          continue
        }

        // Calculate Other Stack Dimensions
        const otherScale = stack.scale
        const otherW = 8 * REM * otherScale
        // We usually care about Width for side snapping.

        // Snap to Right Side of Other (My Left -> Other Right)
        // Distance between My Left (finalX) and Other Right (stack.x + otherW)
        if (Math.abs(finalX - (stack.x + otherW)) < SNAP_DIST) {
          finalX = stack.x + otherW + 1 // Add 1px buffer to avoid overlap visual
          // Auto Align Top if close
          if (Math.abs(finalY - stack.y) < SNAP_DIST) finalY = stack.y
        }

        // Snap to Left Side of Other (My Right -> Other Left)
        // Distance between My Right (finalX + cardWidth) and Other Left (stack.x)
        if (Math.abs((finalX + cardWidth) - stack.x) < SNAP_DIST) {
          finalX = stack.x - cardWidth - 1 // Add 1px buffer
          // Auto Align Top if close
          if (Math.abs(finalY - stack.y) < SNAP_DIST) finalY = stack.y
        }
      }

      moveCardsToCanvas(draggedGroup, finalX, finalY)
    }
  }

  const draggedGroupCards = getDraggedGroup(activeId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Custom Drag Handle (Visible when UI is shown) */}
      <div
        className={`fixed top-0 left-0 w-full h-8 z-[9000] transition-opacity hover:bg-white/10 ${settings.hideUI ? 'hidden' : 'block cursor-move'}`}
        style={{ WebkitAppRegion: 'drag' } as any}
      />

      <button
        onClick={() => setShowSettings(true)}
        style={{ zIndex: 9999, WebkitAppRegion: 'no-drag' } as any} // Ensure button is always clickable and not draggable
        className={`fixed top-6 right-6 p-3 bg-black/40 text-white/70 rounded-full hover:bg-black/60 hover:text-white hover:scale-110 active:scale-95 transition-all pointer-events-auto backdrop-blur-md shadow-lg border border-white/5 ${settings.hideUI ? 'hidden' : ''}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15-.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Main Typeset / Canvas */}
      <div
        ref={setCanvasRef}
        className={`relative w-full h-full pointer-events-auto transition-colors duration-300 overflow-hidden ${settings.isGreenScreen ? 'bg-[#00b140]' :
          (settings.isTransparent && (activeId || isInteracting)) ? 'bg-black/60' : // Visible on interaction
            settings.isTransparent ? 'bg-transparent' : 'bg-[#222]'
          }`}
        style={{
          backgroundColor: settings.isGreenScreen ? '#00b140' :
            (settings.isTransparent && (activeId || isInteracting)) ? 'rgba(0,0,0,0.6)' :
              settings.isTransparent ? 'transparent' : '#222'
        }}
      >
        {Object.values(stacks).map(stack => {
          const scale = stack.scale

          return (
            <Stack key={stack.id} id={stack.id} x={stack.x} y={stack.y} scale={scale} onScale={(delta) => {
              triggerInteraction()
              updateStackScale(stack.id, delta)
            }}>
              {stack.cardIds.map((cardId, index) => {
                const isGhost = activeId && (activeId === cardId || draggedGroupCards.includes(cardId))
                // If moving whole stack, hide original? 
                // draggedGroup logic handles it.

                const cardData = cards[cardId]
                if (!cardData) return null

                // Overlap matches previous logic
                const dynamicMargin = index > 0 ? `-${6.5 * scale}rem` : '0'

                // Reversed Z-Index so top cards cover bottom cards (showing text at bottom of top card)
                const zIndex = 50 - index

                return (
                  <div
                    key={cardId}
                    className={isGhost ? "opacity-0" : "opacity-100"}
                    style={{
                      marginTop: dynamicMargin,
                      zIndex: zIndex
                    }}
                  >
                    <Card
                      {...cardData}
                      index={index}
                      scale={scale}
                    />
                  </div>
                )
              })}
            </Stack>
          )
        })}
      </div>

      <DragOverlay zIndex={10000} dropAnimation={null}>
        {activeId && (
          <div
            className="flex flex-col items-center pb-4 border-2 border-transparent"
            style={{
              // Offset calculation to align Clicked Card with Cursor
              marginTop: `-${(draggedGroupCards.length - 1) * 2.5 * (Object.values(stacks).find(s => s.cardIds.includes(activeId))?.scale || 1)}rem`
            }}
          >
            {draggedGroupCards.map((cardId, i) => {
              const cardData = cards[cardId]
              if (!cardData) return null
              // Overlay Scale: Source scale
              const sourceStack = Object.values(stacks).find(s => s.cardIds.includes(activeId))
              const scale = sourceStack ? sourceStack.scale : 1

              const dynamicMargin = i > 0 ? `-${6.5 * scale}rem` : '0'

              return (
                <div
                  key={cardId}
                  style={{
                    marginTop: dynamicMargin,
                    zIndex: 50 - i // Internal reverse stacking
                  }}
                >
                  <Card
                    {...cardData}
                    index={i}
                    scale={scale}
                    isOverlay
                  />
                </div>
              )
            })}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
export default App
