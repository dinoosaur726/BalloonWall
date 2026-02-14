import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { BalloonGenerator } from './utils/BalloonGenerator'
import {
    REM,
    STEP_REM,
    CARD_WIDTH_REM,
    BASE_HEIGHT_REM
} from './constants'

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

const STANDARD_RANGES = [
    { min: 0, max: 99, imageUrl: 'default', textColor: '#2563eb' },
    { min: 100, max: 299, imageUrl: 'bronze', textColor: '#2563eb' },
    { min: 300, max: 999, imageUrl: 'silver', textColor: '#2563eb' },
    { min: 1000, max: 9999999, imageUrl: 'gold', textColor: '#2563eb' }
]

interface Settings {
    wsPort: number
    isTransparent: boolean
    isGreenScreen: boolean
    hideUI: boolean
    // Signature Balloon Config
    streamerId?: string
    signatureBalloons?: string // Space separated numbers: "100 200 1234"
    // New Automation Settings
    autoAdd: boolean
    minAmount: number
    // Design Settings
    design: {
        showNickname: boolean
        showAmount: boolean
        enableBlur: boolean
    }
}

// ... (Stack update helpers remain same) ...

const updateSourceStack = (stack: Stack, removedCardIds: string[]): Stack | null => {
    // ...
    const newCardIds = stack.cardIds.filter(id => !removedCardIds.includes(id))

    if (newCardIds.length === 0) return null

    const shiftDown = removedCardIds.length * STEP_REM * REM * stack.scale

    return {
        ...stack,
        cardIds: newCardIds,
        y: stack.y + shiftDown
    }
}

interface GameState {
    cards: Record<string, CardData>
    stacks: Record<string, Stack>
    settings: Settings

    // Actions
    handleDonation: (nickname: string, amount: number) => void // New Action
    addCard: (nickname: string, amount: number) => void

    // Stack Operations
    createStack: (cardIds: string[], x: number, y: number) => void
    moveCardsToStack: (cardIds: string[], targetStackId: string) => void
    moveCardsToCanvas: (cardIds: string[], x: number, y: number) => void
    removeCard: (cardId: string) => void
    autoOrganize: () => void
    updateStackScale: (stackId: string, delta: number) => void
    refreshCardImages: () => Promise<void>

    moveStack: (stackId: string, x: number, y: number) => void

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
    stacks: {},
    history: [],

    loadState: (newState) => set(newState),
    resetState: () => set({ cards: {}, stacks: {}, history: [] }),

    settings: {
        wsPort: 3005,
        isTransparent: false,
        isGreenScreen: false,
        hideUI: false,
        streamerId: '',
        signatureBalloons: '',
        autoAdd: true,
        minAmount: 0,
        design: {
            showNickname: true,
            showAmount: true,
            enableBlur: true
        }
    },

    handleDonation: (nickname, amount) => {
        const { settings, addCard } = get()

        // 1. Always add to History (Req: History generates around the request)
        const historyItem = {
            id: uuidv4(),
            nickname,
            amount,
            timestamp: Date.now()
        }
        set(state => ({ history: [historyItem, ...state.history] }))

        // 2. Logic for Auto-Creation
        if (settings.autoAdd) {
            // Check Minimum Amount
            if (amount >= settings.minAmount) {
                addCard(nickname, amount)
            }
        }
    },

