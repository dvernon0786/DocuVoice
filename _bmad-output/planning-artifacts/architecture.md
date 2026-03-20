---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/project-knowledge/deep-dive-api.md
  - _bmad-output/project-knowledge/deep-dive-design-artifacts.md
  - _bmad-output/project-knowledge/deep-dive-docs.md
  - _bmad-output/project-knowledge/deep-dive-scripts.md
  - _bmad-output/project-knowledge/deep-dive-src.md
  - _bmad-output/project-knowledge/deep-dive-summary.md
  - _bmad-output/project-knowledge/index.md
  - _bmad-output/project-knowledge/project-scan-report.json
workflowType: 'architecture'
project_name: 'DocuVoice'
user_name: 'Dghost'
date: '2026-03-20T00:00:00Z'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (architectural implications)**
- PDF import + text extraction (pdf.js) and per-region OCR fallback (Tesseract): requires a client-side ingestion pipeline, per-page rendering, region-selection UI, and workerized OCR processing.
- Chunked, resumable processing with progress UI: implies a job/queue model on the client with persistent state (IndexedDB) and background/resume capabilities.
- On-device card generation (WebLLM) + inline editor: needs model loading/caching, WebGPU/CPU fallbacks, and editor components that preserve provenance (page, excerpt).
- FSRS scheduling + review UX: scheduler module and lightweight review engine integrated with card storage.
- Persistence & export (IndexedDB, .apkg, JSON): stable storage layer and export adapters.
- Settings & encrypted API-key storage: secure storage (Web Crypto) and clear opt-in flows.
- Support tooling (logs, OCR confidence): diagnostic hooks and exportable support bundles.

**Non-Functional Requirements (architectural drivers)**
- Performance: chunked processing, model caching, and dynamic concurrency controls to meet page/minute targets.
- Reliability/Resilience: resumable conversions, background persistence, and crash recovery.
- Security & Privacy: local-first default; explicit opt-in for cloud processing; AES‑GCM encrypted keys via `src/lib/secureStorage.ts`.
- Scalability & Maintainability: code-splitting for heavy modules, service-worker caching for model assets.
- Accessibility: WCAG AA for core flows, keyboard/screen-reader support.
- Observability: client-side logs with timestamps, chunk ids, OCR confidences exportable for support.

### Scale & Complexity
- Primary domain: Web PWA (frontend-heavy, ML inference on-device).
- Complexity level: Medium — core app is an SPA but includes ML, offline-first needs, resumable background jobs, and optional cloud integration.
- Key components to expect: Ingestion (pdf.js + OCR workers), Processing Orchestrator (chunking + resume), Model Layer (WebLLM loader + cache), Editor & Review UI, Scheduler (FSRS), Storage Layer (IndexedDB + secureStorage), Export Adapters, Service Worker.

### Technical Constraints & Dependencies
- WebGPU availability varies; must implement CPU fallbacks and feature-detection with clear UX messaging.
- Tesseract.js and pdf.js are heavy; load in workers and via dynamic imports.
- Large model assets require service-worker caching and user consent for downloads on mobile.
- Optional OpenRouter proxy exists (`api/openrouter.js`) — must ensure secrets and rate-limits are handled server-side.

### Cross-Cutting Concerns
- Offline-first behavior across ingestion → generation → review.
- Privacy-first: never transmit content without explicit job-level opt-in.
- Resource management: dynamic worker counts, chunk sizing, and cache management UI.
- Observability for support: OCR confidences, chunk progress, and error telemetry.
- Accessibility and UX consistency across mobile/desktop.

---

Next steps: run Advanced Elicitation (`A`) for deeper insights, Party Mode (`P`) for multi-perspective analysis, or Continue (`C`) to progress to architectural decisions.

## Starter Template Evaluation

### Primary Technology Domain
Based on the PRD and repository scan, this is a Web PWA SPA using React + TypeScript with Vite and TailwindCSS already present in the repo. A Vite-based starter aligns with existing code and developer tooling.

### Starter Options Considered
- **Vite + React (create-vite)** — minimal, fast scaffolding; supports `react-ts` template and community starters for PWA and Tailwind integration. Recommended for continuity with the repo.
- **T3 Stack (create-t3-app)** — full-stack Next.js opinionated starter (Prisma, tRPC, NextAuth). Strong for server-rendered, typesafe full-stack apps, but shifts away from the current Vite SPA architecture.
- **Vite + PWA plugin** — `vite-plugin-pwa` provides zero-config PWA support and Workbox-based offline caching; pairs well with Vite starter.

### Rationale for Selection
- Keep the existing Vite + React + TypeScript approach for minimal friction, faster iteration, and compatibility with current `vite.config.ts`, `tailwind.config.js`, and `src` layout.
- Use `vite-plugin-pwa` to enable offline-first behavior and service-worker model required by the PRD.
- Continue with Tailwind (already in `package.json`) and the `@tailwindcss/vite` plugin for styling pipeline consistency.

### Initialization Commands (examples)
For a new project scaffold (if needed):
```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
npm install -D tailwindcss @tailwindcss/vite vite-plugin-pwa
```

To enable PWA and Tailwind in an existing Vite project, install and configure `vite-plugin-pwa` and the Tailwind Vite plugin, then add service-worker and manifest configuration.

### Architectural Decisions Provided by Starter
- Language & Runtime: TypeScript + React on Vite (ESModules dev server, Rollup production builds).
- Styling: Tailwind CSS with `@tailwindcss/vite` plugin.
- Build Tooling: Vite dev server + Rollup-based production bundling and code-splitting for heavy modules (WebLLM assets).
- PWA: `vite-plugin-pwa` for service-worker caching of model assets and offline support.
- Project Organization: single-page app, dynamic imports for heavy ML modules, workerized OCR and model workers.

