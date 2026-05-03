# Converge Lecture Viewer — Implementation Spec

**Date**: 2026-05-02
**Status**: Spec — ready for implementation
**Authors**: Jack, 71ne, MossPotato
**Branch**: `jack`

---

## 0. Gap Analysis: What's Built vs What's Needed

### Already Built (Keep)
| Feature | Location | Status |
|---------|----------|--------|
| Audio recording + Deepgram STT | `/capture`, `useAudioRecorder`, `useDeepgramSTT` | Working |
| File upload (drag-drop) | `/capture/upload`, `FileUpload.tsx` | Working |
| AI pipeline (clean transcript → notes → flashcards → quiz) | `ai-pipeline.ts` | Working |
| SM-2 spaced repetition | `useSM2.ts`, `sm2.ts` | Working |
| Quiz runner (MC, T/F, short answer, fill-blank) | `QuizRunner.tsx` | Working |
| Pomodoro timer | `PomodoroTimer.tsx`, `usePomodoro.ts` | Working |
| Canvas LMS sync (Chrome extension) | `/extension/` | Working |
| Accessibility (fonts, contrast, TTS, focus mode, reading ruler, ASL) | `accessibility/`, `preferences.tsx` | Working |
| PocketBase backend with auth + 9 collections | `backend/pb_migrations/` | Working |
| Study sessions + streak tracking | `useStudySession.ts`, `useStudyStreak.ts` | Working |
| Mobile nav | `MobileNav.tsx` | Working |

### Gaps (Must Build)
| Feature | Priority | Complexity | Notes |
|---------|----------|-----------|-------|
| **Theme: black + green** | P0 | Low | CSS variable swap. Currently indigo/purple. |
| **Lecture viewer layout overhaul** | P0 | High | Split layout: left materials, right video/player, bottom timeline |
| **Video playback support** | P0 | Medium | Currently audio-only. Need `<video>` player with seek, chapters. |
| **AI-generated chapters** | P1 | Medium | New AI stage: segment transcript into topics with timestamps |
| **Study guide generation** | P1 | Medium | New AI stage: overview, review questions, terms to know |
| **Timeline panel** | P1 | High | Speaker segments, topic bars, important moments — visual timeline |
| **Timestamp linking** | P1 | Medium | Click any generated content → seek video to that moment |
| **Skeleton loading states** | P1 | Medium | Progressive skeleton UI during AI processing |
| **Processing progress (granular)** | P2 | Low | More stages, progress %, ETA display |
| **"Capture Meeting" input mode** | P2 | Medium | Screen/tab capture via `getDisplayMedia` |
| **Summary tab** | P1 | Low | Dedicated summary view (purpose, takeaways, key concepts) |

---

## 1. Theme Overhaul: Black + Green

### Color System

Replace all indigo/purple accent colors with green. Keep dark backgrounds.

```
--bg-primary:     #000000     (pure black)
--bg-secondary:   #0a0a0a     (near black)
--bg-card:        #111111     (card backgrounds)
--bg-surface:     #1a1a1a     (elevated surfaces)
--border:         #262626     (borders)
--border-hover:   #333333     (hover borders)

--accent:         #22c55e     (green-500 — primary accent)
--accent-hover:   #16a34a     (green-600 — hover)
--accent-muted:   #166534     (green-800 — muted/bg)
--accent-subtle:  #052e16     (green-950 — subtle bg tint)

--text-primary:   #f4f4f5     (zinc-100)
--text-secondary: #a1a1aa     (zinc-400)
--text-muted:     #71717a     (zinc-500)
```

### Files to Update
- `frontend/src/app.css` — CSS variables + global styles
- All components using `indigo-*`, `purple-*` Tailwind classes → `green-*`
- Sidebar active state: `bg-indigo-600` → `bg-green-600`
- Buttons: `bg-indigo-600 hover:bg-indigo-500` → `bg-green-600 hover:bg-green-500`
- Tab underlines: `border-indigo-500 text-indigo-400` → `border-green-500 text-green-400`
- Progress bars, badges, links — all indigo → green
- Extension `content.css` and `popup.css` — indigo → green

### What NOT to Change
- Error states stay red
- Warning states stay amber
- Success states stay green (already correct)
- Destructive buttons stay red

