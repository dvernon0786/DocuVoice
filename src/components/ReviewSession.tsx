import React, { useState, useEffect, useCallback, useRef } from 'react'
import { getDueCards, putCard, updateDeckCounts } from '../lib/db'
import type { Card } from '../lib/db'
import { scheduleCard, intervalLabel } from '../lib/fsrs'
import type { Rating } from '../lib/fsrs'
import TTSPlayer from './TTSPlayer'

type Props = {
  deckId: number
  deckName: string
  onDone: () => void
}

export default function ReviewSession({ deckId, deckName, onDone }: Props) {
  const [queue, setQueue] = useState<Card[]>([])
  const [current, setCurrent] = useState<Card | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, again: 0 })
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [autoRead, setAutoRead] = useState(() => localStorage.getItem('autoReadAloud') === '1')

  // BUG FIX: use refs to get current values inside keyboard handler without stale closure
  const revealedRef = useRef(revealed)
  const currentRef = useRef(current)
  const rateRef = useRef<(r: Rating) => void>(() => {})

  const loadQueue = useCallback(async () => {
    setLoading(true)
    const due = await getDueCards(deckId)
    const newCards = due.filter(c => c.state === 'new')
    const reviewCards = due.filter(c => c.state !== 'new')
    const shuffled = [...newCards.sort(() => Math.random() - 0.5), ...reviewCards]
    setQueue(shuffled)
    setCurrent(shuffled[0] ?? null)
    setDone(shuffled.length === 0)
    setLoading(false)
  }, [deckId])

  useEffect(() => { loadQueue() }, [loadQueue])

  // Keep refs in sync
  useEffect(() => { revealedRef.current = revealed }, [revealed])
  useEffect(() => { currentRef.current = current }, [current])

  async function rate(r: Rating) {
    if (!currentRef.current) return
    const card = currentRef.current
    const result = scheduleCard(card, r)
    await putCard(result.card)
    await updateDeckCounts(deckId)

    setSessionStats(s => ({
      reviewed: s.reviewed + 1,
      again: s.again + (r === 1 ? 1 : 0),
    }))

    setQueue(prev => {
      const remaining = prev.slice(1)
      if (r === 1) {
        const pos = Math.min(3, remaining.length)
        remaining.splice(pos, 0, result.card)
      }
      const next = remaining[0] ?? null
      setCurrent(next)
      if (remaining.length === 0) setDone(true)
      return remaining
    })
    setRevealed(false)
  }

  // Keep rateRef current
  useEffect(() => { rateRef.current = rate }, [queue, deckId])

  // BUG FIX: keyboard handler uses refs — no stale closure
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!revealedRef.current && currentRef.current) setRevealed(true)
      }
      if (revealedRef.current && currentRef.current) {
        if (e.key === '1') rateRef.current(1)
        if (e.key === '2') rateRef.current(2)
        if (e.key === '3') rateRef.current(3)
        if (e.key === '4') rateRef.current(4)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, []) // stable — uses refs

  if (loading) return (
    <div className="review-loading">
      <div className="spinner" />
      <p>Loading cards…</p>
    </div>
  )

  if (done) return (
    <div className="review-done">
      <div className="done-icon">✦</div>
      <h2>Session complete</h2>
      <p className="done-sub">You reviewed {sessionStats.reviewed} card{sessionStats.reviewed !== 1 ? 's' : ''}</p>
      {sessionStats.again > 0 && (
        <p className="done-again">{sessionStats.again} marked Again — they'll resurface soon</p>
      )}
      <div className="done-actions">
        <button className="btn-primary" onClick={onDone}>Back to decks</button>
        {sessionStats.reviewed > 0 && (
          <button className="btn-ghost" onClick={loadQueue}>Keep going</button>
        )}
      </div>
    </div>
  )

  if (!current) return null

  // BUG FIX: safe progress — never divides by zero
  const total = sessionStats.reviewed + queue.length
  const progress = total > 0 ? Math.round((sessionStats.reviewed / total) * 100) : 0

  return (
    <div className="review-session">
      <div className="review-header">
        <button className="btn-back" onClick={onDone}>← {deckName}</button>
        <div className="review-progress-wrap">
          <div className="review-progress-bar">
            <div className="review-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="review-count">{queue.length} left</span>
        </div>
        <label className="auto-read-toggle" title="Auto read aloud">
          <input type="checkbox" checked={autoRead} onChange={e => {
            setAutoRead(e.target.checked)
            localStorage.setItem('autoReadAloud', e.target.checked ? '1' : '0')
          }} />
          <span>🔊</span>
        </label>
      </div>

      <div className="card-stage">
        <div className={`flashcard ${revealed ? 'revealed' : ''}`}>
          <div className="card-face card-front">
            <div className="card-face-header">
              <div className="card-state-badge">{current.state}</div>
              <TTSPlayer text={current.front} compact />
            </div>
            <div className="card-content">{current.front}</div>
            {current.meta?.sourcePage && (
              <div className="card-source">p.{current.meta.sourcePage}</div>
            )}
          </div>

          {revealed && (
            <div className="card-face card-back">
              <div className="card-face-header">
                <div className="card-divider">Answer</div>
                <TTSPlayer text={current.back} compact />
              </div>
              <div className="card-content">{current.back}</div>
              {current.tags && current.tags.length > 0 && (
                <div className="card-tags">
                  {current.tags.map(t => <span key={t} className="tag">{t}</span>)}
                </div>
              )}
            </div>
          )}
        </div>

        {!revealed ? (
          <button className="btn-reveal" onClick={() => setRevealed(true)}>
            Show answer <span className="kbd">Space</span>
          </button>
        ) : (
          <div className="rating-row">
            {([1, 2, 3, 4] as Rating[]).map(r => {
              const preview = scheduleCard(current, r)
              const labels: Record<number,string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' }
              const colors: Record<number,string> = { 1: 'btn-again', 2: 'btn-hard', 3: 'btn-good', 4: 'btn-easy' }
              return (
                <button key={r} className={`btn-rating ${colors[r]}`} onClick={() => rate(r)}>
                  <span className="rating-label">{labels[r]}</span>
                  <span className="rating-interval">{intervalLabel(preview.interval)}</span>
                  <span className="kbd">{r}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

