import React, { useState } from 'react'
import DeckList from './components/DeckList'
import ImportFlow from './components/ImportFlow'
import ReviewSession from './components/ReviewSession'
import Settings from './components/Settings'
import ChatPage from './components/ChatPage'
import type { Deck } from './lib/db'

import * as pdfjsLib from 'pdfjs-dist'
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

type View = 'home' | 'import' | 'review' | 'chat'

export default function App() {
  const [view, setView] = useState<View>('home')
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [deckRefreshKey, setDeckRefreshKey] = useState(0)
  // null on start — ChatPage handles its own unlock flow
  const [chatApiKey] = useState<string | null>(null)

  function goHome() {
    setView('home')
    setActiveDeck(null)
    setDeckRefreshKey(k => k + 1)
  }

  function startReview(deck: Deck) {
    setActiveDeck(deck)
    setView('review')
  }

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-mark">⬡</span>
          <span className="logo-text">MedCards</span>
        </div>
        <div className="sidebar-nav">
          <button className={`nav-item ${view === 'home' ? 'active' : ''}`} onClick={goHome}>
            <span className="nav-icon">⊞</span>
            <span>Decks</span>
          </button>
          <button className={`nav-item ${view === 'import' ? 'active' : ''}`} onClick={() => setView('import')}>
            <span className="nav-icon">⊕</span>
            <span>Import</span>
          </button>
          <button className={`nav-item ${view === 'chat' ? 'active' : ''}`} onClick={() => setView('chat')}>
            <span className="nav-icon">💬</span>
            <span>Chat</span>
          </button>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setSettingsOpen(true)}>
            <span className="nav-icon">⚙</span>
            <span>Settings</span>
          </button>
        </div>
      </nav>

      <main className="main-content">
        {view === 'home' && (
          <DeckList onStudy={startReview} onAdd={() => setView('import')} refreshKey={deckRefreshKey} />
        )}
        {view === 'import' && (
          <ImportFlow onDone={goHome} />
        )}
        {view === 'review' && activeDeck && (
          <ReviewSession deckId={activeDeck.id!} deckName={activeDeck.name} onDone={goHome} />
        )}
        {view === 'chat' && (
          <ChatPage apiKey={chatApiKey} />
        )}
      </main>

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
