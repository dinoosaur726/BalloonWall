import React, { useState, useEffect } from 'react'
import { useStore } from '../store'

interface SettingsModalProps {
    onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
    const store = useStore() // Get full store for actions
    const { settings, history, setSettings, addCard, loadState } = store
    const [localSettings, setLocalSettings] = useState(settings)
    const [activeTab, setActiveTab] = useState<'settings' | 'history' | 'saves'>('settings')

    // Saves Management
    const [saveName, setSaveName] = useState('')
    const [savedInstances, setSavedInstances] = useState<string[]>([])

    useEffect(() => {
        setLocalSettings(settings)
        updateSavedInstances()
    }, [settings])

    const updateSavedInstances = () => {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('BW_SAVE_'))
        setSavedInstances(keys.map(k => k.replace('BW_SAVE_', '')))
    }

    const handleSaveSettings = () => {
        setSettings(localSettings)
        window.ipcRenderer.invoke('set-settings', localSettings)
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

    const handleNewInstance = () => {
        // User request:
        // 1. Ask "Save current instance?"
        // 2. Yes -> Ask specific name -> Save -> Reset
        // 3. No -> Reset immediately (discard)

        // We use window.confirm. OK = Yes (Save), Cancel = No (Discard)
        // To allow an actual "Cancel Operation", we normally need a custom modal.
        // But adhering to instructions:
        const wantToSave = window.confirm("Do you want to SAVE your current instance before starting a new one?\n\nOK = Save & Reset\nCancel = Don't Save (Just Reset)")

        if (wantToSave) {
            // Yes, Save
            const name = window.prompt("Enter name for this save:")
            if (name) {
                const stateToSave = useStore.getState()
                localStorage.setItem(`BW_SAVE_${name}`, JSON.stringify(stateToSave))
                updateSavedInstances()
                store.resetState()
                onClose() // Close modal
            }
            // If they cancel the name prompt, maybe they want to cancel the whole thing?
            // checking "if (name)" protects against empty/cancel.
        } else {
            // No, Don't Save -> Reset immediately
            store.resetState()
            onClose()
        }
    }



    const handleRangeChange = (index: number, field: string, value: string | number) => {
        const newRanges = [...localSettings.amountRanges]
        newRanges[index] = { ...newRanges[index], [field]: value }
        setLocalSettings({ ...localSettings, amountRanges: newRanges })
    }

    // Translation Map for Tabs
    const tabNames: Record<string, string> = {
        settings: '설정',
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
                            제어판
                        </h2>
                        <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">✕</button>
                    </div>

                    <div className="flex gap-6">
                        {['settings', 'history', 'saves'].map((tab) => (
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

                            {/* General Settings */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider">일반 설정</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-white/70 mb-1.5">웹소켓 포트</label>
                                        <input
                                            type="number"
                                            value={localSettings.wsPort}
                                            onChange={(e) => setLocalSettings({ ...localSettings, wsPort: parseInt(e.target.value) })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-white/20"
                                        />
                                    </div>

                                    <div className="col-span-2 grid grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                                            <span className="text-sm font-medium text-white/90">투명 배경</span>
                                            <button
                                                onClick={() => setLocalSettings({ ...localSettings, isTransparent: !localSettings.isTransparent, isGreenScreen: false })}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.isTransparent ? 'bg-blue-500' : 'bg-gray-600'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.isTransparent ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                                            <span className="text-sm font-medium text-white/90">크로마키 (초록)</span>
                                            <button
                                                onClick={() => setLocalSettings({ ...localSettings, isGreenScreen: !localSettings.isGreenScreen, isTransparent: false })}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.isGreenScreen ? 'bg-green-500' : 'bg-gray-600'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.isGreenScreen ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                        <div className="col-span-2 flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                                            <span className="text-sm font-medium text-white/90">UI 숨기기 (방송 모드)</span>
                                            <button
                                                onClick={() => setLocalSettings({ ...localSettings, hideUI: !localSettings.hideUI })}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.hideUI ? 'bg-red-500' : 'bg-gray-600'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.hideUI ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Range Settings */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider">규칙 및 색상 관리</h3>
                                <div className="space-y-3">
                                    {localSettings.amountRanges.map((range, idx) => (
                                        <div key={idx} className="group flex gap-2 items-center bg-white/5 p-2 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-white/40">최소</span>
                                                    <input
                                                        type="number"
                                                        value={range.min}
                                                        onChange={(e) => handleRangeChange(idx, 'min', parseInt(e.target.value))}
                                                        className="w-20 bg-black/20 border border-white/10 rounded-md p-1.5 text-sm text-center focus:outline-none focus:border-blue-500/50"
                                                    />
                                                </div>
                                            </div>
                                            <div className="h-8 w-px bg-white/10 mx-1" />
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-white/40">최대</span>
                                                <input
                                                    type="number"
                                                    value={range.max}
                                                    onChange={(e) => handleRangeChange(idx, 'max', parseInt(e.target.value))}
                                                    className="w-24 bg-black/20 border border-white/10 rounded-md p-1.5 text-sm text-center focus:outline-none focus:border-blue-500/50"
                                                />
                                            </div>
                                            <div className="flex-1 ml-2">
                                                <div className="flex w-full items-center gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="이미지 URL 또는 'gold'..."
                                                        value={range.imageUrl}
                                                        onChange={(e) => handleRangeChange(idx, 'imageUrl', e.target.value)}
                                                        className="flex-1 bg-transparent border-b border-white/10 py-1.5 text-sm text-white/90 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-white/20"
                                                    />
                                                    <button
                                                        onClick={async () => {
                                                            const path = await window.ipcRenderer.invoke('select-image');
                                                            if (path) handleRangeChange(idx, 'imageUrl', path);
                                                        }}
                                                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md text-white/50 hover:text-white transition-colors"
                                                        title="이미지 선택"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" /></svg>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Color Picker */}
                                            <div className="flex flex-col gap-1 items-center px-2">
                                                <span className="text-xs text-white/40">색상</span>
                                                <input
                                                    type="color"
                                                    value={range.textColor || '#2563eb'}
                                                    onChange={(e) => handleRangeChange(idx, 'textColor', e.target.value)}
                                                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0"
                                                    title="글자 색상"
                                                />
                                            </div>
                                            <div className={`w-8 h-8 rounded-full border border-white/20 shadow-inner ${range.imageUrl === 'gold' ? 'bg-yellow-500' :
                                                range.imageUrl === 'silver' ? 'bg-gray-400' :
                                                    range.imageUrl === 'bronze' ? 'bg-orange-700' :
                                                        range.imageUrl === 'default' ? 'bg-blue-500' : 'bg-white/10'
                                                }`}>
                                                {!['gold', 'silver', 'bronze', 'default'].includes(range.imageUrl) && (
                                                    <img src={range.imageUrl} className="w-full h-full object-cover rounded-full opacity-70" />
                                                )}
                                            </div>

                                            {/* Delete Button */}
                                            <button
                                                onClick={() => {
                                                    const newRanges = localSettings.amountRanges.filter((_, i) => i !== idx)
                                                    setLocalSettings({ ...localSettings, amountRanges: newRanges })
                                                }}
                                                className="p-1.5 ml-2 text-white/20 hover:text-red-400 hover:bg-white/5 rounded-full transition-colors"
                                                title="Remove Range"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    className="w-full py-2.5 border border-dashed border-white/20 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                                    onClick={() => setLocalSettings({
                                        ...localSettings,
                                        amountRanges: [...localSettings.amountRanges, { min: 0, max: 0, imageUrl: 'default', textColor: '#2563eb' }]
                                    })}
                                >
                                    <span>+</span> 범위 추가 (테마)
                                </button>
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
                            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-3">
                                <h3 className="text-sm font-semibold text-blue-200 uppercase tracking-wider">세션 관리</h3>
                                <button
                                    onClick={handleNewInstance}
                                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                                >
                                    새 인스턴스 시작
                                </button>
                                <p className="text-xs text-blue-200/60 text-center">
                                    새로 시작하기 전에 현재 상태를 저장할 수 있습니다.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider">현재 상태 저장</h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="저장 이름 입력..."
                                        value={saveName}
                                        onChange={(e) => setSaveName(e.target.value)}
                                        className="flex-1 bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                    />
                                    <button
                                        onClick={saveInstance}
                                        disabled={!saveName}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                                    >
                                        저장
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider">저장된 목록 불러오기</h3>
                                <div className="space-y-2">
                                    {savedInstances.map(name => (
                                        <div key={name} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
                                            <span className="font-medium text-white/90 pl-1">{name}</span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => loadInstance(name)}
                                                    className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 rounded-lg text-xs font-medium transition-colors"
                                                >
                                                    불러오기
                                                </button>
                                                <button
                                                    onClick={() => deleteInstance(name)}
                                                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 rounded-lg text-xs font-medium transition-colors"
                                                >
                                                    삭제
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {savedInstances.length === 0 && (
                                        <div className="p-8 text-center text-white/30 italic border border-dashed border-white/10 rounded-xl">
                                            저장된 인스턴스가 없습니다
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer (Cancel/Save) - Only for Settings Tab? Or global? */}
                {/* Save Changes mainly applies to "settings" tab changes. History/Saves are instant. */}
                {activeTab === 'settings' && (
                    <div className="flex justify-end gap-3 p-6 border-t border-white/10 bg-[#1e1e1e] rounded-b-2xl shrink-0">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveSettings}
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                        >
                            Save Changes
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
