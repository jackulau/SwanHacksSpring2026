import { pb } from './pocketbase';
import {
  TRANSCRIPT_CLEANUP_SYSTEM,
  NOTE_GENERATION_SYSTEM,
  FLASHCARD_GENERATION_SYSTEM,
  QUIZ_GENERATION_SYSTEM,
} from './prompts';
import type { NoteBlock, QuizQuestion } from './types';

// ── LLM provider config ────────────────────────────────────────────────────
// Supports any OpenAI-compatible endpoint: Ollama (local, no key), OpenRouter,
// Google Gemini, OpenAI, or a custom URL.

const LLM_CONFIG_KEY = 'converge_llm_config';

export type LLMProvider = 'ollama' | 'openrouter' | 'google' | 'openai' | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  /**
   * Optional free-form text appended to every system prompt — gives users a
   * single place to nudge tone, language, or per-domain rules (e.g. "always
   * include code examples for CS lectures"). Empty / missing is the default.
   */
  customInstructions?: string;
}

export const PROVIDER_PRESETS: Record<LLMProvider, { label: string; baseUrl: string; needsKey: boolean; defaultModel: string }> = {
  ollama:      { label: 'Ollama (local)',  baseUrl: 'http://localhost:11434/v1', needsKey: false, defaultModel: 'llama3.2' },
  openrouter:  { label: 'OpenRouter',      baseUrl: 'https://openrouter.ai/api/v1', needsKey: true, defaultModel: 'meta-llama/llama-3.1-8b-instruct:free' },
  google:      { label: 'Google Gemini',   baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', needsKey: true, defaultModel: 'gemini-2.0-flash' },
  openai:      { label: 'OpenAI',          baseUrl: 'https://api.openai.com/v1', needsKey: true, defaultModel: 'gpt-4o-mini' },
  custom:      { label: 'Custom endpoint', baseUrl: '', needsKey: false, defaultModel: '' },
};

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'ollama',
  baseUrl: PROVIDER_PRESETS.ollama.baseUrl,
  apiKey: '',
  model: PROVIDER_PRESETS.ollama.defaultModel,
  customInstructions: '',
};

