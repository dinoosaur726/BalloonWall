import React, { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '../store'
import type { CustomBalloon } from '../store'
import appIcon from '../../build/icon.png'
import { isElectron } from '../utils/env'
import packageJson from '../../package.json'

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
    const [activeTab, setActiveTab] = useState<'settings' | 'design' | 'customBalloons' | 'history' | 'saves' | 'about' | 'feedback'>('settings')
    const [confirmReset, setConfirmReset] = useState(false)

    // Custom Balloon (추가시그) Form State
    const [newCustomAmount, setNewCustomAmount] = useState<number | ''>('')
    const [newCustomImage, setNewCustomImage] = useState<string>('')
    const [newCustomUseNormal, setNewCustomUseNormal] = useState(true)
    const [newCustomUseAd, setNewCustomUseAd] = useState(false)
    const [customBalloonError, setCustomBalloonError] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

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
        settings: '설정',
        customBalloons: '추가시그',
        design: '디자인',
        history: '기록',
        saves: '저장',
        about: '정보',
        feedback: '피드백'
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
                        {['settings', 'customBalloons', 'design', 'history', 'saves', 'about', 'feedback'].map((tab) => (
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
                                            <h4 className="text-xs font-semibold text-blue-400 mb-2">시그니처 풍선 (SOOP)</h4>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-white/60 mb-1.5">스트리머 아이디</label>
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
                                            * 스트리머 아이디와 시그니처 풍선 개수를 설정하면, 해당 개수의 별풍선 선물 시
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

                                {/* Ad Balloon Automation Settings */}
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-medium text-white/90">애드벌룬 자동 카드 생성</div>
                                            <div className="text-xs text-white/50 mt-0.5">
                                                {localSettings.autoAddAd ? '애드벌룬 후원 시 자동으로 카드를 생성합니다.' : '후원 기록만 남기고 카드는 수동으로 생성합니다.'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setLocalSettings({ ...localSettings, autoAddAd: !localSettings.autoAddAd })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.autoAddAd !== false ? 'bg-blue-500' : 'bg-gray-600'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.autoAddAd !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {localSettings.autoAddAd !== false && (
                                        <div className="pt-3 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <label className="block text-xs font-medium text-white/70 mb-1.5">
                                                애드벌룬 최소 금액 설정 (OO개 이상만 제작)
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="number"
                                                    value={localSettings.minAmountAd !== undefined ? localSettings.minAmountAd : 0}
                                                    onChange={(e) => setLocalSettings({ ...localSettings, minAmountAd: parseInt(e.target.value) || 0 })}
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

                    {activeTab === 'customBalloons' && (
                        <div className="space-y-6">
                            {/* Add Form */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider">추가시그 등록</h3>
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-white/70 mb-1.5">풍선 개수</label>
                                        <input
                                            type="number"
                                            placeholder="예: 500"
                                            value={newCustomAmount}
                                            onChange={(e) => setNewCustomAmount(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-white/20"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-white/70 mb-1.5">이미지</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/png,image/jpeg,image/gif,image/webp"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (!file) return
                                                    const reader = new FileReader()
                                                    reader.onload = () => {
                                                        setNewCustomImage(reader.result as string)
                                                    }
                                                    reader.readAsDataURL(file)
                                                    e.target.value = ''
                                                }}
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-xs font-semibold transition-all"
                                            >
                                                이미지 선택
                                            </button>
                                            {newCustomImage && (
                                                <img src={newCustomImage} alt="preview" className="w-10 h-10 object-contain rounded border border-white/10" />
                                            )}
                                            {newCustomImage && (
                                                <button
                                                    onClick={() => setNewCustomImage('')}
                                                    className="text-xs text-white/30 hover:text-white/60 transition-colors"
                                                >
                                                    취소
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-6">
                                        <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={newCustomUseNormal}
                                                onChange={(e) => setNewCustomUseNormal(e.target.checked)}
                                                className="rounded border-white/20 bg-black/20 text-blue-500 focus:ring-blue-500/50"
                                            />
                                            별풍선 적용
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={newCustomUseAd}
                                                onChange={(e) => setNewCustomUseAd(e.target.checked)}
                                                className="rounded border-white/20 bg-black/20 text-emerald-500 focus:ring-emerald-500/50"
                                            />
                                            애드벌룬 적용
                                        </label>
                                    </div>

                                    {customBalloonError && (
                                        <p className="text-xs text-red-400">{customBalloonError}</p>
                                    )}

                                    <button
                                        onClick={() => {
                                            setCustomBalloonError('')

                                            if (!newCustomAmount || newCustomAmount <= 0) {
                                                setCustomBalloonError('유효한 개수를 입력해주세요.')
                                                return
                                            }
                                            if (!newCustomImage) {
                                                setCustomBalloonError('이미지를 선택해주세요.')
                                                return
                                            }
                                            if (!newCustomUseNormal && !newCustomUseAd) {
                                                setCustomBalloonError('최소 하나의 유형을 선택해주세요.')
                                                return
                                            }

                                            const sigAmounts = (localSettings.signatureBalloons || '')
                                                .split(' ')
                                                .map(s => parseInt(s))
                                                .filter(n => !isNaN(n))

                                            if (sigAmounts.includes(newCustomAmount)) {
                                                setCustomBalloonError(`${newCustomAmount}개는 이미 시그니처 풍선으로 등록되어 있습니다.`)
                                                return
                                            }

                                            const existing = localSettings.customBalloons || []
                                            if (existing.some(cb => cb.amount === newCustomAmount)) {
                                                setCustomBalloonError(`${newCustomAmount}개는 이미 추가시그로 등록되어 있습니다.`)
                                                return
                                            }

                                            const newEntry: CustomBalloon = {
                                                id: uuidv4(),
                                                amount: newCustomAmount,
                                                imageDataUrl: newCustomImage,
                                                useForNormal: newCustomUseNormal,
                                                useForAd: newCustomUseAd
                                            }

                                            const updatedCustomBalloons = [...existing, newEntry]
                                            const updatedSettings = {
                                                ...localSettings,
                                                customBalloons: updatedCustomBalloons
                                            }
                                            setLocalSettings(updatedSettings)
                                            setSettings({ customBalloons: updatedCustomBalloons })
                                            if (isElectron()) {
                                                window.ipcRenderer.invoke('set-settings', updatedSettings)
                                            }

                                            setNewCustomAmount('')
                                            setNewCustomImage('')
                                            setNewCustomUseNormal(true)
                                            setNewCustomUseAd(false)
                                        }}
                                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
                                    >
                                        추가
                                    </button>
                                </div>
                            </div>

                            {/* List of Custom Balloons */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider">등록 목록</h3>
                                <div className="space-y-2">
                                    {(localSettings.customBalloons || []).map(cb => (
                                        <div key={cb.id} className="group flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/[0.07] transition-all">
                                            <div className="flex items-center gap-3">
                                                <img src={cb.imageDataUrl} alt={`${cb.amount}`} className="w-10 h-10 object-contain rounded border border-white/10" />
                                                <div>
                                                    <span className="font-medium text-white/90">{cb.amount.toLocaleString()}개</span>
                                                    <div className="flex gap-2 mt-0.5">
                                                        {cb.useForNormal && (
                                                            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-500/30">별풍선</span>
                                                        )}
                                                        {cb.useForAd && (
                                                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">애드벌룬</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const updatedCustomBalloons = (localSettings.customBalloons || []).filter(c => c.id !== cb.id)
                                                    const updatedSettings = {
                                                        ...localSettings,
                                                        customBalloons: updatedCustomBalloons
                                                    }
                                                    setLocalSettings(updatedSettings)
                                                    setSettings({ customBalloons: updatedCustomBalloons })
                                                    if (isElectron()) {
                                                        window.ipcRenderer.invoke('set-settings', updatedSettings)
                                                    }
                                                }}
                                                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/25 text-red-400/70 hover:text-red-300 rounded-lg text-xs font-medium transition-all"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    ))}
                                    {(!localSettings.customBalloons || localSettings.customBalloons.length === 0) && (
                                        <div className="flex flex-col items-center gap-2 py-10 text-white/20">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                            <span className="text-sm">등록된 추가시그가 없습니다</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 space-y-1">
                                <p className="text-[11px] text-blue-400/70 font-semibold">권장 이미지 사이즈</p>
                                <p className="text-[11px] text-white/40 leading-relaxed">
                                    480 x 280 px (비율 약 12:7). 이 비율에 맞는 이미지를 사용하면 카드에 꽉 차게 표시됩니다.
                                    다른 비율의 이미지도 사용 가능하며, 잘리지 않고 카드 안에 맞춰서 표시됩니다.
                                </p>
                            </div>

                            <div className="text-[11px] text-white/30 leading-relaxed">
                                * 시그니처 풍선(SOOP)에 등록된 개수와 중복되는 개수는 등록할 수 없습니다.
                                추가시그는 시그니처 풍선 다음, 기본 풍선 이미지 이전에 적용됩니다.
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
                                                <td className="px-4 py-3 font-medium">
                                                    <span className="flex items-center gap-2">
                                                        {item.type === 'Ad' && (
                                                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 w-fit">애드벌룬</span>
                                                        )}
                                                        {item.nickname}
                                                    </span>
                                                </td>
                                                <td className={`px-4 py-3 font-bold ${item.type === 'Ad' ? 'text-emerald-400' : 'text-blue-400'}`}>{item.amount.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => {
                                                            addCard(item.type || 'Normal', item.nickname, item.amount)
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

                    {activeTab === 'about' && (
                        <div className="space-y-6">
                            {/* App Info */}
                            <div className="text-center space-y-3 py-4">
                                <img src={appIcon} alt="App Icon" className="w-20 h-20 mx-auto rounded-2xl shadow-lg shadow-purple-500/20" />
                                <h3 className="text-xl font-bold text-white">Warudo 풍벽지</h3>
                                <p className="text-sm text-white/40">버전 {packageJson.version}</p>
                            </div>

                            {/* Streamer Profile */}
                            {(settings.streamerNameProfile || settings.streamerUrlProfile) && (
                                <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                                    <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">프로필</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-white/60">스트리머명</span>
                                            <span className="text-sm font-medium text-white">{settings.streamerNameProfile}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-white/60">방송국 주소</span>
                                            <a href={settings.streamerUrlProfile} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors truncate max-w-[200px]">
                                                {settings.streamerUrlProfile}
                                            </a>
                                        </div>
                                    </div>
                                    <div className="pt-3 mt-3 border-t border-white/5 flex justify-end">
                                        <button
                                            onClick={() => {
                                                if (window.confirm('프로필 정보를 삭제하고 다시 처음부터 설정하시겠습니까?')) {
                                                    const newSettings = {
                                                        ...useStore.getState().settings,
                                                        streamerNameProfile: '',
                                                        streamerUrlProfile: '',
                                                        hasCompletedWelcome: false
                                                    }
                                                    setSettings(newSettings)
                                                    if (isElectron()) {
                                                        window.ipcRenderer.invoke('set-settings', newSettings)
                                                    }
                                                    onClose()
                                                }
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all"
                                        >
                                            정보 초기화
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Creator */}
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                                <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">제작 정보</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-white/60">제작자</span>
                                        <span className="text-sm font-medium text-white">Dino_Labs</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-white/60">버전</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-mono text-white/80">v{packageJson.version}</span>
                                            {isElectron() && (
                                                <button
                                                    onClick={() => window.ipcRenderer.send('check-for-update')}
                                                    className="px-3 py-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-all"
                                                >
                                                    업데이트 확인
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Third-Party Assets / Copyright */}
                            <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                                <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">저작권 및 서드파티 에셋</h3>
                                <p className="text-[12px] text-white/60 leading-relaxed">
                                    본 프로그램(Warudo 풍벽지)의 소스코드, 구동 방식, 고유 UI 및 핵심 로직에 대한 저작권은 전적으로 <strong>Dino_Labs</strong>에 있습니다. 무단 복제 및 리버스 엔지니어링은 엄격히 금지됩니다.
                                </p>
                                <p className="text-[12px] text-white/50 leading-relaxed">
                                    다만, 프로그램 내에서 동적으로 로드되어 표시되는 <strong>스트리머 시그니쳐 별풍선, 애드벌룬, 기본 별풍선 등 일부 이미지 에셋</strong>의 모든 권리 및 저작권은 <strong>SOOP Co., Ltd.(주식회사 숲)</strong> 및 스트리머 혹은 해당 콘텐츠 원작자에게 귀속됩니다.
                                </p>
                                <p className="text-[11px] text-white/40 leading-relaxed">
                                    해당 서드파티 에셋에 대해 본 소프트웨어는 어떠한 소유권도 주장하지 않으며, 앱 기능 구현을 위해 외부 링크를 통해서만 로드됩니다.
                                </p>
                            </div>

                            {/* Warning */}
                            <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/10">
                                <p className="text-[11px] text-red-400/70 leading-relaxed text-center">
                                    ⚠️ 본 프로그램의 소스코드 및 구동 방식에 대한 무단 복제·재배포는 법적 조치의 대상이 됩니다.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'feedback' && (
                        <FeedbackTab />
                    )}
                </div>

                {/* Footer (Cancel/Save) */}
                {
                    (activeTab === 'settings' || activeTab === 'design' || activeTab === 'customBalloons') && (
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

const FEEDBACK_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyYgwk9uACllB1Zv3ViFKJ3MbTRTIFOc2HWaeLtxcxvy4tvVvKFmP6489zw7ZNPItl5/exec'

function FeedbackTab() {
    const [category, setCategory] = useState('bug')
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

    const categories = [
        { id: 'bug', label: '버그 제보' },
        { id: 'feature', label: '기능 제안' },
        { id: 'other', label: '기타 의견' },
    ]

    const handleSubmit = async () => {
        if (!title.trim() || !message.trim()) return
        setStatus('sending')

        const categoryLabel = categories.find(c => c.id === category)?.label || category

        try {
            const response = await fetch(FEEDBACK_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ 
                    category: categoryLabel,
                    title: title.trim(), 
                    body: message.trim(),
                    token: "VHldDKRxPPxhm6zlYyM1X4otbgG0rDJi2FdmmvjTPsXYsbOuEmRIvpbUpFu3lDzz" 
                }),
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                }
            })

            if (response.ok) {
                setStatus('sent')
                setTitle('')
                setMessage('')
                setTimeout(() => setStatus('idle'), 3000)
            } else {
                setStatus('error')
                setTimeout(() => setStatus('idle'), 3000)
            }
        } catch {
            setStatus('error')
            setTimeout(() => setStatus('idle'), 3000)
        }
    }

    return (
        <div className="space-y-6">
            <div className="text-center py-2">
                <h3 className="text-lg font-semibold text-white">개발자에게 전달하기</h3>
                <p className="text-xs text-white/40 mt-1">버그 제보, 기능 제안, 의견을 보내주세요</p>
            </div>

            {/* Category */}
            <div className="flex gap-2">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        className={`flex-1 py-2 px-3 text-xs font-medium rounded-lg border transition-all ${category === cat.id
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-transparent border-white/5 text-white/40 hover:text-white/60'
                            }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Title */}
            <div className="space-y-2">
                <label className="text-xs font-medium text-white/50">제목</label>
                <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="간단하게 요약해주세요"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
            </div>

            {/* Message */}
            <div className="space-y-2">
                <label className="text-xs font-medium text-white/50">내용</label>
                <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="자세한 내용을 적어주세요"
                    rows={5}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
                />
            </div>

            {/* Submit */}
            <button
                onClick={handleSubmit}
                disabled={!title.trim() || !message.trim() || status === 'sending'}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${status === 'sent'
                    ? 'bg-emerald-600 text-white'
                    : status === 'error'
                        ? 'bg-red-600 text-white'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20'
                    }`}
            >
                {status === 'sending' ? '전송 중...'
                    : status === 'sent' ? '✓ 전송 완료!'
                        : status === 'error' ? '✕ 전송 실패'
                            : '개발자에게 전달'}
            </button>

            <p className="text-[11px] text-white/25 text-center">
                피드백은 구글 시트로 안전하게 전송됩니다
            </p>
        </div>
    )
}
