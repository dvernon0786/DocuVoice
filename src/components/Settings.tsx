import React, { useState, useEffect } from 'react'
import { encryptToLocalStorage, decryptFromLocalStorage, removeItemEncrypted } from '../lib/secureStorage'

type Props = {
  onClose: () => void
}

export default function Settings({ onClose }: Props) {
  const [webGPU, setWebGPU] = useState<'checking' | 'available' | 'unavailable'>('checking')
  const [memory, setMemory] = useState<string>('unknown')
  const [passphrase, setPassphrase] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [keyStatus, setKeyStatus] = useState<'none' | 'saved' | 'loaded' | 'error'>('none')
  const [medMode, setMedMode] = useState(() => localStorage.getItem('medMode') === '1')
  const [cloudEnabled, setCloudEnabled] = useState(() => localStorage.getItem('cloudFallback') === '1')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    // WebGPU detection
    ;(async () => {
      try {
        // @ts-ignore
        const adapter = await navigator?.gpu?.requestAdapter?.()
        setWebGPU(adapter ? 'available' : 'unavailable')
      } catch {
        setWebGPU('unavailable')
      }
    })()

    // Memory
    // @ts-ignore
    const mem = (navigator as any)?.deviceMemory
    if (mem) setMemory(`${mem} GB`)

    // Check if key exists
    if (localStorage.getItem('cloud_api_key')) setKeyStatus('saved')
  }, [])

  function flash(m: string) {
    setMsg(m)
    setTimeout(() => setMsg(''), 2500)
  }

  async function saveKey() {
    if (!passphrase || !apiKey) return
    try {
      await encryptToLocalStorage('cloud_api_key', { key: apiKey }, passphrase)
      setApiKey('')
      setKeyStatus('saved')
      flash('API key saved (encrypted)')
    } catch {
      setKeyStatus('error')
      flash('Failed to save key')
    }
  }

  async function loadKey() {
    if (!passphrase) return
    try {
      const res = await decryptFromLocalStorage('cloud_api_key', passphrase)
      if (res?.key) {
        setApiKey(res.key)
        setKeyStatus('loaded')
        flash('Key loaded')
      } else {
        flash('Wrong passphrase or no key')
      }
    } catch {
      flash('Decryption failed')
    }
  }

  function clearKey() {
    removeItemEncrypted('cloud_api_key')
    setApiKey('')
    setKeyStatus('none')
    flash('Key cleared')
  }

  function toggleMedMode(v: boolean) {
    setMedMode(v)
    localStorage.setItem('medMode', v ? '1' : '0')
  }

  function toggleCloud(v: boolean) {
    setCloudEnabled(v)
    localStorage.setItem('cloudFallback', v ? '1' : '0')
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box settings-modal">
        <div className="modal-header">
          <h3>Settings</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-section">
          <h4>Study mode</h4>
          <label className="toggle-row">
            <span>
              <strong>Med Mode</strong>
              <span className="toggle-desc">NEET-PG / USMLE optimised prompts — clinical vignettes, mechanisms, differentials</span>
            </span>
            <input type="checkbox" checked={medMode} onChange={e => toggleMedMode(e.target.checked)} className="toggle" />
          </label>
        </div>

        <div className="settings-section">
          <h4>Device capabilities</h4>
          <div className="capability-row">
            <span>WebGPU</span>
            <span className={`cap-badge ${webGPU === 'available' ? 'cap-ok' : webGPU === 'unavailable' ? 'cap-no' : 'cap-checking'}`}>
              {webGPU === 'available' ? '✓ Available' : webGPU === 'unavailable' ? '✗ Not available' : 'Checking…'}
            </span>
          </div>
          <div className="capability-row">
            <span>Device memory</span>
            <span className="cap-badge cap-neutral">{memory}</span>
          </div>
          {webGPU === 'unavailable' && (
            <p className="cap-hint">WebGPU unavailable — on-device LLM will use CPU fallback (slower). Enable cloud boost for better performance.</p>
          )}
        </div>

        <div className="settings-section">
          <h4>Cloud boost (OpenRouter)</h4>
          <label className="toggle-row">
            <span>
              <strong>Enable cloud generation</strong>
              <span className="toggle-desc">Use your OpenRouter key for higher-quality card generation. Your key never leaves your device unencrypted.</span>
            </span>
            <input type="checkbox" checked={cloudEnabled} onChange={e => toggleCloud(e.target.checked)} className="toggle" />
          </label>

          {cloudEnabled && (
            <div className="key-manager">
              <div className="key-status-row">
                <span>Key status</span>
                <span className={`cap-badge ${keyStatus === 'saved' || keyStatus === 'loaded' ? 'cap-ok' : 'cap-neutral'}`}>
                  {keyStatus === 'none' ? 'Not set' : keyStatus === 'saved' ? '✓ Encrypted & saved' : keyStatus === 'loaded' ? '✓ Loaded' : '✗ Error'}
                </span>
              </div>
              <input
                type="password"
                className="editor-input"
                placeholder="Passphrase (to encrypt/decrypt key)"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
              />
              <input
                type="password"
                className="editor-input"
                placeholder="OpenRouter API key (sk-or-…)"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <div className="key-actions">
                <button className="btn-primary" onClick={saveKey} disabled={!passphrase || !apiKey}>Save key</button>
                <button className="btn-ghost" onClick={loadKey} disabled={!passphrase}>Verify</button>
                <button className="btn-danger-sm" onClick={clearKey}>Clear</button>
              </div>
              <p className="key-hint">Key is encrypted with AES-GCM + PBKDF2 before storage. Only your passphrase can decrypt it.</p>
            </div>
          )}
        </div>

        {msg && <div className="settings-toast">{msg}</div>}

        <div className="modal-footer">
          <div />
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