### Next Actions
- If you accept this starter approach, I will append this evaluation and mark `stepsCompleted: [1,2,3]`, then load step-04-decisions.md so we can begin making concrete architecture decisions.
- Reply `A` for Advanced Elicitation, `P` for Party Mode, or `C` to accept and continue.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Local-first storage and processing model (IndexedDB primary) to meet privacy and offline NFRs.
- Workerized OCR and model inference pipeline (Tesseract workers + WebLLM in worker/iframe) to protect UI responsiveness.

**Important Decisions (Shape Architecture):**
- Service-worker based caching (vite-plugin-pwa) for large model assets and offline support.
- Encrypted optional API-key storage (Web Crypto AES-GCM via `src/lib/secureStorage.ts`).
- Minimal server surface (OpenRouter proxy in `api/openrouter.js`) for optional cloud-boost jobs; keep sensitive logic server-side.

**Deferred Decisions (Post-MVP):**
- Full server-side sync and multi-user deck sharing (Phase 2).
- Admin/cohort dashboard and large-batch server-side processing.

### Data Architecture
- Primary storage: IndexedDB (client) for decks, card metadata, chunked processing state, and review history.
- Schema: normalize decks, cards, reviews; include source provenance (pdf path, page, excerpt, OCR confidence).
- Export adapters: Anki .apkg generator (client-side) and JSON export for integrations.
- Backup/sync (post-MVP): optional server sync using PostgreSQL + Prisma or Firebase; design export/import hooks now.

### Authentication & Security
- MVP: no account required for local-first flows. Optional cloud-boost operations require explicit user opt-in and API key entry.
- Store API keys encrypted at rest using Web Crypto (AES-GCM) via `src/lib/secureStorage.ts`.
- All server communications (OpenRouter proxy) use TLS; server validates rate-limits and scrubs logs before storing.

### API & Communication Patterns
- Use a minimal REST JSON API for server-side helpers (OpenRouter proxy, support bundle upload). Keep contracts small and well-documented.
- Client → Server: only send content when user explicitly opts in for cloud processing; include job metadata and chunk ids.
- Error handling: structured errors with codes and recommended recovery steps surfaced to users.

### Frontend Architecture
- Framework: React + TypeScript (existing repo). Code-splitting for heavy modules (WebLLM, TTS, Tesseract).
- State management: local component state + lightweight global store (Zustand) for app state and job orchestration.
- UI patterns: Editor components for inline card edits, PDF page/region selector, and a Review session UI driven by FSRS engine.

### Infrastructure & Deployment
- Static assets and frontend: deploy to Vercel/Netlify (static hosting). Use GitHub Actions for CI (lint/test/build).
- Serverless proxies: simple Node serverless function (api/openrouter.js) hosted on same platform with environment secrets.
- Monitoring: client-side error telemetry (opt-in) and support bundle export. Use Sentry or similar for server functions.

### Decision Impact Analysis
- IndexedDB-first means design APIs to be optional and decoupled; implement export/import early.
- Workerized inference implies message-passing interfaces and careful resource management; design a small RPC layer for workers.
- PWA caching impacts storage footprint; provide user controls to manage cached models.

### Implementation Sequence
1. Implement ingestion pipeline (pdf.js + page preview + region selector) and workerized Tesseract OCR with chunking and IndexedDB persistence.
2. Implement card-generation pipeline using a stubbed WebLLM flow (mock/local model) and inline editor UX.
3. Add FSRS scheduler & review UI integrated with saved decks.
4. Enable PWA (vite-plugin-pwa) and service-worker caching for model assets.
5. Add optional OpenRouter proxy integration and encrypted API-key storage.

---

## Implementation Patterns

- Worker RPC: standardize a small JSON-RPC over postMessage for OCR/model workers (methods: processChunk, getStatus, cancelJob).
- Chunking: fixed-size page chunks with resumable offsets and checkpointed progress in IndexedDB.
- Error handling pattern: surface human-readable message + actionable recovery step + attachable support bundle.
- Observability: emit structured events (timestamp, chunkId, op, status, ocrConfidence) to support bundle and optional telemetry.

---

## Project Structure Recommendations

- `src/lib/` — platform helpers (`db.ts`, `secureStorage.ts`, `worker-rpc.ts`).
- `src/workers/` — Tesseract worker, model worker shims.
- `src/components/` — `PDFPageViewer`, `CardEditor`, `ReviewSession`.
- `src/pages/` — main app routes (Import, Edit, Review, Settings, Support).
- `service-worker.js` — generated via `vite-plugin-pwa` for model caching & offline assets.

---

## Validation & Risk Mitigation

- WebGPU/Model fallback: detect `navigator.gpu`; if absent, fall back to Wasm/CPU model path and surface messaging.
- Memory pressure: adaptive worker concurrency and chunk-size throttling; detect low-memory devices and reduce parallelism.
- OCR quality: per-region re-run UI, confidence thresholds, and human-edit mandatory step before saving decks.
- Security: avoid sending raw documents to server; if user opts in, send only necessary chunks and prompt for confirmation.

---

## Finalization

All architecture steps completed. Documented decisions are appended here to guide implementation. Next recommended actions:
- Create implementation issues for the top 5 tasks in the Implementation Sequence.
- Add unit/e2e smoke tests for ingestion and review flows.



