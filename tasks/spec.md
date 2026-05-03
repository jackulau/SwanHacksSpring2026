# HackStack — Product Specification

**Codename**: HackStack  
**Tagline**: "Every student's accessibility toolkit — without asking for one."  
**Branch**: `jack`  
**Date**: 2026-05-02  
**Status**: Implementation complete — audited 2026-05-02

---

## 0. Implementation Audit (2026-05-02)

### Navigation & UI/UX Audit — All Pages Verified

| Route | Page | Status | Notes |
|-------|------|--------|-------|
| `/` | Dashboard (auth) | PASS | Stats, quick actions, recent lectures, courses, assignments |
| `/` | Landing (unauth) | PASS | Marketing page with features |
| `/login` | Login | PASS | Redirects to dashboard when authed |
| `/capture` | Record Lecture | PASS | Start recording button, live captions area, sign language toggle |
| `/capture/upload` | Upload Audio | PASS | Drag-drop zone, file type hints |
| `/courses` | Courses List | PASS | Add Course button, empty state |
| `/courses/$courseId` | Course Detail | PASS | Lectures list within course |
| `/study` | Study Hub | PASS | 3 study mode cards, progress stats, tips |
| `/study/flashcards` | Flashcard Review | PASS | Empty state with guidance |
| `/study/quiz/$quizId` | Quiz Runner | PASS | Loads quiz, runs QuizRunner, saves attempts |
| `/study/planner` | Study Planner | PASS | Pomodoro timer (25:00), streak, session counter |
| `/settings` | Settings | PASS | Canvas integration, accessibility, account/notif/privacy (soon) |
| `/settings/accessibility` | Accessibility Panel | PASS | Theme, font, size, spacing, motion, reading level, TTS, study prefs |
| `/lectures/$lectureId` | Lecture Detail | PASS | 4 tabs: Transcript, Notes, Flashcards, Quiz — all render |

### Backend Audit

| Check | Status | Action Taken |
|-------|--------|-------------|
| Access rules | FIXED | 6 collections had empty rules (wide open). Now enforce `@request.auth.id = user.id` |
| Cascade deletes | FIXED | lectures->course was `false`, now `true` |
| Missing fields | FIXED | `front_image`/`back_image` added to flashcards |
| DB indexes | ADDED | Indexes on all foreign keys + `next_review`, `status` |
| Orphaned migrations | REMOVED | 3 old `items` collection migrations deleted |
| Assignments collection | OK | Properly defined with auth rules in separate migration |

### Chrome Extension Audit

| Check | Status | Action Taken |
|-------|--------|-------------|
| Manifest permissions | FIXED | `optional_host_permissions` narrowed from `*` to `instructure.com` |
| Content script injection | OK | Canvas detection, sync button, toast notifications |
| Auth flow | OK | Login/logout via PocketBase, token in chrome.storage |
| Sync logic | OK | Courses + assignments with upsert, status detection |
| CSS accessibility | FIXED | Added `prefers-reduced-motion` support |
| Z-index | FIXED | Reduced from 99999 to 10000 |
| Icons | OK | 16/48/128px PNGs present |

### Frontend Code Audit

| Check | Status |
|-------|--------|
| TypeScript strict mode | PASS — 0 errors |
| All routes implemented | PASS — 14/14 (quiz route was stub, now complete) |
| All components implemented | PASS — 20+ components, no stubs |
| All hooks implemented | PASS — 9/9 hooks |
| All lib files implemented | PASS — auth, preferences, pocketbase, ai-pipeline, sm2, types, prompts, canvas |
| TODOs/FIXMEs | NONE found |
| Console.log cleanup | CLEAN — only intentional logs in Canvas bookmarklet script |

### Known Limitations (Not Bugs)

- Account/Notifications/Privacy settings pages show "Soon" badge — planned future work
- AI pipeline requires `VITE_OPENAI_API_KEY` env var at runtime
- Deepgram STT requires API key for live capture
- Sign language detection is client-side only (MediaPipe), no server component
- Canvas sync requires Chrome extension installed + Canvas session active

---

## 1. Vision

One platform that replaces the 4-5 tool juggle students do today (Otter.ai + Notion + Quizlet + TurboLearn + calendar app). Record a lecture, get a clean transcript, auto-generated notes, flashcards, and quizzes — all accessible-first, disclosure-free. Students with disabilities get the same power tools as everyone else, no paperwork required.

### 1.1 Why This Wins

| Competitor | Gap HackStack Fills |
|---|---|
| Otter.ai | Transcription only. No study tools. No accessibility modes. |
| TurboLearn AI | Upload-based, no live capture. No workspace. No accessibility focus. |
| Quizlet | Manual card creation. No lecture integration. |
| Notion AI | General-purpose. No audio capture. No spaced repetition. No accessibility modes. |
| Google Docs + Live Transcribe | Fragmented. No study generation. No quiz mode. |

**Differentiator**: Accessible-first design baked in, not bolted on. Every feature ships with WCAG 2.1 AA compliance, screen reader support, neurodivergent-friendly modes, and zero disclosure requirements.

---

## 2. User Personas

### 2.1 Primary: College Student (Any)
- Attends 3-5 lectures/week
- Takes notes manually or uses multiple fragmented tools
- Wants to study efficiently without setup overhead
- May or may not have a diagnosed disability

### 2.2 Secondary: Student with Accessibility Needs
- Hard of hearing → needs live captions + clean transcripts
- Dyslexic → needs OpenDyslexic font, adjustable reading level, TTS
- ADHD → needs chunked study sessions, break reminders, progress gamification
- ESL → needs multi-language translation, simplified vocabulary
- **Key insight**: These students currently must disclose disability to get accommodations. HackStack gives them the tools universally.

### 2.3 Tertiary: Teaching Assistant / Instructor
- Uploads lecture recordings for students
- Reviews auto-generated quiz banks for quality
- Uses analytics to see which concepts students struggle with

---

## 3. Core Architecture

