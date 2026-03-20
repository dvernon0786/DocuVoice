import React, { useState, useEffect, useRef } from 'react'
import { ttsEngine, TTS_VOICES } from '../lib/tts'
import type { TTSState } from '../lib/tts'

type Props = {
  text: string
  compact?: boolean       // icon-only mode for cards
  label?: string          // override button label
  highlightText?: boolean // highlight words as spoken (review mode)
}

export default function TTSPlayer({ text, compact = false, label, highlightText = false }: Props) {
  const [ttsState, setTtsState] = useState<TTSState>('idle')
  const [charIndex, setCharIndex] = useState<number>(-1)
  const voiceId = localStorage.getItem('ttsVoice') ?? 'browser-default'

  useEffect(() => {
    const unsub = ttsEngine.onStateChange((s) => {
      setTtsState(s)
      if (s === 'idle') setCharIndex(-1)
    })
    return () => unsub()
  }, [])

  function handleClick() {
    if (ttsState === 'speaking') {
      ttsEngine.pause()
    } else if (ttsState === 'paused') {
      ttsEngine.resume()
    } else {
      ttsEngine.setVoice(voiceId)
      ttsEngine.speak(text, highlightText ? (ci) => setCharIndex(ci) : undefined)
    }
  }

  function handleStop(e: React.MouseEvent) {
    e.stopPropagation()
    ttsEngine.stop()
    setCharIndex(-1)
  }

  const icon = ttsState === 'speaking' ? '⏸' : ttsState === 'paused' ? '▶' : ttsState === 'loading' ? '…' : '🔊'
  const btnLabel = label ?? (ttsState === 'speaking' ? 'Pause' : ttsState === 'paused' ? 'Resume' : 'Read aloud')

  if (compact) {
    return (
      <div className="tts-compact">
        <button
          className={`tts-btn-compact ${ttsState === 'speaking' ? 'tts-active' : ''}`}
          onClick={handleClick}
          title={btnLabel}
          disabled={ttsState === 'loading'}
        >
          {icon}
        </button>
        {(ttsState === 'speaking' || ttsState === 'paused') && (
          <button className="tts-stop-compact" onClick={handleStop} title="Stop">■</button>
        )}
      </div>
    )
  }

  return (
    <div className="tts-player">
      <button
        className={`tts-btn ${ttsState === 'speaking' ? 'tts-btn-active' : ''}`}
        onClick={handleClick}
        disabled={ttsState === 'loading'}
      >
        <span className="tts-icon">{icon}</span>
        <span>{btnLabel}</span>
      </button>
      {(ttsState === 'speaking' || ttsState === 'paused') && (
        <button className="tts-stop" onClick={handleStop}>■ Stop</button>
      )}
      {highlightText && charIndex >= 0 && (
        <div className="tts-highlight-text">
          <span className="tts-spoken">{text.slice(0, charIndex)}</span>
          <span className="tts-current">{text.slice(charIndex, charIndex + 20)}</span>
          <span className="tts-unspoken">{text.slice(charIndex + 20)}</span>
        </div>
      )}
    </div>
  )
}

