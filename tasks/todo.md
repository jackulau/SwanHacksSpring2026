# Converge — Ship Checklist (2026-05-03)

## Theme Transformation (DONE)
- [x] CSS variables: dark → Converge light (cream #fbfbf9, green #2f5d4f)
- [x] Georgia serif branding font
- [x] All routes + components: text-white/text-black → CSS vars
- [x] Sidebar: dark green with white text
- [x] Landing, login, dashboard: light theme
- [x] Focus-highlight, skeleton, glass, aurora: light mode
- [x] WCAG AA contrast: text-subtle=#777, text-muted=#555
- [x] Indigo/purple remnants → green

## Features (All Built)
- [x] Recording (live audio capture + Deepgram STT) — requires VITE_DEEPGRAM_API_KEY
- [x] AI Pipeline (clean transcript → notes → flashcards → quiz) — requires VITE_OPENAI_API_KEY
- [x] File upload (drag-drop + audio processing)
- [x] Canvas LMS sync (popup + console paste fallback)
- [x] Chrome extension (content script + popup + background worker)
- [x] Course CRUD (add/edit/delete)
- [x] Lecture viewer (transcript + notes tabs, audio seek)
- [x] Flashcard review (SM-2 spaced repetition)
- [x] Quiz runner (MC, T/F, short answer, fill-blank)
- [x] Pomodoro timer + study sessions
- [x] Study planner (to-do tasks)
- [x] Calendar (week/month views, Canvas assignment sync)
- [x] Accessibility (OpenDyslexic, high contrast, TTS, focus mode, reading ruler, sign language)
- [x] Sign language detection (MediaPipe Hands + ASL letters)
- [x] Settings (profile, preferences, accessibility, account, data export)
- [x] Trash (soft-delete recovery)

## Database
- [x] PocketBase :8090 healthy
- [x] 9 collections with access rules
- [x] Cascade deletes + indexes

## Ship
- [ ] Commit all theme + contrast changes
- [ ] Push to remote
- [ ] Merge jack → main