### 3.1 System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  Vite + TanStack Router + Tailwind v4                   │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ Capture  │ │Workspace │ │  Study   │ │ Settings/  │ │
│  │  Module  │ │  Module  │ │  Module  │ │ A11y Panel │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬───────┘ │
│       │             │            │             │         │
│       └─────────────┴────────────┴─────────────┘         │
│                         │                                │
│                    PocketBase SDK                        │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP/WS
┌─────────────────────▼───────────────────────────────────┐
│                  Backend (PocketBase)                     │
│                                                          │
│  Collections:                                            │
│  users, lectures, transcripts, notes, flashcards,       │
│  quizzes, quiz_attempts, study_sessions, courses         │
│                                                          │
│  Hooks (Go/JS):                                         │
│  - on_lecture_create → trigger AI pipeline               │
│  - on_transcript_complete → generate notes + cards       │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│               AI Processing Pipeline                     │
│                                                          │
│  Stage 1: Audio → Text (Deepgram / Whisper API)         │
│  Stage 2: Text → Clean Transcript (GPT-4o-mini)        │
│  Stage 3: Clean Transcript → Structured Notes (GPT-4o) │
│  Stage 4: Clean Transcript → Flashcards (GPT-4o-mini)  │
│  Stage 5: Clean Transcript → Quiz Bank (GPT-4o-mini)   │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 19 + Vite 6 + TanStack Router | Already scaffolded. Fast HMR. File-based routing. |
| Styling | Tailwind v4 | Already installed. Utility-first, fast iteration. |
| State | React context + TanStack Query (add) | Server state caching, optimistic updates. |
| Audio Capture | Web Audio API + MediaRecorder | Browser-native. No dependencies. |
| Real-time STT | Deepgram WebSocket API | Sub-300ms latency. Speaker diarization. Free tier available. |
| Batch STT | OpenAI Whisper API | Fallback for uploaded files. $0.006/min. |
| AI Processing | OpenAI GPT-4o-mini | Cheap ($0.15/1M input). Good enough for notes/cards/quizzes. |
| AI Processing (premium) | OpenAI GPT-4o | For complex note structuring when quality matters. |
| Backend | PocketBase | Already scaffolded. Auth, DB, file storage, realtime, hooks. |
| File Storage | PocketBase (local) | Audio files stored as attachments on lecture records. |
| Deploy | Vercel (frontend) + Fly.io (PocketBase) | Free tiers. Separate scaling. |

### 3.3 Cost Estimation (per lecture hour)

| Service | Cost |
|---|---|
| Deepgram real-time STT | ~$0.0043/min → $0.26/hr |
| Whisper API (batch fallback) | $0.006/min → $0.36/hr |
| GPT-4o-mini (transcript cleanup) | ~$0.02 per lecture |
| GPT-4o-mini (notes + cards + quiz) | ~$0.05 per lecture |
| MediaPipe sign language detection | $0.00 (client-side, runs in browser) |
| **Total per lecture hour** | **~$0.33** |

---

## 4. Data Model (PocketBase Collections)

### 4.1 `users` (built-in PocketBase auth)
Extended with profile fields:
```
users {
  // PocketBase built-in: id, email, password, etc.
  display_name:      text
  avatar:            file
  preferences:       json    // { theme, font, fontSize, readingLevel, language, ttsEnabled, dyslexiaMode, highContrast, reducedMotion, breakReminders, pomodoroLength }
  onboarding_done:   bool
}
```

### 4.2 `courses`
```
courses {
  id:          text (PK)
  user:        relation(users)
  name:        text
  code:        text       // e.g. "CS 101"
  color:       text       // hex for UI
  semester:    text       // e.g. "Fall 2026"
  created:     datetime
  updated:     datetime
}
```

### 4.3 `lectures`
```
lectures {
  id:              text (PK)
  user:            relation(users)
  course:          relation(courses)     // optional
  title:           text
  audio_file:      file                  // stored in PocketBase
  duration_secs:   number
  status:          select [uploading, processing, transcribing, generating, ready, error]
  error_message:   text                  // if status == error
  recorded_at:     datetime
  created:         datetime
  updated:         datetime
}
```

### 4.4 `transcripts`
```
transcripts {
  id:              text (PK)
  lecture:         relation(lectures)
  raw_text:        text                  // direct STT output
  clean_text:      text                  // AI-cleaned version
  segments:        json                  // [{ start: number, end: number, text: string, speaker?: string, confidence: number }]
  speakers:        json                  // [{ id: string, label: string }] for diarization
  language:        text                  // detected language code
  word_count:      number
  created:         datetime
  updated:         datetime
}
```

### 4.5 `notes`
```
notes {
  id:              text (PK)
  lecture:         relation(lectures)    // nullable — can be standalone
  user:            relation(users)
  title:           text
  content:         json                  // block-based content (Notion-style)
  content_type:    select [auto_generated, manual, hybrid]
  key_concepts:    json                  // [{ term: string, definition: string, importance: "high"|"medium"|"low" }]
  summary:         text                  // 2-3 sentence summary
  created:         datetime
  updated:         datetime
}
```

**Block content schema** (stored in `notes.content`):
```json
[
  { "type": "heading", "level": 1, "text": "Lecture Title" },
  { "type": "heading", "level": 2, "text": "Section Name" },
  { "type": "paragraph", "text": "Content here..." },
  { "type": "bullet_list", "items": ["Point 1", "Point 2"] },
  { "type": "key_term", "term": "Photosynthesis", "definition": "..." },
  { "type": "example", "text": "For instance..." },
  { "type": "callout", "variant": "important", "text": "This will be on the exam" },
  { "type": "callout", "variant": "confusion", "text": "Common misconception: ..." },
  { "type": "code", "language": "python", "code": "def example():\n    pass" },
  { "type": "quote", "text": "Direct quote from lecturer", "timestamp": 1234 },
  { "type": "divider" }
]
```

### 4.6 `flashcards`
```
flashcards {
  id:              text (PK)
  lecture:         relation(lectures)    // nullable
  user:            relation(users)
  deck_name:       text
  front:           text
  back:            text
  front_image:     file                  // optional diagram/image
  back_image:      file
  tags:            json                  // string array
  difficulty:      select [easy, medium, hard]
  source:          select [auto_generated, manual]

  // SM-2 spaced repetition fields
  ease_factor:     number   // default 2.5
  interval_days:   number   // default 0
  repetitions:     number   // default 0
  next_review:     datetime
  last_review:     datetime

  created:         datetime
  updated:         datetime
}
```

### 4.7 `quizzes`
```
quizzes {
  id:              text (PK)
  lecture:         relation(lectures)
  user:            relation(users)
  title:           text
  questions:       json                  // array of Question objects (see below)
  total_points:    number
  source:          select [auto_generated, manual]
  created:         datetime
  updated:         datetime
}
```

**Question schema** (stored in `quizzes.questions`):
```json
[
  {
    "id": "q1",
    "type": "multiple_choice",
    "question": "What is photosynthesis?",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct_answer": 2,
    "explanation": "Because...",
    "points": 1,
    "difficulty": "medium",
    "concept_tag": "photosynthesis"
  },
  {
    "id": "q2",
    "type": "short_answer",
    "question": "Explain the light-dependent reactions.",
    "rubric": "Must mention: water splitting, electron transport, ATP/NADPH production",
    "points": 3,
    "difficulty": "hard",
    "concept_tag": "light_reactions"
  },
  {
    "id": "q3",
    "type": "true_false",
    "question": "The Calvin cycle requires direct sunlight.",
    "correct_answer": false,
    "explanation": "The Calvin cycle uses ATP and NADPH, not direct light.",
    "points": 1,
    "difficulty": "easy",
    "concept_tag": "calvin_cycle"
  },
  {
    "id": "q4",
    "type": "fill_blank",
    "question": "The process of _____ converts CO2 into glucose.",
    "correct_answer": "carbon fixation",
    "accept_also": ["carbon dioxide fixation", "CO2 fixation"],
    "points": 1,
    "difficulty": "medium",
    "concept_tag": "carbon_fixation"
  }
]
```

