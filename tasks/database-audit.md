# PocketBase Schema Audit

Audit date: 2026-05-02
Files examined:
- `backend/pb_migrations/1777412368_created_items.js`
- `backend/pb_migrations/1777412633_deleted_items.js`
- `backend/pb_migrations/1777500000_hackstack_collections.js`
- `backend/pb_migrations/1777500001_assignments_collection.js`
- `frontend/src/lib/types.ts`
- `frontend/src/routes/**` (all route files + hooks/useSM2.ts)

---

## Per-Collection Findings

### courses
- **Rules** (`1777500000:9-13`): list/view/update/delete gate correctly on `@request.auth.id = user.id`. createRule is `@request.auth.id != ''` — correct; any authenticated user can create their own course.
- **`user` relation** (`line 21`): `cascadeDelete: false`. If a user account is deleted, their courses become orphans with no owner. Should be `cascadeDelete: true` or set a deletion hook.
- **No indexes**. The app runs `filter: user = "${userId}"` on every course list/count (`courses.tsx:62`, `index.tsx:349`). There is no index on `user` in this collection.

### lectures
- **Rules** (`lines 32-36`): same correct pattern as courses.
- **`course` relation** (`line 47`): `cascadeDelete: false`. Deleting a course leaves its lectures dangling. Given that notes/transcripts/flashcards/quizzes all cascade-delete from lectures, a dangling lecture effectively orphans the entire content tree. Should be `cascadeDelete: true`.
- **`user` relation** (`line 46`): `cascadeDelete: false` — same orphan risk as courses.
- **`audio_file`** (`line 41`): `maxSize: 0` (unlimited), `mimeTypes: []` (any type accepted). No audio-specific MIME restriction (`audio/mpeg`, `audio/wav`, `audio/webm`, etc.) and no size cap. A malicious or careless user could upload multi-GB non-audio files.
- **No indexes**. The app filters on both `user` and `course` (`courses.$courseId.tsx:23`, `index.tsx:354`, `lectures.$lectureId.tsx:51`). No index covers either column.
- **`status` field** (`line 43`): optional select with no default. A lecture created without a status will have a null status, which the UI must guard.

### transcripts
- **Rules** (`lines 58-62`): ALL rules are empty strings — meaning **world-readable and world-writable with no authentication**. Any unauthenticated HTTP client can read, create, update, or delete transcripts. This is the most severe security issue in the schema.
- **`lecture` relation** (`line 72`): `cascadeDelete: true` — correct; deleting a lecture removes its transcripts.
- **`lecture` relation required**: `required: false` (`line 72`). A transcript without a lecture reference cannot be looked up by the `lecture = "${lectureId}"` filter (`lectures.$lectureId.tsx:56`), but it can be created. Should be `required: true`.
- **No indexes** on `lecture`. Every transcript lookup is a full table scan.

### notes
- **Rules** (`lines 83-87`): same problem as transcripts — all rules are empty strings. Fully open to unauthenticated access.
- **`lecture` relation** (`line 96`): `cascadeDelete: true` — correct.
- **`user` relation** (`line 97`): `cascadeDelete: false` — orphan on user deletion.
- **`summary` field** (`line 95`): `required: false` in schema; `required: true` (non-optional `string`) in TS type `Note` at `types.ts:254`. See TS drift section.
- **No indexes** on `lecture` or `user`. Both are queried frequently (`lectures.$lectureId.tsx:63-65`).

### flashcards
- **Rules** (`lines 110-114`): same — all empty strings, unauthenticated access.
- **`lecture` relation** (`line 127`): `cascadeDelete: true` — correct.
- **`user` relation** (`line 128`): `cascadeDelete: false`.
- **No indexes** on `user`, `lecture`, or `next_review`. The SM2 hook (`useSM2.ts:29-30`) filters on `user && (next_review <= now || next_review = "")`. Without a composite index this scans the entire flashcards table on every review session load. The `study.tsx` page (`lines 39-40`) also does a count query with the same filter.
- **`front_image` / `back_image`** fields: present in TS (`types.ts:265-266`) but completely absent from the migration. Any write to these fields will silently fail in PocketBase.

### quizzes
- **Rules** (`lines 135-139`): all empty strings — unauthenticated access.
- **`lecture` / `user` relations** (`lines 151-152`): same cascade patterns as flashcards.
- **No indexes** on `user` or `lecture`.

### quiz_attempts
- **Rules** (`lines 163-167`): all empty strings — unauthenticated access.
- **`quiz` relation** (`line 177`): `cascadeDelete: true` — correct.
- **`user` relation** (`line 178`): `cascadeDelete: false`.
- **`score` / `max_score` / `percentage`** (`lines 172-174`): all `required: false`, no min/max bounds. A client can submit `percentage: 999` or a negative score. Add `min: 0` / `max: 100` on `percentage`.
- **No indexes** on `quiz` or `user`.

