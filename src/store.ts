import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'

interface CardData {
    id: string
    nickname: string
    amount: number
    imageUrl: string
    textColor?: string
}

export interface Stack {
    id: string
    cardIds: string[]
    x: number
    y: number
    scale: number
    // We can add zIndex if needed, or rely on render order
}

interface Settings {
    wsPort: number
    amountRanges: { min: number; max: number; imageUrl: string; textColor?: string }[]
    // maxCardsPerColumn removed

    isTransparent: boolean
    isGreenScreen: boolean
    hideUI: boolean
}

interface GameState {
    cards: Record<string, CardData>
    stacks: Record<string, Stack>
    settings: Settings

    // Actions
    addCard: (nickname: string, amount: number) => void

    // Stack Operations
    createStack: (cardIds: string[], x: number, y: number) => void
    moveCardsToStack: (cardIds: string[], targetStackId: string) => void
    moveCardsToCanvas: (cardIds: string[], x: number, y: number) => void
    removeCard: (cardId: string) => void
    autoOrganize: () => void
    updateStackScale: (stackId: string, delta: number) => void

    // Drag/Drop Logic helpers
    // When dropping a card/group on canvas: createStack
    // When dropping a card/group on existing stack: append to stack (merge logic)

    // History
    history: { id: string, nickname: string, amount: number, timestamp: number }[]
    // Actions
    loadState: (state: GameState) => void
    resetState: () => void

    setSettings: (settings: Partial<Settings>) => void
    initSettings: (settings: Settings) => void
}