### 4.8 `quiz_attempts`
```
quiz_attempts {
  id:              text (PK)
  quiz:            relation(quizzes)
  user:            relation(users)
  answers:         json        // [{ question_id: string, answer: any, correct: bool, points_earned: number }]
  score:           number
  max_score:       number
  percentage:      number
  time_taken_secs: number
  completed_at:    datetime
  created:         datetime
}
```

### 4.9 `study_sessions`
```
study_sessions {
  id:              text (PK)
  user:            relation(users)
  session_type:    select [flashcard_review, quiz, pomodoro, free_study]
  lecture:         relation(lectures)    // nullable
  cards_reviewed:  number
  cards_correct:   number
  duration_secs:   number
  started_at:      datetime
  ended_at:        datetime
  created:         datetime
}
```

---

## 5. Feature Specifications

### 5.1 Capture Module

#### 5.1.1 Live Recording
**Route**: `/capture`

**User flow**:
1. User clicks "Start Recording"
2. Browser requests microphone permission via `navigator.mediaDevices.getUserMedia()`
3. `MediaRecorder` captures audio as webm/opus chunks
4. Simultaneously, audio stream connects to Deepgram WebSocket for real-time STT
5. Live captions appear on screen with <300ms latency
6. User clicks "Stop Recording"
7. Audio blob assembled and uploaded to PocketBase as lecture attachment
8. AI pipeline triggered

**Technical details**:
```typescript
// Audio capture config
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    channelCount: 1,
    sampleRate: 16000,
    echoCancellation: true,
    noiseSuppression: true,
  }
});

const recorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 64000,
});

// Deepgram real-time connection
const dgSocket = new WebSocket('wss://api.deepgram.com/v1/listen?...');
// Send audio chunks as they arrive
recorder.ondataavailable = (e) => {
  dgSocket.send(e.data);
};
```

**Deepgram config parameters**:
```
model=nova-2
language=en
smart_format=true
punctuate=true
diarize=true           // speaker identification
filler_words=false     // remove "um", "uh"
utterances=true        // sentence-level grouping
interim_results=true   // show partial results live
endpointing=300        // ms silence to end utterance
```

**Live caption display**:
- Scrolling text area showing real-time transcription
- Current speaker labeled (Speaker 1, Speaker 2...)
- Confidence-based styling: high confidence = solid, low = slightly transparent
- Timestamp markers every 30 seconds
- Keyword highlighting for detected technical terms

#### 5.1.2 File Upload
**Route**: `/capture/upload`

**Supported formats**: mp3, mp4, m4a, wav, webm, ogg, flac  
**Max file size**: 500MB (configurable)  
**Processing**: Whisper API (batch, not real-time)

**User flow**:
1. Drag-and-drop or file picker
2. Upload progress bar
3. File stored in PocketBase
4. Lecture record created with `status: "processing"`
5. Backend hook sends to Whisper API
6. On completion, AI pipeline continues

#### 5.1.3 AI Processing Pipeline

Triggered after transcription completes. Runs sequentially:

**Stage 1: Transcript Cleanup** (GPT-4o-mini)
```
System: You are a lecture transcript cleaner. Fix:
- Grammar and punctuation errors
- Filler words the STT missed
- Technical jargon spelling (e.g., "gradient descent" not "grading descent")
- Run-on sentences → proper sentence boundaries
- Speaker label consistency

Preserve: meaning, technical accuracy, lecture flow.
Do NOT: summarize, remove content, add content, change meaning.

Output: cleaned transcript as plain text with paragraph breaks.
```

**Stage 2: Note Generation** (GPT-4o-mini)
```
System: You are a study notes generator. From this lecture transcript, create structured notes.

Output JSON array of content blocks:
- heading (h1 for title, h2 for sections)
- paragraph (explanatory text)
- bullet_list (key points)
- key_term (term + definition pairs)
- example (illustrative examples from the lecture)
- callout with variant "important" (exam hints, emphasized points)
- callout with variant "confusion" (common misconceptions mentioned)

Rules:
- Extract ALL key concepts, don't skip content
- Use the lecturer's own examples
- Flag anything the lecturer emphasized
- Include timestamps referencing the original audio
- Aim for comprehensive coverage, not brevity
```

**Stage 3: Flashcard Generation** (GPT-4o-mini)
```
System: Generate flashcards from this lecture transcript.

For each key concept, create a card:
- Front: question or prompt (concise, clear)
- Back: answer (complete but not verbose)
- Difficulty: easy/medium/hard
- Tags: relevant topic tags

Rules:
- One concept per card
- Avoid yes/no questions
- Use "What is", "How does", "Why does", "Compare X and Y" formats
- Include cards for definitions, processes, relationships, and applications
- 15-30 cards per lecture hour
```

**Stage 4: Quiz Generation** (GPT-4o-mini)
```
System: Generate a quiz from this lecture transcript.

Create a mix of:
- 5-8 multiple choice questions (4 options each)
- 2-3 true/false questions
- 2-3 short answer questions
- 1-2 fill-in-the-blank questions

For each question provide:
- The question text
- Correct answer
- Explanation of why the answer is correct
- Difficulty rating
- Concept tag linking to the relevant topic

Rules:
- Questions should test understanding, not just recall
- Distractors (wrong MC options) should be plausible
- Cover the full lecture, not just the beginning
- Include at least one application/scenario question
```

**Pipeline error handling**:
- Each stage retries up to 2 times on API failure
- If a stage fails after retries, lecture status → "error" with message
- Partial results saved: if notes succeed but flashcards fail, notes are still available
- User can manually re-trigger any failed stage

---

### 5.2 Workspace Module

#### 5.2.1 Dashboard
**Route**: `/` (authenticated)

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│  HackStack                        [Settings] [User] │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Quick Actions:                                      │
│  [🎙 Record Lecture]  [📁 Upload Audio]              │
│                                                      │
│  ┌─────────────────┐  ┌─────────────────┐           │
│  │ Due for Review   │  │ Recent Lectures  │           │
│  │ 12 flashcards    │  │ CS 101 - May 1   │           │
│  │ 1 quiz retake    │  │ BIO 201 - Apr 30 │           │
│  │ [Study Now →]    │  │ MATH 301 - ...   │           │
│  └─────────────────┘  └─────────────────┘           │
│                                                      │
│  Study Streak: 5 days 🔥                            │
│  ████████░░  80% of weekly goal                     │
│                                                      │
│  Courses:                                            │
│  [CS 101] [BIO 201] [MATH 301] [+ Add Course]      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

#### 5.2.2 Course View
**Route**: `/courses/$courseId`

Shows all lectures for a course, organized by date. Each lecture card shows:
- Title and date
- Processing status (if still running)
- Quick links: Transcript | Notes | Cards | Quiz
- Duration
- Number of flashcards due for review

#### 5.2.3 Lecture Detail
**Route**: `/lectures/$lectureId`

**Tabbed layout**:
- **Transcript**: Clean transcript with optional raw view toggle. Click-to-seek if audio player is active.
- **Notes**: Block-based rendered notes. Editable — user can add/remove/reorder blocks.
- **Flashcards**: Card deck view with flip animation. Shows card count and mastery %.
- **Quiz**: Take quiz, view past attempts, see analytics per concept.