export function getLLMConfig(): LLMConfig {
  try {
    const raw = localStorage.getItem(LLM_CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function setLLMConfig(config: LLMConfig) {
  localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(config));
}

export async function testLLMConnection(): Promise<{ ok: boolean; model: string; error?: string }> {
  const cfg = getLLMConfig();
  const preset = PROVIDER_PRESETS[cfg.provider];

  if (preset.needsKey && !cfg.apiKey) {
    return { ok: false, model: cfg.model, error: `${preset.label} requires an API key.` };
  }
  if (!cfg.baseUrl) {
    return { ok: false, model: cfg.model, error: 'No endpoint URL configured.' };
  }

  const base = cfg.baseUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
        max_tokens: 4,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, model: cfg.model, error: `${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true, model: cfg.model };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (cfg.provider === 'ollama') {
      return { ok: false, model: cfg.model, error: `Cannot reach Ollama at ${base}. Is it running? (ollama serve)` };
    }
    return { ok: false, model: cfg.model, error: msg };
  }
}

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const cfg = getLLMConfig();
  const preset = PROVIDER_PRESETS[cfg.provider];

  if (preset.needsKey && !cfg.apiKey) {
    throw new Error(
      `${preset.label} requires an API key. Go to Settings → AI Model to add one.`,
    );
  }

  if (!cfg.baseUrl) {
    throw new Error('No LLM endpoint configured. Go to Settings → AI Model.');
  }

  const base = cfg.baseUrl.replace(/\/+$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

  // Append the user's custom instructions, if any, as a second system block.
  // We keep it as a separate message rather than concatenating so the model
  // can disambiguate "core task rules" from "user preferences."
  const trimmedCustom = (cfg.customInstructions ?? '').trim();
  const systemMessages =
    trimmedCustom.length > 0
      ? [
          { role: 'system' as const, content: systemPrompt },
          { role: 'system' as const, content: `Additional user preferences:\n${trimmedCustom}` },
        ]
      : [{ role: 'system' as const, content: systemPrompt }];

  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          ...systemMessages,
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });
  } catch (e) {
    if (cfg.provider === 'ollama') {
      throw new Error(
        'Cannot reach Ollama at ' + base + '. Is it running? (ollama serve)',
      );
    }
    throw new Error(`Cannot reach ${preset.label}: ${e instanceof Error ? e.message : e}`);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM error (${res.status}): ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

function parseJSON<T>(raw: string): T {
  let cleaned = raw.trim();

  // Strip a code fence anywhere in the response. Handles ```json … ```,
  // ```js … ```, plain ``` … ```, and intro/outro chatter around the fence
  // (Llama and friends like to say "Here's the JSON:" before and "Hope this
  // helps!" after).
  const fenceMatch = cleaned.match(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    // Last resort: extract the substring between the first opening bracket
    // and the last matching closing bracket. Catches outputs like
    // "Here's an array: [ ... ] — hope this helps." that escape the fence
    // strip above.
    const firstArr = cleaned.indexOf('[');
    const firstObj = cleaned.indexOf('{');
    const start =
      firstArr === -1
        ? firstObj
        : firstObj === -1
          ? firstArr
          : Math.min(firstArr, firstObj);
    if (start === -1) throw err;
    const open = cleaned[start];
    const close = open === '[' ? ']' : '}';
    const end = cleaned.lastIndexOf(close);
    if (end <= start) throw err;
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (i < retries) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastError;
}

async function updateLectureStatus(lectureId: string, status: string, errorMessage?: string) {
  await pb.collection('lectures').update(lectureId, {
    status,
    ...(errorMessage ? { error_message: errorMessage } : {}),
  });
}

export async function cleanTranscript(rawText: string): Promise<string> {
  return withRetry(() =>
    callLLM(TRANSCRIPT_CLEANUP_SYSTEM, `Clean this transcript:\n\n${rawText}`),
  );
}

export async function generateNotes(transcript: string): Promise<NoteBlock[]> {
  const raw = await withRetry(() =>
    callLLM(
      NOTE_GENERATION_SYSTEM,
      `Generate structured notes from this lecture transcript:\n\n${transcript}`,
    ),
  );
  return parseJSON<NoteBlock[]>(raw);
}

interface RawFlashcard {
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
}

export async function generateFlashcards(transcript: string): Promise<RawFlashcard[]> {
  const raw = await withRetry(() =>
    callLLM(
      FLASHCARD_GENERATION_SYSTEM,
      `Generate flashcards from this lecture transcript:\n\n${transcript}`,
    ),
  );
  return parseJSON<RawFlashcard[]>(raw);
}

export async function generateQuiz(transcript: string): Promise<QuizQuestion[]> {
  const raw = await withRetry(() =>
    callLLM(
      QUIZ_GENERATION_SYSTEM,
      `Generate a quiz from this lecture transcript:\n\n${transcript}`,
    ),
  );
  return parseJSON<QuizQuestion[]>(raw);
}

export interface PipelineResult {
  cleanText?: string;
  notes?: NoteBlock[];
  flashcards?: RawFlashcard[];
  quiz?: QuizQuestion[];
  errors: string[];
}

export async function runPipeline(lectureId: string, rawTranscript: string): Promise<PipelineResult> {
  const result: PipelineResult = { errors: [] };

  await updateLectureStatus(lectureId, 'processing');

  try {
    result.cleanText = await cleanTranscript(rawTranscript);
    await pb.collection('transcripts').create({
      lecture: lectureId,
      raw_text: rawTranscript,
      clean_text: result.cleanText,
      segments: [],
      speakers: [],
      language: 'en',
      word_count: result.cleanText.split(/\s+/).length,
    });
  } catch (e) {
    result.errors.push(`Transcript cleanup failed: ${e}`);
  }

  const textForGeneration = result.cleanText || rawTranscript;
  await updateLectureStatus(lectureId, 'generating');

  const userId = pb.authStore.record?.id;

  try {
    result.notes = await generateNotes(textForGeneration);
    const keyConcepts = result.notes
      .filter((b): b is Extract<NoteBlock, { type: 'key_term' }> => b.type === 'key_term')
      .map((b) => ({ term: b.term, definition: b.definition, importance: 'medium' as const }));
    await pb.collection('notes').create({
      lecture: lectureId,
      user: userId,
      title: 'Auto-generated Notes',
      content: result.notes,
      content_type: 'auto_generated',
      key_concepts: keyConcepts,
      summary: '',
    });
  } catch (e) {
    result.errors.push(`Note generation failed: ${e}`);
  }

  try {
    result.flashcards = await generateFlashcards(textForGeneration);
    for (const card of result.flashcards) {
      await pb.collection('flashcards').create({
        lecture: lectureId,
        user: userId,
        deck_name: 'Lecture Flashcards',
        front: card.front,
        back: card.back,
        tags: card.tags,
        difficulty: card.difficulty,
        source: 'auto_generated',
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
      });
    }
  } catch (e) {
    result.errors.push(`Flashcard generation failed: ${e}`);
  }

  try {
    result.quiz = await generateQuiz(textForGeneration);
    const totalPoints = result.quiz.reduce((sum, q) => sum + q.points, 0);
    await pb.collection('quizzes').create({
      lecture: lectureId,
      user: userId,
      title: 'Auto-generated Quiz',
      questions: result.quiz,
      total_points: totalPoints,
      source: 'auto_generated',
    });
  } catch (e) {
    result.errors.push(`Quiz generation failed: ${e}`);
  }

  await updateLectureStatus(
    lectureId,
    result.errors.length === 0 ? 'ready' : 'error',
    result.errors.length > 0 ? result.errors.join('; ') : undefined,
  );

  return result;
}
