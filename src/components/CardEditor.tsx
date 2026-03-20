import React, { useState, useEffect, useRef } from 'react'
import type { Card } from '../lib/db'

type Props = {
  open: boolean
  card?: Partial<Card> | null
  onClose: () => void
  onSave: (c: Partial<Card>) => void
}

export default function CardEditor({ open, card, onClose, onSave }: Props) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [tags, setTags] = useState('')
  const frontRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open && card) {
      setFront(card.front ?? '')
      setBack(card.back ?? '')
      setTags((card.tags ?? []).join(', '))
      setTimeout(() => frontRef.current?.focus(), 50)
    }
  }, [open, card])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave()
    }
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, front, back, tags])

  function handleSave() {
    if (!front.trim() || !back.trim()) return
    onSave({
      ...card,
      front: front.trim(),
      back: back.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    })
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box card-editor-modal">
        <div className="modal-header">
          <h3>Edit card</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {card?.meta?.sourcePage && (
          <div className="source-ref">
            Source: page {card.meta.sourcePage}
            {card.meta?.excerpt && <span className="source-excerpt"> — "{card.meta.excerpt}"</span>}
          </div>
        )}

        <div className="editor-field">
          <label>Front</label>
          <textarea
            ref={frontRef}
            className="editor-textarea"
            value={front}
            onChange={e => setFront(e.target.value)}
            rows={3}
            placeholder="Question or cloze prompt…"
          />
        </div>

        <div className="editor-field">
          <label>Back</label>
          <textarea
            className="editor-textarea"
            value={back}
            onChange={e => setBack(e.target.value)}
            rows={4}
            placeholder="Answer…"
          />
        </div>

        <div className="editor-field">
          <label>Tags <span className="label-hint">(comma separated)</span></label>
          <input
            className="editor-input"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="pharmacology, cardiology, high-yield"
          />
        </div>

        <div className="modal-footer">
          <span className="kbd-hint">⌘↩ to save · Esc to cancel</span>
          <div className="modal-actions">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={!front.trim() || !back.trim()}
            >
              Save card
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