**Audio player bar** (persistent at bottom when lecture has audio):
- Play/pause, seek bar, playback speed (0.5x - 2x)
- Current timestamp synced with transcript highlighting
- Skip forward/back 10s buttons

#### 5.2.4 Note Editor
**Route**: `/lectures/$lectureId/notes` (also `/notes/new` for standalone)

Block-based editor inspired by Notion. Features:
- Drag to reorder blocks
- `/` command menu to insert block types
- Inline formatting: bold, italic, code, highlight
- Click key_term blocks to see definition
- Click callout blocks to expand
- Manual edit mode on auto-generated notes

**Block types supported**:
- Heading (H1, H2, H3)
- Paragraph
- Bullet list / Numbered list
- Key term (highlighted term + definition)
- Example (indented with icon)
- Callout (important / confusion / tip)
- Code block (with language)
- Quote (with optional timestamp link)
- Divider
- Image (uploaded)

---

### 5.3 Study Module

#### 5.3.1 Flashcard Review
**Route**: `/study/flashcards`

**SM-2 Algorithm Implementation**:
```typescript
interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: Date;
}

function sm2(quality: number, card: Flashcard): SM2Result {
  // quality: 0-5 (0=complete blackout, 5=perfect recall)

  let { ease_factor: ef, interval_days: interval, repetitions } = card;

  if (quality >= 3) {
    // correct response
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * ef);
    }
    repetitions += 1;
  } else {
    // incorrect — reset
    repetitions = 0;
    interval = 1;
  }

  // update ease factor
  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  ef = Math.max(1.3, ef); // minimum ease factor

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return { easeFactor: ef, interval, repetitions, nextReview };
}
```

**Review UI**:
- Card flips on click/tap/spacebar
- After reveal, rate: Again (0) | Hard (2) | Good (4) | Easy (5)
- Progress bar showing cards remaining
- Session stats: cards reviewed, accuracy, time spent
- Keyboard shortcuts: Space (flip), 1-4 (rate), → (skip)

**Queue priority**:
1. Overdue cards (past `next_review`)
2. New cards (never reviewed, `repetitions === 0`)
3. Cards due today
4. Sorted by: overdue days DESC, then ease_factor ASC (hardest first)

#### 5.3.2 Quiz Mode
**Route**: `/study/quiz/$quizId`

**Features**:
- One question at a time, progress indicator
- Multiple choice: click option, submit
- Short answer: text input, AI-graded against rubric
- True/false: toggle buttons
- Fill blank: inline text input
- Timer (optional, configurable)
- Skip and return to skipped questions
- Review mode after completion: see all answers with explanations
- Score breakdown by concept tag

**Accessibility modes for quiz**:
- Extended time: 1.5x or 2x time limit
- Read-aloud: TTS reads question + options
- Simplified language: re-phrases at lower reading level
- High contrast mode
- Keyboard-only navigation

#### 5.3.3 Study Planner
**Route**: `/study/planner`

- Calendar view showing upcoming reviews
- Pomodoro timer: 25 min work / 5 min break (configurable)
- Daily goal setting: "Review X cards per day"
- Streak tracking with visual indicator
- Study session history (graph: time studied per day/week)
- Smart suggestions: "You have 15 cards due in CS 101. Study now?"

**ADHD-friendly features**:
- Chunked sessions: auto-break after N cards (configurable, default 20)
- Break reminders with gentle notification
- Progress dopamine: confetti/animation on milestones
- "Just 5 more" mode when near completion
- Visual progress bars everywhere (not just numbers)
- No infinite scrolling — clear stopping points

---

### 5.4 Sign Language Recognition Module

#### 5.4.1 Overview
MediaPipe Hands + Gesture Recognition running client-side in the browser. Detects ASL (American Sign Language) fingerspelling and common signs via webcam, converts to text, and merges into the live caption stream. Deaf/HoD students can sign questions or notes; hearing students get sign language as an input modality alongside speech.

**Two modes**:
1. **Sign-to-Text Input** — User signs into webcam, recognized text appears in captions/transcript alongside audio STT
2. **Sign Language Overlay** — Avatar or visual overlay that translates caption text into sign language animations (stretch goal)

#### 5.4.2 Technical Architecture

```
┌──────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│   Webcam     │────→│  MediaPipe Hands     │────→│  Gesture         │
│   Stream     │     │  (21 landmarks/hand) │     │  Classifier      │
│              │     │  runs in browser     │     │  (TFLite/custom)  │
└──────────────┘     └─────────────────────┘     └────────┬─────────┘
                                                           │
                                                    recognized sign
                                                           │
                                                  ┌────────▼─────────┐
                                                  │  Sign Buffer     │
                                                  │  (debounce +     │
                                                  │   confidence     │
                                                  │   threshold)     │
                                                  └────────┬─────────┘
                                                           │
                                              ┌────────────▼────────────┐
                                              │  Caption Merger         │
                                              │  Interleaves sign text  │
                                              │  with audio STT output  │
                                              └─────────────────────────┘
```

**MediaPipe setup** (runs entirely client-side, no API calls):
```typescript
import { Hands, HAND_CONNECTIONS } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,        // 0=lite, 1=full
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5,
});

hands.onResults((results) => {
  if (results.multiHandLandmarks) {
    for (const landmarks of results.multiHandLandmarks) {
      // landmarks = array of 21 {x, y, z} normalized coordinates
      // Pass to gesture classifier
      const gesture = classifyGesture(landmarks);
      if (gesture.confidence > CONFIDENCE_THRESHOLD) {
        signBuffer.push(gesture);
      }
    }
  }
});

// Connect webcam feed
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480,
  facingMode: 'user',
});
camera.start();
```

#### 5.4.3 Gesture Classification Strategy

**Tier 1: ASL Fingerspelling (MVP)**
- 26 static hand poses (A-Z letters)
- Train or use pre-trained TFLite model on MediaPipe hand landmarks
- Each frame → 21 landmarks × 3 coords = 63 features → classifier → letter
- Debounce: same letter held for 500ms = confirmed letter
- Space detection: hand drops below threshold for 300ms = space between words
- Word completion: after space, check against dictionary for autocorrect

**Tier 2: Common ASL Signs (Stretch)**
- 50-100 most common signs (hello, thank you, yes, no, help, question, understand, again, please, sorry, etc.)
- Requires temporal gesture recognition (sequence of hand positions over time)
- Use LSTM or simple DTW (Dynamic Time Warping) on landmark sequences
- Pre-recorded gesture templates matched against live input

**Tier 3: Sign Language Avatar Overlay (Stretch+)**
- Text → sign language animation
- Pre-built avatar performs signs corresponding to caption words
- Use existing open-source ASL animation datasets
- Rendered as overlay on lecture video or beside captions

#### 5.4.4 Landmark Data Format