---

## 2. Lecture Viewer Layout Overhaul

### Current Layout
```
┌─────────────────────────────────────┐
│ Title + Date                         │
│ [Transcript] [Notes] [Flashcards] [Quiz] │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ Single content panel (full width)│ │
│ └──────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### New Layout
```
┌──────────────────────────────────────────────────┐
│ Title + Date + Status Badge + Duration            │
├────────────────────────┬─────────────────────────┤
│                        │                          │
│  LEFT PANEL (60%)      │  RIGHT PANEL (40%)       │
│                        │                          │
│  Tabs:                 │  ┌──────────────────┐   │
│  [Summary] [Chapters]  │  │   Video/Audio     │   │
│  [Transcript] [Notes]  │  │   Player          │   │
│  [Flashcards] [Quiz]   │  │                   │   │
│  [Study Guide]         │  └──────────────────┘   │
│                        │                          │
│  ┌──────────────────┐  │  Analytics / Info:       │
│  │ Active tab       │  │  - Duration              │
│  │ content          │  │  - Word count            │
│  │                  │  │  - Speakers              │
│  │                  │  │  - Key concepts count    │
│  └──────────────────┘  │  - Flashcard count       │
│                        │                          │
├────────────────────────┴─────────────────────────┤
│  BOTTOM: Timeline Panel                           │
│  ┌───────────────────────────────────────────┐   │
│  │ ▓▓▓▓▓▓▓░░▓▓▓▓▓▓▓▓▓▓▓░░░▓▓▓▓▓  Speakers │   │
│  │ ████░░░░░████████░░░░░░░░████   Topics   │   │
│  │ ▲        ▲       ▲          ▲   Moments  │   │
│  └───────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

### Responsive Behavior
- **Desktop (≥1024px)**: Side-by-side layout as shown
- **Tablet (768-1023px)**: Video player moves above content panel (stacked)
- **Mobile (<768px)**: Single column, video on top, tabs below

### Tab System (7 tabs)
| Tab | Icon | Content |
|-----|------|---------|
| Summary | `FileText` | Lecture purpose, key takeaways, important concepts |
| Chapters | `List` | Topic segments with timestamps, click to seek |
| Transcript | `MessageSquare` | Speaker-labeled transcript with timestamp markers |
| Notes | `BookOpen` | Structured notes (existing NoteBlock format) |
| Flashcards | `Brain` | Flashcard review deck (existing) |
| Quiz | `HelpCircle` | Quiz runner (existing) |
| Study Guide | `GraduationCap` | Overview, review questions, terms to know |

---

## 3. Video/Audio Player

### Requirements
- Support both video (mp4, webm) and audio (mp3, m4a, wav, ogg, flac)
- Seek bar with chapter markers
- Playback speed control (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x)
- Volume control
- Current timestamp display
- Keyboard shortcuts: Space (play/pause), Left/Right (±5s), Shift+Left/Right (±30s)

### Integration Points
- Expose `seekTo(seconds: number)` function via context/ref
- All timestamped content (transcript lines, chapters, flashcards, key concepts) call `seekTo` on click
- Player state (currentTime, duration, playing) available to all child components

### Implementation
New file: `frontend/src/components/lecture/LecturePlayer.tsx`

```typescript
interface LecturePlayerProps {
  src: string;
  type: 'video' | 'audio';
  chapters?: Chapter[];
  onTimeUpdate?: (currentTime: number) => void;
}
```

Use existing `AudioPlayer.tsx` as base, extend with video support and chapter markers.

---

## 4. AI Pipeline Extensions

### Current Pipeline
```
raw transcript → clean transcript → notes → flashcards → quiz
```

### Extended Pipeline
```
raw transcript
  → clean transcript
  → speaker identification (if Deepgram provides diarization)
  → chapter/topic segmentation    ← NEW
  → summary generation            ← NEW
  → notes generation              (existing)
  → flashcard generation          (existing, add timestamps)
  → quiz generation               (existing)
  → study guide generation        ← NEW
  → important moments extraction  ← NEW
```

### New AI Stages

#### 4a. Chapter Segmentation

New prompt in `prompts.ts`:

```
System: You are an academic lecture analyzer. Given a lecture transcript,
identify distinct topics/sections. Return JSON array of chapters.

Each chapter: { title, startTime (seconds), endTime (seconds), summary (1-2 sentences) }

Rules:
- 3-8 chapters per lecture hour
- Titles should be specific and descriptive
- Every second of the lecture must belong to a chapter
- Chapters must be chronological and non-overlapping
```

Output type:
```typescript
interface Chapter {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  summary: string;
}
```

#### 4b. Summary Generation

New prompt:
```
System: Generate a structured lecture summary. Return JSON with:
- lecturePurpose: 1 sentence describing what this lecture covers
- keyTakeaways: 3-5 bullet points of most important ideas
- importantConcepts: array of { term, definition, timestamp }
```

Output type:
```typescript
interface LectureSummary {
  lecturePurpose: string;
  keyTakeaways: string[];
  importantConcepts: {
    term: string;
    definition: string;
    timestamp: number;
  }[];
}
```

#### 4c. Study Guide Generation

New prompt:
```
System: Create a study guide for exam preparation. Return JSON with:
- overview: 2-3 sentence lecture overview
- reviewQuestions: 5-8 open-ended questions students should be able to answer
- termsToKnow: list of key vocabulary with brief definitions
- examTips: 2-3 tips for studying this material
```

Output type:
```typescript
interface StudyGuide {
  overview: string;
  reviewQuestions: string[];
  termsToKnow: { term: string; definition: string }[];
  examTips: string[];
}
```

#### 4d. Important Moments Extraction

New prompt:
```
System: Identify important moments in this lecture. Return JSON array of:
{ type: "definition"|"exam_hint"|"example"|"question"|"key_point", label, timestamp }
```

Output type:
```typescript
interface ImportantMoment {
  type: 'definition' | 'exam_hint' | 'example' | 'question' | 'key_point';
  label: string;
  timestamp: number;
}
```

### Timestamp Strategy

The current Deepgram STT returns `TranscriptSegment` with `start` and `end` times. To make AI-generated timestamps work:

1. Include segment timestamps in the transcript text sent to AI:
   ```
   [00:00] Today we're going to talk about cellular respiration.
   [00:08] The first thing to understand is...
   ```
2. AI can reference these markers in its output
3. Parse `[MM:SS]` markers back to seconds in the response

Add a helper:
```typescript
function formatTranscriptWithTimestamps(segments: TranscriptSegment[]): string {
  return segments.map(s =>
    `[${formatTime(s.start)}] ${s.text}`
  ).join('\n');
}
```

---

## 5. Data Model Changes

### New Collection: `lecture_analysis`

Stores all AI-generated analysis for a lecture in one record (avoids multiple collections).

```
lecture_analysis {
  id:               text (PK)
  lecture:           relation(lectures) — cascadeDelete: true
  user:              relation(users)
  summary:           json    // LectureSummary
  chapters:          json    // Chapter[]
  study_guide:       json    // StudyGuide
  important_moments: json    // ImportantMoment[]
  timeline:          json    // TimelineData (speakers, topics)
  created:           datetime
  updated:           datetime
}
```

Access rules: `@request.auth.id = user.id`

### Lecture Status Updates

Expand the `status` select values:

```
Current:  uploading, processing, transcribing, generating, ready, error
Extended: uploading, extracting_audio, transcribing, detecting_speakers,
          segmenting_topics, generating_summary, generating_notes,
          generating_flashcards, generating_quiz, generating_study_guide,
          finalizing, ready, error
```

Add fields to lectures:
```
progress:         number    // 0-100
current_step:     text      // Human-readable "Creating flashcards..."
estimated_eta:    number    // Seconds remaining (rough estimate)
```

### Migration File

New file: `backend/pb_migrations/1777600001_lecture_analysis.js`

---

## 6. Timeline Panel

### Data Structure

```typescript
interface TimelineData {
  speakers: {
    name: string;
    color: string;
    segments: { startTime: number; endTime: number }[];
  }[];
  topics: {
    label: string;
    startTime: number;
    endTime: number;
    color: string;
  }[];
  importantMoments: ImportantMoment[];
}
```

### Visual Design

