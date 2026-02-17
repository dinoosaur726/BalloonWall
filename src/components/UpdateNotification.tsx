import { useState, useEffect } from 'react'
import { isElectron } from '../utils/env'

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready' | 'uptodate'

interface UpdateInfo {
    version: string
}

export default function UpdateNotification() {
    const [state, setState] = useState<UpdateState>('idle')
    const [info, setInfo] = useState<UpdateInfo | null>(null)
    const [progress, setProgress] = useState(0)
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        if (!isElectron()) return

        const onAvailable = (_event: any, data: UpdateInfo) => {
            setInfo(data)
            setState('available')
            setDismissed(false)
        }

        const onProgress = (_event: any, data: { percent: number }) => {
            setProgress(data.percent)
        }

        const onDownloaded = () => {
            setState('ready')
        }

        const onNotAvailable = () => {
            setState('uptodate')
            setDismissed(false)
            setTimeout(() => setDismissed(true), 3000)
        }

        window.ipcRenderer.on('update-available', onAvailable)
        window.ipcRenderer.on('update-not-available', onNotAvailable)
        window.ipcRenderer.on('update-progress', onProgress)
        window.ipcRenderer.on('update-downloaded', onDownloaded)

        return () => {
            window.ipcRenderer.off('update-available', onAvailable)
            window.ipcRenderer.off('update-not-available', onNotAvailable)
            window.ipcRenderer.off('update-progress', onProgress)
            window.ipcRenderer.off('update-downloaded', onDownloaded)
        }
    }, [])

    if (!isElectron() || state === 'idle' || dismissed) return null

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] animate-slide-up">
            <div className="bg-[#1a1a2e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 px-6 py-4 min-w-[400px] max-w-[500px]">

                {/* Available */}
                {state === 'available' && (
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-white">새 업데이트 v{info?.version}</p>
                            <p className="text-xs text-white/50 mt-0.5">새로운 버전이 출시되었습니다</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <button
                                onClick={() => setDismissed(true)}
                                className="px-3 py-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
                            >
                                나중에
                            </button>
                            <button
                                onClick={() => {
                                    setState('downloading')
                                    window.ipcRenderer.send('download-update')
                                }}
                                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-all active:scale-95"
                            >
                                다운로드
                            </button>
                        </div>
                    </div>
                )}

                {/* Downloading */}
                {state === 'downloading' && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 animate-pulse">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-white">다운로드 중... {progress}%</p>
                            </div>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Ready to Install */}
                {state === 'ready' && (
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-white">설치 준비 완료</p>
                            <p className="text-xs text-white/50 mt-0.5">앱을 재시작하면 업데이트가 적용됩니다</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <button
                                onClick={() => setDismissed(true)}
                                className="px-3 py-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
                            >
                                나중에
                            </button>
                            <button
                                onClick={() => window.ipcRenderer.send('install-update')}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all active:scale-95"
                            >
                                지금 설치
                            </button>
                        </div>
                    </div>
                )}

                {/* Up to date */}
                {state === 'uptodate' && (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <p className="text-sm text-white/70">최신 버전입니다!</p>
                    </div>
                )}
            </div>
        </div>
    )
}
