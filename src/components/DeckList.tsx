import React, { useEffect, useState } from 'react'
import { getAllDecks, deleteDeck, updateDeckCounts } from '../lib/db'
import type { Deck } from '../lib/db'

type Props = {
  onStudy: (deck: Deck) => void
  onAdd: () => void
  refreshKey: number
}

export default function DeckList({ onStudy, onAdd, refreshKey }: Props) {
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    const all = await getAllDecks()
    // refresh counts
    await Promise.all(all.map(d => updateDeckCounts(d.id!)))
    const refreshed = await getAllDecks()
    setDecks(refreshed.sort((a, b) => b.updatedAt - a.updatedAt))
    setLoading(false)
  }

  useEffect(() => { load() }, [refreshKey])

  async function handleDelete(id: number) {
    if (!confirm('Delete this deck and all its cards?')) return
    setDeleting(id)
    await deleteDeck(id)
    await load()
    setDeleting(null)
  }

  if (loading) return (
    <div className="deck-loading">
      <div className="spinner" />
    </div>
  )

  return (
    <div className="deck-list">
      <div className="deck-list-header">
        <h2>Your decks</h2>
        <button className="btn-primary" onClick={onAdd}>+ New deck</button>
      </div>

      {decks.length === 0 ? (
        <div className="deck-empty">
          <div className="empty-icon">⬡</div>
          <p>No decks yet. Import a PDF to get started.</p>
          <button className="btn-primary" onClick={onAdd}>Import PDF</button>
        </div>
      ) : (
        <div className="deck-grid">
          {decks.map(deck => {
            const hasDue = deck.dueCards > 0 || deck.newCards > 0
            return (
              <div key={deck.id} className={`deck-card ${hasDue ? 'has-due' : ''}`}>
                <div className="deck-card-body" onClick={() => onStudy(deck)}>
                  <h3 className="deck-name">{deck.name}</h3>
                  {deck.description && <p className="deck-desc">{deck.description}</p>}
                  <div className="deck-stats">
                    <span className="stat stat-total">{deck.totalCards} cards</span>
                    {deck.newCards > 0 && <span className="stat stat-new">{deck.newCards} new</span>}
                    {deck.dueCards > 0 && <span className="stat stat-due">{deck.dueCards} due</span>}
                  </div>
                </div>
                <div className="deck-actions">
                  <button
                    className="btn-study"
                    onClick={() => onStudy(deck)}
                    disabled={deck.totalCards === 0}
                  >
                    {hasDue ? 'Study now' : 'Review'}
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(deck.id!)}
                    disabled={deleting === deck.id}
                  >
                    {deleting === deck.id ? '…' : '✕'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
import React from 'react'

type Deck = { id?: number; name: string }

export default function DeckList({ onStudy, onAdd }: { onStudy: (d: Deck) => void; onAdd: () => void; refreshKey?: number }) {
  const sample: Deck = { id: 1, name: 'Sample Deck' }
  return (
    <div className="deck-list p-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold">Decks</h2>
        <button className="px-2 py-1 bg-blue-600 rounded" onClick={onAdd}>Add</button>
      </div>
      <ul>
        <li className="py-2 border-b border-slate-700 flex justify-between items-center">
          <div>{sample.name}</div>
          <div>
            <button className="px-2 py-1 bg-green-600 rounded" onClick={() => onStudy(sample)}>Study</button>
          </div>
        </li>
      </ul>
    </div>
  )
}
