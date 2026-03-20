import React, { useState, useEffect } from 'react'
import type { Card } from '../lib/db'

export default function CardEditor({ open, card, onClose, onSave }: { open: boolean; card: Partial<Card> | null; onClose: () => void; onSave: (c: Partial<Card>) => void }) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')

  useEffect(() => {
    if (card) {
      setFront(card.front || '')
      setBack(card.back || '')
    }
  }, [card])

  if (!open) return null

  return (
    <div className="card-editor fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-white p-4 rounded w-[600px]">
        <h3 className="font-semibold">Edit Card</h3>
        <label className="block mt-2">Front</label>
        <textarea className="w-full p-2" value={front} onChange={e => setFront(e.target.value)} />
        <label className="block mt-2">Back</label>
        <textarea className="w-full p-2" value={back} onChange={e => setBack(e.target.value)} />
        <div className="mt-3 flex justify-end gap-2">
          <button className="px-3 py-1 bg-gray-300 rounded" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => onSave({ ...card, front, back })}>Save</button>
        </div>
      </div>
    </div>
  )
}

