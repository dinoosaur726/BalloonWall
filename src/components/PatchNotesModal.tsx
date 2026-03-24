import React from 'react'
import { useStore } from '../store'
import { isElectron } from '../utils/env'
import packageJson from '../../package.json'

export const PatchNotesModal: React.FC = () => {
    const { setSettings } = useStore()

    const handleClose = () => {
        const newSettings = { lastSeenPatchNotes: packageJson.version }
        setSettings(newSettings)
        if (isElectron()) {
            window.ipcRenderer.invoke('set-settings', newSettings)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col ring-1 ring-white/10">
                <div className="h-24 bg-gradient-to-br from-blue-600/20 via-indigo-600/20 to-purple-600/20 relative flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
                    <h2 className="relative z-10 text-2xl font-bold text-white tracking-tight">
                        v{packageJson.version} 업데이트
                    </h2>
                </div>

                <div className="px-8 py-6 space-y-5">
                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-500/30">1</span>
                            <div>
                                <p className="text-sm font-semibold text-white/90 mb-1">카드 간 스냅 토글 추가</p>
                                <p className="text-xs text-white/50 leading-relaxed">
                                    설정 &gt; 디자인에서 카드 간 스냅 기능을 끌 수 있습니다. 끄면 카드를 더 자유롭게 배치할 수 있으며, 벽면 스냅은 그대로 유지됩니다.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-500/30">2</span>
                            <div>
                                <p className="text-sm font-semibold text-white/90 mb-1">크기 조절 시 주변 카드 밀기/당기기 제거</p>
                                <p className="text-xs text-white/50 leading-relaxed">
                                    카드 크기를 조절할 때 주변 카드가 밀리거나 당겨지던 동작을 제거했습니다. 버그가 잦아 삭제 조치하였습니다.
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleClose}
                        className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-all"
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    )
}
