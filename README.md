# DocuCards

**100% local/offline PWA**  
PDF → OCR → smart chunking → AI-generated flashcards → FSRS spaced repetition

## Features (MVP)
- Upload any PDF (text or scanned)
- Automatic OCR fallback (Tesseract.js)
- Per-page/per-chunk card generation (WebLLM local inference)
- Human review & edit
- FSRS spaced repetition scheduler
- Split-screen: PDF/chunks left | cards/review right
- No server, no data leaves device

## Tech
- Vite + React + TypeScript
- WebLLM (Phi-3-mini local LLM)
- pdf.js + Tesseract.js
- ts-fsrs
- PWA (installable, offline)

## Run locally
```bash
npm install
npm run dev
```

## Deploy
Push to GitHub → connect to Vercel → instant free hosting

Enjoy studying!
