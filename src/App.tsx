import React, { useState, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import Tesseract from 'tesseract.js'
import { addCard as dbAddCard, getAllCards as dbGetAllCards, deleteCard as dbDeleteCard } from './lib/db'

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
      const prompt = `Extract 3 concise flashcards from the following text. Return JSON array of {front, back, tags}:\n\n${chunk}`
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
    const sample = sentences.slice(0, 3).map((s, i) => ({
      front: s.slice(0, 80) + (s.length > 80 ? '...' : ''),
      back: s,
      tags: [],
      meta: { sourcePage: page, chunkIndex: idx }
    }))
    return sample
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const pages = await processPDF(file)
    const generated: Card[] = []
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      // naive chunking: split by ~500 chars
      const chunks = []
      for (let j = 0; j < page.length; j += 800) chunks.push(page.slice(j, j + 800))
      for (let k = 0; k < chunks.length; k++) {
        const out = await generateCardsForChunk(chunks[k], i + 1, k)
        generated.push(...out)
      }
    }
    setCards(generated)
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

  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">DocuCards — MVP scaffold</h1>
      <div className="mb-4">
        <input type="file" accept="application/pdf" onChange={onFile} />
        <div className="mt-2">Status: {status}</div>
      </div>

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
