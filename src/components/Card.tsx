import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'
import { useStore } from '../store'
import {
    CARD_WIDTH_REM,
    BASE_HEIGHT_REM,
    IMG_HEIGHT_REM,
    TEXT_HEIGHT_REM
} from '../constants'

interface CardProps {
    id: string
    nickname: string
    amount: number
    imageUrl: string
    type?: 'Normal' | 'Ad'
    textColor?: string
    index: number // logic index in column
    isOverlay?: boolean
    childCards?: React.ReactNode // For overlay grouping
    scale?: number
    onScale?: (delta: number) => void
    hideImage?: boolean
    isCustomImage?: boolean
}

export const Card: React.FC<CardProps> = ({
    id,
    nickname,
    amount,
    imageUrl,
    type,
    index,
    isOverlay,
    childCards,
    scale = 1,
    hideImage = false,
    isCustomImage = false
}) => {
    const { settings } = useStore()
    const { design } = settings

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id,
        data: { index, type: 'CARD' },
        disabled: isOverlay
    })

    const currentWidthRem = CARD_WIDTH_REM * scale

    // Adjust font sizes based on scale - Increased as requested
    const nicknameSize = `${0.9 * scale}rem` // Match amount size
    const amountSize = `${0.9 * scale}rem`   // Smaller

    return (
        <motion.div
            ref={setNodeRef}
            className={twMerge(
                "relative flex flex-col items-center p-0 rounded-xl select-none cursor-grab active:cursor-grabbing overflow-hidden group bg-transparent",
                // Removed border and white background from container
                isDragging ? "opacity-30" : "opacity-100",
                // Removed scale-105 to prevent position jump on drop
                isOverlay && "opacity-100 cursor-grabbing shadow-2xl z-50",
            )}
            style={{
                width: `${currentWidthRem}rem`,
                height: `${BASE_HEIGHT_REM * scale}rem`,
            }}
            {...attributes}
            {...listeners}
        >
            {/* Image Area */}
            <div
                className={twMerge(
                    "w-full relative transition-opacity duration-300 overflow-hidden rounded-xl",
                    hideImage ? "opacity-0" : "opacity-100"
                )}
                style={{ height: `${IMG_HEIGHT_REM * scale}rem` }}
            >
                {!hideImage && (
                    <>
                        {imageUrl === 'gold' && <div className="w-full h-full bg-yellow-400" />}
                        {imageUrl === 'silver' && <div className="w-full h-full bg-gray-400" />}
                        {imageUrl === 'bronze' && <div className="w-full h-full bg-orange-700" />}
                        {imageUrl === 'default' && <div className="w-full h-full bg-blue-500" />}

                        {!['gold', 'silver', 'bronze', 'default'].includes(imageUrl) && (
                            <img
                                src={imageUrl}
                                alt="bg"
                                className={twMerge(
                                    "w-full h-full drop-shadow-md",
                                    isCustomImage ? "object-contain" : "object-cover"
                                )}
                            />
                        )}
                    </>
                )}
            </div>

            {/* Text Area */}
            <div
                className="w-full relative flex flex-col items-center justify-center bg-white rounded-xl"
                style={{ height: `${TEXT_HEIGHT_REM * scale}rem` }}
            >
                {/* Delete Button (Hover) */}
                <button
                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-gray-200 text-gray-500 hover:bg-red-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer"
                    style={{ fontSize: '0.7em' }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation()
                        useStore.getState().removeCard(id)
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>

                {design.showNickname && (
                    <div
                        className="truncate w-[90%] text-center text-[#ff0808]"
                        style={{
                            fontSize: nicknameSize,
                            lineHeight: '1.2',
                            fontFamily: '"Nanum Gothic", sans-serif',
                            fontWeight: 800
                        }}
                    >
                        {nickname}
                    </div>
                )}

                {design.showAmount && (
                    <div
                        className="truncate w-[90%] text-center text-black"
                        style={{
                            fontSize: amountSize,
                            lineHeight: '1.2',
                            fontFamily: '"Nanum Gothic", sans-serif',
                            fontWeight: 800
                        }}
                    >
                        {type === 'Ad' ? `애드벌룬 ${amount.toLocaleString()}개` : `별풍선 ${amount.toLocaleString()}개`}
                    </div>
                )}
            </div>

            {childCards}
        </motion.div>
    )
}
