import React, { useState } from 'react'
import { useStore } from '../store'
import { isElectron } from '../utils/env'
import appIcon from '../../build/icon.png'

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyh_QVvKbpB7T0vf_Q4oGfQNtAMerDvQfgvm1guckXr55s71UtIUysFl1oWVowuoQQ/exec'

export const WelcomeModal: React.FC = () => {
    const { setSettings } = useStore()
    const [streamerName, setStreamerName] = useState('')
    const [streamerUrl, setStreamerUrl] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!streamerName.trim() || !streamerUrl.trim()) {
            setError('스트리머명과 방송국 주소를 모두 입력해주세요.')
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    streamerName,
                    streamerUrl,
                    token: "VHldDKRxPPxhm6zlYyM1X4otbgG0rDJi2FdmmvjTPsXYsbOuEmRIvpbUpFu3lDzz"
                }),
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                }
            })

            if (!response.ok) {
                console.warn('Google Script returned non-ok status', response.status)
            }

            const newSettings = {
                streamerNameProfile: streamerName,
                streamerUrlProfile: streamerUrl,
                hasCompletedWelcome: true
            }

            setSettings(newSettings)

            if (isElectron()) {
                window.ipcRenderer.invoke('set-settings', newSettings)
            }

        } catch (err: any) {
            console.error('Failed to submit welcome info:', err)
            const newSettings = {
                streamerNameProfile: streamerName,
                streamerUrlProfile: streamerUrl,
                hasCompletedWelcome: true
            }
            setSettings(newSettings)
            if (isElectron()) {
                window.ipcRenderer.invoke('set-settings', newSettings)
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col ring-1 ring-white/10 relative">

                <div className="h-32 bg-gradient-to-br from-indigo-600/20 via-purple-600/20 to-blue-600/20 absolute top-0 left-0 w-full z-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
                </div>

                <div className="relative z-10 px-8 pt-10 pb-8 flex flex-col items-center">
                    <div className="w-20 h-20 bg-[#1e1e1e] rounded-2xl p-2 shadow-xl ring-1 ring-white/10 mb-6 relative">
                        <img src={appIcon} alt="App Icon" className="w-full h-full object-contain rounded-xl" />
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
                        환영합니다!
                    </h2>
                    <p className="text-sm text-white/50 text-center mb-8">
                        프로그램을 사용하기 위해 스트리머 정보를 입력해주세요. <br />이 정보는 설정에서 확인할 수 있습니다.
                    </p>

                    <form onSubmit={handleSubmit} className="w-full space-y-5">
                        <div className="space-y-2">
                            <label className="text-[13px] font-semibold text-white/70 ml-1">스트리머명</label>
                            <input
                                type="text"
                                value={streamerName}
                                onChange={(e) => setStreamerName(e.target.value)}
                                placeholder="예. DinoLabs"
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-white/20"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[13px] font-semibold text-white/70 ml-1">SOOP 방송국 주소</label>
                            <input
                                type="url"
                                value={streamerUrl}
                                onChange={(e) => setStreamerUrl(e.target.value)}
                                placeholder="https://www.sooplive.co.kr/station/아이디"
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-white/20"
                                required
                            />
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs text-center font-medium">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full mt-4 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    저장 중...
                                </>
                            ) : (
                                "시작하기"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
