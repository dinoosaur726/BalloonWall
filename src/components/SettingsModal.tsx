import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { isElectron } from '../utils/env'

interface SettingsModalProps {
    onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
    const store = useStore() // Get full store for actions
    const { settings, history, setSettings, addCard, loadState } = store
    const [localSettings, setLocalSettings] = useState(() => ({
        ...settings,
        design: settings.design || { showNickname: true, showAmount: true }
    }))
    const [activeTab, setActiveTab] = useState<'settings' | 'design' | 'history' | 'saves'>('settings')
    const [confirmReset, setConfirmReset] = useState(false)

    // Saves Management
    const [saveName, setSaveName] = useState('')
    const [savedInstances, setSavedInstances] = useState<string[]>([])

    useEffect(() => {
        setLocalSettings(prev => ({
            ...settings,
            design: settings.design || prev.design || { showNickname: true, showAmount: true }
        }))
        updateSavedInstances()
    }, [settings])

    const updateSavedInstances = () => {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('BW_SAVE_'))
        setSavedInstances(keys.map(k => k.replace('BW_SAVE_', '')))
    }

    const handleSaveSettings = () => {
        setSettings(localSettings)
        if (isElectron()) {
            window.ipcRenderer.invoke('set-settings', localSettings)
        }
        onClose()
    }

    const saveInstance = () => {
        if (!saveName) return
        const stateToSave = useStore.getState()
        localStorage.setItem(`BW_SAVE_${saveName}`, JSON.stringify(stateToSave))
        setSaveName('')
        updateSavedInstances()
    }

    const loadInstance = (name: string) => {
        const raw = localStorage.getItem(`BW_SAVE_${name}`)
        if (raw) {
            const parsed = JSON.parse(raw)
            loadState(parsed)
            onClose()
        }
    }

    const deleteInstance = (name: string) => {
        localStorage.removeItem(`BW_SAVE_${name}`)
        updateSavedInstances()
    }

    const handleSaveAndReset = () => {
        if (!saveName.trim()) return
        const stateToSave = useStore.getState()
        localStorage.setItem(`BW_SAVE_${saveName.trim()}`, JSON.stringify(stateToSave))
        updateSavedInstances()
        setSaveName('')
        store.resetState()
        setConfirmReset(false)
        onClose()
    }

    const handleDiscardAndReset = () => {
        store.resetState()
        setConfirmReset(false)
        onClose()
    }

    // Translation Map for Tabs
    const tabNames: Record<string, string> = {
        settings: '설정1',
        design: '디자인',
        history: '기록',
        saves: '저장'
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl text-white max-h-[90vh] flex flex-col ring-1 ring-white/10">
                {/* Header & Tabs */}
                <div className="p-6 pb-0 border-b border-white/10 shrink-0">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            설정
                        </h2>
                        <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">✕</button>
                    </div>

                    <div className="flex gap-6">
                        {['settings', 'design', 'history', 'saves'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeTab === tab ? 'border-blue-500 text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}
                            >
                                {tabNames[tab]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'settings' && (
                        <div className="space-y-8">
                            {/* Actions */}
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4">
                                <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">동작</h3>
                                <button
                                    onClick={() => {
                                        useStore.getState().autoOrganize()
                                        onClose()
                                    }}
                                    className="w-full py-3 px-4 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect className="rect" x="3" y="3" width="18" height="18" rx="2" ry="2" /><line className="line" x1="3" y1="9" x2="21" y2="9" /><line className="line" x1="9" y1="21" x2="9" y2="9" /></svg>
                                    카드 자동 정렬
                                </button>
                            </div>

                            {/* Network & OBS Settings */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider">연동 설정</h3>

                                <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-white/70 mb-1.5">웹소켓 포트</label>
                                        <input
                                            type="number"
                                            value={localSettings.wsPort}
                                            onChange={(e) => setLocalSettings({ ...localSettings, wsPort: parseInt(e.target.value) })}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-white/20"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-white/70 mb-1.5">OBS 브라우저 소스 포트</label>
                                        <input
                                            type="number"
                                            value={localSettings.httpPort || 3006}
                                            onChange={(e) => setLocalSettings({ ...localSettings, httpPort: parseInt(e.target.value) || 3006 })}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-white/20"
                                        />
                                        <div className="mt-2 p-2.5 bg-black/30 rounded-lg border border-white/5">
                                            <p className="text-[11px] text-white/50 mb-1">OBS 브라우저 소스 URL:</p>
                                            <code className="text-xs text-emerald-400 font-mono select-all break-all">
                                                {`http://localhost:${localSettings.httpPort || 3006}?wsPort=${localSettings.wsPort || 3005}`}
                                            </code>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                                        <div className="col-span-2">
                                            <h4 className="text-xs font-semibold text-blue-400 mb-2">시그니처 풍선 (SOOP/AfreecaTV)</h4>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-white/60 mb-1.5">BJ 아이디</label>
                                            <input
                                                type="text"
                                                placeholder="sooplive ID"
                                                value={localSettings.streamerId || ''}
                                                onChange={(e) => setLocalSettings({ ...localSettings, streamerId: e.target.value })}
                                                className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-white/20"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-white/60 mb-1.5">시그니처 개수 (공백 구분)</label>
                                            <input
                                                type="text"
                                                placeholder="예: 100 282 486"
                                                value={localSettings.signatureBalloons || ''}
                                                onChange={(e) => setLocalSettings({ ...localSettings, signatureBalloons: e.target.value })}
                                                className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-white/20"
                                            />
                                        </div>
                                        <div className="col-span-2 text-[11px] text-white/30 leading-relaxed">
                                            * BJ 아이디와 시그니처 풍선 개수를 설정하면, 해당 개수의 별풍선 선물 시
                                            자동으로 방송국의 시그니처 이미지를 불러옵니다.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Automation Settings */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider">자동화 설정</h3>

                                <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-medium text-white/90">자동 카드 생성</div>
                                            <div className="text-xs text-white/50 mt-0.5">
                                                {localSettings.autoAdd ? '후원 시 자동으로 카드를 생성합니다.' : '후원 기록만 남기고 카드는 수동으로 생성합니다.'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setLocalSettings({ ...localSettings, autoAdd: !localSettings.autoAdd })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.autoAdd ? 'bg-blue-500' : 'bg-gray-600'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.autoAdd ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {localSettings.autoAdd && (
                                        <div className="pt-3 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <label className="block text-xs font-medium text-white/70 mb-1.5">
                                                최소 금액 설정 (OO개 이상만 제작)
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="number"
                                                    value={localSettings.minAmount}
                                                    onChange={(e) => setLocalSettings({ ...localSettings, minAmount: parseInt(e.target.value) || 0 })}
                                                    className="w-24 bg-black/20 border border-white/10 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-white/20"
                                                />
                                                <span className="text-xs text-white/40">개 이상 후원 시에만 자동 생성</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'design' && (
                        <div className="space-y-8">
                            {/* Design Settings */}
                            <div className="space-y-6">
                                {/* Text Visibility */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider">텍스트 표시</h3>
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-white/90">닉네임 표시</span>
                                            <button
                                                onClick={() => setLocalSettings({
                                                    ...localSettings,
                                                    design: { ...localSettings.design, showNickname: !localSettings.design.showNickname }
                                                })}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.design.showNickname ? 'bg-blue-500' : 'bg-gray-600'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.design.showNickname ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                            <span className="text-sm font-medium text-white/90">개수 표시</span>
                                            <button
                                                onClick={() => setLocalSettings({
                                                    ...localSettings,
                                                    design: { ...localSettings.design, showAmount: !localSettings.design.showAmount }
                                                })}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.design.showAmount ? 'bg-blue-500' : 'bg-gray-600'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.design.showAmount ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>


                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-2">후원 기록</h3>
                            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-white/5 text-white/50 uppercase text-xs font-semibold">
                                        <tr>
                                            <th className="px-4 py-3">시간</th>
                                            <th className="px-4 py-3">닉네임</th>
                                            <th className="px-4 py-3">금액 (후원)</th>
                                            <th className="px-4 py-3 text-right">동작</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {history && history.map((item) => (
                                            <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-3 text-white/40">{new Date(item.timestamp).toLocaleTimeString()}</td>
                                                <td className="px-4 py-3 font-medium">{item.nickname}</td>
                                                <td className="px-4 py-3 text-blue-400 font-bold">{item.amount.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => {
                                                            addCard(item.nickname, item.amount)
                                                            onClose()
                                                        }}
                                                        className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs font-medium transition-colors"
                                                    >
                                                        카드 생성
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {(!history || history.length === 0) && (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-8 text-center text-white/30">
                                                    해당 기록 없음
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'saves' && (
                        <div className="space-y-6">
                            {/* 현재 상태 저장 */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider">현재 상태 저장</h3>
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="저장할 이름을 입력하세요"
                                            value={saveName}
                                            onChange={(e) => setSaveName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && saveInstance()}
                                            className="flex-1 bg-black/20 border border-white/10 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-white/20"
                                        />
                                        <button
                                            onClick={saveInstance}
                                            disabled={!saveName.trim()}
                                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
                                        >
                                            저장
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-white/30">현재 카드 배치와 설정을 저장합니다. 같은 이름이 있으면 덮어씁니다.</p>
                                </div>
                            </div>

                            {/* 저장 목록 */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider">저장 목록</h3>
                                <div className="space-y-2">
                                    {savedInstances.map(name => (
                                        <div key={name} className="group flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/[0.07] transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">B</div>
                                                <span className="font-medium text-white/90">{name}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => loadInstance(name)}
                                                    className="px-3.5 py-1.5 bg-blue-500/15 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 rounded-lg text-xs font-semibold transition-all"
                                                >
                                                    불러오기
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm(`"${name}" 저장을 삭제하시겠습니까?`)) {
                                                            deleteInstance(name)
                                                        }
                                                    }}
                                                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/25 text-red-400/70 hover:text-red-300 rounded-lg text-xs font-medium transition-all"
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {savedInstances.length === 0 && (
                                        <div className="flex flex-col items-center gap-2 py-10 text-white/20">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                                            <span className="text-sm">아직 저장된 항목이 없습니다</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 초기화 */}
                            <div className="space-y-3 pt-2 border-t border-white/5">
                                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider">초기화</h3>
                                {!confirmReset ? (
                                    <button
                                        onClick={() => setConfirmReset(true)}
                                        className="w-full py-3 bg-white/5 hover:bg-red-500/10 text-white/50 hover:text-red-400 font-medium rounded-xl border border-white/10 hover:border-red-500/30 transition-all text-sm"
                                    >
                                        모든 카드 초기화
                                    </button>
                                ) : (
                                    <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <p className="text-sm text-red-300 font-medium text-center">현재 카드를 모두 삭제하고 처음부터 시작합니다</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setConfirmReset(false)}
                                                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm font-medium transition-all"
                                            >
                                                취소
                                            </button>
                                            <button
                                                onClick={handleSaveAndReset}
                                                disabled={!saveName.trim()}
                                                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-all"
                                            >
                                                저장 후 초기화
                                            </button>
                                            <button
                                                onClick={handleDiscardAndReset}
                                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-semibold transition-all"
                                            >
                                                바로 초기화
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-white/30 text-center">"저장 후 초기화"를 누르려면 먼저 위에서 저장 이름을 입력하세요</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer (Cancel/Save) */}
                {
                    (activeTab === 'settings' || activeTab === 'design') && (
                        <div className="flex justify-end gap-3 p-6 border-t border-white/10 bg-[#1e1e1e] rounded-b-2xl shrink-0">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSaveSettings}
                                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                            >
                                설정 저장
                            </button>
                        </div>
                    )
                }
            </div >
        </div >
    )
}
