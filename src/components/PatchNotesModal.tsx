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
                        <div className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-500/30">1</span>
                            <div>
                                <p className="text-sm font-semibold text-white/90 mb-1">도전미션/대결미션 풍선 추가</p>
                                <p className="text-xs text-white/50 leading-relaxed">
                                    도전미션과 대결미션 풍선 유형이 새로 추가되었습니다. 개수에 따라 3단계 이미지가 적용됩니다.
                                </p>
                                <div className="mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                    <p className="text-xs font-bold text-amber-400 mb-1.5">블루프린트 교체 필수</p>
                                    <p className="text-[11px] text-amber-300/70 leading-relaxed">
                                        도전미션/대결미션을 지원하려면 와루도 블루프린트를 새 버전으로 교체해야 합니다.
                                        아래 구글 드라이브 링크에서 블루프린트를 다운받은 후, 기존 블루프린트 삭제 &rarr; 새 블루프린트 임포트를 진행해주세요.
                                        블루프린트 교체 방법을 모르시는 분들을 위한 안내 영상도 같은 링크에 업로드되어 있습니다.
                                    </p>
                                    <button
                                        onClick={() => {
                                            const url = 'https://drive.google.com/drive/folders/12I-dmmVXG1C0UcqHdwob-1vwbwBUBe_Z?usp=sharing'
                                            if (isElectron() && window.ipcRenderer) {
                                                window.ipcRenderer.send('open-external', url)
                                            } else {
                                                window.open(url, '_blank')
                                            }
                                        }}
                                        className="mt-2 text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2 cursor-pointer"
                                    >
                                        블루프린트 다운로드 (구글 드라이브)
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-500/30">2</span>
                            <div>
                                <p className="text-sm font-semibold text-white/90 mb-1">도전미션/대결미션 자동화 설정</p>
                                <p className="text-xs text-white/50 leading-relaxed">
                                    설정에서 도전미션과 대결미션 각각의 자동 카드 생성 및 최소 금액을 별도로 설정할 수 있습니다.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-500/30">3</span>
                            <div>
                                <p className="text-sm font-semibold text-white/90 mb-1">시그니처/추가시그 미션 지원</p>
                                <p className="text-xs text-white/50 leading-relaxed">
                                    시그니처 이미지와 추가시그를 도전미션·대결미션에도 적용할 수 있는 옵션이 추가되었습니다.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-500/30">4</span>
                            <div>
                                <p className="text-sm font-semibold text-white/90 mb-1">업데이트 로그 탭 추가</p>
                                <p className="text-xs text-white/50 leading-relaxed">
                                    설정에서 모든 과거 업데이트 내역을 확인할 수 있습니다.
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
