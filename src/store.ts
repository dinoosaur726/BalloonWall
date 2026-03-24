import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { BalloonGenerator } from './utils/BalloonGenerator'
import { isElectron } from './utils/env'
import {
    REM,
    STEP_REM,
    CARD_WIDTH_REM,
    BASE_HEIGHT_REM
} from './constants'

interface CardData {
    id: string
    type?: 'Normal' | 'Ad'
    nickname: string
    amount: number
    imageUrl: string
    textColor?: string
    isCustomImage?: boolean
}

export interface CustomBalloon {
    id: string
    amount: number
    imageDataUrl: string
    useForNormal: boolean
    useForAd: boolean
}

export interface Stack {
    id: string
    cardIds: string[]
    x: number
    y: number
    scale: number
}

const STANDARD_RANGES = [
    { min: 0, max: 99, imageUrl: 'default', textColor: '#2563eb' },
    { min: 100, max: 299, imageUrl: 'bronze', textColor: '#2563eb' },
    { min: 300, max: 999, imageUrl: 'silver', textColor: '#2563eb' },
    { min: 1000, max: 9999999, imageUrl: 'gold', textColor: '#2563eb' }
]

interface Settings {
    wsPort: number
    httpPort: number
    streamerId?: string
    signatureBalloons?: string
    customBalloons?: CustomBalloon[]
    streamerNameProfile?: string
    streamerUrlProfile?: string
    hasCompletedWelcome?: boolean
    autoAdd: boolean
    minAmount: number
    autoAddAd: boolean
    minAmountAd: number
    snapToStacks: boolean
    lastSeenPatchNotes?: string
    design: {
        showNickname: boolean
        showAmount: boolean
    }
}

interface Rect {
    left: number
    right: number
    top: number
    bottom: number
}

const getStackRect = (stack: Stack): Rect => {
    const width = CARD_WIDTH_REM * REM * stack.scale
    const height = ((stack.cardIds.length - 1) * STEP_REM + BASE_HEIGHT_REM) * REM * stack.scale

    return {
        left: stack.x,
        right: stack.x + width,
        top: stack.y,
        bottom: stack.y + height
    }
}

const resolveVerticalCollisions = (stacks: Record<string, Stack>, sourceStackId: string): Record<string, Stack> => {
    const newStacks = { ...stacks }
    const queue = [sourceStackId]
    const processed = new Set<string>()

    const PADDING = 0
    const MAX_ITERATIONS = 1000
    let iterations = 0

    while (queue.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++
        const currentId = queue.shift()!
        if (processed.has(currentId)) continue
        processed.add(currentId)

        const currentStack = newStacks[currentId]
        if (!currentStack) continue

        const currentRect = getStackRect(currentStack)

        Object.values(newStacks).forEach(other => {
            if (other.id === currentId) return

            const otherRect = getStackRect(other)

            const isHorizontalOverlap = currentRect.left < otherRect.right && currentRect.right > otherRect.left

            if (isHorizontalOverlap) {
                if (otherRect.bottom > currentRect.top + PADDING) {
                    if (otherRect.top < currentRect.top) {
                        const otherHeight = otherRect.bottom - otherRect.top
                        const newY = currentRect.top - PADDING - otherHeight

                        if (newY < other.y) {
                            newStacks[other.id] = { ...other, y: newY }
                            queue.push(other.id)
                        }
                    }
                }
            }
        })
    }

    return newStacks
}

