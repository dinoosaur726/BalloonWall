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
                        <p className="text-xs font-bold text-white/60 uppercase tracking-wider">기능 업데이트</p>

                        <div className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-500/30">1</span>
                            <div>
                                <p className="text-sm font-semibold text-white/90 mb-1">피드백 스트리머명 자동 첨부</p>
                                <p className="text-xs text-white/50 leading-relaxed">
                                    피드백 전송 시 스트리머명이 제목에 자동으로 포함됩니다. 내용 확인 후 필요한 경우 디스코드를 통해 답변드리겠습니다.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center border border-blue-500/30">2</span>
                            <div>
                                <p className="text-sm font-semibold text-white/90 mb-1">영상풍선 지원</p>
                                <p className="text-xs text-white/50 leading-relaxed">
                                    영상풍선을 지원합니다. 구글 드라이브에서 새 블루프린트를 다운받아 기존 블루프린트에 덮어씌워주세요.
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
                                    className="mt-1.5 text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2 cursor-pointer"
                                >
                                    블루프린트 다운로드 (구글 드라이브)
                                </button>
                            </div>
                        </div>

                    </div>

                    <div className="space-y-4">
                        <p className="text-xs font-bold text-white/60 uppercase tracking-wider">질문 답변</p>

                        <div className="flex gap-3">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400/60 mt-1.5" />
                            <div>
                                <p className="text-sm font-semibold text-white/90 mb-0.5">저장된 기록 불러오기 후 별풍선이 쌓이지 않는 이슈</p>
                                <p className="text-xs text-white/50 leading-relaxed">확인 결과 현재 재현되지 않는 이슈입니다. 재현이 가능해지면 다시 확인하겠습니다.</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400/60 mt-1.5" />
                            <div>
                                <p className="text-sm font-semibold text-white/90 mb-0.5">시그니처 사이즈 통일 요청</p>
                                <p className="text-xs text-white/50 leading-relaxed">숲에 등록된 시그니처는 스트리머·제작자마다 규격이 미세하게 다르기 때문에 일괄 통일이 불가능합니다.</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400/60 mt-1.5" />
                            <div>
                                <p className="text-sm font-semibold text-white/90 mb-0.5">별풍선이 끝없이 쌓이면 사라지는 현상</p>
                                <p className="text-xs text-white/50 leading-relaxed">공간이 부족해지면 좌상단에 카드가 생성되고, 계속 쌓이면서 밀려나 사라지는 것처럼 보이는 현상입니다. 빠른 패치가 어려운 만큼, 좌상단에 카드가 생성되면 빠르게 위치를 잡아주시는 것을 권장합니다.</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400/60 mt-1.5" />
                            <div>
                                <p className="text-sm font-semibold text-white/90 mb-0.5">영상풍선이 추가시그와 겹치는 현상</p>
                                <p className="text-xs text-white/50 leading-relaxed">영상풍선은 기존에 지원하지 않던 기능으로, 이번 업데이트에서 새로 추가된 영역입니다. 추가시그와는 무관합니다.</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-xs font-bold text-white/60 uppercase tracking-wider">당부 사항</p>
                        <p className="text-xs text-white/50 leading-relaxed">
                            다양한 의견을 보내주시는 점 항상 감사드립니다. 다만 다수가 필요로 하는 기능을 우선적으로 개발할 수밖에 없는 점 양해 부탁드립니다. 또한 존재하지 않는 기능이 동작하지 않는 것은 버그가 아닙니다. 버그 제보와 기능 제안을 구분하여 보내주시면 감사하겠습니다.
                        </p>
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
