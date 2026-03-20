import React, { useState, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import Tesseract from 'tesseract.js'
import { addCard as dbAddCard, getAllCards as dbGetAllCards, deleteCard as dbDeleteCard } from './lib/db'
import CardEditor from './components/CardEditor'
import PDFPageViewer from './components/PDFPageViewer'

export const CARD_SCHEMA = {
  front: 'string',
  back: 'string',
  tags: 'string[]',
  meta: { sourcePage: 'number', chunkIndex: 'number' }
}

type Card = {
  front: string
  back: string
  tags?: string[]
  meta?: { sourcePage?: number; chunkIndex?: number }
}

export default function App() {
  const [cards, setCards] = useState<Card[]>([])
  const [status, setStatus] = useState<string>('idle')
  const [medMode, setMedMode] = useState<boolean>(() => {
    try { return localStorage.getItem('medMode') === '1' } catch { return false }
  })

  useEffect(() => { try { localStorage.setItem('medMode', medMode ? '1' : '0') } catch {} }, [medMode])

  async function processPDF(file: File) {
    setStatus('processing')
    const arrayBuffer = await file.arrayBuffer()
    try {
      const loadingTask: any = pdfjsLib.getDocument({ data: arrayBuffer })
      const doc = await loadingTask.promise
      const textPages: string[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        const strings = content.items.map((it: any) => it.str)
        const pageText = strings.join(' ')
        textPages.push(pageText)
      }
      setStatus('extracted')
      return textPages
    } catch (err) {
      // OCR fallback using Tesseract (scanned PDFs)
      setStatus('ocr-fallback')
      // NOTE: In a real app you'd render each page to canvas and OCR it.
      // Here we'll run OCR on the whole file as a simple fallback.
      const { data } = await Tesseract.recognize(await file.arrayBuffer(), 'eng+hin+kan')
      return [data.text]
    }
  }

  async function generateCardsForChunk(chunk: string, page = 0, idx = 0) {
    // Structured output expected by CARD_SCHEMA
    // Try to use local WebLLM if available, otherwise fallback to a simple heuristic
    try {
      // dynamic import so app still loads if dependency isn't installed yet
      const pkgName = '@mlc-ai/web-llm'
      // prevent Vite from pre-bundling this optional dependency
      // @ts-ignore
      const WebLLMMod: any = await import(/* @vite-ignore */ pkgName).catch(() => null)
      // @ts-ignore
      const WebLLM = WebLLMMod?.WebLLM
      // @ts-ignore (simplified usage — replace with actual WebLLM init & call)
      const model = await WebLLM?.load?.()
        const prompt = medMode
          ? `You are a top medical tutor for NEET-PG / USMLE. From this exact textbook/lecture chunk only, generate 4 high-yield flashcards. Return strict JSON array of objects with keys {front, back, tags}. Prioritize: one fact per card, cloze deletions for lists/tables, clinical vignettes, mechanisms, differentials, and common drug side-effects. Tags should include specialties when relevant (e.g. "pharmacology","cardiology","anatomy","high-yield"). Text: """${chunk}"""`
          : `Extract 3 concise flashcards from the following text. Return JSON array of {front, back, tags}:\n\n${chunk}`
      // @ts-ignore
      const result = await model?.generate?.(prompt)
      if (result) {
        // Expecting JSON — parse safely
        try {
          const parsed = JSON.parse(result)
          const out: Card[] = parsed.map((c: any, i: number) => ({
            front: c.front || `Q: ${i}`,
            back: c.back || '',
            tags: c.tags || [],
            meta: { sourcePage: page, chunkIndex: idx }
          }))
          return out
        } catch (e) {
          // fallthrough to heuristic
        }
      }
    } catch (e) {
      // model not available — fallback
    }

    // Simple heuristic fallback: split into sentences and make Q/A
    const sentences = chunk.split(/(?<=[.?!])\s+/).filter(Boolean)
    const take = medMode ? 4 : 3
    const sample = sentences.slice(0, take).map((s, i) => ({
      front: medMode ? `Cloze: ${s.slice(0, Math.min(60, s.length))}${s.length>60?'...':''}` : s.slice(0, 80) + (s.length > 80 ? '...' : ''),
      back: s,
      tags: medMode ? ['medical','high-yield'] : [],
      meta: { sourcePage: page, chunkIndex: idx }
    }))
    return sample
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // instead of auto-processing, show per-page viewer so user can select regions
    setSelectedFile(file)
  }

  // selected file for per-page viewer
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  async function handleRegionExtract(text: string, pageIndex: number) {
    if (!text || !text.trim()) return
    setStatus('generating')
    // chunk the extracted region and create cards
    const out = await generateCardsForChunk(text, pageIndex, 0)
    setCards((prev) => [...prev, ...out])
    setStatus('done')
  }

  // Stored cards from IndexedDB
  const [storedCards, setStoredCards] = useState<any[]>([])

  useEffect(() => {
    (async () => {
      try {
        const all = await dbGetAllCards()
        setStoredCards(all as any[])
      } catch (e) {
        // ignore
      }
    })()
  }, [])

  async function saveToDB(card: Card) {
    try {
      await dbAddCard(card)
      const all = await dbGetAllCards()
      setStoredCards(all as any[])
      console.log('saved to db')
    } catch (e) {
      console.error('save error', e)
    }
  }

  async function removeFromDB(id: number) {
    try {
      await dbDeleteCard(id)
      const all = await dbGetAllCards()
      setStoredCards(all as any[])
    } catch (e) {
      console.error('delete error', e)
    }
  }

  async function reviewCard(card: Card, rating: number) {
    // Use ts-fsrs to repeat/update schedule
    try {
      // Try dynamic import of `ts-fsrs` so the app still runs if it's not installed.
      const fsrsPkg = 'ts-fsrs'
      // prevent Vite from pre-bundling
      const mod: any = await import(/* @vite-ignore */ fsrsPkg).catch(() => null)
      if (mod && typeof mod.repeat === 'function') {
        const res = await mod.repeat({ card, rating })
        console.log('FSRS repeat result:', res)
      } else {
        console.log('ts-fsrs not available; skipping scheduling')
      }
    } catch (e) {
      console.log('FSRS not available or error:', e)
    }
  }

  // Card editor modal
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorCard, setEditorCard] = useState<Card | null>(null)

  function openEditor(card: Card) {
    setEditorCard(card)
    setEditorOpen(true)
  }

  async function onEditorSave(c: Card) {
    await saveToDB(c)
    setEditorOpen(false)
    setEditorCard(null)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">DocuCards — MVP scaffold</h1>
      <div className="mb-4">
        <input type="file" accept="application/pdf" onChange={onFile} />
        <div className="mt-2">Status: {status}</div>
      </div>

      {selectedFile && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <button className="px-2 py-1 bg-red-600 rounded" onClick={() => setSelectedFile(null)}>Close viewer</button>
            <div className="text-sm text-slate-400">Use the viewer to select rectangular regions on pages.</div>
          </div>
          <PDFPageViewer file={selectedFile} onRegionExtract={handleRegionExtract} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 p-4 rounded">
          <h2 className="font-semibold">Generated cards</h2>
          <ul>
            {cards.map((c, i) => (
              <li key={i} className="border-b border-slate-700 py-2">
                <div className="text-sm text-slate-300">{c.front}</div>
                <div className="text-xs text-slate-400">{c.back}</div>
                <div className="mt-2">
                  <button className="mr-2 px-2 py-1 bg-green-600 rounded" onClick={() => reviewCard(c, 5)}>Easy</button>
                  <button className="mr-2 px-2 py-1 bg-yellow-600 rounded" onClick={() => reviewCard(c, 3)}>Good</button>
                  <button className="mr-2 px-2 py-1 bg-blue-600 rounded" onClick={() => saveToDB(c)}>Save</button>
                  <button className="mr-2 px-2 py-1 bg-indigo-700 text-white rounded" onClick={() => openEditor(c)}>Edit</button>
                  <button className="px-2 py-1 bg-red-600 rounded" onClick={() => reviewCard(c, 0)}>Again</button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-slate-800 p-4 rounded">
          <h2 className="font-semibold">Preview / Notes</h2>
          <p className="text-sm text-slate-400">Upload a PDF to extract text; app will attempt PDF text extraction first and fall back to Tesseract OCR (eng+hin+kan).</p>

          <div className="mt-4">
            <h3 className="font-medium">Stored Cards</h3>
            {storedCards.length === 0 && <div className="text-sm text-slate-500">No saved cards yet.</div>}
            <ul>
              {storedCards.map((c: any) => (
                <li key={c.id} className="flex items-start justify-between border-b border-slate-700 py-2">
                  <div>
                    <div className="text-sm text-slate-300">{c.front}</div>
                    <div className="text-xs text-slate-400">{c.back}</div>
                  </div>
                  <div className="pl-4">
                    <button className="px-2 py-1 bg-red-600 rounded" onClick={() => removeFromDB(c.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
