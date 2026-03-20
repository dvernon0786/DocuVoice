import React, { useState, useEffect, useCallback } from 'react'
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

  const loadQueue = useCallback(async () => {
    setLoading(true)
    const due = await getDueCards(deckId)
    // shuffle new cards to the front
    const newCards = due.filter(c => c.state === 'new')
    const reviewCards = due.filter(c => c.state !== 'new')
    const shuffled = [...newCards.sort(() => Math.random() - 0.5), ...reviewCards]
    setQueue(shuffled)
    setCurrent(shuffled[0] ?? null)
    setDone(shuffled.length === 0)
    setLoading(false)
  }, [deckId])

  useEffect(() => { loadQueue() }, [loadQueue])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!revealed && current) setRevealed(true)
      }
      if (revealed && current) {
        if (e.key === '1') rate(1)
        if (e.key === '2') rate(2)
        if (e.key === '3') rate(3)
        if (e.key === '4') rate(4)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [revealed, current])

  async function rate(rating: Rating) {
    if (!current) return
    const result = scheduleCard(current, rating)
    await putCard(result.card)
    await updateDeckCounts(deckId)

    setSessionStats(s => ({
      reviewed: s.reviewed + 1,
      again: s.again + (rating === 1 ? 1 : 0),
    }))

    const remaining = queue.slice(1)
    // if Again, push back at position 3 (or end)
    if (rating === 1) {
      const pos = Math.min(3, remaining.length)
      remaining.splice(pos, 0, result.card)
    }

    setQueue(remaining)
    setCurrent(remaining[0] ?? null)
    setRevealed(false)
    if (remaining.length === 0) setDone(true)
  }

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

  const progress = queue.length > 0
    ? Math.round((sessionStats.reviewed / (sessionStats.reviewed + queue.length)) * 100)
    : 100

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
              const labels = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' }
              const colors = { 1: 'btn-again', 2: 'btn-hard', 3: 'btn-good', 4: 'btn-easy' }
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
