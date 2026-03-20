import React, { useState, useEffect } from 'react'

type Card = {
  front: string
  back: string
  tags?: string[]
  meta?: { sourcePage?: number; chunkIndex?: number }
}

export default function CardEditor({
  open,
  card,
  onClose,
  onSave
}: {
  open: boolean
  card?: Card | null
  onClose: () => void
  onSave: (c: Card) => void
}) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [tags, setTags] = useState('')

  useEffect(() => {
    if (card) {
      setFront(card.front || '')
      setBack(card.back || '')
      setTags((card.tags || []).join(', '))
    }
  }, [card])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white text-black rounded p-4 w-full max-w-2xl">
        <h3 className="text-lg font-semibold mb-2">Edit Card</h3>
        <div className="mb-2">
          <label className="block text-sm font-medium">Front</label>
          <textarea className="w-full border rounded p-2" value={front} onChange={(e) => setFront(e.target.value)} />
        </div>
        <div className="mb-2">
          <label className="block text-sm font-medium">Back</label>
          <textarea className="w-full border rounded p-2" value={back} onChange={(e) => setBack(e.target.value)} />
        </div>
        <div className="mb-2">
          <label className="block text-sm font-medium">Tags (comma separated)</label>
          <input className="w-full border rounded p-2" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 bg-gray-300 rounded" onClick={onClose}>Cancel</button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={() => {
              const out: Card = { front, back, tags: tags.split(',').map(t => t.trim()).filter(Boolean) }
              onSave(out)
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
