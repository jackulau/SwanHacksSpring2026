import { RecordModel } from "pocketbase";

// ──────────────────────────────────────────────
// Backward-compat
// ──────────────────────────────────────────────

export interface Item extends RecordModel {
  name: string;
  description: string;
}

// ──────────────────────────────────────────────
// Shared / reusable primitives
// ──────────────────────────────────────────────

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  font: string;
  fontSize: number;
  readingLevel: "elementary" | "middle" | "high" | "college" | "professional";
  language: string;
  ttsEnabled: boolean;
  dyslexiaMode: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  breakReminders: boolean;
  pomodoroLength: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  confidence: number;
}

export interface Speaker {
  id: string;
  label: string;
}

export interface KeyConcept {
  term: string;
  definition: string;
  importance: "low" | "medium" | "high";
}

export interface CaptionSegment {
  text: string;
  source: "audio" | "sign";
  timestamp: number;
  confidence: number;
  isFinal?: boolean;
  speaker?: string;
}

export interface RecognizedSign {
  label: string;
  confidence: number;
  timestamp: number;
}

export interface SM2Result {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string;
}

// ──────────────────────────────────────────────
// Note content blocks
// ──────────────────────────────────────────────

interface NoteBlockBase {
  id: string;
}

export interface HeadingBlock extends NoteBlockBase {
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
}

export interface ParagraphBlock extends NoteBlockBase {
  type: "paragraph";
  text: string;
}

export interface BulletListBlock extends NoteBlockBase {
  type: "bullet_list";
  items: string[];
}

export interface KeyTermBlock extends NoteBlockBase {
  type: "key_term";
  term: string;
  definition: string;
}

export interface ExampleBlock extends NoteBlockBase {
  type: "example";
  text: string;
}

export interface CalloutBlock extends NoteBlockBase {
  type: "callout";
  variant: "important" | "confusion" | "tip";
  text: string;
}

export interface CodeBlock extends NoteBlockBase {
  type: "code";
  language: string;
  code: string;
}

export interface QuoteBlock extends NoteBlockBase {
  type: "quote";
  text: string;
  attribution?: string;
}

export interface DividerBlock extends NoteBlockBase {
  type: "divider";
}

export interface ImageBlock extends NoteBlockBase {
  type: "image";
  url: string;
  alt?: string;
  caption?: string;
}

export interface TodoBlock extends NoteBlockBase {
  type: "todo";
  text: string;
  checked: boolean;
}

export interface ToggleBlock extends NoteBlockBase {
  type: "toggle";
  text: string;
  open: boolean;
  children: NoteBlock[];
}

export interface NumberedItemBlock extends NoteBlockBase {
  type: "numbered_item";
  text: string;
}

export interface BulletItemBlock extends NoteBlockBase {
  type: "bullet_item";
  text: string;
}

export interface TableBlock extends NoteBlockBase {
  type: "table";
  rows: string[][];
  hasHeader: boolean;
}

export interface MathBlock extends NoteBlockBase {
  type: "math";
  expression: string;
}

export interface EmbedBlock extends NoteBlockBase {
  type: "embed";
  url: string;
  title?: string;
}

export interface PageRefBlock extends NoteBlockBase {
  type: "page_ref";
  pageId: string;
  title: string;
}

export type NoteBlock =
  | HeadingBlock
  | ParagraphBlock
  | BulletListBlock
  | BulletItemBlock
  | NumberedItemBlock
  | TodoBlock
  | ToggleBlock
  | TableBlock
  | MathBlock
  | EmbedBlock
  | PageRefBlock
  | KeyTermBlock
  | ExampleBlock
  | CalloutBlock
  | CodeBlock
  | QuoteBlock
  | DividerBlock
  | ImageBlock;

// ──────────────────────────────────────────────
// Quiz question types
// ──────────────────────────────────────────────