### study_sessions
- **Rules** (`lines 189-193`): all empty strings — unauthenticated access.
- **`lecture` relation** (`line 203`): `cascadeDelete: true`.
- **`user` relation** (`line 204`): `cascadeDelete: false`.
- **`session_type`** (`line 197`): `required: false`, no default. A session created without a type is orphaned from meaningful analytics.
- **No indexes** on `user` or `lecture`.

### assignments (`1777500001`)
- **Rules** (`lines 8-12`): correctly secured — same pattern as courses.
- **`user` relation** (`line 16`): `required: true` — good. `cascadeDelete: false` — user deletion leaves orphan assignments.
- **`course` relation** (`line 17`): `cascadeDelete: true` — correct; assignment removed when course is deleted.
- **`status` field** (`line 23`): typed as plain `text` in the migration. TS defines it as a string literal union `"upcoming" | "submitted" | "graded" | "missing"` (`types.ts:358`). The schema allows any arbitrary string, undermining runtime safety. Should be a `select` field with those four values.
- **`canvas_url` field** (`line 24`): typed as plain `text`. Should be `url` type for built-in validation.
- **No indexes** on `user` or `course`. The assignment list UI will filter by both.

---

## Missing Indexes

| Collection | Query (source file:line) | Suggested Index |
|---|---|---|
| courses | `filter: user = "${userId}"` (`courses.tsx:62`, `index.tsx:349`) | `CREATE INDEX idx_courses_user ON courses (user)` |
| lectures | `filter: user = "${userId}"` (`index.tsx:354`) | `CREATE INDEX idx_lectures_user ON lectures (user)` |
| lectures | `filter: course = "${courseId}"` + `sort: -recorded_at` (`courses.$courseId.tsx:23`) | `CREATE INDEX idx_lectures_course_recorded ON lectures (course, recorded_at DESC)` |
| transcripts | `filter: lecture = "${lectureId}"` (`lectures.$lectureId.tsx:56`) | `CREATE INDEX idx_transcripts_lecture ON transcripts (lecture)` |
| notes | `filter: lecture = "${lectureId}"` (`lectures.$lectureId.tsx:64`) | `CREATE INDEX idx_notes_lecture ON notes (lecture)` |
| notes | `filter: user` (implicit via rules) | `CREATE INDEX idx_notes_user ON notes (user)` |
| flashcards | `filter: user && (next_review <= now || next_review = "")` (`useSM2.ts:28-30`, `study.tsx:40`) | `CREATE INDEX idx_flashcards_user_next_review ON flashcards (user, next_review)` |
| flashcards | `filter: lecture = "${lectureId}"` (`lectures.$lectureId.tsx:72`) | `CREATE INDEX idx_flashcards_lecture ON flashcards (lecture)` |
| quizzes | `filter: lecture = "${lectureId}"` (`lectures.$lectureId.tsx:79`) | `CREATE INDEX idx_quizzes_lecture ON quizzes (lecture)` |
| quizzes | `filter: user = "${userId}"` (`study.tsx:44`) | `CREATE INDEX idx_quizzes_user ON quizzes (user)` |
| quiz_attempts | filter by `quiz` (expected UI flow) | `CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts (quiz)` |
| study_sessions | filter by `user` (expected analytics) | `CREATE INDEX idx_study_sessions_user ON study_sessions (user)` |
| assignments | filter by `user`, `course`, `due_at` | `CREATE INDEX idx_assignments_user_due ON assignments (user, due_at)` |

In PocketBase migrations, add indexes via the `"indexes"` array on the collection object, e.g.:

```js
"indexes": [
  "CREATE INDEX idx_courses_user ON courses (user)"
]
```

---

## Security Concerns

### CRITICAL — Five collections have no access rules

Collections `transcripts`, `notes`, `flashcards`, `quizzes`, `quiz_attempts`, and `study_sessions` all define every rule as an empty string (`""`). In PocketBase, an empty string rule means **no restriction** — the endpoint is public and unauthenticated. Any HTTP client knowing the collection name can:

- Read every user's notes, flashcards, and quiz answers
- Write, overwrite, or delete any record

**Source**: `1777500000_hackstack_collections.js` lines 58-62 (transcripts), 83-87 (notes), 110-114 (flashcards), 135-139 (quizzes), 163-167 (quiz_attempts), 189-193 (study_sessions).

**Required fix** for each:
```json
"listRule":   "@request.auth.id = user.id",
"viewRule":   "@request.auth.id = user.id",
"createRule": "@request.auth.id != ''",
"updateRule": "@request.auth.id = user.id",
"deleteRule": "@request.auth.id = user.id"
```

`transcripts` has no `user` field at all, so its rule should use the lecture owner:
```
"listRule": "@request.auth.id = lecture.user.id"
```

### HIGH — createRule on courses/lectures/assignments allows ID spoofing

`createRule: "@request.auth.id != ''"` (`1777500000:12`, `1777500001:10`) only confirms the user is authenticated; it does not verify that `@request.data.user = @request.auth.id`. A logged-in user can POST a record with another user's ID in the `user` field, assigning content to a victim account. Fix:

