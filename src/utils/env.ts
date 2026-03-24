export const isElectron = (): boolean => {
    return !!(window as any).ipcRenderer
}