interface QuizQuestionBase {
  id: string;
  question: string;
  points: number;
  difficulty: "easy" | "medium" | "hard";
  concept_tag: string;
  explanation?: string;
}

export interface MultipleChoiceQuestion extends QuizQuestionBase {
  type: "multiple_choice";
  options: string[];
  correct_answer: number;
}

export interface TrueFalseQuestion extends QuizQuestionBase {
  type: "true_false";
  correct_answer: boolean;
}

export interface ShortAnswerQuestion extends QuizQuestionBase {
  type: "short_answer";
  correct_answer: string;
  accept_also?: string[];
}

export interface FillBlankQuestion extends QuizQuestionBase {
  type: "fill_blank";
  correct_answer: string;
  accept_also?: string[];
}

export type QuizQuestion =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | ShortAnswerQuestion
  | FillBlankQuestion;

export interface QuizAnswer {
  question_id: string;
  answer: string | number | boolean;
  correct: boolean;
  points_earned: number;
}

// ──────────────────────────────────────────────
// Collection models
// ──────────────────────────────────────────────

export interface User extends RecordModel {
  email: string;
  display_name: string;
  avatar: string;
  preferences: UserPreferences;
  onboarding_done: boolean;
}

export interface Course extends RecordModel {
  user: string;
  name: string;
  code: string;
  color: string;
  semester: string;
}

export type LectureStatus =
  | "uploading"
  | "processing"
  | "transcribing"
  | "generating"
  | "ready"
  | "error";

export interface Lecture extends RecordModel {
  user: string;
  course: string;
  title: string;
  audio_file: string;
  duration_secs: number;
  status: LectureStatus;
  error_message: string;
  recorded_at: string;
  tags: string[];
}

export interface Transcript extends RecordModel {
  lecture: string;
  raw_text: string;
  clean_text: string;
  segments: TranscriptSegment[];
  speakers: Speaker[];
  language: string;
  word_count: number;
}

export type NoteContentType = "auto_generated" | "manual" | "hybrid";

export interface Note extends RecordModel {
  lecture: string;
  user: string;
  title: string;
  content: NoteBlock[];
  content_type: NoteContentType;
  key_concepts: KeyConcept[];
  summary: string;
}

export type FlashcardDifficulty = "easy" | "medium" | "hard";
export type FlashcardSource = "auto_generated" | "manual";

export interface Flashcard extends RecordModel {
  lecture: string;
  user: string;
  deck_name: string;
  front: string;
  back: string;
  front_image: string;
  back_image: string;
  tags: string[];
  difficulty: FlashcardDifficulty;
  source: FlashcardSource;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review: string;
  last_review: string;
}

export type QuizSource = "auto_generated" | "manual";

export interface Quiz extends RecordModel {
  lecture: string;
  user: string;
  title: string;
  questions: QuizQuestion[];
  total_points: number;
  source: QuizSource;
  tags: string[];
}

export interface QuizAttempt extends RecordModel {
  quiz: string;
  user: string;
  answers: QuizAnswer[];
  score: number;
  max_score: number;
  percentage: number;
  time_taken_secs: number;
  completed_at: string;
}

export type SessionType =
  | "flashcard_review"
  | "quiz"
  | "pomodoro"
  | "free_study";

export interface StudySession extends RecordModel {
  user: string;
  session_type: SessionType;
  lecture: string;
  cards_reviewed: number;
  cards_correct: number;
  duration_secs: number;
  started_at: string;
  ended_at: string;
}

// ──────────────────────────────────────────────
// Canvas LMS integration
// ──────────────────────────────────────────────

export interface CanvasConfig {
  base_url: string;
  api_token: string;
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  start_at: string | null;
  end_at: string | null;
  workflow_state: string;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  unlock_at: string | null;
  lock_at: string | null;
  points_possible: number;
  course_id: number;
  html_url: string;
  submission_types: string[];
  has_submitted_submissions: boolean;
}

