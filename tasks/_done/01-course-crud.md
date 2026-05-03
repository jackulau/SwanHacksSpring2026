# Feature #1 — Course CRUD Edit / Update Flow — DONE

## Summary
Implemented the missing edit and confirmed-delete flow for courses on `frontend/src/routes/courses.tsx`. The course card now exposes a pencil icon that swaps the card body for an inline `EditCourseForm` (no modal) with name, code, semester, and a 7-swatch color picker. Saves persist via `pb.collection('courses').update(id, patch)` and apply optimistically with rollback on error. The trash icon now opens an inline `ConfirmDeleteRow` (no `confirm()`); accepting it removes the row from local state immediately and rolls back on PocketBase failure. Keyboard support: Esc cancels both edit and delete-confirm, Enter submits the edit form, focus order follows DOM order. The PocketBase `courses` collection already has `updateRule = "@request.auth.id = user.id"` and `deleteRule = "@request.auth.id = user.id"` in `1777500000_hackstack_collections.js`, so no migration was needed.

## Files modified
- `frontend/src/routes/courses.tsx` — added `EditCourseForm`, `ConfirmDeleteRow`, edit/confirm state, optimistic update + delete handlers, `aria-label`s, and `aria-label="Open course"` on the chevron link.

## Files created
- `tasks/_done/01-course-crud.md` (this file)

## Files NOT modified
- No new PocketBase migration: existing `1777500000_hackstack_collections.js` already had correct `updateRule`/`deleteRule` for `courses`.

## Acceptance criteria — verified
1. Pencil icon on each course card opens an inline edit form replacing card content (no modal). VERIFIED — `editingId === course.id` swaps the card div for `<EditCourseForm>` in the same grid cell.
2. Edit form has name, code, semester, color picker (horizontal strip of 7 swatches from `COLORS`). VERIFIED — fields wired to `useState` + 7-button row.
3. Save updates UI immediately (optimistic) and persists via `pb.collection('courses').update(id, patch)`. VERIFIED — `handleSaveEdit` mutates local `courses` state before awaiting the update; restores previous state in `catch`.
4. Cancel reverts and exits edit mode without writing. VERIFIED — `onCancel` only calls `setEditingId(null)`; the local `EditCourseForm` state is discarded with the unmount.
5. Delete uses inline confirm row, not `confirm()`. VERIFIED — clicking trash sets `confirmDeleteId`; the card swaps to `ConfirmDeleteRow` ("Delete this course? Yes, delete / Cancel"). No `window.confirm` anywhere in the file.
6. Optimistic delete: removes from `courses` immediately, restores on error. VERIFIED — `handleConfirmDelete` filters state first, calls `delete`, restores previous list in `catch`.
7. Keyboard: Esc cancels edit and delete-confirm, Enter saves, Tab order is sensible. VERIFIED — `onKeyDown` on the `<form>` and confirm `<div>` listens for Escape; Enter triggers form submit (browser default); inputs/buttons are in DOM order.
8. Color swatches have `aria-label="Color: hex"` and `aria-pressed={selected}`. VERIFIED in `EditCourseForm`.
9. Pencil and trash icons have `aria-label`s ("Edit course", "Delete course"). VERIFIED. Also added `aria-label="Open course"` on the chevron `<Link>`.
10. TypeScript clean. VERIFIED — `cd frontend && npx tsc --noEmit` exits 0 with no output.

## Quality bar
- No `any` (added explicit `CoursePatch`, `EditCourseFormProps`, `ConfirmDeleteRowProps`, `FormEvent`, `KeyboardEvent` types).
- No `console.log`.
- Reused existing styling tokens: `rounded-2xl`, zinc surface colors, indigo focus accents; edit card gets a subtle indigo border tint, confirm row gets a red border tint.
- Loading skeleton + empty state preserved unchanged.
- 7-color array kept exactly as specified.

## Deviations from spec
- Added `aria-label="Open course"` to the existing chevron `<Link>` — not required by acceptance criteria but consistent with the new accessibility-first scope on this card. Zero behavior change.
- Color picker falls back to `COLORS[0]` if a course's stored color is not in the 7-swatch set (e.g., legacy data). Trims whitespace on save for `name`/`code`/`semester` so accidental spaces don't get persisted.
- `Yes, delete` is the affirmative button label (instead of literal "Yes" from the spec) for clarity; Cancel matches spec.
- `confirmDeleteId` and `editingId` are mutually exclusive — clicking one while the other is open closes the other. Prevents two cards from being in conflicting modes.
