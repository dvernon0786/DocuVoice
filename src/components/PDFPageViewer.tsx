import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import Tesseract from 'tesseract.js'

type WordBox = { x0: number; y0: number; x1: number; y1: number; text: string }

export default function PDFPageViewer({ file, onRegionExtract }: { file: File | null; onRegionExtract: (text: string, page: number) => void }) {
  const [doc, setDoc] = useState<any>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({})
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [ocrResults, setOcrResults] = useState<Record<number, WordBox[]>>({})
  const [rendered, setRendered] = useState<Record<number, boolean>>({})

  // selection state in canvas pixels
  const [selection, setSelection] = useState<{ page: number; x: number; y: number; w: number; h: number } | null>(null)
  const selStartRef = useRef<{ page: number; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!file) {
      setDoc(null)
      setNumPages(0)
      setRendered({})
      setOcrResults({})
      return
    }
    let mounted = true
    ;(async () => {
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask: any = pdfjsLib.getDocument({ data: arrayBuffer })
      const loaded = await loadingTask.promise
      if (!mounted) return
      setDoc(loaded)
      setNumPages(loaded.numPages)
    })()
    return () => { mounted = false }
  }, [file])

  // lazy render pages when visible
  useEffect(() => {
    if (!containerRef.current || numPages === 0) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((ent) => {
        const el = ent.target as HTMLElement
        const idx = Number(el.dataset.page)
        if (ent.isIntersecting) {
          setRendered((r) => ({ ...r, [idx]: true }))
        }
      })
    }, { root: containerRef.current, rootMargin: '200px' })

    const wrappers = containerRef.current.querySelectorAll('.dv-page')
    wrappers.forEach((w) => observer.observe(w))
    return () => observer.disconnect()
  }, [numPages])

  const renderPage = useCallback(async (pageNum: number) => {
    if (!doc) return
    try {
      const page = await doc.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1.5 })
      let canvas = canvasRefs.current[pageNum]
      if (!canvas) {
        canvas = document.createElement('canvas')
        canvasRefs.current[pageNum] = canvas
      }
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      const ctx = canvas.getContext('2d')!
        // ensure a white background before PDF painting (helps visibility in dark themes)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport }).promise
        console.debug('Rendered PDF page', pageNum)
      // trigger OCR on this page (async)
      ;(async () => {
        try {
          // skip OCR for extremely small canvases (avoids tesseract warnings)
          if (canvas.width < 20 || canvas.height < 20) return
          const res = await Tesseract.recognize(canvas as any, 'eng+hin+kan')
          const words = (res.data.words || []).map((w: any) => ({ x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1, text: w.text }))
          setOcrResults((prev) => ({ ...prev, [pageNum]: words }))
        } catch (e) {
          console.warn('OCR error', e)
        }
      })()
    } catch (e) {
      console.error('renderPage error', e)
    }
  }, [doc])

  useEffect(() => {
    // when a page becomes marked as rendered, actually render it
    Object.entries(rendered).forEach(([k, v]) => {
      const idx = Number(k)
      if (v && canvasRefs.current[idx] && containerRef.current) {
        // mount canvas into wrapper if not already
        const wrapper = containerRef.current.querySelector(`.dv-page[data-page="${idx}"]`)
        if (wrapper && !wrapper.querySelector('canvas')) {
          const canvas = canvasRefs.current[idx]
          canvas!.style.maxWidth = '100%'
          canvas!.style.height = 'auto'
            canvas!.style.display = 'block'
            canvas!.style.background = 'white'
          wrapper.appendChild(canvas!)
        }
        // render/update content
        renderPage(idx)
      }
    })
  }, [rendered, renderPage])

  function clientToCanvasCoords(clientX: number, clientY: number, page: number) {
    const canvas = canvasRefs.current[page]
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const x = (clientX - rect.left) * (canvas.width / rect.width)
    const y = (clientY - rect.top) * (canvas.height / rect.height)
    return { x, y }
  }

  function handlePointerDown(ev: React.PointerEvent, page: number) {
    (ev.target as Element).setPointerCapture(ev.pointerId)
    const { x, y } = clientToCanvasCoords(ev.clientX, ev.clientY, page)
    selStartRef.current = { page, x, y }
    setSelection({ page, x, y, w: 0, h: 0 })
  }

  function handlePointerMove(ev: React.PointerEvent, page: number) {
    if (!selStartRef.current || selStartRef.current.page !== page) return
    const { x, y } = clientToCanvasCoords(ev.clientX, ev.clientY, page)
    const sx = selStartRef.current.x
    const sy = selStartRef.current.y
    const nx = Math.min(sx, x)
    const ny = Math.min(sy, y)
    const w = Math.abs(x - sx)
    const h = Math.abs(y - sy)
    setSelection({ page, x: nx, y: ny, w, h })
  }

  async function handlePointerUp(ev: React.PointerEvent, page: number) {
    if (!selStartRef.current || selStartRef.current.page !== page) return
    const { x, y } = clientToCanvasCoords(ev.clientX, ev.clientY, page)
    const sx = selStartRef.current.x
    const sy = selStartRef.current.y
    const nx = Math.min(sx, x)
    const ny = Math.min(sy, y)
    const w = Math.abs(x - sx)
    const h = Math.abs(y - sy)
    selStartRef.current = null
    setSelection(null)
    if (w < 3 || h < 3) return
    if (w < 20 || h < 20) {
      // selection too small for OCR — avoid noisy tesseract warnings
      onRegionExtract('', page)
      return
    }
    const canvas = canvasRefs.current[page]
    if (!canvas) return
    const tmp = document.createElement('canvas')
    tmp.width = Math.floor(w)
    tmp.height = Math.floor(h)
    const tctx = tmp.getContext('2d')!
    tctx.drawImage(canvas, Math.floor(nx), Math.floor(ny), Math.floor(w), Math.floor(h), 0, 0, Math.floor(w), Math.floor(h))
    try {
      const res = await Tesseract.recognize(tmp as any, 'eng+hin+kan')
      const text = res.data.text || ''
      onRegionExtract(text, page)
    } catch (err) {
      console.error('region OCR failed', err)
      onRegionExtract('', page)
    }
  }

  return (
    <div ref={containerRef} className="space-y-6 max-h-[60vh] overflow-auto p-2 border rounded bg-slate-900">
      {Array.from({ length: Math.max(0, numPages) }).map((_, idx) => {
        const pageNum = idx + 1
        const words = ocrResults[pageNum] || []
        return (
          <div key={pageNum} data-page={pageNum} className="dv-page relative p-2 border border-slate-700 rounded bg-black">
            <div className="text-xs text-slate-400 mb-1">Page {pageNum}</div>
            <div
              onPointerDown={(e) => handlePointerDown(e, pageNum)}
              onPointerMove={(e) => handlePointerMove(e, pageNum)}
              onPointerUp={(e) => handlePointerUp(e, pageNum)}
              style={{ position: 'relative', width: '100%' }}
            >
              {/* canvas will be appended into this wrapper by render effect when ready */}
              {/* word overlays */}
              {canvasRefs.current[pageNum] && (
                <div className="absolute inset-0 pointer-events-none">
                  {words.map((w, i) => {
                    const canvas = canvasRefs.current[pageNum]!
                    const rect = canvas.getBoundingClientRect()
                    const left = (w.x0 / canvas.width) * rect.width
                    const top = (w.y0 / canvas.height) * rect.height
                    const width = ((w.x1 - w.x0) / canvas.width) * rect.width
                    const height = ((w.y1 - w.y0) / canvas.height) * rect.height
                    return (
                      <div key={i} style={{ left, top, width, height }} className="absolute bg-yellow-300/20 border border-yellow-400/40 text-[10px] text-yellow-100/90 overflow-hidden">
                        <span className="sr-only">{w.text}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              {/* selection visual */}
              {selection && selection.page === pageNum && (
                (() => {
                  const canvas = canvasRefs.current[pageNum]
                  if (!canvas) return null
                  const rect = canvas.getBoundingClientRect()
                  const left = (selection.x / canvas.width) * rect.width
                  const top = (selection.y / canvas.height) * rect.height
                  const width = (selection.w / canvas.width) * rect.width
                  const height = (selection.h / canvas.height) * rect.height
                  return <div style={{ left, top, width, height }} className="absolute border-2 border-blue-400/80 bg-blue-400/20" />
                })()
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
