---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
inputDocuments:
  - _bmad-output/planning-artifacts/prd-section-01-problem-target.md
workflowType: 'prd'
briefCount: 0
researchCount: 0
brainstormingCount: 1
projectDocsCount: 0
classification:
  projectType: web_app
  domain: edtech
  complexity: medium
  projectContext: greenfield
completed: true
completedAt: '2026-03-20T00:00:00Z'
---

# Product Requirements Document - DocuVoice

**Author:** Dghost
**Date:** 2026-03-20

## Executive Summary

MedCards is an offline-first, privacy-preserving PWA that converts PDFs (lecture notes, textbooks, question banks) into high-yield flashcards with evidence-based FSRS scheduling—delivering usable study decks in minutes instead of months. Built for medical students in India and globally, MedCards prioritizes local processing (WebLLM + pdf.js + Tesseract) so users can generate, edit, review, and retain study material entirely on-device, with an optional user-supplied OpenRouter key (Grok-first) for quality boosts when desired. MedCards is the complete study environment.

### What Makes This Special

- Local-first architecture: full PDF→OCR→card generation→FSRS review pipeline runs in-browser, preserving privacy and enabling reliable offline study.
- Medical-first prompts and workflows: generation is tuned for clinical relevance (differentials, mechanisms, cloze for lists) and validated by a mandatory human-edit step before saving.
- Practical pipeline and UX: per-page / per-region selection, quick generation, inline editor, and immediate FSRS review close the loop between content ingestion and spaced practice.
- Flexible quality options: default WebLLM provides zero-cloud operation; users may opt to supply an OpenRouter key (Grok priority) to accelerate and improve card quality without surrendering ownership of their data.
- Offline TTS (Piper) planned for audio-based review sessions.

## Project Classification

- Project Type: web_app (PWA, SPA)
- Domain: edtech (medical exam prep)
- Complexity: medium (privacy and medical-content accuracy are primary concerns)
- Project Context: greenfield (no prior planning artifacts loaded)

## Success Criteria

### User Success
- No hard limit on PDF size or number of pages; large documents are supported via chunked processing, resumable/background jobs, and per-chunk card-generation so users can begin editing results before full-file completion.
- Users can generate, edit, and save a deck in one session (create ≥1 deck, edit ≥3 cards, schedule first review).
- Convert a 30-page PDF into an editable flashcard deck within 10 minutes on a laptop (≤15 minutes on a mid-range phone). For larger files, processing time scales proportionally and runs as a background job with progress indicators.
- Aha moment: user completes first review session and marks the deck "helpful" — target: ≥60% of new users report "helpful" after first review.

### Business Success
- Activation: ≥30% of new installs generate at least one deck in their first session.
- Engagement: weekly active users (WAU)/monthly active users (MAU) ≥ 20%.
- Retention: 7-day retention ≥20%; 30-day retention ≥10%.
- Optional paid funnel (post-MVP): 2% paid-conversion by month 6 (if monetization enabled).

### Technical Success
- Local pipeline reliability: PDF→OCR→card-generation completes within target times (≤10 min for 30 pages on laptop, ≤15 min on mid-range phones).
- OCR quality: English OCR error rate <5% on reasonably scanned PDFs; fallbacks (per-region OCR) available for noisy scans.
- Scalability: support chunked OCR + generation pipeline with resumable processing and incremental saving to the deck.
- Background reliability: long-running conversions continue in background (or resume after reload) and surface progress/errors to the user.
- Offline-first reliability: core features (import, generate, edit, first review) function offline ≥90% of the time.
- Privacy: no user content leaves device without explicit opt-in; encrypted storage for any optional API keys.

### Measurable Outcomes (key KPIs)
- New-install activation rate ≥30%
- 7d retention ≥20% / 30d retention ≥10%
- WAU/MAU ≥20%
- First-review helpfulness ≥60%
- OCR error rate <5% (English)

## Product Scope

### MVP (Must)
- PDF import, pdf.js extraction, Tesseract fallback OCR.
- Card generation (WebLLM on-device) + inline editor.
- FSRS scheduling for review.
- MedCards is the full review environment.
- Offline-first UX and encrypted optional API-key storage.

### Growth (Post-MVP)
- Cloud optional quality boost (user-supplied OpenRouter key).
- TTS (Piper) for playback and study sessions.
- Multi-language OCR improvements and higher-quality card templates.
- Sharing/export workflows and sync options.

### Vision
- Collaborative decks, institutional workflows, server-side validation for high-stakes content, and integrated analytics for learning outcomes.

## User Journeys