```
Speaker Row:   ▓▓▓Prof▓▓▓░░▓▓Student▓▓░░▓▓▓Prof▓▓▓▓▓
Topic Row:     ████ Intro ████ Glycolysis ████ Krebs ████
Moment Row:    ▲ def      ▲ exam    ▲ question    ▲ key
               |          |         |              |
Playhead:      ──────────|───────────────────────────
```

- Each row = horizontal bar proportional to lecture duration
- Speaker segments colored by speaker
- Topic segments colored and labeled
- Important moments shown as markers (▲) with tooltips
- Playhead syncs with video/audio position
- Click anywhere on timeline → seek to that position

### Component

New file: `frontend/src/components/lecture/TimelinePanel.tsx`

```typescript
interface TimelinePanelProps {
  duration: number;
  currentTime: number;
  speakers?: TimelineData['speakers'];
  topics?: Chapter[];
  moments?: ImportantMoment[];
  onSeek: (time: number) => void;
}
```

---

## 7. Skeleton Loading States

### Processing View

When lecture status is not `ready`, show the lecture viewer layout with skeletons:

```
┌─────────────────────┬────────────────────┐
│                     │  ┌──────────────┐  │
│  [Summary] disabled │  │  Processing  │  │
│                     │  │  animation   │  │
│  ┌───────────────┐  │  │  or video    │  │
│  │ ░░░░░░░░░░░░░ │  │  │  preview     │  │
│  │ ░░░░░░░░░░░░░ │  │  └──────────────┘  │
│  │ ░░░░░░░░░░░░░ │  │                    │
│  │ ░░░░░░░░░░░░░ │  │  Creating notes... │
│  └───────────────┘  │  ████████░░░░ 65%  │
│                     │  ~2 min remaining   │
└─────────────────────┴────────────────────┘
```

### Stage-to-UI Mapping

| Backend Stage | User Message | Progress % |
|--------------|-------------|-----------|
| `uploading` | Uploading your lecture... | 5-10 |
| `extracting_audio` | Processing audio... | 10-15 |
| `transcribing` | Creating transcript... | 15-35 |
| `detecting_speakers` | Identifying speakers... | 35-40 |
| `segmenting_topics` | Finding key topics... | 40-50 |
| `generating_summary` | Generating summary... | 50-60 |
| `generating_notes` | Creating notes... | 60-70 |
| `generating_flashcards` | Building flashcards... | 70-80 |
| `generating_quiz` | Writing quiz questions... | 80-85 |
| `generating_study_guide` | Creating study guide... | 85-95 |
| `finalizing` | Finalizing your workspace... | 95-100 |
| `ready` | (show full content) | 100 |

### Polling

Frontend polls lecture status every 3 seconds while `status !== 'ready' && status !== 'error'`:

```typescript
useEffect(() => {
  if (lecture?.status === 'ready' || lecture?.status === 'error') return;
  const interval = setInterval(async () => {
    const updated = await pb.collection('lectures').getOne(lectureId);
    setLecture(updated);
    if (updated.status === 'ready' || updated.status === 'error') {
      clearInterval(interval);
      // Refetch all sub-resources
    }
  }, 3000);
  return () => clearInterval(interval);
}, [lecture?.status]);
```

---

## 8. "Capture Meeting" Mode

### Three Input Modes on `/capture`

```
┌─────────────────────────────────────────────────┐
│  How would you like to add a lecture?             │
│                                                   │
│  ┌─────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ 🎙️      │  │ 🖥️           │  │ 📁         │  │
│  │ Record  │  │ Capture      │  │ Upload     │  │
│  │ In      │  │ Meeting      │  │ a File     │  │
│  │ Person  │  │              │  │            │  │
│  └─────────┘  └──────────────┘  └────────────┘  │
│                                                   │
│  Microphone     Screen + audio    Audio/video     │
│  recording      capture           file upload     │
└─────────────────────────────────────────────────┘
```

- **Record In Person**: Existing mic recording flow
- **Capture Meeting**: `navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })` — captures screen + system audio from Zoom/Teams/Meet
- **Upload a File**: Existing file upload flow

### Capture Meeting Implementation

New hook: `frontend/src/hooks/useScreenCapture.ts`

