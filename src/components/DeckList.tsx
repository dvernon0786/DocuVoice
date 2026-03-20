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