const updateSourceStack = (stack: Stack, removedCardIds: string[]): Stack | null => {
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

    handleDonation: (type: 'Normal' | 'Ad', nickname: string, amount: number) => void
    addCard: (type: 'Normal' | 'Ad', nickname: string, amount: number) => void

    createStack: (cardIds: string[], x: number, y: number) => void
    moveCardsToStack: (cardIds: string[], targetStackId: string) => void
    moveCardsToCanvas: (cardIds: string[], x: number, y: number) => void
    removeCard: (cardId: string) => void
    autoOrganize: () => void
    updateStackScale: (stackId: string, delta: number) => void
    refreshCardImages: () => Promise<void>

    moveStack: (stackId: string, x: number, y: number) => void

    history: { id: string, type?: 'Normal' | 'Ad', nickname: string, amount: number, timestamp: number }[]
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
        httpPort: 3006,
        streamerId: '',
        signatureBalloons: '',
        customBalloons: [],
        streamerNameProfile: '',
        streamerUrlProfile: '',
        hasCompletedWelcome: false,
        autoAdd: true,
        minAmount: 0,
        autoAddAd: true,
        minAmountAd: 0,
        snapToStacks: true,
        lastSeenPatchNotes: '',
        design: {
            showNickname: true,
            showAmount: true
        }
    },

    handleDonation: (type, nickname, amount) => {
        const { settings, addCard } = get()

        const historyItem = {
            id: uuidv4(),
            type,
            nickname,
            amount,
            timestamp: Date.now()
        }
        set(state => ({ history: [historyItem, ...state.history] }))

        if (type === 'Ad') {
            if (settings.autoAddAd && amount >= settings.minAmountAd) {
                addCard(type, nickname, amount)
            }
        } else {
            if (settings.autoAdd && amount >= settings.minAmount) {
                addCard(type, nickname, amount)
            }
        }
    },

    addCard: async (type, nickname, amount) => {
        const { settings } = get()

        let imageUrl = 'default'
        let textColor = '#2563eb'
        let useGenerator = false
        let isCustomImage = false

        for (const range of STANDARD_RANGES) {
            if (amount >= range.min && amount <= range.max) {
                imageUrl = range.imageUrl
                textColor = range.textColor || '#2563eb'
                break
            }
        }

        if (['default', 'bronze', 'silver', 'gold'].includes(imageUrl)) {
            useGenerator = true
        }

        if (useGenerator || type === 'Ad') {
            try {
                const sigConfig = {
                    streamerId: settings.streamerId,
                    signatureBalloons: settings.signatureBalloons ? settings.signatureBalloons.split(' ').map(s => parseInt(s)).filter(n => !isNaN(n)) : [],
                    customBalloons: settings.customBalloons || []
                };

                const result = await BalloonGenerator.generate(nickname, amount, sigConfig, type)
                imageUrl = result.imageUrl
                isCustomImage = result.isCustom
            } catch (err) {
                console.error("Generator failed, falling back", err)
            }
        }

        const newCard: CardData = {
            id: uuidv4(),
            type,
            nickname,
            amount,
            imageUrl,
            textColor,
            isCustomImage
        }

        const stackValues = Object.values(get().stacks)
        let targetStack: Stack | null = null

        for (const stack of stackValues) {
            if (stack.cardIds.length > 0) {
                const firstCardId = stack.cardIds[0]
                const firstCard = get().cards[firstCardId]
                if (firstCard && firstCard.amount === amount && firstCard.type === type) {
                    const nextY = stack.y - (STEP_REM * REM * stack.scale)
                    if (nextY < 50) {
                        continue
                    }

                    if (!targetStack || stack.cardIds.length <= targetStack.cardIds.length) {
                        targetStack = stack
                    }
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

            let nextStacks = { ...get().stacks, [targetStack.id]: updatedStack }
            nextStacks = resolveVerticalCollisions(nextStacks, targetStack.id)

            set(state => ({
                cards: { ...state.cards, [newCard.id]: newCard },
                stacks: nextStacks
            }))
        } else {
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

            const resolvedStacks = resolveVerticalCollisions(newStacks, targetStackId)

            return { stacks: resolvedStacks }
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
            return {
                stacks: {
                    ...state.stacks,
                    [stackId]: { ...stack, scale: newScale, y: newY }
                }
            }
        })
    },

    setSettings: (newSettings) => {
        set(state => {
            const updatedSettings = { ...state.settings, ...newSettings }
            return { settings: updatedSettings }
        })

        const { refreshCardImages } = get()
        if (newSettings.streamerId || newSettings.signatureBalloons || newSettings.customBalloons) {
            refreshCardImages()
        }
    },

    refreshCardImages: async () => {
        const { cards, settings } = get()
        const sigConfig = {
            streamerId: settings.streamerId,
            signatureBalloons: settings.signatureBalloons ? settings.signatureBalloons.split(' ').map(s => parseInt(s)).filter(n => !isNaN(n)) : [],
            customBalloons: settings.customBalloons || []
        };

        const updates: Record<string, Partial<CardData>> = {}
        const promises = Object.values(cards).map(async (card) => {
            let targetImageUrl = 'default'

            for (const range of STANDARD_RANGES) {
                if (card.amount >= range.min && card.amount <= range.max) {
                    targetImageUrl = range.imageUrl
                    break
                }
            }

            const isSignature = sigConfig.streamerId && sigConfig.signatureBalloons.includes(card.amount);
            const isCustom = (sigConfig.customBalloons || []).some(cb =>
                cb.amount === card.amount &&
                (card.type === 'Ad' ? cb.useForAd : cb.useForNormal)
            );
            const isPreset = ['default', 'bronze', 'silver', 'gold'].includes(targetImageUrl)
            const isAd = card.type === 'Ad';

            if (isPreset || isSignature || isCustom || isAd) {
                try {
                    const result = await BalloonGenerator.generate(card.nickname, card.amount, sigConfig, card.type || 'Normal')
                    updates[card.id] = { imageUrl: result.imageUrl, isCustomImage: result.isCustom }
                } catch (e) {
                    console.error(`Failed to refresh card ${card.id}`, e)
                    updates[card.id] = { imageUrl: targetImageUrl, isCustomImage: false }
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

if (isElectron()) {
    let syncTimer: ReturnType<typeof setTimeout> | null = null
    useStore.subscribe((state) => {
        if (syncTimer) clearTimeout(syncTimer)
        syncTimer = setTimeout(() => {
            window.ipcRenderer.send('state-sync', {
                cards: state.cards,
                stacks: state.stacks,
                settings: state.settings,
                history: state.history
            })
        }, 50)
    })
}