```typescript
interface UseScreenCaptureReturn {
  isCapturing: boolean;
  startCapture: () => Promise<void>;
  stopCapture: () => void;
  mediaStream: MediaStream | null;
  recordedBlob: Blob | null;
}
```

Uses `getDisplayMedia` for screen + audio. Records via `MediaRecorder` (same as `useAudioRecorder` but with video track). On stop, produces a webm blob that gets uploaded like any other file.

---

## 9. Transcript Viewer Upgrade

### Current
- Shows raw text and clean text toggle
- No timestamps, no speakers, no interactivity

### New
- Speaker-labeled segments with colored speaker tags
- Timestamp markers on each segment (clickable → seek)
- Active segment highlight (syncs with video playback position)
- Search within transcript
- Click segment → seek video to that time

### Component Update

```typescript
interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  rawText: string;
  cleanText: string;
  currentTime?: number;
  onSeek?: (time: number) => void;
}
```

Each segment renders as:
```
[12:34]  Professor: Today we're going to talk about...
[12:42]  Professor: The first important concept is...
[13:01]  Student:   Can you explain that again?
```

Active segment (matching currentTime) gets green left border + subtle bg highlight.

---

## 10. Implementation Order

### Phase 1: Theme + Layout (4-6 hours)
1. Swap color system (indigo → green, CSS variables)
2. Build split-panel lecture viewer layout
3. Add video/audio player component
4. Wire up seek context between player and content

### Phase 2: AI Pipeline Extensions (4-6 hours)
5. Add timestamp formatting to transcript before AI calls
6. Add chapter segmentation prompt + AI call
7. Add summary generation prompt + AI call
8. Add study guide generation prompt + AI call
9. Add important moments extraction
10. Create `lecture_analysis` collection + migration
11. Update `runPipeline()` with new stages + granular status

### Phase 3: New UI Components (4-6 hours)
12. Summary tab component
13. Chapters tab component (with seek)
14. Study Guide tab component
15. Timeline panel component
16. Skeleton loading states
17. Processing progress display with polling

### Phase 4: Polish (2-3 hours)
18. Transcript viewer upgrade (speakers, timestamps, active highlight)
19. Capture Meeting mode (`getDisplayMedia`)
20. Keyboard shortcuts for player
21. Mobile responsive adjustments
22. Extension theme update (green)

---

## 11. File Map (New + Modified)

### New Files
```
frontend/src/components/lecture/LecturePlayer.tsx
frontend/src/components/lecture/TimelinePanel.tsx
frontend/src/components/lecture/SummaryTab.tsx
frontend/src/components/lecture/ChaptersTab.tsx
frontend/src/components/lecture/StudyGuideTab.tsx
frontend/src/components/lecture/ProcessingView.tsx
frontend/src/hooks/useScreenCapture.ts
frontend/src/hooks/useLecturePlayer.ts
backend/pb_migrations/1777600001_lecture_analysis.js
```

### Modified Files
```
frontend/src/app.css                              — green theme
frontend/src/routes/lectures.$lectureId.tsx       — split layout, new tabs
frontend/src/routes/capture.tsx                   — 3 input modes
frontend/src/components/workspace/TranscriptViewer.tsx — speakers, timestamps, seek
frontend/src/lib/ai-pipeline.ts                   — new stages, granular status
frontend/src/lib/prompts.ts                       — chapter, summary, study guide, moments prompts
frontend/src/lib/types.ts                         — Chapter, LectureSummary, StudyGuide, ImportantMoment, TimelineData
extension/content.css                             — green theme
extension/popup.css                               — green theme
```

---

## 12. Hackathon MVP Scope

If time-constrained, ship this subset:

| Must Have | Nice to Have | Cut |
|-----------|-------------|-----|
| Green theme | Capture Meeting mode | Speaker diarization timeline |
| Split layout + video player | Study guide tab | Important moments extraction |
| Summary tab (AI) | Skeleton loading with progress | Keyboard shortcuts |
| Chapters tab (AI) | Transcript active highlight | Search in transcript |
| Timestamp-linked seeking | Timeline panel | ETA estimation |
| Flashcards + quiz (existing) | Extension theme update | |

Minimum viable: theme swap + split layout + video player + summary + chapters = **demo-ready in ~8 hours**.