MediaPipe Hands returns 21 landmarks per hand:
```
 0: WRIST
 1-4: THUMB (CMC, MCP, IP, TIP)
 5-8: INDEX (MCP, PIP, DIP, TIP)
 9-12: MIDDLE (MCP, PIP, DIP, TIP)
 13-16: RING (MCP, PIP, DIP, TIP)
 17-20: PINKY (MCP, PIP, DIP, TIP)
```

Each landmark: `{ x: 0-1, y: 0-1, z: depth }` normalized to image dimensions.

**Feature engineering for classifier**:
```typescript
function extractFeatures(landmarks: NormalizedLandmark[]): number[] {
  const features: number[] = [];

  // Relative positions (all landmarks relative to wrist)
  const wrist = landmarks[0];
  for (let i = 1; i < 21; i++) {
    features.push(landmarks[i].x - wrist.x);
    features.push(landmarks[i].y - wrist.y);
    features.push(landmarks[i].z - wrist.z);
  }

  // Finger angles (curl detection)
  const fingerTips = [4, 8, 12, 16, 20];
  const fingerMCPs = [2, 5, 9, 13, 17];
  for (let i = 0; i < 5; i++) {
    const tip = landmarks[fingerTips[i]];
    const mcp = landmarks[fingerMCPs[i]];
    // Distance from tip to MCP (extended vs curled)
    features.push(Math.sqrt(
      (tip.x - mcp.x) ** 2 +
      (tip.y - mcp.y) ** 2 +
      (tip.z - mcp.z) ** 2
    ));
  }

  // Inter-finger distances (thumb-to-each-finger tip)
  const thumbTip = landmarks[4];
  for (const tip of [8, 12, 16, 20]) {
    features.push(Math.sqrt(
      (thumbTip.x - landmarks[tip].x) ** 2 +
      (thumbTip.y - landmarks[tip].y) ** 2 +
      (thumbTip.z - landmarks[tip].z) ** 2
    ));
  }

  return features; // 60 + 5 + 4 = 69 features
}
```

#### 5.4.5 Sign Buffer & Caption Merger

```typescript
interface RecognizedSign {
  letter: string;
  confidence: number;
  timestamp: number;
}

class SignBuffer {
  private buffer: RecognizedSign[] = [];
  private currentWord: string = '';
  private lastSignTime: number = 0;
  private onWord: (word: string) => void;

  constructor(onWord: (word: string) => void) {
    this.onWord = onWord;
  }

  push(sign: RecognizedSign) {
    const now = Date.now();

    // Space detection: gap > 800ms between signs → emit word
    if (now - this.lastSignTime > 800 && this.currentWord.length > 0) {
      this.emitWord();
    }

    // Debounce: same letter must be held for 500ms
    // (multiple consecutive frames with same classification)
    if (this.buffer.length > 0) {
      const last = this.buffer[this.buffer.length - 1];
      if (last.letter === sign.letter) {
        // Same letter, check duration
        if (now - this.buffer[0].timestamp >= 500) {
          this.currentWord += sign.letter;
          this.buffer = [];
        }
      } else {
        // Different letter, reset buffer
        this.buffer = [sign];
      }
    } else {
      this.buffer = [sign];
    }

    this.lastSignTime = now;
  }

  private emitWord() {
    if (this.currentWord.length > 0) {
      this.onWord(this.currentWord);
      this.currentWord = '';
    }
  }
}
```

**Caption merger** — interleaves audio STT output and sign-to-text:
```typescript
interface CaptionSegment {
  text: string;
  source: 'audio' | 'sign';
  speaker?: string;
  timestamp: number;
  confidence: number;
}

// In LiveCaptions component, both sources push to same stream:
// - Deepgram WebSocket → { source: 'audio', ... }
// - SignBuffer onWord  → { source: 'sign', ... }
// Rendered with different styling:
//   audio = normal text
//   sign  = italic + hand icon prefix
```

#### 5.4.6 UI for Sign Language Mode

**Capture page additions** when sign language enabled:
```
┌─────────────────────────────────────────────────────────┐
│  Recording: 03:24                            [Stop]     │
├───────────────────────────┬─────────────────────────────┤
│                           │                             │
│   Webcam Preview          │   Live Captions             │
│   ┌───────────────┐       │                             │
│   │               │       │   "Today we'll discuss      │
│   │   [Hand       │       │   neural networks..."       │
│   │    landmarks  │       │                             │
│   │    overlay]   │       │   🤟 "question"             │
│   │               │       │   (signed by you)           │
│   └───────────────┘       │                             │
│                           │   "Good question. Neural    │
│   Detected: Q-U-E-S-T... │   networks are..."          │
│   Confidence: 94%         │                             │
│                           │                             │
├───────────────────────────┴─────────────────────────────┤
│   [🎙 Mic: On]  [🤟 Sign: On]  [📷 Camera: On]        │
└─────────────────────────────────────────────────────────┘
```

- Webcam preview shows hand landmark overlay (drawn with MediaPipe drawing utils)
- Current fingerspelling buffer shown below preview ("Detected: Q-U-E-S-T...")
- Confidence meter for current detection
- Toggle buttons for mic, sign detection, and camera independently
- Captions show source: audio text is normal, signed text has hand icon prefix and italic styling

#### 5.4.7 Performance Considerations

