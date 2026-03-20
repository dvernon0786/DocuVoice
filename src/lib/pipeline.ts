// Chunked, resumable PDF processing pipeline
// pdf.js → Tesseract OCR fallback → card generation (cloud → local → heuristic)

import type { Card } from './db'

export type ProgressCallback = (msg: string, pct: number) => void

export type GeneratedCard = Omit<Card, 'id' | 'stability' | 'difficulty' | 'elapsedDays' | 'scheduledDays' | 'reps' | 'lapses' | 'state' | 'createdAt'>

// ── Text extraction ────────────────────────────────────────────────────────

export async function extractPageText(pdfDoc: any, pageNum: number): Promise<string> {
  try {
    const page = await pdfDoc.getPage(pageNum)
    const content = await page.getTextContent()
    return content.items.map((it: any) => it.str).join(' ').trim()
  } catch {
    return ''
  }
}

export async function ocrPage(pdfDoc: any, pageNum: number): Promise<{ text: string; confidence: number }> {
  try {
    const Tesseract = (await import('tesseract.js')).default
    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    const result = await Tesseract.recognize(canvas as any, 'eng+hin+kan')
    const confidence = result.data.confidence ?? 0
    return { text: result.data.text || '', confidence }
  } catch {
    return { text: '', confidence: 0 }
  }
}

// ── Card generation ────────────────────────────────────────────────────────

const MED_PROMPT = (chunk: string) =>
  `You are a top medical educator for NEET-PG / USMLE. From the following text ONLY, generate 4 high-yield flashcards.
Return a strict JSON array — nothing else — of objects with keys: front, back, tags.
Rules: one fact per card; use cloze format for lists (e.g. "The _____ is responsible for..."); prioritize mechanisms, differentials, drug side-effects, clinical vignettes.
Tags should include relevant specialties: pharmacology, cardiology, anatomy, physiology, pathology, high-yield, etc.
Text: """${chunk}"""`

const GENERAL_PROMPT = (chunk: string) =>
  `Extract 4 concise flashcards from the following text.
Return ONLY a JSON array of objects with keys: front, back, tags. No preamble.
Text:\n\n${chunk}`

async function generateViaCloud(
  chunk: string,
  medMode: boolean,
  apiKey: string,
  model = 'x-ai/grok-3-mini'
): Promise<GeneratedCard[] | null> {
  try {
    const resp = await fetch('/api/openrouter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: medMode ? MED_PROMPT(chunk) : GENERAL_PROMPT(chunk) }],
        stream: false,
        apiKey,
      }),
    })
    if (!resp.ok) return null
    const completion = await resp.json()
    const text: string = completion?.choices?.[0]?.message?.content ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    if (!Array.isArray(parsed)) return null
    return parsed.map((c: any) => ({
      deckId: 0,
      front: c.front ?? '',
      back: c.back ?? '',
      tags: Array.isArray(c.tags) ? c.tags : [],
      meta: {},
      nextReview: Date.now(),
    }))
  } catch {
    return null
  }
}

async function generateViaWebLLM(
  chunk: string,
  medMode: boolean
): Promise<GeneratedCard[] | null> {
  try {
    // Try a normal dynamic import; Vite is configured to treat this module as external
    // so Rollup will not attempt to resolve it during the build.
    // @ts-ignore
    const mod: any = await import('@mlc-ai/web-llm').catch(() => null)
    if (!mod) return null
    const engine = mod.CreateMLCEngine
      ? await mod.CreateMLCEngine('Phi-3.5-mini-instruct-q4f16_1-MLC', {
          initProgressCallback: () => {},
        })
      : null
    if (!engine) return null
    const prompt = medMode ? MED_PROMPT(chunk) : GENERAL_PROMPT(chunk)
    const reply = await engine.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
    })
    const text = reply.choices?.[0]?.message?.content ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    if (!Array.isArray(parsed)) return null
    return parsed.map((c: any) => ({
      deckId: 0,
      front: c.front ?? '',
      back: c.back ?? '',
      tags: Array.isArray(c.tags) ? c.tags : [],
      meta: {},
      nextReview: Date.now(),
    }))
  } catch {
    return null
  }
}

