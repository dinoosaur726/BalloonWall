import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'
import { useStore } from '../store'

interface CardProps {
    id: string
    nickname: string
    amount: number
    imageUrl: string
    textColor?: string
    index: number // logic index in column
    isOverlay?: boolean
    childCards?: React.ReactNode // For overlay grouping
    scale?: number
    onScale?: (delta: number) => void
}

export const Card: React.FC<CardProps> = ({ id, nickname, amount, imageUrl, textColor = '#2563eb', index, isOverlay, childCards, scale = 1 }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id,
        data: { index, type: 'CARD' },
        disabled: isOverlay
    })

    // Physical scaling logic to affect layout flow
    const baseWidthRem = 8 // w-32 = 8rem
    const currentWidthRem = baseWidthRem * scale

    const style = {
        // marginBottom is handled by parent wrapper in App.tsx now
        width: `${currentWidthRem}rem`,
        height: `${9 * scale}rem`, // Fixed Height for exact physics (6rem img + 3rem text)
        fontSize: `${0.875 * scale}rem`,
    }

    return (
        <motion.div
            ref={setNodeRef}
            // Removing layoutId and initial opacity to prevent disappearing bugs on move
            // initial={{ opacity: 0 }}
            // animate={{ opacity: 1 }}
            // exit={{ opacity: 0 }}
            // layoutId={id}
            className={twMerge(
                "relative flex flex-col items-center p-0 rounded-xl shadow-md select-none cursor-grab active:cursor-grabbing bg-white border border-gray-200 overflow-hidden group",
                isDragging ? "opacity-30" : "opacity-100",
                isOverlay && "opacity-100 cursor-grabbing shadow-2xl scale-105 z-50 ring-2 ring-blue-500"
            )}
            style={style}
            {...attributes}
            {...listeners}
        >
            {/* Standard Reference Design: Image Top, Text Bottom */}
            {/* Image height should probably scale too. w-full h-24 (6rem). 
                If width scales, h-24 stays 6rem. Aspect ratio might change.
                Better to use aspect ratio or scaled height.
            */}
            <div
                className="w-full bg-gray-100 relative"
                style={{ height: `${7.2 * scale}rem` }} // Scale the image container height (Increased from 6)
            >
                {imageUrl === 'gold' && <div className="w-full h-full bg-yellow-400" />}
                {imageUrl === 'silver' && <div className="w-full h-full bg-gray-400" />}
                {imageUrl === 'bronze' && <div className="w-full h-full bg-orange-700" />}
                {imageUrl === 'default' && <div className="w-full h-full bg-blue-500" />}

                {!['gold', 'silver', 'bronze', 'default'].includes(imageUrl) && (
                    <img src={imageUrl} alt="bg" className="w-full h-full object-cover" />
                )}
            </div>

            <div className="w-full bg-white p-[0.3em] flex flex-col items-center justify-center flex-1 relative group/text">
                <button
                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-gray-200 text-gray-500 hover:bg-red-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all z-50 cursor-pointer"
                    style={{ fontSize: '0.7em' }}
                    onPointerDown={(e) => {
                        e.stopPropagation() // Prevent Drag Start
                    }}
                    onClick={(e) => {
                        e.stopPropagation()
                        useStore.getState().removeCard(id)
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
                <span className="font-bold text-gray-900 leading-tight text-center line-clamp-1 translate-y-[2px]" style={{ fontSize: '0.95em' }}>{nickname}</span>
                <span className="font-bold mt-[0.1em] translate-y-[2px]" style={{ fontSize: '0.85em', color: textColor }}>
                    {amount.toLocaleString()}
                </span>
            </div>

            {childCards}
        </motion.div>
    )
}