    addCard: async (nickname, amount) => {
        const { settings } = get()

        let imageUrl = 'default'
        let textColor = '#2563eb' // Default Blue
        let useGenerator = false

        // Use STANDARD_RANGES
        for (const range of STANDARD_RANGES) {
            if (amount >= range.min && amount <= range.max) {
                imageUrl = range.imageUrl
                textColor = range.textColor || '#2563eb'
                break
            }
        }

        // Decide generator usage
        if (['default', 'bronze', 'silver', 'gold'].includes(imageUrl)) {
            useGenerator = true
        }

        if (useGenerator) {
            try {
                const sigConfig = {
                    streamerId: settings.streamerId,
                    signatureBalloons: settings.signatureBalloons ? settings.signatureBalloons.split(' ').map(s => parseInt(s)).filter(n => !isNaN(n)) : []
                };

                // Implicitly checks signature/external logic inside generator
                imageUrl = await BalloonGenerator.generate(nickname, amount, sigConfig)
            } catch (err) {
                console.error("Generator failed, falling back", err)
            }
        }

        const newCard: CardData = {
            id: uuidv4(),
            nickname,
            amount,
            imageUrl,
            textColor
        }

        // Auto-Stacking Logic: Find stack with matching amount
        const stackValues = Object.values(get().stacks)
        let targetStack: Stack | null = null

        // Find a stack that has cards of the same amount
        for (const stack of stackValues) {
            if (stack.cardIds.length > 0) {
                const firstCardId = stack.cardIds[0]
                const firstCard = get().cards[firstCardId]
                if (firstCard && firstCard.amount === amount) {
                    targetStack = stack
                    break
                }
            }
        }

        if (targetStack) {
            const shiftUp = STEP_REM * REM * targetStack.scale

            const updatedStack = {
                ...targetStack,
                cardIds: [newCard.id, ...targetStack.cardIds],
                y: targetStack.y - shiftUp
            }

            set(state => ({
                cards: { ...state.cards, [newCard.id]: newCard },
                stacks: { ...state.stacks, [targetStack.id]: updatedStack },
            }))
        } else {
            // No matching stack found -> Create New Stack
            // Position it randomly or use a smart placement (AutoOrganize logic is separate)
            // For now, random placement to avoid overlap
            const x = 50 + Math.random() * 200
            const y = 50 + Math.random() * 200

            const newStackId = uuidv4()
            const newStack: Stack = {
                id: newStackId,
                cardIds: [newCard.id],
                x,
                y,
                scale: 0.85
            }

            set(state => ({
                cards: { ...state.cards, [newCard.id]: newCard },
                stacks: { ...state.stacks, [newStackId]: newStack },
            }))
        }
    },