### 1. Primary User — Exam-Prep Student (Core Journey)
- Opening: Student opens MedCards on their laptop/phone with a PDF of lecture notes.
- Steps: import PDF → automatic text extraction (pdf.js) → preview per-page text → select pages/regions → generate cards (chunked) → edit cards inline → save deck → schedule first review via FSRS → complete first review session.
- Success: student finishes first review and marks the deck "helpful" (Aha moment).
- Failure modes & recovery: OCR fails on noisy scan → surface low-confidence excerpts and offer per-region OCR; device slow/low-memory → offer chunked processing, background/resumable job, or cloud-boost option.

### 2. Primary User — Large/Interrupted File (Edge Case)
- Opening: Student imports a 400-page question bank.
- Steps: system chunks file, starts incremental OCR + generation, shows progress; student begins editing cards for first chunks while later chunks process in background; if session closes, resume on next open.
- Success: student can study a partial deck immediately and resume full conversion later.
- Failure modes & recovery: mid-processing crash → resume from last completed chunk; device limits detected → suggest splitting file or using cloud-boost for heavy batches.

### 3. Admin / Course Manager
- Opening: Instructor or institution admin prepares curated content for a cohort.
- Steps: upload master PDFs (desktop), configure templates (card types, difficulty tags), review autogenerated decks, approve or push curated decks to students (export/import workflow or shared bundle).
- Requirements surfaced: admin dashboard for batch uploads, template management, content moderation and approval workflow, analytics for cohort adoption.

### 4. Support / Troubleshooter
- Opening: Support agent receives a user report: "conversion failed".
- Steps: reproduce by loading same PDF, preview OCR output layer, export logs & OCR text, advise user to re-run per-region OCR or split file, escalate to devs if crash reproduces.
- Requirements surfaced: ability to export processing logs, view OCR confidence, reproduction steps, and reprocess with modified settings.

- ### 5. Power User / Integration (API/Export)
- Opening: Researcher or power user wants to integrate MedCards into a workflow.
- Steps: import via CLI or structured upload, run headless conversion, export JSON of cards for use with LMS or custom tooling.
- Requirements surfaced: documented import/export format, bulk-processing endpoint or CLI tool, metadata tags for grading/analytics.

## Journey Requirements Summary
- Core import + extraction (pdf.js) with per-region OCR fallback (Tesseract).
- Chunked processing pipeline with resumable background jobs and progress UI.
- Inline editor, FSRS scheduler, and local Anki export (.apkg).
- Inline editor, FSRS scheduler, and local deck persistence (IndexedDB).
- Encrypted optional API-key storage and explicit opt-in for cloud boosts.
- Admin dashboard: batch uploads, templates, moderation, analytics.
- Support tooling: export logs, OCR confidence viewer, reprocess controls.
- API/CLI interfaces for bulk and automated workflows.

<!-- End of User Journeys (Step 4) -->

## Project-Type: web_app (SPA/PWA)

**Project-Type Overview**
- Project type: `web_app` (SPA / PWA).
- Primary UX: Single-Page Application with progressive enhancement via `vite-plugin-pwa` and service worker.
- Priority browsers: Chrome & Edge (golden path), Firefox (supported with fallbacks), Safari (partial; warn users).
- Mobile focus: Android Chrome primary; iOS supported but lower priority.

**Technical Architecture Considerations**
- SPA routing and state (React + Vite) — continue single-bundle SPA model with code-splitting for heavy features (PDF processing, WebLLM assets).
- WebGPU-first local LLM/TTS paths; CPU fallbacks where unavailable. Feature-detect `navigator.gpu` early and surface clear UX messages.
- Chunked, resumable PDF processing pipeline (client-side): pdf.js → per-page/per-region OCR (Tesseract) → chunked WebLLM card generation → incremental save to IndexedDB.
- Background/resumable jobs with progress UI and local persistence; surface errors and retry controls.

**Dynamic Sections (browser_matrix; responsive_design; performance_targets; seo_strategy; accessibility_level)**

- Browser matrix
  - Chrome/Edge: full feature set (WebGPU, WebLLM, Piper TTS). Target as golden path.
  - Firefox: support WebGPU where present; enable CPU fallback and show guidance.
  - Safari: partial support—test WebGPU on macOS/iOS 26+, provide warning and optional cloud-boost path.
  - Detection & messaging: runtime checks for WebGPU, WebAssembly SIMD, available memory, and camera access.

- Responsive design
  - Layouts adapt to phone/tablet/desktop; prioritized flows: import/edit/review optimized for narrow screens.
  - Large asset flows (model downloads/cache) only triggered on Wi‑Fi or user opt-in on mobile.
  - Touch affordances for selection regions in `PDFPageViewer` and editor controls.