function heuristicFallback(chunk: string, medMode: boolean): GeneratedCard[] {
  const sentences = chunk.split(/(?<=[.?!])\s+/).filter(s => s.length > 20)
  const take = Math.min(4, sentences.length)
  return sentences.slice(0, take).map(s => ({
    deckId: 0,
    front: medMode
      ? `Complete: ${s.slice(0, 70)}${s.length > 70 ? '...' : ''}`
      : s.slice(0, 90) + (s.length > 90 ? '...' : ''),
    back: s,
    tags: medMode ? ['medical', 'high-yield'] : [],
    meta: {},
    nextReview: Date.now(),
  }))
}

export async function generateCards(
  chunk: string,
  deckId: number,
  pageIndex: number,
  chunkIndex: number,
  medMode: boolean,
  apiKey?: string | null
): Promise<GeneratedCard[]> {
  if (!chunk.trim()) return []

  // 1. Cloud (if key available)
  if (apiKey) {
    const cloud = await generateViaCloud(chunk, medMode, apiKey)
    if (cloud && cloud.length > 0) {
      return cloud.map(c => ({ ...c, deckId, meta: { sourcePage: pageIndex, chunkIndex } }))
    }
  }

  // 2. WebLLM (local)
  const local = await generateViaWebLLM(chunk, medMode)
  if (local && local.length > 0) {
    return local.map(c => ({ ...c, deckId, meta: { sourcePage: pageIndex, chunkIndex } }))
  }

  // 3. Heuristic
  return heuristicFallback(chunk, medMode).map(c => ({
    ...c,
    deckId,
    meta: { sourcePage: pageIndex, chunkIndex },
  }))
}

// ── Chunking ───────────────────────────────────────────────────────────────

const CHUNK_SIZE = 800  // tokens approx

export function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    chunks.push(words.slice(i, i + CHUNK_SIZE).join(' '))
  }
  return chunks.length ? chunks : []
}

// ── Full pipeline ──────────────────────────────────────────────────────────

export type PipelineOptions = {
  deckId: number
  medMode: boolean
  apiKey?: string | null
  startPage?: number  // for resumption
  onProgress: ProgressCallback
  onCardsReady: (cards: GeneratedCard[], pageIndex: number) => void
  signal?: AbortSignal
}

export async function runPipeline(pdfDoc: any, opts: PipelineOptions): Promise<void> {
  const { deckId, medMode, apiKey, onProgress, onCardsReady, signal } = opts
  const numPages = pdfDoc.numPages
  const startPage = opts.startPage ?? 1

  for (let p = startPage; p <= numPages; p++) {
    if (signal?.aborted) break

    onProgress(`Extracting page ${p} of ${numPages}…`, ((p - 1) / numPages) * 50)

    // Try pdf.js text first
    let text = await extractPageText(pdfDoc, p)

    // Fall back to OCR if text is sparse
    if (text.length < 50) {
      onProgress(`OCR on page ${p}…`, ((p - 1) / numPages) * 50 + 5)
      const ocr = await ocrPage(pdfDoc, p)
      text = ocr.text
    }

    if (!text.trim()) continue

    const chunks = chunkText(text)

    for (let ci = 0; ci < chunks.length; ci++) {
      if (signal?.aborted) break
      onProgress(
        `Generating cards for page ${p}… (chunk ${ci + 1}/${chunks.length})`,
        50 + ((p - 1) / numPages) * 50
      )
      const cards = await generateCards(chunks[ci], deckId, p, ci, medMode, apiKey)
      if (cards.length) onCardsReady(cards, p)
    }
  }

  onProgress('Done', 100)
}

