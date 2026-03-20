import React, { useEffect } from 'react'

export default function TTSPlayer({ text, compact, label }: { text?: string; compact?: boolean; label?: string }) {
  useEffect(() => {
    if (!text) return
    // Simple optional Web Speech API read-aloud when supported
    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'en-US'
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utter)
    }
  }, [text])

  return (
    <button className={`tts-player ${compact ? 'compact' : ''}`} title={label || 'Read aloud'}>
      🔊
    </button>
  )
}
