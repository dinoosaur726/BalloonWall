/**
 * Environment detection utilities.
 * Determines if the app is running inside Electron or in a standalone browser (e.g., OBS Browser Source).
 */

export const isElectron = (): boolean => {
    return !!(window as any).ipcRenderer
}