- Performance targets
  - 30-page PDF → full card generation (first chunk usable) within ≤10 min on laptop; ≤15 min on mid-range phone for first-pass.
  - First chunk processing latency: initial preview and first-card generation within 60–120s for 10 pages.
  - Background conversion completeness: 90% of conversions under 500 pages should complete without user intervention on capable devices.
  - Memory safeguards: detect low-memory devices and reduce concurrent workers / fall back to smaller chunk sizes.

- SEO strategy
  - App is a PWA SPA — SEO limited to marketing/content pages. No server-side rendering required for core app flows.
  - Provide shareable landing pages (marketing) with SSR if SEO important for discoverability; not required for MVP.

- Accessibility level
  - Target WCAG 2.1 AA for core flows (import, edit, review, playback).
  - Keyboard navigation, focus management for modals (editor, viewer), high-contrast themes, and TTS controls.
  - Ensure exported decks and review UI are screen-reader friendly.

**Implementation Considerations**
- Code-splitting and dynamic import for heavy modules: WebLLM assets, TTS encoders, Tesseract workers.
- Use service worker to cache model assets and static resources; provide UI to manage cached model footprints.
- Optional cloud-boost path: encrypted local storage for OpenRouter key (`src/lib/secureStorage.ts`) and clear opt-in flow.
- Monitoring & logs: client-side logging for long-running conversions, uploadable support bundles for troubleshooting.
- Testing matrix: prioritize Chrome desktop & Android Chrome on mid-range devices; add Firefox and Safari smoke tests.

<!-- End of Project-Type (Step 7) -->

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Lean problem-solving MVP — validate the core PDF→Card→Review loop quickly with reliable offline-first behavior and human-in-the-loop quality control.

**Resource Requirements:** Estimated MVP team: 1 PM, 2 frontend (React/Vite), 1 WebGPU/ML engineer, 1 QA/DevOps, 1 UX/designer (≈5 people). Target delivery: 3–4 months.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:** import → select → generate → edit → save → first review.

**Must-Have Capabilities:**
- PDF import + `pdf.js` extraction with per-region OCR fallback (Tesseract).
- Chunked processing pipeline + progress UI + resumable background jobs.
- On-device card generation (WebLLM) with inline editor and mandatory human-review step before persisting.
- FSRS scheduling + local review UX.
- Local persistence (IndexedDB).
- Minimal settings: WebGPU detection, cloud-boost opt-in, model cache management.
- Basic telemetry & support export (logs, OCR confidence) for troubleshooting.
- WCAG AA accessibility for core flows.

**Non-MVP (defer to Phase 2):** TTS playback (Piper), admin dashboard, cohort sharing, advanced analytics, multi-language ML tuning.

### Phase 2 (Growth)

- Optional cloud-boost (OpenRouter), TTS playback, sharing & deck sync, improved multi-language OCR, admin/cohort tools, enhanced templates, monetization experiments.

### Phase 3 (Vision)

- Collaborative decks, institutional distribution, server-side validation for high-stakes content, advanced analytics and LMS integrations.

### Risk Mitigation

- Technical: feature-detect WebGPU and provide CPU fallback and cloud-boost; require human-edit step; use chunking and adaptive worker counts to handle device limits.
- Market: focus early on medical-student cohorts and coaching centers for activation/retention validation.
- Resource: keep MVP scope tight; consider contracting ML specialists if needed.
- Compliance/Privacy: local-first by default; explicit opt-in for cloud processing; encrypted keys via `src/lib/secureStorage.ts`.

### Measurable Scope Goals

- Deliver core MVP supporting the primary journey within 3–4 months with a 5-person team.
- First-deck generation usable within targets (30-page ≤10 min on laptop baseline).
- Validate Activation: ≥30% new installs create a deck in first session.

<!-- End of Scoping (Step 8) -->

## Functional Requirements

### Import & Extraction
- FR1: [User] can import a PDF, DOCX, or supported document into the app for processing.
- FR2: [System] extracts text from imported documents and presents a per-page preview layer for selection.
- FR3: [User] can select pages and arbitrary rectangular regions to include or exclude from processing.

### OCR & Document Processing
- FR4: [System] performs OCR on selected pages/regions and provides an OCR confidence indicator for each extracted text block.
- FR5: [User] can request per-region OCR re-processing when confidence is low.
- FR6: [System] supports chunked and resumable processing of large documents and reports progress to the user.

