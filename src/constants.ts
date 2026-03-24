// Physics & Layout Constants

// Base Unit (Tailwind default)
export const REM = 16

// Card Dimensions (in rem)
export const CARD_WIDTH_REM = 15.12
export const IMG_HEIGHT_REM = 8.97375
// Increased from 2.5 to 2.75 (~10% boost for text area)
export const TEXT_HEIGHT_REM = 2.75

// Total Height
export const BASE_HEIGHT_REM = IMG_HEIGHT_REM + TEXT_HEIGHT_REM

// Stacking Physics
// The amount of vertical overlap.
// Usually, we want the text area of the card BELOW to be visible.
// So the card ABOVE should be shifted up by the height of the text area.
export const STEP_REM = TEXT_HEIGHT_REM

// Snapping Constants (in px)
export const SNAP_DIST_PX = 10
