# HackStack Implementation Plan

## Phase 1: Foundation (Hours 0-4)
- [x] Install all dependencies (TanStack Query, lucide-react, framer-motion, MediaPipe, fonts)
- [x] Extend PocketBase schema: create all collections with migrations
- [x] Define TypeScript types for all data models
- [x] Build AppShell layout with sidebar navigation
- [x] Build route structure (all routes with placeholder pages)
- [x] User preferences context + CSS custom properties
- [x] Basic accessibility panel (font size, theme toggle)

## Phase 2: Capture (Hours 4-8)
- [x] `useAudioRecorder` hook
- [x] `useDeepgramSTT` hook
- [x] `useMediaPipeHands` hook
- [x] `useSignLanguage` hook
- [x] SignLanguageDetector component
- [x] Caption merger (audio STT + sign-to-text)
- [x] Live recording page
- [x] File upload page
- [x] Processing status component

## Phase 3: AI Pipeline (Hours 8-12)
- [x] Prompt templates
- [x] AI pipeline orchestrator
- [x] Transcript cleanup
- [x] Note generation
- [x] Flashcard generation
- [x] Quiz generation
- [x] Error handling + partial result saving

## Phase 4: Workspace (Hours 12-16)
- [x] Dashboard
- [x] Course CRUD
- [x] Lecture detail page with tabs
- [x] Transcript viewer with audio sync
- [x] Note editor (block-based)
- [x] Audio player bar

## Phase 5: Study Tools (Hours 16-20)
- [x] SM-2 algorithm
- [x] Flashcard review UI
- [x] Quiz runner
- [x] Quiz results
- [x] Study session tracking

## Phase 6: Polish & Accessibility (Hours 20-24)
- [x] Full accessibility panel
- [x] Font loading (OpenDyslexic, Atkinson Hyperlegible)
- [x] TTS integration (hook)
- [x] Reading ruler + focus mode
- [x] High contrast + sepia themes
- [x] Pomodoro timer (hook)
- [x] Study streak
- [x] Responsive design pass
- [x] Demo data seeding

## Post-implementation hardening (this round)
- [x] Security migration: locked down `transcripts`/`notes`/`flashcards`/`quizzes`/`quiz_attempts`/`study_sessions` rules
- [x] Fixed user-id spoofing on `courses`/`lectures`/`assignments` createRule (now `@request.auth.id = @request.body.user`)
- [x] Fixed duplicate-record bug in `routes/capture.tsx` (StrictMode + stale closure → ref-guarded)
- [x] Bottom-padding reservation in AppShell `<main>` for MobileNav + AudioPlayer
- [x] Floating accessibility button auto-lifts above MobileNav and AudioPlayer

## Documentation produced this round
- [x] `tasks/architecture-audit.md`
- [x] `tasks/typescript-audit.md`
- [x] `tasks/database-audit.md`
- [x] `tasks/security-audit.md`
- [x] `tasks/e2e-test-plan.md`
- [x] `tasks/_done/01-course-crud.md` … `06-demo-data.md`
