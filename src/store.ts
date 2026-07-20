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
    type?: 'Normal' | 'Ad' | 'Challenge' | 'Battle'
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
    useForChallenge?: boolean
    useForBattle?: boolean
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
    autoAddChallenge: boolean
    minAmountChallenge: number
    autoAddBattle: boolean
    minAmountBattle: number
    useSignatureForMissions?: boolean
    snapToStacks: boolean
    lastSeenPatchNotes?: string
    newCardPosition?: NewCardPosition
    design: {
        showNickname: boolean
        showAmount: boolean
    }
}

export type NewCardPosition =
    | 'top-left' | 'top-center' | 'top-right'
    | 'middle-left' | 'middle-center' | 'middle-right'
    | 'bottom-left' | 'bottom-center' | 'bottom-right'

const CANVAS_WIDTH = 1920
const CANVAS_HEIGHT = 1080
const SPAWN_JITTER = 200
// 상단 32px는 창 드래그 영역이라 그 아래로만 자동 배치/밀어내기를 허용한다
const MIN_STACK_Y = 40
const HISTORY_LIMIT = 500

const getSpawnPosition = (position: NewCardPosition = 'middle-left') => {
    const cardW = CARD_WIDTH_REM * REM * 0.85
    const cardH = BASE_HEIGHT_REM * REM * 0.85
    const regionW = CANVAS_WIDTH / 3
    const regionH = CANVAS_HEIGHT / 3
    const xs = {
        left: regionW * 0.5 - cardW / 2,
        center: regionW * 1.5 - cardW / 2,
        right: regionW * 2.5 - cardW / 2
    }
    const ys = {
        top: regionH * 0.5 - cardH / 2,
        middle: regionH * 1.5 - cardH / 2,
        bottom: regionH * 2.5 - cardH / 2
    }
    const anchors: Record<NewCardPosition, [number, number]> = {
        'top-left': [xs.left, ys.top],
        'top-center': [xs.center, ys.top],
        'top-right': [xs.right, ys.top],
        'middle-left': [xs.left, ys.middle],
        'middle-center': [xs.center, ys.middle],
        'middle-right': [xs.right, ys.middle],
        'bottom-left': [xs.left, ys.bottom],
        'bottom-center': [xs.center, ys.bottom],
        'bottom-right': [xs.right, ys.bottom]
    }
    const [ax, ay] = anchors[position] || anchors['middle-left']
    const jitter = () => (Math.random() - 0.5) * SPAWN_JITTER
    const x = Math.min(Math.max(ax + jitter(), 8), CANVAS_WIDTH - cardW - 8)
    const y = Math.min(Math.max(ay + jitter(), MIN_STACK_Y), CANVAS_HEIGHT - cardH - 8)
    return { x, y }
}

interface Rect {
    left: number
    right: number
    top: number
    bottom: number
}