    createStack: (cardIds, x, y) => {
        const newStackId = uuidv4()
        const newStack: Stack = {
            id: newStackId,
            cardIds,
            x,
            y,
            scale: 1
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

    moveCardsToStack: (cardIds, targetStackId) => {
        // ... (existing implementation)
        set(state => {
            const firstCardId = cardIds[0]
            const sourceStackEntry = Object.entries(state.stacks).find(([_, s]) => s.cardIds.includes(firstCardId))
            if (!sourceStackEntry) return state
            const [sourceStackId, sourceStack] = sourceStackEntry
            if (sourceStackId === targetStackId) return state
            const targetStack = state.stacks[targetStackId]
            if (!targetStack) return state

            const newStacks = { ...state.stacks }
            const sourceResult = updateSourceStack(sourceStack, cardIds)
            if (sourceResult === null) {
                delete newStacks[sourceStackId]
            } else {
                newStacks[sourceStackId] = sourceResult
            }
            const addCount = cardIds.length
            const shiftUp = addCount * STEP_REM * REM * targetStack.scale

            newStacks[targetStackId] = {
                ...targetStack,
                cardIds: [...cardIds, ...targetStack.cardIds],
                y: targetStack.y - shiftUp
            }

            return { stacks: newStacks }
        })
    },

    moveCardsToCanvas: (cardIds, x, y) => {
        set(state => {
            const firstCardId = cardIds[0]
            const sourceStackEntry = Object.entries(state.stacks).find(([_, s]) => s.cardIds.includes(firstCardId))
            if (!sourceStackEntry) return state
            const [sourceStackId, sourceStack] = sourceStackEntry

            const newStacks = { ...state.stacks }
            const sourceResult = updateSourceStack(sourceStack, cardIds)
            if (sourceResult === null) {
                delete newStacks[sourceStackId]
            } else {
                newStacks[sourceStackId] = sourceResult
            }

            const newStackId = uuidv4()
            newStacks[newStackId] = {
                id: newStackId,
                cardIds: cardIds,
                x,
                y,
                scale: sourceStack.scale
            }

            return { stacks: newStacks }
        })
    },

    removeCard: (cardId) => {
        set(state => {
            const stacks = { ...state.stacks }
            const cards = { ...state.cards }
            delete cards[cardId]
            const stackEntry = Object.entries(stacks).find(([_, s]) => s.cardIds.includes(cardId))
            if (stackEntry) {
                const [stackId, stack] = stackEntry
                const sourceResult = updateSourceStack(stack, [cardId])
                if (sourceResult === null) {
                    delete stacks[stackId]
                } else {
                    stacks[stackId] = sourceResult
                }
            }
            return { cards, stacks }
        })
    },

    autoOrganize: () => {
        // ... (existing implementation)
        set(state => {
            const stacks = { ...state.stacks }
            const stackValues = Object.values(stacks)
            const singleStacks = stackValues.filter(s => s.cardIds.length === 1)
            if (singleStacks.length === 0) return {}
            const cardsToMove: string[] = []
            singleStacks.forEach(s => {
                cardsToMove.push(...s.cardIds)
                delete stacks[s.id]
            })
            const cardWidthPx = CARD_WIDTH_REM * REM
            const estimatedHeightPx = (cardsToMove.length * STEP_REM * REM) + (BASE_HEIGHT_REM * REM)
            const SPACING = 20
            let safeX = 50
            let safeY = 50
            let found = false
            const isOverlapping = (x: number, y: number, w: number, h: number) => {
                return Object.values(stacks).some(s => {
                    const sW = CARD_WIDTH_REM * REM * s.scale
                    const sH = ((s.cardIds.length - 1) * STEP_REM + BASE_HEIGHT_REM) * REM * s.scale
                    return !(
                        x + w < s.x ||
                        x > s.x + sW ||
                        y + h < s.y ||
                        y > s.y + sH
                    )
                })
            }
            let attempt = 0
            while (attempt < 100) {
                if (!isOverlapping(safeX, safeY, cardWidthPx, estimatedHeightPx)) {
                    found = true
                    break
                }
                safeX += (cardWidthPx + SPACING)
                if (safeX > 1600) {
                    safeX = 50
                    safeY += 400
                }
                attempt++
            }
            if (!found) {
                safeX = 50 + Math.random() * 50
                safeY = 50 + Math.random() * 50
            }
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
        // ... (existing implementation)
        set(state => {
            const stack = state.stacks[stackId]
            if (!stack) return state
            const step = 0.05
            const change = delta < 0 ? step : -step
            const oldScale = stack.scale
            const newScale = Math.max(0.2, Math.min(3, oldScale + change))
            if (oldScale === newScale) return state
            const count = stack.cardIds.length
            const baseHeight = ((count - 1) * STEP_REM + BASE_HEIGHT_REM) * REM
            const oldHeight = baseHeight * oldScale
            const newHeight = baseHeight * newScale
            const newY = stack.y + (oldHeight - newHeight)
            const newStacks = { ...state.stacks }
            const updatedStack = { ...stack, scale: newScale, y: newY }
            newStacks[stackId] = updatedStack
            const PUSH_GAP = 0
            const SNAP_TOLERANCE = 5
            const baseWidth = CARD_WIDTH_REM * REM
            const pushNeighbors = (currentId: string, currentRightEdge: number) => {
                const neighbors = Object.values(newStacks)
                    .filter(s => s.id !== currentId && s.x > newStacks[currentId].x)
                    .sort((a, b) => a.x - b.x)
                for (const neighbor of neighbors) {
                    if (neighbor.x < currentRightEdge + PUSH_GAP) {
                        const pushDist = (currentRightEdge + PUSH_GAP) - neighbor.x
                        newStacks[neighbor.id] = { ...neighbor, x: neighbor.x + pushDist }
                        const neighborWidth = baseWidth * newStacks[neighbor.id].scale
                        pushNeighbors(neighbor.id, newStacks[neighbor.id].x + neighborWidth)
                    }
                }
            }
            const pullNeighbors = (currentId: string, oldRightEdge: number, shiftAmount: number) => {
                const neighbors = Object.values(newStacks)
                    .filter(s => s.id !== currentId && s.x > newStacks[currentId].x)
                    .sort((a, b) => a.x - b.x)
                for (const neighbor of neighbors) {
                    if (Math.abs(neighbor.x - oldRightEdge) < SNAP_TOLERANCE) {
                        const neighborOldX = neighbor.x
                        const newNeighborX = neighbor.x + shiftAmount
                        newStacks[neighbor.id] = { ...neighbor, x: newNeighborX }
                        const neighborWidth = baseWidth * neighbor.scale
                        pullNeighbors(neighbor.id, neighborOldX + neighborWidth, shiftAmount)
                    }
                }
            }
            const oldWidth = baseWidth * oldScale
            const newWidth = baseWidth * newScale
            if (newScale > oldScale) {
                pushNeighbors(stackId, updatedStack.x + newWidth)
            } else {
                const widthDiff = newWidth - oldWidth
                pullNeighbors(stackId, updatedStack.x + oldWidth, widthDiff)
            }
            return { stacks: newStacks }
        })
    },

    setSettings: (newSettings) => {
        set(state => {
            const updatedSettings = { ...state.settings, ...newSettings }
            return { settings: updatedSettings } // Simplified setSettings
        })

        // Side Effect: Trigger Refresh if Signature Config changed
        // We no longer check amountRanges
        const { refreshCardImages } = get()
        if (newSettings.streamerId || newSettings.signatureBalloons) {
            refreshCardImages()
        }
    },

    refreshCardImages: async () => {
        const { cards, settings } = get()
        const sigConfig = {
            streamerId: settings.streamerId,
            signatureBalloons: settings.signatureBalloons ? settings.signatureBalloons.split(' ').map(s => parseInt(s)).filter(n => !isNaN(n)) : []
        };

        const updates: Record<string, Partial<CardData>> = {}
        const promises = Object.values(cards).map(async (card) => {
            let targetImageUrl = 'default'

            // Check STANDARD_RANGES
            for (const range of STANDARD_RANGES) {
                if (card.amount >= range.min && card.amount <= range.max) {
                    targetImageUrl = range.imageUrl
                    break
                }
            }

            // Signature Logic
            // If it matches signature, we regenerate.
            // If it matches standard ranges (default/bronze/...), we regenerate (to get updated visuals/fetch)
            // Wait, if it's standard, we ALWAYS regenerate now because we rely on Generator for ALL of them except maybe pure local?
            // Actually, we probably want to regenerate to ensure we get the fetched image if available.

            const isSignature = sigConfig.streamerId && sigConfig.signatureBalloons.includes(card.amount);
            const isPreset = ['default', 'bronze', 'silver', 'gold'].includes(targetImageUrl)

            if (isPreset || isSignature) {
                try {
                    const genUrl = await BalloonGenerator.generate(card.nickname, card.amount, sigConfig)
                    updates[card.id] = { imageUrl: genUrl }
                } catch (e) {
                    console.error(`Failed to refresh card ${card.id}`, e)
                    updates[card.id] = { imageUrl: targetImageUrl }
                }
            }
        })

        await Promise.all(promises)

        if (Object.keys(updates).length > 0) {
            set(state => {
                const newCards = { ...state.cards }
                Object.entries(updates).forEach(([id, update]) => {
                    if (newCards[id]) {
                        newCards[id] = { ...newCards[id], ...update }
                    }
                })
                return { cards: newCards }
            })
        }
    },

    initSettings: (incomingSettings) => set(state => ({
        settings: {
            ...state.settings,
            ...incomingSettings,
            design: {
                ...state.settings.design,
                ...(incomingSettings.design || {})
            }
        }
    }))
}))
