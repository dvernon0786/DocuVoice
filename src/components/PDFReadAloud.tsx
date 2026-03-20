import React, { useState, useRef, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { ttsEngine, TTS_VOICES } from '../lib/tts'
import type { TTSState } from '../lib/tts'
import { extractPageText, ocrPage } from '../lib/pipeline'

type Props = {
  file: File | null
}

export default function PDFReadAloud({ file }: Props) {
  const [pages, setPages] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [ttsState, setTtsState] = useState<TTSState>('idle')
  const [loading, setLoading] = useState(false)
  const [rate, setRate] = useState(() => parseFloat(localStorage.getItem('ttsRate') ?? '1.0'))
  const [voice, setVoice] = useState(() => localStorage.getItem('ttsVoice') ?? 'browser-default')
  const abortRef = useRef<AbortController | null>(null)
  const docRef = useRef<any>(null)

  useEffect(() => {
    const unsub = ttsEngine.onStateChange(s => setTtsState(s))
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!file) return
    ;(async () => {
      setLoading(true)
      const buf = await file.arrayBuffer()
      const doc = await (pdfjsLib.getDocument({ data: buf }) as any).promise
      docRef.current = doc
      const texts: string[] = []
      for (let p = 1; p <= doc.numPages; p++) {
        let text = await extractPageText(doc, p)
        if (text.length < 50) {
          const ocr = await ocrPage(doc, p)
          text = ocr.text
        }
        texts.push(text.trim())
      }
      setPages(texts)
      setLoading(false)
    })()
  }, [file])

  function applyRate(r: number) {
    setRate(r)
    localStorage.setItem('ttsRate', String(r))
    ttsEngine.setRate(r)
  }

  function applyVoice(v: string) {
    setVoice(v)
    localStorage.setItem('ttsVoice', v)
    ttsEngine.setVoice(v)
  }

  async function playFrom(pageIdx: number) {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    ttsEngine.setVoice(voice)
    ttsEngine.setRate(rate)
    setCurrentPage(pageIdx)

    const chunks = pages.slice(pageIdx)
    await ttsEngine.speakSequence(
      chunks,
      (i) => setCurrentPage(pageIdx + i),
      abortRef.current.signal
    )
  }

  function pause() { ttsEngine.pause() }
  function resume() { ttsEngine.resume() }

  function stop() {
    abortRef.current?.abort()
    ttsEngine.stop()
  }

  function prev() {
    const p = Math.max(0, currentPage - 1)
    setCurrentPage(p)
    if (ttsState === 'speaking' || ttsState === 'paused') playFrom(p)
  }

  function next() {
    const p = Math.min(pages.length - 1, currentPage + 1)
    setCurrentPage(p)
    if (ttsState === 'speaking' || ttsState === 'paused') playFrom(p)
  }

  const isActive = ttsState === 'speaking' || ttsState === 'paused'

  return (
    <div className="pdf-read-aloud">
      <div className="pra-controls">
        {/* Voice selector */}
        <div className="pra-control-group">
          <label className="pra-label">Voice</label>
          <select
            className="pra-select"
            value={voice}
            onChange={e => applyVoice(e.target.value)}
          >
            {TTS_VOICES.map(v => (
              <option key={v.id} value={v.id}>
                {v.label} {v.quality === 'high' ? '★' : v.quality === 'medium' ? '◈' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Speed */}
        <div className="pra-control-group">
          <label className="pra-label">Speed {rate.toFixed(1)}×</label>
          <input
            type="range"
            min="0.5" max="2.0" step="0.1"
            value={rate}
            onChange={e => applyRate(parseFloat(e.target.value))}
            className="pra-range"
          />
        </div>
      </div>

      {/* Transport */}
      <div className="pra-transport">
        <button className="pra-btn" onClick={prev} disabled={currentPage === 0 || loading} title="Previous page">⏮</button>

        {!isActive ? (
          <button
            className="pra-btn pra-play"
            onClick={() => playFrom(currentPage)}
            disabled={loading || pages.length === 0}
          >
            {loading ? '…' : '▶ Play'}
          </button>
        ) : (
          <>
            {ttsState === 'speaking' ? (
              <button className="pra-btn pra-play" onClick={pause}>⏸ Pause</button>
            ) : (
              <button className="pra-btn pra-play" onClick={resume}>▶ Resume</button>
            )}
            <button className="pra-btn pra-stop" onClick={stop}>■ Stop</button>
          </>
        )}

        <button className="pra-btn" onClick={next} disabled={currentPage >= pages.length - 1 || loading} title="Next page">⏭</button>
      </div>

      {/* Page status */}
      {pages.length > 0 && (
        <div className="pra-status">
          <div className="pra-page-progress">
            <div className="pra-page-fill" style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }} />
          </div>
          <span className="pra-page-label">
            {ttsState === 'speaking' ? 'Reading ' : ''}
            Page {currentPage + 1} of {pages.length}
          </span>
        </div>
      )}

      {/* Page list */}
      {pages.length > 0 && (
        <div className="pra-page-list">
          {pages.map((text, i) => (
            <div
              key={i}
              className={`pra-page-item ${i === currentPage ? 'pra-page-active' : ''}`}
              onClick={() => { setCurrentPage(i); if (isActive) playFrom(i) }}
            >
              <span className="pra-page-num">p.{i + 1}</span>
              <span className="pra-page-preview">{text.slice(0, 80)}{text.length > 80 ? '…' : ''}</span>
              {i === currentPage && ttsState === 'speaking' && (
                <span className="pra-page-wave">
                  <span /><span /><span />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
import React, { useEffect, useState } from 'react'

export default function PDFReadAloud({ file }: { file: File | null }) {
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  async function readAll() {
    if (!file) return
    setPlaying(true)
    try {
      const text = await file.text()
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text.slice(0, 2000))
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(u)
      }
    } catch (e) {
      // ignore
    }
    setPlaying(false)
  }

  return (
    <div className="pdf-readaloud">
      <button className="px-2 py-1 bg-indigo-600 rounded" onClick={readAll}>{playing ? 'Reading…' : 'Read sample'}</button>
    </div>
  )
}
