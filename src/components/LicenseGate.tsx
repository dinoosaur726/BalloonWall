import { useState, useEffect, type ReactNode } from 'react'
import { isElectron } from '../utils/env'

interface LicenseGateProps {
    children: ReactNode
}

export function LicenseGate({ children }: LicenseGateProps) {
    const [status, setStatus] = useState<'loading' | 'unlocked' | 'locked'>('loading')
    const [licenseKey, setLicenseKey] = useState('')
    const [error, setError] = useState('')
    const [verifying, setVerifying] = useState(false)

    // Skip gate in browser mode (OBS) — only Electron needs license
    if (!isElectron()) {
        return <>{children}</>
    }

    // Check license on mount
    useEffect(() => {
        checkLicenseStatus()
    }, [])

    const checkLicenseStatus = async () => {
        try {
            const result = await window.ipcRenderer.invoke('get-license-status')

            if (result.isActivated) {
                // Already activated on this machine — verify with Gumroad (no increment)
                const verifyResult = await window.ipcRenderer.invoke('verify-license', result.licenseKey)
                if (verifyResult.success) {
                    setStatus('unlocked')
                } else {
                    // License invalid (refunded, etc.) — show input
                    setError(verifyResult.error || '라이센스가 만료되었습니다.')
                    setStatus('locked')
                }
            } else {
                setStatus('locked')
            }
        } catch (err) {
            console.error('[LicenseGate] Failed to check status:', err)
            setStatus('locked')
        }
    }

    const handleVerify = async () => {
        const trimmed = licenseKey.trim()
        if (!trimmed) {
            setError('라이센스 키를 입력하세요.')
            return
        }

        setError('')
        setVerifying(true)

        try {
            const result = await window.ipcRenderer.invoke('verify-license', trimmed)

            if (result.success) {
                setStatus('unlocked')
            } else {
                setError(result.error || '인증에 실패했습니다.')
            }
        } catch (err: any) {
            setError('인증 중 오류가 발생했습니다.')
        } finally {
            setVerifying(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !verifying) {
            handleVerify()
        }
    }

    // Loading state
    if (status === 'loading') {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <div style={styles.spinner} />
                    <p style={styles.loadingText}>라이센스 확인 중...</p>
                </div>
            </div>
        )
    }

    // Unlocked — render app
    if (status === 'unlocked') {
        return <>{children}</>
    }

    // Locked — show license input
    return (
        <div style={styles.container}>
            <div style={styles.card}>
                {/* Logo / Title */}
                <div style={styles.titleSection}>
                    <h1 style={styles.title}>Warudo 자동 풍벽지</h1>
                    <p style={styles.subtitle}>Created by Dino_Labs</p>
                </div>

                {/* Input */}
                <div style={styles.inputGroup}>
                    <input
                        type="text"
                        value={licenseKey}
                        onChange={(e) => setLicenseKey(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                        disabled={verifying}
                        style={{
                            ...styles.input,
                            ...(verifying ? styles.inputDisabled : {})
                        }}
                    />
                    <button
                        onClick={handleVerify}
                        disabled={verifying}
                        style={{
                            ...styles.button,
                            ...(verifying ? styles.buttonDisabled : {})
                        }}
                    >
                        {verifying ? '인증 중...' : '인증'}
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div style={styles.errorBox}>
                        <span style={styles.errorIcon}>⚠️</span>
                        <span style={styles.errorText}>{error}</span>
                    </div>
                )}

                {/* Help */}
                <p style={styles.helpText}>
                    Gumroad에서 구매 후 이메일로 받은 라이센스 키를 입력하세요.
                </p>
            </div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a2e',
        zIndex: 99999,
        fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
    },
    card: {
        background: '#16213e',
        borderRadius: 16,
        padding: '48px 40px',
        maxWidth: 480,
        width: '90%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        alignItems: 'center',
    },
    titleSection: {
        textAlign: 'center' as const,
    },
    title: {
        fontSize: 28,
        fontWeight: 700,
        color: '#e2e8f0',
        margin: '0 0 8px 0',
    },
    subtitle: {
        fontSize: 14,
        color: '#94a3b8',
        margin: 0,
    },
    inputGroup: {
        display: 'flex',
        gap: 10,
        width: '100%',
    },
    input: {
        flex: 1,
        padding: '12px 16px',
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Consolas', monospace",
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.05)',
        color: '#e2e8f0',
        outline: 'none',
        letterSpacing: '0.5px',
    },
    inputDisabled: {
        opacity: 0.5,
        cursor: 'not-allowed',
    },
    button: {
        padding: '12px 24px',
        fontSize: 14,
        fontWeight: 600,
        borderRadius: 10,
        border: 'none',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        color: '#ffffff',
        cursor: 'pointer',
        whiteSpace: 'nowrap' as const,
        transition: 'opacity 0.2s, transform 0.1s',
    },
    buttonDisabled: {
        opacity: 0.5,
        cursor: 'not-allowed',
    },
    errorBox: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '12px 16px',
        borderRadius: 10,
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        width: '100%',
    },
    errorIcon: {
        fontSize: 16,
        flexShrink: 0,
    },
    errorText: {
        fontSize: 13,
        color: '#fca5a5',
        lineHeight: 1.5,
        whiteSpace: 'pre-line' as const,
    },
    helpText: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center' as const,
        margin: 0,
    },
    spinner: {
        width: 32,
        height: 32,
        border: '3px solid rgba(255,255,255,0.1)',
        borderTopColor: '#667eea',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },
    loadingText: {
        fontSize: 14,
        color: '#94a3b8',
        margin: 0,
    },
}

// Inject spinner animation
if (typeof document !== 'undefined') {
    const styleEl = document.createElement('style')
    styleEl.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `
    document.head.appendChild(styleEl)
}
