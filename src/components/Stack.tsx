import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { twMerge } from 'tailwind-merge'

interface StackProps {
    id: string
    x: number
    y: number
    scale: number
    children: React.ReactNode
    onScale?: (delta: number) => void
}

export const Stack: React.FC<StackProps> = ({ id, x, y, scale, children, onScale }) => {
    const { setNodeRef, isOver } = useDroppable({
        id
    })

    const handleWheel = (e: React.WheelEvent) => {
        if (onScale) {
            e.stopPropagation()
            onScale(e.deltaY)
        }
    }

    return (
        <div
            ref={setNodeRef}
            onWheel={handleWheel}
            className={twMerge(
                "absolute flex flex-col justify-start items-center rounded-lg transition-colors pb-4",
                "min-w-[2rem]",
                "border-2 border-transparent",
                isOver && "border-white/30 bg-white/5"
            )}
            style={{
                left: x,
                top: y,
                // Ensure z-index is handled if needed.
                // transform: `scale(${scale})` ? No, we are scaling children sizing as per previous logic.
                // We just pass scale to children (Cards).
            }}
        >
            {children}
        </div>
    )
}