### Card Generation & Editing
- FR7: [User] can generate candidate flashcards from selected content in a single action.
- FR8: [System] groups generated cards into an editable deck where each card can be edited inline by the user.
- FR9: [User] can accept, modify, delete, or merge generated cards prior to saving.
- FR10: [System] preserves source references (page number, excerpt) for each generated card.

### Review & Scheduling
- FR11: [User] can schedule a generated deck for review using an FSRS-based schedule.
- FR12: [User] can start a review session, mark cards as correct/incorrect, and see next-review dates.
- FR13: [System] tracks review history per card and exposes basic progress metrics for the user.

### Persistence & Export
- FR14: [User] can save decks locally and view a list of saved decks.
- FR15: [User] can save, view, resume, or delete decks within MedCards.
- FR16: [User] can export card data as JSON for personal backup.

### Settings, Model & Resource Management
- FR17: [User] can view device capability status (WebGPU availability, memory) and model cache usage.
- FR18: [User] can opt into or out of cloud-boost features and manage their encrypted API key.
- FR19: [System] allows the user to manage cached model assets and clear cache to free space.

### Admin, Moderation & Sharing (Post-MVP/Optional)
- FR20: [Admin] can upload and configure templates for batch deck generation.
- FR21: [Admin] can approve or reject autogenerated decks before distribution to a cohort.
- FR22: [User] can share/export curated deck bundles to other users (Phase 2 feature).

### Integrations & Automation
- FR23: [Power User/API] can perform headless conversions and request exports via a documented export format or CLI.
- FR24: [System] provides metadata (tags, difficulty, source) with exports to support LMS/analytics integration.

### Security, Privacy & Compliance
- FR25: [System] stores optional cloud API keys encrypted at rest and requires explicit user opt-in for cloud processing.
- FR26: [System] never transmits user content off-device unless the user explicitly requests cloud processing for a job.

### Accessibility & UX
- FR27: [User] can navigate all core flows via keyboard and screen reader; core review/playback UI must meet WCAG AA.
- FR28: [User] can control TTS playback (if available) with accessible controls (play/pause/seek/rate).

### Support & Observability
- FR29: [Support] can export processing logs and OCR snapshots to help triage user issues.
- FR30: [System] surfaces actionable error messages and recommended recovery steps when processing fails.

<!-- End of Functional Requirements (Step 9) -->

## Non-Functional Requirements

### Performance
- NFR1: Interactive actions (open editor, accept/modify a card) complete within 2 seconds on a typical laptop; first-card generation for a 10-page chunk completes within 60–120 seconds on a modern laptop.
- NFR2: Background chunked processing must make measurable progress; for typical mid-range devices the system should process at least 1 page/minute on average under normal conditions (device-dependent).
- NFR3: The app must detect low-memory devices and automatically reduce concurrency (worker count) to avoid crashes.

### Reliability & Resilience
- NFR4: Chunked conversions must be resumable after app restart or crash; at least 95% of interrupted conversions should resume successfully from last saved chunk.
- NFR5: Core offline flows (import, generate first-chunk, edit, save, start review) must work without network connectivity ≥90% of the time for typical usage patterns.

### Security & Privacy
- NFR6: All optional cloud API keys and sensitive configuration are encrypted at rest using AES-GCM with keys derived via PBKDF2 (or equivalent) — leverage existing `src/lib/secureStorage.ts` implementation.
- NFR7: All network communication to cloud services must use TLS 1.2+; the app must only transmit user content when the user explicitly opts in to cloud processing for a job.
- NFR8: User-identifiable data (if any) must be minimised; logs uploaded for support must be scrubbed of sensitive excerpts unless the user explicitly includes them.

### Scalability & Maintainability
- NFR9: The client architecture must support incremental feature delivery via code-splitting; large model assets should be cached via service worker and removable through UI.
- NFR10: Optional server-side endpoints (cloud-boost) should be designed to handle bursty uploads — server SLAs to be defined separately; client must expose retry/backoff for failed uploads.

### Accessibility
- NFR11: Core flows must meet WCAG 2.1 AA for the import/edit/review UI — keyboard navigation, proper ARIA roles, focus management, and screen-reader support required.

### Observability & Supportability
- NFR12: Client must produce actionable logs for long-running conversions (timestamps, chunk ids, OCR confidence) and offer a user-triggered export for support bundles.
- NFR13: Error messages must be actionable and include suggested recovery steps (e.g., retry per-region OCR, reduce chunk size, enable cloud-boost).

### Measurability
- NFR14: The product must capture telemetry for key NFR verification: first-chunk latency, conversion success/failure rates, memory-related crashes, and feature-detection stats (WebGPU availability).

<!-- End of Non-Functional Requirements (Step 10) -->

