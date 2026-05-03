# Converge — Full Feature Verification Spec (2026-05-03)

## 1. Infrastructure
- [x] PocketBase :8090 healthy
- [x] Dev server :3000 healthy
- [x] TypeScript compiles clean (tsc --noEmit)
- [x] Vite build succeeds
- [x] All 10 DB collections exist (users, courses, lectures, transcripts, notes, flashcards, quizzes, quiz_attempts, assignments, study_sessions)
- [x] All collections have created/updated autodate fields (migration 1777700000)

## 2. Auth & Landing
- [x] Dashboard renders (cream bg, green branding, Georgia serif logo)
- [x] Hero greeting with user name ("Good evening, demo")
- [x] Login/signup functional (demo user active)
- [x] User menu with sign out

## 3. Dashboard (authenticated)
- [x] Study streak displays (0 days)
- [x] Quick actions (Start recording, Upload, Notes, Review, Calendar)
- [x] Recent notes section (empty state shown correctly)
- [x] Upcoming assignments — "Extra Credit Opportunity" from Canvas sync
- [x] Zero console errors

## 4. Courses
- [x] Course list renders — 16 courses from Canvas sync
- [x] "Add course" button present
- [x] Course detail page loads with Lectures/Assignments/Notes tabs
- [x] Course code and name displayed correctly

## 5. Capture
- [x] Record page loads with mic button
- [x] Record/Upload tab toggle works
- [x] Upload page loads with drag-drop zone (mp3, m4a, wav, webm, ogg, flac)
- [x] Sign language toggle button present
- [x] STT status shows "Press record to begin"
- [x] Uses local Whisper (not Deepgram) — verified in code

## 6. Calendar
- [x] Calendar renders with school week view
- [x] Day/Week/Month view toggles present
- [x] Mini calendar sidebar with month navigation
- [x] "New event" button present
- [x] 10 assignments displayed from Canvas sync
- [x] Time slot grid for creating events

## 7. Study Hub
- [x] Study page renders with launcher rows
- [x] Flashcard count shows ("No cards due")
- [x] Quiz count shows ("None yet")
- [x] "Start Pomodoro" button present and links to planner

## 8. Planner
- [x] Pomodoro timer displays (25:00 ready)
- [x] Tasks section with 13 open tasks from Canvas
- [x] "Add a task" input present

## 9. Flashcards
- [x] Flashcard review page loads
- [x] Empty state when no cards ("Record or upload a lecture to generate flashcards")

## 10. Quiz
- [x] Quiz disabled in study hub when none available
- [x] Shows "None yet" count

## 11. Settings
- [x] Profile section: name, email display
- [x] Preferences: theme (Converge Light / High Contrast), font (System/Atkinson/OpenDyslexic), reading level
- [x] Canvas integration section with URL input + sync button + manual fallback
- [x] AI model section: provider dropdown (Ollama/OpenRouter/Google/OpenAI/Custom), model field, test button
- [x] Account section with sign out
- [x] Data section with export

## 12. Accessibility
- [x] A11y floating button visible on all pages (bottom-right corner)
- [x] Skip to main content link present

## 13. Trash
- [x] Trash page renders with empty state
- [x] "Back to dashboard" link

## 14. Theme Consistency
- [x] No white-on-white text — verified via screenshot
- [x] Sidebar: white text on dark green
- [x] Content: dark text on cream/white
- [x] Primary buttons: white text on green
- [x] Readable contrast on all text

## 15. Local AI
- [x] ai-pipeline.ts uses configurable LLM (Ollama/OpenRouter/Google/OpenAI/Custom)
- [x] useLocalWhisper.ts exists and replaces Deepgram
- [x] capture.tsx imports useLocalWhisper (not useDeepgramSTT)
- [x] capture.upload.tsx uses transcribeAudioFile (not OpenAI API)
- [x] Settings AI model section allows provider selection
- [x] Dead useDeepgramSTT.ts removed
- [x] Zero references to VITE_DEEPGRAM_API_KEY or VITE_OPENAI_API_KEY in active code

## 16. Database Fix
- [x] Added autodate migration (created/updated fields) for all collections
- [x] sort=-updated queries work (was failing with 400)
- [x] PocketBase restarted with migration applied

## Ship
- [x] All checks pass
- [ ] Commit
- [ ] Push
- [ ] Merge jack → main