// 화면 밖으로 나갔거나 좌표가 깨진 스택을 캔버스 안으로 되돌린다 (불러오기/자동 정렬 시 복구용)
export const clampStackToCanvas = (stack: Stack): Stack => {
    const width = CARD_WIDTH_REM * REM * stack.scale
    const height = ((stack.cardIds.length - 1) * STEP_REM + BASE_HEIGHT_REM) * REM * stack.scale
    const maxX = Math.max(0, CANVAS_WIDTH - width)
    const maxY = Math.max(0, CANVAS_HEIGHT - height)
    const x = Number.isFinite(stack.x) ? Math.min(Math.max(stack.x, 0), maxX) : MIN_STACK_Y
    const y = Number.isFinite(stack.y) ? Math.min(Math.max(stack.y, 0), maxY) : MIN_STACK_Y
    if (x === stack.x && y === stack.y) return stack
    return { ...stack, x, y }
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

// 겹치는 위쪽 스택들을 밀어 올린다. 어느 스택이라도 화면 위(MIN_STACK_Y)로 밀려나야만 해결되는
// 상황이면 null을 반환한다 — 호출자는 이 경우 쌓기/병합을 포기해야 한다 (겹침·화면 이탈 방지)
const resolveVerticalCollisions = (stacks: Record<string, Stack>, sourceStackId: string): Record<string, Stack> | null => {
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

        for (const other of Object.values(newStacks)) {
            if (other.id === currentId) continue

            const otherRect = getStackRect(other)

            const isHorizontalOverlap = currentRect.left < otherRect.right && currentRect.right > otherRect.left

            if (isHorizontalOverlap) {
                if (otherRect.bottom > currentRect.top + PADDING) {
                    if (otherRect.top < currentRect.top) {
                        const otherHeight = otherRect.bottom - otherRect.top
                        const newY = currentRect.top - PADDING - otherHeight

                        if (newY < other.y) {
                            if (newY < MIN_STACK_Y) return null
                            newStacks[other.id] = { ...other, y: newY }
                            queue.push(other.id)
                        }
                    }
                }
            }
        }
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

    handleDonation: (type: 'Normal' | 'Ad' | 'Challenge' | 'Battle', nickname: string, amount: number) => void
    addCard: (type: 'Normal' | 'Ad' | 'Challenge' | 'Battle', nickname: string, amount: number) => void

    createStack: (cardIds: string[], x: number, y: number) => void
    moveCardsToStack: (cardIds: string[], targetStackId: string) => void
    moveCardsToCanvas: (cardIds: string[], x: number, y: number) => void
    removeCard: (cardId: string) => void
    autoOrganize: () => void
    updateStackScale: (stackId: string, delta: number) => void
    refreshCardImages: () => Promise<void>

    moveStack: (stackId: string, x: number, y: number) => void

    history: { id: string, type?: 'Normal' | 'Ad' | 'Challenge' | 'Battle', nickname: string, amount: number, timestamp: number }[]
    loadState: (state: Partial<GameState>) => void
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
        autoAddChallenge: true,
        minAmountChallenge: 0,
        autoAddBattle: true,
        minAmountBattle: 0,
        snapToStacks: true,
        lastSeenPatchNotes: '',
        newCardPosition: 'middle-left',
        design: {
            showNickname: true,
            showAmount: true
        }
    },

    handleDonation: (type, nickname, amount) => {
        const { settings, addCard } = get()

        const displayNickname = nickname === 'NULL12345'
            ? (type === 'Battle' ? '대결미션정산' : type === 'Challenge' ? '미션성공' : nickname)
            : nickname

        const historyItem = {
            id: uuidv4(),
            type,
            nickname: displayNickname,
            amount,
            timestamp: Date.now()
        }
        set(state => ({ history: [historyItem, ...state.history].slice(0, HISTORY_LIMIT) }))

        if (type === 'Ad') {
            if (settings.autoAddAd && amount >= settings.minAmountAd) {
                addCard(type, nickname, amount)
            }
        } else if (type === 'Challenge') {
            if (settings.autoAddChallenge && amount >= settings.minAmountChallenge) {
                addCard(type, nickname, amount)
            }
        } else if (type === 'Battle') {
            if (settings.autoAddBattle && amount >= settings.minAmountBattle) {
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

        if (useGenerator || type === 'Ad' || type === 'Challenge' || type === 'Battle') {
            try {
                const sigConfig = {
                    streamerId: settings.streamerId,
                    signatureBalloons: settings.signatureBalloons ? settings.signatureBalloons.split(' ').map(s => parseInt(s)).filter(n => !isNaN(n)) : [],
                    customBalloons: settings.customBalloons || [],
                    useSignatureForMissions: settings.useSignatureForMissions || false
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

        // 이미지 생성(await) 이후의 스택 배치는 반드시 단일 set 안에서 처리한다.
        // set 밖에서 get()으로 읽은 스냅샷을 쓰면 후원이 연달아 들어올 때 서로의 변경을 덮어쓴다.
        set(state => {
            // 같은 금액/종류의 스택을 카드 수가 적은 순으로 시도한다.
            // 스택 자신이나 밀려나는 이웃 스택이 화면 위로 나가야 하는 후보는 건너뛰고,
            // 모두 불가능하면 새 스택을 생성한다.
            const candidates = Object.values(state.stacks)
                .filter(stack => {
                    if (stack.cardIds.length === 0) return false
                    const firstCard = state.cards[stack.cardIds[0]]
                    if (!firstCard || firstCard.amount !== amount || firstCard.type !== type) return false
                    const nextY = stack.y - (STEP_REM * REM * stack.scale)
                    return nextY >= 50
                })
                .sort((a, b) => a.cardIds.length - b.cardIds.length)

            for (const targetStack of candidates) {
                const shiftUp = STEP_REM * REM * targetStack.scale

                const updatedStack = {
                    ...targetStack,
                    cardIds: [newCard.id, ...targetStack.cardIds],
                    y: targetStack.y - shiftUp
                }

                const resolved = resolveVerticalCollisions(
                    { ...state.stacks, [targetStack.id]: updatedStack },
                    targetStack.id
                )
                if (resolved) {
                    return {
                        cards: { ...state.cards, [newCard.id]: newCard },
                        stacks: resolved
                    }
                }
            }

            const { x, y } = getSpawnPosition(state.settings.newCardPosition)

            const newStackId = uuidv4()
            const newStack: Stack = {
                id: newStackId,
                cardIds: [newCard.id],
                x,
                y,
                scale: 0.85
            }

            return {
                cards: { ...state.cards, [newCard.id]: newCard },
                stacks: { ...state.stacks, [newStackId]: newStack },
            }
        })
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

            const addCount = cardIds.length
            const shiftUp = addCount * STEP_REM * REM * targetStack.scale
            const newY = targetStack.y - shiftUp

            // 합친 스택이 화면 위(MIN_STACK_Y)를 넘게 되면 병합을 거부한다 — 드래그한 카드는 제자리로 돌아간다
            if (newY < MIN_STACK_Y) return state

            const newStacks = { ...state.stacks }
            const sourceResult = updateSourceStack(sourceStack, cardIds)
            if (sourceResult === null) {
                delete newStacks[sourceStackId]
            } else {
                newStacks[sourceStackId] = sourceResult
            }

            newStacks[targetStackId] = {
                ...targetStack,
                cardIds: [...cardIds, ...targetStack.cardIds],
                y: newY
            }

            // 위쪽 스택을 밀어낼 공간이 없으면 병합을 거부한다 — 드래그한 카드는 제자리로 돌아간다
            const resolvedStacks = resolveVerticalCollisions(newStacks, targetStackId)
            if (resolvedStacks === null) return state

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
            // 화면 밖으로 나가버린 스택도 이 버튼으로 복구할 수 있도록 먼저 전부 캔버스 안으로 되돌린다
            const stacks: Record<string, Stack> = {}
            Object.values(state.stacks).forEach(s => {
                stacks[s.id] = clampStackToCanvas(s)
            })

            const singleStacks = Object.values(stacks).filter(s => s.cardIds.length === 1)
            if (singleStacks.length === 0) return { stacks }
            const cardsToMove: string[] = []
            singleStacks.forEach(s => {
                cardsToMove.push(...s.cardIds)
                delete stacks[s.id]
            })

            const cardWidthPx = CARD_WIDTH_REM * REM
            const SPACING = 20
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

            // 한 스택이 화면(1080px)을 넘지 않도록 최대 카드 수를 계산해 여러 스택으로 나눈다
            const MAX_STACK_HEIGHT_PX = 900
            const maxCardsPerStack = Math.max(1, Math.floor((MAX_STACK_HEIGHT_PX / REM - BASE_HEIGHT_REM) / STEP_REM) + 1)

            for (let i = 0; i < cardsToMove.length; i += maxCardsPerStack) {
                const chunk = cardsToMove.slice(i, i + maxCardsPerStack)
                const estimatedHeightPx = ((chunk.length - 1) * STEP_REM + BASE_HEIGHT_REM) * REM

                let safeX = 50
                let safeY = 50
                let found = false
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
                stacks[newStackId] = clampStackToCanvas({
                    id: newStackId,
                    cardIds: chunk,
                    x: safeX,
                    y: safeY,
                    scale: 1
                })
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
            const newY = Math.max(0, stack.y + (oldHeight - newHeight))
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
            customBalloons: settings.customBalloons || [],
            useSignatureForMissions: settings.useSignatureForMissions || false
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
                (card.type === 'Ad' ? cb.useForAd : card.type === 'Challenge' ? cb.useForChallenge : card.type === 'Battle' ? cb.useForBattle : cb.useForNormal)
            );
            const isPreset = ['default', 'bronze', 'silver', 'gold'].includes(targetImageUrl)
            const isAd = card.type === 'Ad';
            const isChallenge = card.type === 'Challenge';
            const isBattle = card.type === 'Battle';

            if (isPreset || isSignature || isCustom || isAd || isChallenge || isBattle) {
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
