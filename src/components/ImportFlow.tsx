import React, { useState, useRef, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import PDFPageViewer from './PDFPageViewer'
import PDFReadAloud from './PDFReadAloud'
import CardEditor from './CardEditor'
import TTSPlayer from './TTSPlayer'
import { addDeck, addCard, makeNewCard, updateDeckCounts } from '../lib/db'
import type { Card } from '../lib/db'
import { generateCards } from '../lib/pipeline'
import { decryptFromLocalStorage } from '../lib/secureStorage'
import { saveFile, loadFile, removeFile } from '../lib/fileStorage'

type StagedCard = Omit<Card, 'id' | 'stability' | 'difficulty' | 'elapsedDays' | 'scheduledDays' | 'reps' | 'lapses' | 'state' | 'createdAt'>
 

type Props = {
  onDone: () => void
}

type Phase = 'pick' | 'viewer' | 'staging'

export default function ImportFlow({ onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('pick')
  const [file, setFile] = useState<File | null>(null)
  const [deckName, setDeckName] = useState('')
  const [staged, setStaged] = useState<StagedCard[]>([])
  const [status, setStatus] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorIdx, setEditorIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const dragRef = useRef<HTMLDivElement>(null)

  const medMode = localStorage.getItem('medMode') === '1'
  const cloudEnabled = localStorage.getItem('cloudFallback') === '1'

  // BUG FIX: Read decrypted key from sessionStorage (set by Settings after unlock)
  // Falls back to null gracefully — pipeline uses heuristic
  function getApiKey(): string | null {
    if (!cloudEnabled) return null
    return sessionStorage.getItem('decrypted_api_key') ?? null
  }

  function onFileSelect(f: File) {
    setFile(f)
    setDeckName(f.name.replace(/\.pdf$/i, ''))
    setPhase('viewer')
    // persist selected file so it survives a page reload
    try { saveFile('import_last_file', f).catch(() => {}) } catch {}
  }

  useEffect(() => {
    // attempt to restore a previously uploaded file after refresh
    let mounted = true
    ;(async () => {
      try {
        const f = await loadFile('import_last_file')
        if (!mounted) return
        if (f) {
          setFile(f)
          setDeckName(f.name.replace(/\.pdf$/i, ''))
          setPhase('viewer')
        }
      } catch (e) {
        console.warn('restore file failed', e)
      }
    })()
    return () => { mounted = false }
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.type === 'application/pdf') onFileSelect(f)
  }

  async function handleRegionExtract(text: string, pageIndex: number) {
    if (!text.trim()) return
    setStatus(`Generating cards from page ${pageIndex}…`)
    const apiKey = getApiKey()
    const newCards = await generateCards(text, 0, pageIndex, 0, medMode, apiKey)
    // BUG FIX: use functional update to avoid stale staged.length
    setStaged(prev => {
      const next = [...prev, ...newCards]
      setStatus(`${next.length} card${next.length !== 1 ? 's' : ''} staged`)
      return next
    })
    if (phase === 'viewer') setPhase('staging')
  }

  async function saveDeck() {
    if (!deckName.trim() || staged.length === 0) return
    setSaving(true)
    setStatus('Saving…')

    const deckId = await addDeck({
      name: deckName.trim(),
      sourceFile: file?.name,
      totalCards: staged.length,
      newCards: staged.length,
      dueCards: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    for (const c of staged) {
      await addCard(makeNewCard({ ...c, deckId }))
    }

    await updateDeckCounts(deckId)
    setSaving(false)
    onDone()
    try { await removeFile('import_last_file') } catch {}
  }

  function removeCard(idx: number) {
    setStaged(prev => prev.filter((_, i) => i !== idx))
  }

  function openEditor(idx: number) {
    setEditorIdx(idx)
    setEditorOpen(true)
  }

  function onEditorSave(c: Partial<Card>) {
    if (editorIdx === null) return
    setStaged(prev => prev.map((s, i) => i === editorIdx ? { ...s, ...c } : s))
    setEditorOpen(false)
    setEditorIdx(null)
  }

  // ── Pick phase ──────────────────────────────────────────────────────────

  if (phase === 'pick') return (
    <div className="import-flow">
      <div className="import-header">
        <button className="btn-back" onClick={onDone}>← Back</button>
        <h2>Import PDF</h2>
      </div>

      <div
        ref={dragRef}
        className="drop-zone"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => document.getElementById('pdf-input')?.click()}
      >
        <div className="drop-icon">⬡</div>
        <p className="drop-primary">Drop a PDF here</p>
        <p className="drop-secondary">or click to browse</p>
        <input
          id="pdf-input"
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f) }}
        />
      </div>

      <div className="import-tips">
        <div className="tip"><span className="tip-icon">⬡</span><span>Lecture notes, textbook chapters, question banks</span></div>
        <div className="tip"><span className="tip-icon">⬡</span><span>Scanned PDFs supported via OCR (Tesseract)</span></div>
        <div className="tip"><span className="tip-icon">⬡</span><span>Select regions on each page to generate cards</span></div>
      </div>
    </div>
  )

  // ── Viewer phase ────────────────────────────────────────────────────────

  if (phase === 'viewer') return (
    <div className="import-flow">
      <div className="import-header">
        <button className="btn-back" onClick={() => setPhase('pick')}>← Back</button>
        <h2>{file?.name}</h2>
        {staged.length > 0 && (
          <button className="btn-primary" onClick={() => setPhase('staging')}>
            Review {staged.length} card{staged.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>
      {status && <div className="status-bar">{status}</div>}
      <div className="viewer-tts-panel">
        <div className="viewer-tts-label">🔊 Read aloud this PDF</div>
        <PDFReadAloud file={file} />
      </div>
      <p className="viewer-hint">Draw rectangles on pages to select content → cards generated instantly</p>
      <PDFPageViewer file={file} onRegionExtract={handleRegionExtract} />
    </div>
  )

  // ── Staging phase ───────────────────────────────────────────────────────

  return (
    <div className="import-flow">
      <div className="import-header">
        <button className="btn-back" onClick={() => setPhase('viewer')}>← Back to PDF</button>
        <h2>Review cards</h2>
        <button
          className="btn-primary"
          onClick={saveDeck}
          disabled={staged.length === 0 || saving || !deckName.trim()}
        >
          {saving ? 'Saving…' : `Save deck (${staged.length})`}
        </button>
      </div>

      <div className="deck-name-row">
        <label>Deck name</label>
        <input
          className="editor-input deck-name-input"
          value={deckName}
          onChange={e => setDeckName(e.target.value)}
          placeholder="e.g. Cardiology — Week 3"
        />
      </div>

      {status && <div className="status-bar">{status}</div>}

      <div className="staged-cards">
        {staged.length === 0 && (
          <div className="staged-empty">
            <p>No cards yet. Go back and select regions on the PDF.</p>
            <button className="btn-ghost" onClick={() => setPhase('viewer')}>← Back to PDF</button>
          </div>
        )}
        {staged.map((c, i) => (
          <div key={i} className="staged-card">
            <div className="staged-card-content">
              <div className="staged-front">{c.front}</div>
              <div className="staged-back">{c.back}</div>
              {c.tags && c.tags.length > 0 && (
                <div className="card-tags">
                  {c.tags.map(t => <span key={t} className="tag">{t}</span>)}
                </div>
              )}
              <div className="staged-tts">
                <TTSPlayer text={`${c.front}. ${c.back}`} compact />
              </div>
            </div>
            <div className="staged-actions">
              <button className="btn-icon" onClick={() => openEditor(i)} title="Edit">✎</button>
              <button className="btn-icon btn-icon-del" onClick={() => removeCard(i)} title="Delete">✕</button>
            </div>
          </div>
        ))}
      </div>

      <CardEditor
        open={editorOpen}
        card={editorIdx !== null ? staged[editorIdx] : null}
        onClose={() => setEditorOpen(false)}
        onSave={onEditorSave}
      />
    </div>
  )
}

