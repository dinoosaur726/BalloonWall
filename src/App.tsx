import { useEffect, useState, useRef } from 'react'
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
import UpdateNotification from './components/UpdateNotification'
import { LicenseGate } from './components/LicenseGate'
import { isElectron } from './utils/env'
import {
  REM,
  STEP_REM,
  CARD_WIDTH_REM,
  BASE_HEIGHT_REM,
  SNAP_DIST_PX,
  IMG_HEIGHT_REM
} from './constants'

// Augment React CSSProperties for Electron Drag Regions
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}

// Global window type is handled by electron-env.d.ts

function App() {
  const { stacks, cards, handleDonation, moveCardsToStack, moveCardsToCanvas, initSettings, updateStackScale, loadState } = useStore()

  const inElectron = isElectron()


  const [activeId, setActiveId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [dragStartPos, setDragStartPos] = useState<{ x: number, y: number } | null>(null)

  // WebSocket ref for browser mode
  const wsRef = useRef<WebSocket | null>(null)

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
    if (inElectron) {
      // ─── Electron Mode ───
      window.ipcRenderer.invoke('get-settings').then((savedSettings) => {
        if (savedSettings) initSettings(savedSettings)
      }).catch(err => console.error(err))

      const handleNewDonation = (_event: any, data: { nickname: string, amount: number }) => {
        window.ipcRenderer.send('log', `[App] Received donation: ${data.nickname}/${data.amount}`);
        handleDonation(data.nickname, data.amount)
      }

      // Defensive: Remove any existing listeners first
      window.ipcRenderer.removeAllListeners('new-donation')
      window.ipcRenderer.on('new-donation', handleNewDonation)

      // Global Hotkey: Escape opens settings (Exit Broadcast Mode)
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setShowSettings(prev => !prev)
        }
      }
      window.addEventListener('keydown', handleKeyDown)

      return () => {
        window.ipcRenderer.removeAllListeners('new-donation')
        window.removeEventListener('keydown', handleKeyDown)
      }
    } else {
      // ─── Browser Mode (OBS Browser Source) ───
      // Connect to WebSocket server to receive state updates
      const connectWs = () => {
        // Determine WS port from URL params or default
        const urlParams = new URLSearchParams(window.location.search)
        const wsPort = urlParams.get('wsPort') || '3005'
        const wsHost = window.location.hostname || 'localhost'
        const wsUrl = `ws://${wsHost}:${wsPort}`

        console.log(`[BrowserMode] Connecting to WebSocket: ${wsUrl}`)
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('[BrowserMode] WebSocket connected')
        }

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)

            if (msg.type === 'full-state' || msg.type === 'state-update') {
              const { cards, stacks, settings: syncSettings, history } = msg.payload
              // Load the synced state into the store
              loadState({
                cards: cards || {},
                stacks: stacks || {},
                settings: syncSettings ? { ...useStore.getState().settings, ...syncSettings } : useStore.getState().settings,
                history: history || []
              } as any)
            }
          } catch (err) {
            console.error('[BrowserMode] Failed to parse WS message:', err)
          }
        }

        ws.onclose = () => {
          console.log('[BrowserMode] WebSocket disconnected, reconnecting in 3s...')
          setTimeout(connectWs, 3000)
        }

        ws.onerror = (err) => {
          console.error('[BrowserMode] WebSocket error:', err)
          ws.close()
        }
      }

      connectWs()

      return () => {
        if (wsRef.current) {
          wsRef.current.close()
          wsRef.current = null
        }
      }
    }
  }, [])

  // Drag Logic
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)

    // Find source stack to store initial position
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
    // Select index and everything BEFORE it (Top of stack)
    return sourceStackEntry.cardIds.slice(0, index + 1)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event
    setActiveId(null)
    setDragStartPos(null)

    const draggedGroup = getDraggedGroup(active.id as string)
    if (draggedGroup.length === 0) return

    // Case 1: Dropped on another Stack (Merge)
    if (over && over.id !== 'canvas') {
      let targetStackId = over.id as string

      // If dropped on a card, find its stack
      const targetStackEntry = Object.entries(stacks).find(([sId, s]) => sId === targetStackId || s.cardIds.includes(targetStackId))
      if (targetStackEntry) {
        targetStackId = targetStackEntry[0]
        moveCardsToStack(draggedGroup, targetStackId)
        return
      }
    }

    // Case 2: Dropped on Canvas -> Move/Create Stack
    if (dragStartPos) {
      const newX = dragStartPos.x + delta.x
      const newY = dragStartPos.y + delta.y

      const WINDOW_W = window.innerWidth
      const WINDOW_H = window.innerHeight

      const sourceStackEntry = Object.values(stacks).find(s => s.cardIds.includes(active.id as string))
      const currentScale = sourceStackEntry ? sourceStackEntry.scale : 1

      const cardWidth = CARD_WIDTH_REM * REM * currentScale
      const cardCount = draggedGroup.length
      const totalHeight = ((cardCount - 1) * STEP_REM + BASE_HEIGHT_REM) * REM * currentScale

      let finalX = newX
      let finalY = newY

      // --- Window Edge Snapping ---
      if (finalX < SNAP_DIST_PX) finalX = 0
      if (finalY < SNAP_DIST_PX) finalY = 0
      if (finalX + cardWidth > WINDOW_W - SNAP_DIST_PX) finalX = WINDOW_W - cardWidth
      if (finalY + totalHeight > WINDOW_H - SNAP_DIST_PX) finalY = WINDOW_H - totalHeight

      // --- Stack-to-Stack Side Snapping ---
      for (const stack of Object.values(stacks)) {
        // Skip self if moving whole stack with same ID (though usually we split off)
        if (activeId && stack.cardIds.includes(activeId) && draggedGroup.length === stack.cardIds.length) {
          continue
        }

        const otherScale = stack.scale
        const otherW = CARD_WIDTH_REM * REM * otherScale

        // Snap to Right Side of Other
        if (Math.abs(finalX - (stack.x + otherW)) < SNAP_DIST_PX) {
          finalX = stack.x + otherW + 1
          if (Math.abs(finalY - stack.y) < SNAP_DIST_PX) finalY = stack.y
        }

        // Snap to Left Side of Other
        if (Math.abs((finalX + cardWidth) - stack.x) < SNAP_DIST_PX) {
          finalX = stack.x - cardWidth - 1
          if (Math.abs(finalY - stack.y) < SNAP_DIST_PX) finalY = stack.y
        }
      }

      moveCardsToCanvas(draggedGroup, finalX, finalY)
    }
  }

  const draggedGroupCards = getDraggedGroup(activeId)

  // ─── Background Logic ───
  // Browser mode: always transparent
  // Electron mode: follows settings
  const getBackgroundClass = () => {
    if (!inElectron) {
      // OBS Browser Source: always transparent
      return 'bg-transparent'
    }
    return 'bg-[#222]'
  }

  return (
    <LicenseGate>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Custom Drag Handle — Electron only */}
        {inElectron && (
          <div
            className="fixed top-0 left-0 w-full h-8 z-[9000] transition-opacity hover:bg-white/10 block cursor-move"
            style={{ WebkitAppRegion: 'drag' }}
          />
        )}

        {/* Settings Button — Electron only */}
        {inElectron && (
          <button
            onClick={() => setShowSettings(true)}
            style={{ zIndex: 9999, WebkitAppRegion: 'no-drag' }}
            className="fixed top-6 right-6 p-3 bg-black/40 text-white/70 rounded-full hover:bg-black/60 hover:text-white hover:scale-110 active:scale-95 transition-all pointer-events-auto backdrop-blur-md shadow-lg border border-white/5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15-.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        )}

        {/* Settings Modal — Electron only */}
        {inElectron && showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

        {/* Update Notification — Electron only */}
        {inElectron && <UpdateNotification />}

        {/* Main Typeset / Canvas */}
        <div
          ref={setCanvasRef}
          className={`relative w-full h-full pointer-events-auto transition-colors duration-300 overflow-hidden ${getBackgroundClass()}`}
        >
          {Object.values(stacks).map(stack => {
            const scale = stack.scale

            return (
              <Stack key={stack.id} id={stack.id} x={stack.x} y={stack.y} scale={scale} onScale={(delta) => {
                updateStackScale(stack.id, delta)
              }}>
                {stack.cardIds.map((cardId, index) => {
                  const isGhost = activeId && (activeId === cardId || draggedGroupCards.includes(cardId))

                  const cardData = cards[cardId]
                  if (!cardData) return null

                  const dynamicMargin = index > 0 ? `-${IMG_HEIGHT_REM * scale}rem` : '0'
                  const zIndex = 50 - index
                  const shouldHideImage = index > 0

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
                        hideImage={shouldHideImage}
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
                marginTop: `-${(draggedGroupCards.length - 1) * STEP_REM * (Object.values(stacks).find(s => s.cardIds.includes(activeId))?.scale || 1)}rem`
              }}
            >
              {draggedGroupCards.map((cardId, i) => {
                const cardData = cards[cardId]
                if (!cardData) return null
                const sourceStack = Object.values(stacks).find(s => s.cardIds.includes(activeId))
                const scale = sourceStack ? sourceStack.scale : 1

                const dynamicMargin = i > 0 ? `-${IMG_HEIGHT_REM * scale}rem` : '0'

                return (
                  <div
                    key={cardId}
                    style={{
                      marginTop: dynamicMargin,
                      zIndex: 50 - i
                    }}
                  >
                    <Card
                      {...cardData}
                      index={i}
                      scale={scale}
                      isOverlay
                      hideImage={i > 0}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </LicenseGate>
  )
}
export default App
