import React, { useEffect, useState } from 'react'

export default function PDFReadAloud({ file }: { file: File | null }) {
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  async function readAll() {
    if (!file) return
    setPlaying(true)
    try {
      const text = await file.text()
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text.slice(0, 2000))
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(u)
      }
    } catch (e) {
      // ignore
    }
    setPlaying(false)
  }

  return (
    <div className="pdf-readaloud">
      <button className="px-2 py-1 bg-indigo-600 rounded" onClick={readAll}>{playing ? 'Reading…' : 'Read sample'}</button>
    </div>
  )
}