| Concern | Solution |
|---|---|
| MediaPipe inference ~15-30ms per frame at 30fps | Use `requestAnimationFrame`, skip frames if behind (target 15fps for hands is sufficient) |
| Camera + mic + Deepgram WS + MediaPipe simultaneously | Profile memory. Reduce camera resolution to 480p for hand detection (landmarks don't need HD) |
| GPU contention on low-end laptops | `modelComplexity: 0` (lite) option in settings. Fall back to CPU if WebGL unavailable |
| Battery drain on mobile | Auto-pause sign detection when tab not visible. Show battery warning if detection enabled for >30 min |
| Two video streams (lecture + webcam) | Sign detection uses small PiP webcam only, not lecture video |

#### 5.4.8 ASL Fingerspelling Model Options

**Option A: Pre-trained TFLite model (recommended for hackathon)**
- Use existing fingerspelling model from TensorFlow Hub / Kaggle ASL datasets
- Load via `@mediapipe/tasks-vision` GestureRecognizer
- Supports custom gesture packs — load ASL letters as gesture templates
- No training needed, just package the model

**Option B: Train custom classifier**
- Collect landmark data for each letter (use existing ASL fingerspelling datasets: ASL Alphabet on Kaggle, 87k images)
- Extract features using `extractFeatures()` above
- Train small neural net (2 hidden layers, 128 units each) in TensorFlow.js
- Export to TFLite for MediaPipe Tasks integration
- More work but more accurate for our specific landmark format

**Recommended approach**: Start with Option A (MediaPipe GestureRecognizer with pre-trained ASL pack). If accuracy insufficient, switch to Option B during polish phase.

---

### 5.5 Accessibility Panel

**Route**: `/settings/accessibility` (also accessible from any page via floating button)

#### 5.4.1 Display Settings
| Setting | Options | Default |
|---|---|---|
| Font family | System, OpenDyslexic, Atkinson Hyperlegible, Lexie Readable | System |
| Font size | 14-24px slider | 16px |
| Line spacing | 1.2 - 2.0 slider | 1.5 |
| Letter spacing | normal, wide, wider | normal |
| Theme | Light, Dark, High Contrast, Sepia | Dark |
| Reduced motion | on/off | off (respects `prefers-reduced-motion`) |
| Color blind mode | none, protanopia, deuteranopia, tritanopia | none |

#### 5.4.2 Reading Settings
| Setting | Options | Default |
|---|---|---|
| Reading level | Original, Simplified, Basic | Original |
| Text-to-speech | on/off | off |
| TTS voice | system voices | system default |
| TTS speed | 0.5x - 2.0x | 1.0x |
| Reading ruler | on/off (horizontal line follows cursor) | off |
| Focus mode | off, sentence, paragraph (dims surrounding text) | off |

#### 5.4.3 Caption Settings (for live recording)
| Setting | Options | Default |
|---|---|---|
| Caption font size | 18-36px | 24px |
| Caption position | top, bottom, floating | bottom |
| Caption background | transparent, semi, opaque | semi |
| Caption color | white, yellow, cyan | white |
| Auto-scroll | on/off | on |
| Show confidence | on/off (dim low-confidence words) | off |
| Show speaker labels | on/off | on |

#### 5.4.4 Study Settings
| Setting | Options | Default |
|---|---|---|
| Cards per session | 10, 20, 30, 50, unlimited | 20 |
| Break reminder interval | 15, 25, 30, 45 min | 25 min |
| Quiz time multiplier | 1x, 1.5x, 2x, unlimited | 1x |
| Animation level | full, reduced, none | full |
| Sound effects | on/off | on |
| Haptic feedback (mobile) | on/off | on |

All preferences stored in `users.preferences` JSON field. Applied via CSS custom properties and React context.

---

## 6. Route Map

```
/                           → Dashboard (redirect to /login if not auth'd)
/login                      → Login / Register
/capture                    → Live recording interface
/capture/upload             → File upload interface
/courses                    → All courses list
/courses/$courseId           → Course detail with lectures
/lectures/$lectureId        → Lecture detail (tabs: transcript, notes, cards, quiz)
/lectures/$lectureId/notes  → Full note editor
/study                      → Study hub (cards due, quizzes, planner)
/study/flashcards           → Flashcard review session (filters by course/lecture)
/study/quiz/$quizId         → Take quiz
/study/quiz/$quizId/results → Quiz results + review
/study/planner              → Study planner / calendar
/settings                   → General settings
/settings/accessibility     → Accessibility preferences panel
```

All routes require auth except `/login`. TanStack Router file-based routing — each route is a file in `src/routes/`.

---

## 7. API Keys & Environment Variables

```env
# Frontend (.env.local)
VITE_POCKETBASE_URL=http://127.0.0.1:8090
VITE_DEEPGRAM_API_KEY=...          # WebSocket STT (client-side for hackathon; proxy in prod)

# Backend (PocketBase hooks or proxy server)
OPENAI_API_KEY=...                 # GPT-4o-mini for AI pipeline
DEEPGRAM_API_KEY=...               # Server-side STT for uploads
WHISPER_API_KEY=...                # Same as OPENAI_API_KEY (Whisper is OpenAI)
```

**Security note for hackathon**: Deepgram WebSocket connection happens client-side (API key exposed). Acceptable for demo. Production: proxy through backend.

---

## 8. AI Prompt Templates

### 8.1 Transcript Cleanup

```
System prompt:
You are a lecture transcript cleaner for an educational platform. Your job is to take raw speech-to-text output and produce a clean, readable transcript.

Rules:
1. Fix grammar, punctuation, and sentence boundaries
2. Remove filler words (um, uh, like, you know) that the STT didn't catch
3. Fix technical jargon spelling — use the correct spelling for domain terms
4. Maintain paragraph breaks at natural topic transitions
5. Keep speaker labels if present (format: "Speaker 1: ...")
6. Preserve all substantive content — do NOT summarize or skip anything
7. Fix common STT errors (homophones, run-together words)
8. Do NOT add content that wasn't in the original

Input: Raw transcript text
Output: Cleaned transcript text with proper paragraphs
```

### 8.2 Note Generation

```
System prompt:
You are a study notes generator for a university lecture. Generate comprehensive, well-structured notes from a lecture transcript.

Output a JSON array of content blocks. Available block types:
- { "type": "heading", "level": 1|2|3, "text": "..." }
- { "type": "paragraph", "text": "..." }
- { "type": "bullet_list", "items": ["...", "..."] }
- { "type": "key_term", "term": "...", "definition": "..." }
- { "type": "example", "text": "..." }
- { "type": "callout", "variant": "important"|"confusion"|"tip", "text": "..." }
- { "type": "code", "language": "...", "code": "..." }
- { "type": "quote", "text": "...", "timestamp": null }

Rules:
1. Extract ALL key concepts — comprehensive coverage over brevity
2. Use heading level 1 for the lecture title, level 2 for main sections, level 3 for sub-sections
3. Use key_term blocks for every defined term or concept
4. Use example blocks for the lecturer's illustrations
5. Use callout "important" for anything emphasized or flagged for exams
6. Use callout "confusion" for common misconceptions the lecturer mentions
7. Maintain the lecture's logical flow and ordering
8. Include relevant code if the lecture involves programming

User prompt:
Generate structured notes from this lecture transcript:

{transcript}
```

### 8.3 Flashcard Generation

```
System prompt:
You are a flashcard generator for a university study tool. Create effective study flashcards from lecture content.

Output a JSON array of flashcard objects:
[
  {
    "front": "question or prompt",
    "back": "answer",
    "difficulty": "easy"|"medium"|"hard",
    "tags": ["topic1", "topic2"]
  }
]

Rules:
1. One concept per card
2. Front should be a clear question — avoid yes/no format
3. Back should be a complete but concise answer
4. Use varied question types: "What is...", "How does...", "Why...", "Compare...", "What are the steps of..."
5. Create 15-30 cards per lecture hour
6. Cover definitions, processes, relationships, and applications
7. Difficulty: easy = recall a definition, medium = explain a concept, hard = apply/analyze
8. Tag each card with the relevant topic from the lecture

User prompt:
Generate flashcards from this lecture transcript:

{transcript}
```

### 8.4 Quiz Generation

```
System prompt:
You are a quiz generator for a university study tool. Create a comprehensive quiz that tests understanding of lecture material.

Output a JSON array of question objects:
[
  {
    "id": "q1",
    "type": "multiple_choice"|"true_false"|"short_answer"|"fill_blank",
    "question": "...",
    "options": ["A) ...", ...],       // MC only
    "correct_answer": 2|true|"text",  // index for MC, bool for T/F, string for SA/FB
    "accept_also": ["...", "..."],    // alternative correct answers for SA/FB
    "explanation": "...",
    "points": 1-3,
    "difficulty": "easy"|"medium"|"hard",
    "concept_tag": "topic_name"
  }
]

Rules:
1. Create a balanced mix: 5-8 MC, 2-3 T/F, 2-3 short answer, 1-2 fill blank
2. MC distractors should be plausible (common misconceptions)
3. Cover the full lecture evenly — not just the beginning
4. Test understanding and application, not just memorization
5. Include at least one scenario/application question
6. Explanations should teach — explain WHY the answer is correct
7. Points: 1 for recall, 2 for understanding, 3 for application
8. Tag each question with its concept for analytics

User prompt:
Generate a quiz from this lecture transcript:

{transcript}
```

### 8.5 Reading Level Simplification

```
System prompt:
Rewrite the following text at a {level} reading level.

Levels:
- "simplified": Use simpler vocabulary, shorter sentences. Keep all content. Aim for grade 8-10 reading level.
- "basic": Use basic vocabulary, very short sentences. Explain technical terms inline. Aim for grade 5-7 reading level.

Rules:
1. Preserve ALL information — simplify language, not content
2. Break long sentences into shorter ones
3. Replace jargon with simpler terms (keep the jargon in parentheses first time)
4. Add brief inline explanations for complex concepts
5. Maintain the logical structure

User prompt:
Simplify this text to {level} reading level:

{text}
```

---

## 9. UI Component Architecture

### 9.1 Shared Components

```
src/
├── components/
│   ├── ui/                          # Base UI primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Tabs.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── Dropdown.tsx
│   │   ├── Toggle.tsx
│   │   ├── Slider.tsx
│   │   └── Tooltip.tsx
│   ├── layout/
│   │   ├── AppShell.tsx             # Main layout wrapper (nav + content + a11y fab)
│   │   ├── Sidebar.tsx              # Course navigation
│   │   └── AudioPlayer.tsx          # Persistent bottom audio bar
│   ├── capture/
│   │   ├── RecordButton.tsx         # Mic button with recording state
│   │   ├── LiveCaptions.tsx         # Real-time caption display (merged audio + sign)
│   │   ├── FileUpload.tsx           # Drag-and-drop upload
│   │   ├── ProcessingStatus.tsx     # Pipeline progress indicator
│   │   ├── SignLanguageDetector.tsx  # Webcam preview + landmark overlay + detection status
│   │   └── CaptureControls.tsx      # Mic/Sign/Camera toggle bar
│   ├── workspace/
│   │   ├── NoteEditor.tsx           # Block-based note editor
│   │   ├── NoteBlock.tsx            # Individual block renderer
│   │   ├── BlockMenu.tsx            # "/" command insert menu
│   │   ├── TranscriptViewer.tsx     # Transcript with timestamp sync
│   │   └── LectureCard.tsx          # Lecture list item
│   ├── study/
│   │   ├── FlashcardDeck.tsx        # Card flip + review UI
│   │   ├── FlashcardCard.tsx        # Single card with flip animation
│   │   ├── QuizRunner.tsx           # Quiz taking interface
│   │   ├── QuizQuestion.tsx         # Single question renderer
│   │   ├── QuizResults.tsx          # Score + review after quiz
│   │   ├── PomodoroTimer.tsx        # Timer with break reminders
│   │   ├── StudyStreak.tsx          # Streak counter + fire animation
│   │   └── ProgressRing.tsx         # Circular progress for mastery %
│   ├── sign-language/
│   │   ├── HandLandmarkCanvas.tsx   # Draws MediaPipe hand landmarks on canvas overlay
│   │   ├── SignDetectionStatus.tsx  # Current letter buffer + confidence meter
│   │   ├── GestureVisualizer.tsx    # Shows recognized gesture name + animation
│   │   └── SignLanguageToggle.tsx   # Enable/disable sign detection toggle
│   └── accessibility/
│       ├── A11yFab.tsx              # Floating accessibility button
│       ├── A11yPanel.tsx            # Settings panel overlay
│       ├── FontSelector.tsx
│       ├── ReadingRuler.tsx         # Horizontal line following cursor
│       ├── FocusMode.tsx            # Dims non-focused text
│       └── TTSControls.tsx          # Text-to-speech play/pause/speed
├── hooks/
│   ├── useAudioRecorder.ts          # MediaRecorder + Web Audio API
│   ├── useDeepgramSTT.ts           # WebSocket connection to Deepgram
│   ├── useMediaPipeHands.ts        # MediaPipe Hands init + landmark stream
│   ├── useSignLanguage.ts          # Gesture classifier + SignBuffer + caption merge
│   ├── useSM2.ts                   # Spaced repetition algorithm
│   ├── usePomodoro.ts              # Timer with state management
│   ├── useA11yPreferences.ts       # Read/write user preferences
│   ├── useTTS.ts                   # SpeechSynthesis API wrapper
│   └── useKeyboardShortcuts.ts     # Global keyboard shortcut handler
├── lib/
│   ├── pocketbase.ts               # PB client (exists)
│   ├── auth.tsx                    # Auth context (exists)
│   ├── types.ts                    # TypeScript types (exists, extend)
│   ├── ai-pipeline.ts             # AI processing orchestration
│   ├── prompts.ts                 # AI prompt templates
│   └── sm2.ts                     # SM-2 algorithm pure functions
└── routes/
    ├── __root.tsx                  # Root layout (exists)
    ├── index.tsx                   # Dashboard (rewrite)
    ├── login.tsx                   # Auth (exists)
    ├── capture.tsx                 # Live recording
    ├── capture.upload.tsx          # File upload
    ├── courses.tsx                 # Course list
    ├── courses.$courseId.tsx       # Course detail
    ├── lectures.$lectureId.tsx    # Lecture detail (tabs)
    ├── study.tsx                   # Study hub
    ├── study.flashcards.tsx       # Flashcard review
    ├── study.quiz.$quizId.tsx     # Quiz runner
    ├── study.planner.tsx          # Study planner
    ├── settings.tsx               # Settings
    └── settings.accessibility.tsx # Accessibility panel
```

### 9.2 Design Tokens

```css
/* Tailwind v4 theme extension — add to app.css */

/* Colors */
--color-primary: #6366f1;        /* indigo-500 — primary actions */
--color-primary-hover: #4f46e5;  /* indigo-600 */
--color-surface: #18181b;        /* zinc-900 — card backgrounds */
--color-surface-raised: #27272a; /* zinc-800 — elevated surfaces */
--color-border: #3f3f46;         /* zinc-700 */
--color-text: #fafafa;           /* zinc-50 */
--color-text-muted: #a1a1aa;     /* zinc-400 */
--color-success: #22c55e;        /* green-500 */
--color-warning: #f59e0b;        /* amber-500 */
--color-error: #ef4444;          /* red-500 */

/* Accessibility: high contrast overrides */
.high-contrast {
  --color-text: #ffffff;
  --color-text-muted: #d4d4d8;
  --color-border: #71717a;
  --color-primary: #818cf8;
}

/* Accessibility: dyslexia font */
.dyslexia-font {
  font-family: 'OpenDyslexic', sans-serif;
  letter-spacing: 0.05em;
  word-spacing: 0.1em;
}

/* Accessibility: sepia theme */
.theme-sepia {
  --color-surface: #f5f0e8;
  --color-text: #3d3229;
  --color-border: #c4b5a0;
}
```

---

## 10. Implementation Phases

### Phase 1: Foundation (Hours 0-4)
- [ ] Extend PocketBase schema: create all collections with migrations
- [ ] Add TanStack Query for server state
- [ ] Build AppShell layout with sidebar navigation
- [ ] Build route structure (empty pages with headers)
- [ ] User preferences context + CSS custom properties
- [ ] Basic accessibility panel (font size, theme toggle)

### Phase 2: Capture (Hours 4-8)
- [ ] `useAudioRecorder` hook (MediaRecorder + Web Audio)
- [ ] `useDeepgramSTT` hook (WebSocket real-time STT)
- [ ] `useMediaPipeHands` hook (webcam → hand landmarks)
- [ ] `useSignLanguage` hook (landmarks → gesture classification → text)
- [ ] SignLanguageDetector component (webcam preview + landmark overlay)
- [ ] Caption merger (interleave audio STT + sign-to-text)
- [ ] Live recording page with caption display + sign language panel
- [ ] File upload page with drag-and-drop
- [ ] Lecture creation in PocketBase on recording stop / upload complete
- [ ] Processing status component

### Phase 3: AI Pipeline (Hours 8-12)
- [ ] Prompt templates in `lib/prompts.ts`
- [ ] AI pipeline orchestrator in `lib/ai-pipeline.ts`
- [ ] Transcript cleanup (GPT-4o-mini)
- [ ] Note generation (GPT-4o-mini)
- [ ] Flashcard generation (GPT-4o-mini)
- [ ] Quiz generation (GPT-4o-mini)
- [ ] PocketBase hooks to trigger pipeline on lecture creation
- [ ] Error handling + partial result saving

### Phase 4: Workspace (Hours 12-16)
- [ ] Dashboard with quick actions + due cards + recent lectures
- [ ] Course CRUD
- [ ] Lecture detail page with tabs
- [ ] Transcript viewer with audio sync
- [ ] Note editor (block-based, editable)
- [ ] Audio player bar

### Phase 5: Study Tools (Hours 16-20)
- [ ] SM-2 algorithm implementation
- [ ] Flashcard review UI with flip animation
- [ ] Flashcard rating + scheduling
- [ ] Quiz runner (all question types)
- [ ] Quiz results + explanation review
- [ ] Study session tracking

### Phase 6: Polish & Accessibility (Hours 20-24)
- [ ] Full accessibility panel (all settings from 5.4)
- [ ] OpenDyslexic + Atkinson Hyperlegible font loading
- [ ] TTS integration (Web Speech API)
- [ ] Reading ruler + focus mode
- [ ] High contrast + sepia themes
- [ ] Reading level simplification (AI)
- [ ] Keyboard navigation audit (all components)
- [ ] Screen reader testing (aria labels, roles, live regions)
- [ ] Pomodoro timer
- [ ] Study streak tracking
- [ ] Responsive design pass (mobile-friendly)
- [ ] Demo data seeding for presentation

---

## 11. Hackathon Demo Script (3-5 minutes)

1. **Open** — Show dashboard. "HackStack: every student's accessibility toolkit."
2. **Record** — Start live recording. Read a passage. Show live captions appearing in real-time.
3. **Process** — Stop recording. Show AI pipeline processing (transcript → notes → cards → quiz).
4. **Review** — Open generated transcript. Toggle between raw and cleaned. Show how much cleaner it is.
5. **Notes** — Switch to auto-generated notes tab. Show structured notes with key terms, examples, callouts.
6. **Study** — Flip through flashcards. Rate a few. Show spaced repetition scheduling.
7. **Quiz** — Start auto-generated quiz. Answer a few questions. Show instant feedback + explanations.
8. **Sign Language** — Enable sign detection. Sign "HELLO" into webcam. Show hand landmarks drawn live. Show fingerspelled text appear in captions with hand icon. "Deaf students can participate without an interpreter present."
9. **Accessibility** — Open accessibility panel. Toggle dyslexia font — show notes change live. Toggle TTS — hear notes read aloud. Toggle simplified reading level — watch text simplify. Toggle high contrast.
10. **Close** — "Every student gets these tools. No disclosure. No paperwork. No juggling 5 apps."

---

## 12. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Deepgram latency or downtime during demo | No live captions | Pre-record backup audio, have cached transcript ready |
| OpenAI API rate limits | Pipeline stalls | Use GPT-4o-mini (higher limits), pre-generate demo data |
| Audio quality in noisy hackathon venue | Poor transcription | Use pre-recorded demo audio for presentation |
| PocketBase concurrent writes | Data corruption | Single-user demo, no concurrent access concerns |
| Large audio files | Upload/processing slow | Cap at 10 min for demo, show 2-min sample |
| Browser mic permission denied | Can't record | Show fallback upload flow |
| WebSocket disconnects (Deepgram) | Live captions stop | Auto-reconnect logic in `useDeepgramSTT` |
| MediaPipe WASM fails to load | No sign detection | Bundle WASM locally as fallback; CDN primary. Show graceful "sign detection unavailable" |
| Low webcam quality / poor lighting | Inaccurate hand detection | Show confidence indicator, warn user. `minDetectionConfidence` tunable in settings |
| ASL fingerspelling accuracy too low | Garbled sign text | Pre-train on clean dataset, aggressive confidence threshold (>0.85), dictionary autocorrect |
| GPU contention (MediaPipe + video) | Frame drops, lag | Reduce to `modelComplexity: 0`, cap detection to 15fps, offer CPU fallback toggle |

---

## 13. Dependencies to Install

```bash
# Frontend additions
npm install @tanstack/react-query    # server state
npm install lucide-react             # icons
npm install framer-motion            # card flip, transitions
npm install @fontsource/atkinson-hyperlegible  # a11y font
npm install @mediapipe/hands         # hand landmark detection
npm install @mediapipe/camera_utils  # webcam → MediaPipe bridge
npm install @mediapipe/drawing_utils # landmark visualization on canvas
npm install @mediapipe/tasks-vision  # GestureRecognizer (pre-trained ASL)

# Dev
npm install -D @types/dom-speech-recognition  # TTS types
```

Deepgram + OpenAI are API calls — no SDK needed (use fetch/WebSocket).
MediaPipe runs entirely client-side — no API key, no cost, no latency.

---

## 14. Success Criteria (Hackathon Judging)

1. **Working demo**: Record → transcribe → generate notes/cards/quiz in under 2 minutes
2. **Sign language**: Fingerspell at least one word into webcam, see it appear in captions live
3. **Accessibility**: At least 3 toggleable accessibility features (font, TTS, reading level) working live
4. **Polish**: Dark theme, smooth transitions, no layout jank
5. **Differentiation**: Clear pitch on why this beats TurboLearn + Quizlet + Notion separately
6. **Technical depth**: SM-2 spaced repetition, multiple AI pipeline stages, real-time WebSocket STT, client-side ML (MediaPipe)
