// Barrel for the Generate flows.
//
// Each flow takes an input record id (note page / lecture / course),
// composes a prompt against the LLM provider abstraction, and writes the
// result back into PocketBase. UI surfaces import from this module so the
// route files stay focused on layout.

export { flashcardsFromNote, deriveDeckName } from "./flashcardsFromNote";
export type {
  FlashcardsFromNoteOptions,
  FlashcardsFromNoteResult,
} from "./flashcardsFromNote";
export { flashcardsFromText } from "./flashcardsFromText";
export type {
  FlashcardsFromTextOptions,
  FlashcardsFromTextResult,
} from "./flashcardsFromText";
export { flashcardsFromQuiz } from "./flashcardsFromQuiz";
export type {
  FlashcardsFromQuizOptions,
  FlashcardsFromQuizResult,
} from "./flashcardsFromQuiz";
export { quizFromLecture } from "./quizFromLecture";
export type { QuizFromLectureOptions } from "./quizFromLecture";
export { quizFromNote } from "./quizFromNote";
export type { QuizFromNoteOptions } from "./quizFromNote";
export { studyPlanFromCourse } from "./studyPlanFromCourse";
export type { StudyPlanFromCourseOptions } from "./studyPlanFromCourse";
