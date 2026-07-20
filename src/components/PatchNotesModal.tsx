import React from 'react'
import { useStore } from '../store'
import { isElectron } from '../utils/env'
import packageJson from '../../package.json'

interface PatchNotesModalProps {
    onDismiss: () => void
}

export const PatchNotesModal: React.FC<PatchNotesModalProps> = ({ onDismiss }) => {
    const { setSettings } = useStore()

    const handleDontShowAgain = () => {
        const newSettings = { lastSeenPatchNotes: packageJson.version }
        setSettings(newSettings)
        if (isElectron()) {
            window.ipcRenderer.invoke('set-settings', newSettings)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col ring-1 ring-white/10">
                <div className="h-24 bg-gradient-to-br from-blue-600/20 via-indigo-600/20 to-purple-600/20 relative flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
                    <h2 className="relative z-10 text-2xl font-bold text-white tracking-tight">
                        v{packageJson.version} 업데이트
                    </h2>
                </div>

                <div className="px-8 py-6 space-y-5 overflow-y-auto max-h-[60vh]">
                    <div className="space-y-4">
                        <p className="text-xs font-bold text-white/60 uppercase tracking-wider">버그 수정</p>

                        <div className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-500/30">1</span>
                            <div>
                                <p className="text-sm font-semibold text-white/90 mb-1">풍벽지가 화면 위로 사라지던 현상 수정</p>
                                <p className="text-xs text-white/50 leading-relaxed">
                                    별풍선이 쌓일 때 위에 있던 풍벽지가 화면 밖으로 밀려나던 문제를 해결했습니다.
                                    이미 화면 밖으로 나간 풍벽지는 "풍벽지 자동 정렬" 버튼으로 되돌릴 수 있습니다.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-500/30">2</span>
                            <div>
                                <p className="text-sm font-semibold text-white/90 mb-1">연속 후원 시 별풍선 누락 수정</p>
                                <p className="text-xs text-white/50 leading-relaxed">
                                    후원이 짧은 시간에 연달아 들어오면 가끔 별풍선이 누락되던 문제를 해결했습니다.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-500/30">3</span>
                            <div>
                                <p className="text-sm font-semibold text-white/90 mb-1">설정 저장 시 OBS 화면이 끊기던 문제 수정</p>
                                <p className="text-xs text-white/50 leading-relaxed">
                                    포트를 바꾸지 않았다면 설정을 저장해도 OBS 연결이 유지됩니다.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-500/30">4</span>
                            <div>
                                <p className="text-sm font-semibold text-white/90 mb-1">프로그램 안정성 개선</p>
                                <p className="text-xs text-white/50 leading-relaxed">
                                    그 외에 프로그램이 갑자기 종료되거나 후원이 표시되지 않던 여러 문제를 해결했습니다.
                                    자세한 내용은 "설정 &gt; 업데이트 로그"에서 확인할 수 있습니다.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onDismiss}
                            className="flex-1 py-3.5 bg-white/10 hover:bg-white/15 text-white/70 font-bold rounded-xl active:scale-[0.98] transition-all"
                        >
                            닫기
                        </button>
                        <button
                            onClick={handleDontShowAgain}
                            className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-all"
                        >
                            더이상 보지 않기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