export const useStore = create<GameState>((set, get) => ({
    cards: {},
    stacks: {}, // Start empty? Or default stacks?
    history: [],

    loadState: (newState) => set(newState),
    resetState: () => set({ cards: {}, stacks: {}, history: [] }),

    settings: {
        wsPort: 3000,
        amountRanges: [
            { min: 0, max: 99, imageUrl: 'default' },
            { min: 100, max: 999, imageUrl: 'bronze' },
            { min: 1000, max: 9999, imageUrl: 'silver' },
            { min: 10000, max: 999999, imageUrl: 'gold' }
        ],

        isTransparent: false,
        isGreenScreen: false,
        hideUI: false
    },

    addCard: (nickname, amount) => {
        const { settings } = get()

        // Determine Image URL and Text Color
        let imageUrl = 'default'
        let textColor = '#2563eb' // Default Blue

        for (const range of settings.amountRanges) {
            if (amount >= range.min && amount <= range.max) {
                imageUrl = range.imageUrl
                textColor = range.textColor || '#2563eb'
                break
            }
        }

        const newCard: CardData = {
            id: uuidv4(),
            nickname,
            amount,
            imageUrl,
            textColor
        }

        // Spawn logic: Find a spot? Or just spawn in center/random?
        // Let's spawn at random positions within safe area (e.g. 100, 100 to 800, 500)
        const x = 50 + Math.random() * 200
        const y = 50 + Math.random() * 200

        const newStackId = uuidv4()
        const newStack: Stack = {
            id: newStackId,
            cardIds: [newCard.id],
            x,
            y,
            scale: 1
        }

        const historyItem = {
            id: uuidv4(),
            nickname,
            amount,
            timestamp: Date.now()
        }

        set(state => ({
            cards: { ...state.cards, [newCard.id]: newCard },
            stacks: { ...state.stacks, [newStackId]: newStack },
            history: [historyItem, ...state.history] // Newest first
        }))
    },

    createStack: (cardIds, x, y) => {
        const newStackId = uuidv4()
        const newStack: Stack = {
            id: newStackId,
            cardIds,
            x,
            y,
            scale: 1 // Default scale or inherit?
        }
        set(state => ({
            stacks: { ...state.stacks, [newStackId]: newStack }
        }))
    },

    moveStack: (stackId, x, y) => {
        set(state => ({
            stacks: {
                ...state.stacks,
                [stackId]: { ...state.stacks[stackId], x, y }
            }
        }))
    },

    // Unified Move Logic
    moveCardsToStack: (cardIds: string[], targetStackId: string) => {
        set(state => {
            const firstCardId = cardIds[0]
            // Find source stack
            const sourceStackEntry = Object.entries(state.stacks).find(([_, s]) => s.cardIds.includes(firstCardId))
            if (!sourceStackEntry) return state
            const [sourceStackId, sourceStack] = sourceStackEntry

            // Remove from source
            const newSourceCardIds = sourceStack.cardIds.filter(id => !cardIds.includes(id))

            // Add to target
            const targetStack = state.stacks[targetStackId]
            if (!targetStack) return state

            // Prevent merging into itself if it's the same stack
            if (sourceStackId === targetStackId) return state

            const newStacks = { ...state.stacks }
            const REM = 16
            // Exact Step: 9rem (Card Height) - 6.5rem (Overlap) = 2.5rem
            const STEP_REM = 2.5

            // 1. Handle Source Stack (Splitting Top)
            if (newSourceCardIds.length === 0) {
                delete newStacks[sourceStackId]
            } else {
                // We removed K cards from the TOP.
                // To keep the Bottom Fixed, the Source Stack Y must Shift DOWN.
                // Shift = K * Step * Scale
                const removedCount = cardIds.length
                const shiftDown = removedCount * STEP_REM * REM * sourceStack.scale

                newStacks[sourceStackId] = {
                    ...sourceStack,
                    cardIds: newSourceCardIds,
                    y: sourceStack.y + shiftDown
                }
            }

            // 2. Handle Target Stack (Adding to Top)
            // We adding K cards to the TOP.
            // To keep the Bottom Fixed, the Target Stack Y must Shift UP.
            // Shift = K * Step * Scale
            const addCount = cardIds.length
            const shiftUp = addCount * STEP_REM * REM * targetStack.scale

            newStacks[targetStackId] = {
                ...targetStack,
                cardIds: [...cardIds, ...targetStack.cardIds], // Prepend: New cards on Top
                y: targetStack.y - shiftUp
            }

            return { stacks: newStacks }
        })
    },

    moveCardsToCanvas: (cardIds: string[], x: number, y: number) => {
        set(state => {
            const firstCardId = cardIds[0]
            const sourceStackEntry = Object.entries(state.stacks).find(([_, s]) => s.cardIds.includes(firstCardId))
            if (!sourceStackEntry) return state
            const [sourceStackId, sourceStack] = sourceStackEntry

            // Remove from source
            const newSourceCardIds = sourceStack.cardIds.filter(id => !cardIds.includes(id))

            // Create new stack at dropped position (x, y)
            const newStackId = uuidv4()
            const newStack: Stack = {
                id: newStackId,
                cardIds: cardIds,
                x,
                y,
                scale: sourceStack.scale
            }

            const newStacks = { ...state.stacks }
            const REM = 16
            const STEP_REM = 2.5 // Exact Step

            // 1. Handle Source Stack (Splitting Top)
            if (newSourceCardIds.length === 0) {
                delete newStacks[sourceStackId]
            } else {
                // We removed K cards from the TOP.
                // To keep the Bottom Fixed, the Source Stack Y must Shift DOWN.
                // Shift = K * Step * Scale
                const removedCount = cardIds.length
                const shiftDown = removedCount * STEP_REM * REM * sourceStack.scale

                newStacks[sourceStackId] = {
                    ...sourceStack,
                    cardIds: newSourceCardIds,
                    y: sourceStack.y + shiftDown
                }
            }

            newStacks[newStackId] = newStack

            return { stacks: newStacks }
        })
    },

    removeCard: (cardId) => {
        set(state => {
            const stacks = { ...state.stacks }
            const cards = { ...state.cards }

            // 1. Delete Card Data
            delete cards[cardId]

            // 2. Remove from Stack
            const stackEntry = Object.entries(stacks).find(([_, s]) => s.cardIds.includes(cardId))
            if (stackEntry) {
                const [stackId, stack] = stackEntry
                const newCardIds = stack.cardIds.filter(id => id !== cardId)

                if (newCardIds.length === 0) {
                    // Delete empty stack
                    delete stacks[stackId]
                } else {
                    // Update stack
                    // Calculate Y Shift to keep Bottom Fixed
                    // Height decreases by 1 Step (2.5rem).
                    // So Top (y) must move DOWN by 1 Step to keep Bottom in place.
                    const REM = 16
                    const STEP_REM = 2.5
                    const shiftDown = STEP_REM * REM * stack.scale

                    stacks[stackId] = {
                        ...stack,
                        cardIds: newCardIds,
                        y: stack.y + shiftDown
                    }
                }
            }

            return { cards, stacks }
        })
    },

    autoOrganize: () => {
        set(state => {
            const stacks = { ...state.stacks }
            const stackValues = Object.values(stacks)

            // 1. Identify Singles
            const singleStacks = stackValues.filter(s => s.cardIds.length === 1)

            if (singleStacks.length === 0) return {}

            const cardsToMove: string[] = []
            singleStacks.forEach(s => {
                cardsToMove.push(...s.cardIds)
                delete stacks[s.id]
            })

            // 2. Find Safe Position (Smart Placement)
            const REM = 16
            const CARD_WIDTH_PX = 8 * REM // 128px
            // Approx height: (Cards * Step) + Height
            const ESTIMATED_HEIGHT_PX = (cardsToMove.length * 2.5 * REM) + (9 * REM)
            const SPACING = 20

            let safeX = 50
            let safeY = 50
            let found = false

            // Helper to check collision with REMAINING stacks
            const isOverlapping = (x: number, y: number, w: number, h: number) => {
                return Object.values(stacks).some(s => {
                    const sW = 8 * REM * s.scale
                    const sH = ((s.cardIds.length - 1) * 2.5 + 9) * REM * s.scale

                    // Simple AABB Collision
                    return !(
                        x + w < s.x ||
                        x > s.x + sW ||
                        y + h < s.y ||
                        y > s.y + sH
                    )
                })
            }

            // Search Loop
            let attempt = 0
            while (attempt < 100) {
                if (!isOverlapping(safeX, safeY, CARD_WIDTH_PX, ESTIMATED_HEIGHT_PX)) {
                    found = true
                    break
                }
                // Move Right
                safeX += (CARD_WIDTH_PX + SPACING)
                // Wrap to next row if too wide
                if (safeX > 1600) {
                    safeX = 50
                    safeY += 400 // Move down
                }
                attempt++
            }

            // Fallback
            if (!found) {
                safeX = 50 + Math.random() * 50
                safeY = 50 + Math.random() * 50
            }

            // 3. Create NEW Stack
            const newStackId = uuidv4()
            stacks[newStackId] = {
                id: newStackId,
                cardIds: cardsToMove,
                x: safeX,
                y: safeY,
                scale: 1
            }

            return { stacks }
        })
    },

    updateStackScale: (stackId, delta) => {
        set(state => {
            const stack = state.stacks[stackId]
            if (!stack) return state

            const step = 0.05 // Faster scaling
            const change = delta < 0 ? step : -step
            const oldScale = stack.scale
            const newScale = Math.max(0.2, Math.min(3, oldScale + change))

            if (oldScale === newScale) return state

            const REM = 16
            // Constants matching App.tsx/Card logic
            const CARD_WIDTH_REM = 8
            const STEP_HEIGHT_REM = 2.5
            // Stack Height = ((Count - 1) * Step + CardHeight) * Scale

            // 1. Bottom-Left Anchor Calculation
            const count = stack.cardIds.length
            // Height in pixels without scale
            const baseHeight = ((count - 1) * STEP_HEIGHT_REM + 9) * REM

            const oldHeight = baseHeight * oldScale
            const newHeight = baseHeight * newScale

            // To keep bottom fixed: Y_new = Y_old + (Height_old - Height_new)
            // If getting smaller (new < old), Height decreases, Diff is positive -> Y increases (moves down). Correct.
            // If getting larger (new > old), Height increases, Diff is negative -> Y decreases (moves up). Correct.
            const newY = stack.y + (oldHeight - newHeight)

            const newStacks = { ...state.stacks }
            // Update the scaling stack
            const updatedStack = { ...stack, scale: newScale, y: newY }
            newStacks[stackId] = updatedStack

            // 2. Collision Physics (Push or Pull)
            const PUSH_GAP = 0 // User requested no margin (they stick together)
            const SNAP_TOLERANCE = 5 // Distance to consider "touching" for pulling

            const baseWidth = CARD_WIDTH_REM * REM

            // Recursive Push (Growing)
            const pushNeighbors = (currentId: string, currentRightEdge: number) => {
                const neighbors = Object.values(newStacks)
                    .filter(s => s.id !== currentId && s.x > newStacks[currentId].x) // Strictly on right
                    .sort((a, b) => a.x - b.x) // Closest first

                for (const neighbor of neighbors) {
                    // If overlap (with 0 gap)
                    if (neighbor.x < currentRightEdge + PUSH_GAP) {
                        const pushDist = (currentRightEdge + PUSH_GAP) - neighbor.x
                        // Move neighbor
                        newStacks[neighbor.id] = { ...neighbor, x: neighbor.x + pushDist }
                        // Recurse
                        const neighborWidth = baseWidth * newStacks[neighbor.id].scale
                        pushNeighbors(neighbor.id, newStacks[neighbor.id].x + neighborWidth)
                    }
                }
            }

            // Recursive Pull (Shrinking)
            const pullNeighbors = (currentId: string, oldRightEdge: number, shiftAmount: number) => {
                const neighbors = Object.values(newStacks)
                    .filter(s => s.id !== currentId && s.x > newStacks[currentId].x) // Strictly on right
                    .sort((a, b) => a.x - b.x)

                for (const neighbor of neighbors) {
                    // Check if it WAS touching (or very close) to the OLD right edge
                    if (Math.abs(neighbor.x - oldRightEdge) < SNAP_TOLERANCE) {
                        // Move neighbor LEFT by shiftAmount
                        // We need to capture old X before updating for recursion
                        const neighborOldX = neighbor.x
                        const newNeighborX = neighbor.x + shiftAmount

                        newStacks[neighbor.id] = { ...neighbor, x: newNeighborX }

                        // Recurse: Try to pull things attached to THIS neighbor
                        // The neighbor's right edge also shifted by shiftAmount
                        const neighborWidth = baseWidth * neighbor.scale
                        // Recurse using Neighbor's OLD right edge
                        pullNeighbors(neighbor.id, neighborOldX + neighborWidth, shiftAmount)
                    }
                }
            }

            const oldWidth = baseWidth * oldScale
            const newWidth = baseWidth * newScale

            if (newScale > oldScale) {
                // PUSH
                pushNeighbors(stackId, updatedStack.x + newWidth)
            } else {
                // PULL
                // Check for neighbors at `updatedStack.x + oldWidth`
                // Ensure we use the stack's CURRENT X (which didn't change, only Y changed for anchor)
                const widthDiff = newWidth - oldWidth // Negative
                pullNeighbors(stackId, updatedStack.x + oldWidth, widthDiff)
            }

            return { stacks: newStacks }
        })
    },

    setSettings: (newSettings) => set(state => {
        const updatedSettings = { ...state.settings, ...newSettings }

        // If amountRanges changed, we must refresh ALL existing cards
        // to match the new images/ranges.
        if (newSettings.amountRanges) {
            const updatedCards = { ...state.cards }
            let hasChanges = false

            Object.values(updatedCards).forEach(card => {
                // Re-calculate image URL and Color based on NEW settings
                let newImageUrl = 'default'
                let newTextColor = '#2563eb'

                for (const range of updatedSettings.amountRanges) {
                    if (card.amount >= range.min && card.amount <= range.max) {
                        newImageUrl = range.imageUrl
                        newTextColor = range.textColor || '#2563eb'
                        break
                    }
                }

                if (card.imageUrl !== newImageUrl || card.textColor !== newTextColor) {
                    updatedCards[card.id] = { ...card, imageUrl: newImageUrl, textColor: newTextColor }
                    hasChanges = true
                }
            })

            if (hasChanges) {
                return { settings: updatedSettings, cards: updatedCards }
            }
        }

        return { settings: updatedSettings }
    }),
    initSettings: (settings) => set({ settings })
}))