```
"createRule": "@request.auth.id != '' && @request.data.user = @request.auth.id"
```

### MEDIUM — No cascade on user deletion across all collections

Every `user` relation in every collection is `cascadeDelete: false`. Deleting a PocketBase auth record leaves every associated record (courses, lectures, notes, flashcards, quizzes, attempts, sessions, assignments) orphaned with a stale foreign key. These become invisible in the UI but persist in the database indefinitely.

---

## TS vs Schema Drift

| TS field (`types.ts`) | Schema field | Difference |
|---|---|---|
| `Note.summary: string` (required, line 254) | `notes.summary` required: false (line 95) | TS treats it as always present; PB allows null. Reads of notes without a summary will yield `undefined` where `string` is expected. |
| `Flashcard.front_image: string` (line 265) | Not present in migration | Field does not exist in PocketBase. All writes silently fail; reads always return undefined. |
| `Flashcard.back_image: string` (line 266) | Not present in migration | Same as above. |
| `Assignment.status: "upcoming"\|"submitted"\|"graded"\|"missing"` (line 358) | `assignments.status` is plain `text` type (line 23) | PB enforces no enum constraint. Any string value is accepted at the DB layer. |
| `User.display_name: string` (line 202) | Not auditable without users collection migration | No migration creates a `display_name` field on the auth collection. Likely configured via the PocketBase UI only — fragile for reproducible deploys. |
| `User.preferences: UserPreferences` (line 204) | Not auditable | Same — no migration for the users auth collection fields. |
| `User.onboarding_done: boolean` (line 205) | Not auditable | Same. |
| `Lecture.course: string` (required in TS via non-optional field, line 228) | `lectures.course` required: false (line 47) | Lectures can be created without a course reference; TS assumes it is always set. |
| `StudySession` has no `course` field (TS line 306-315) | `study_sessions` has no `course` field | Consistent — but the planner page hardcodes streak as `0` and never reads study_sessions, so the collection is currently inert. |

---

## Migration Health

**Ordering dependency** (`1777500001` depends on `1777500000`): The assignments migration references `pbc_courses` by ID (`collectionId: "pbc_courses"`, line 17). If `1777500001` runs before `1777500000`, PocketBase will throw a foreign key / collection-not-found error at save time. The numeric timestamp prefix (1777500001 > 1777500000) ensures correct ordering as long as PocketBase runs migrations in filename-ascending order, which it does. Safe as-is, but the dependency is implicit and undocumented.

**Legacy items migration pair**: `1777412368_created_items.js` creates a collection named `items` with open rules (`"listRule": ""`, etc.) and zero fields beyond the PK. `1777412633_deleted_items.js` deletes it. The net result is a no-op across both migrations, but the `items` collection momentarily exists with public access during an initial `migrate up`. Low risk, but both files can be removed once the project drops legacy support.

**Rollback of `1777500000`** (`lines 209-216`): The down function wraps each `app.delete()` in a try/catch, swallowing any error silently. If a collection has dependent collections (e.g., `lectures` still has `transcripts` pointing to it), the delete will fail silently and the rollback will leave the database in a partial state. Use dependency-ordered deletion (the array is already in reverse order: study_sessions → courses) but remove the catch-all so failures surface.

**`1777500001` rollback** (`line 30`): Looks up the collection by name `"assignments"` not by ID `"pbc_assignments"`. This is fragile if the collection is renamed. Use the ID: `app.findCollectionByNameOrId("pbc_assignments")`.

---

## Top 5 Fixes Before Demo

**1. Add access rules to the five open collections (CRITICAL)**
`transcripts`, `notes`, `flashcards`, `quizzes`, `quiz_attempts`, `study_sessions` — add `listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule` in a new migration. Without this, every user's academic data is readable by anyone with a browser and the API base URL.

**2. Add `user` index to `flashcards` + composite with `next_review` (CRITICAL for correctness)**
Every page load of `/study/flashcards` calls `getFullList` with `filter: user = X && (next_review <= now || next_review = "")`. Without an index, PocketBase scans the full flashcards table. This is the hottest query path in the entire app and will visibly degrade as card count grows.

**3. Add `front_image` and `back_image` file fields to the `flashcards` migration (HIGH)**
These fields exist in `types.ts:265-266` but not in the schema. Any code that attempts to upload or display card images is silently broken today.

**4. Lock the `createRule` to prevent user ID spoofing on courses, lectures, and assignments (HIGH)**
Change `@request.auth.id != ''` to `@request.auth.id != '' && @request.data.user = @request.auth.id`. Without this, any authenticated user can create content attributed to another account.

**5. Convert `assignments.status` from `text` to a `select` field with values `["upcoming","submitted","graded","missing"]` (MEDIUM)**
Currently any arbitrary string is accepted by the database, and the TS type provides false safety. Add the select constraint and add an index on `(user, due_at)` for the planner page that will filter upcoming due dates.