export interface Assignment extends RecordModel {
  user: string;
  course: string;
  canvas_id: number;
  title: string;
  description: string;
  due_at: string;
  points_possible: number;
  status: "upcoming" | "submitted" | "graded" | "missing";
  canvas_url: string;
  submission_types: string[];
}

// ──────────────────────────────────────────────
// Note pages (rich, Notion-style standalone documents)
// ──────────────────────────────────────────────

export interface PageProperties {
  tags?: string[];
  status?: "draft" | "in_progress" | "done";
  due_at?: string;
}

export interface NotePage extends RecordModel {
  user: string;
  title: string;
  icon: string;
  parent: string;
  course: string;
  lecture: string;
  blocks: NoteBlock[];
  properties: PageProperties;
  archived: boolean;
}

export interface NoteLink extends RecordModel {
  user: string;
  source_page: string;
  target_page: string;
}

export interface NoteCommentRecord extends RecordModel {
  user: string;
  page: string;
  parent: string;
  body: string;
  resolved: boolean;
}

export interface CalendarEventRecord extends RecordModel {
  user: string;
  title: string;
  start_at: string;
  end_at: string;
  notes: string;
  color: string;
  external_href: string;
}

// ──────────────────────────────────────────────
// Multiplayer quiz sessions
// ──────────────────────────────────────────────

export type QuizSessionState = "lobby" | "running" | "complete";

export interface QuizSessionSettings {
  question_seconds?: number;
  speed_bonus?: boolean;
  shuffle?: boolean;
}

export interface QuizSessionRecord extends RecordModel {
  host_user: string;
  quiz: string;
  code: string;
  state: QuizSessionState;
  current_question_index: number;
  started_at: string;
  ended_at: string;
  question_started_at: string;
  settings: QuizSessionSettings;
}

export interface QuizSessionParticipantRecord extends RecordModel {
  session: string;
  user: string;
  display_name: string;
  score: number;
  streak: number;
  last_answer_at: string;
}

export interface QuizSessionAnswerRecord extends RecordModel {
  session: string;
  participant: string;
  user: string;
  question_index: number;
  choice: number | string | boolean | null;
  correct: boolean;
  points_earned: number;
  ms_to_answer: number;
  answered_at: string;
}

// ──────────────────────────────────────────────
// ASL segments
// ──────────────────────────────────────────────

export interface AslSegmentFrame {
  data_url?: string;
  ts?: number;
}

export interface AslSegmentRecord extends RecordModel {
  user: string;
  session_id: string;
  transcription: string;
  confidence: number;
  provider: string;
  model: string;
  duration_ms: number;
  frames: AslSegmentFrame[];
  meta: Record<string, unknown>;
  resigned: boolean;
}

// ──────────────────────────────────────────────
// Knowledge DB (chunks + edges)
// ──────────────────────────────────────────────

export type KnowledgeSourceType =
  | "note"
  | "lecture_transcript"
  | "flashcard"
  | "quiz_question"
  | "course_module"
  | "calendar_event"
  | "asl_segment"
  | "file";

export interface KnowledgeChunkRecord extends RecordModel {
  user: string;
  source_type: KnowledgeSourceType;
  source_id: string;
  section: string;
  title: string;
  text: string;
  tokens: number;
  embedding: number[] | null;
  meta: Record<string, unknown>;
  created_from_at: string;
}

export type KnowledgeEdgeKind = "mentions" | "derived_from" | "same_source";

// ──────────────────────────────────────────────
// Course modules
// ──────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

export interface CourseModuleRecord extends RecordModel {
  user: string;
  course: string;
  title: string;
  description: string;
  sort_index: number;
  checklist: ChecklistItem[];
  done: boolean;
}

export interface KnowledgeEdgeRecord extends RecordModel {
  user: string;
  from_chunk: string;
  to_chunk: string;
  kind: KnowledgeEdgeKind;
  weight: number;
}
