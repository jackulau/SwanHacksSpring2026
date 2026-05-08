# BLOCKED — PocketBase restart needed

Two new routes were added to `backend/pb_hooks/llm.pb.js`:

- `POST /api/llm/anthropic-stream`
- `POST /api/llm/openai-stream`

PocketBase only re-registers `routerAdd` handlers at startup, so these
endpoints will return 404 until you restart `pocketbase serve`. The
frontend providers detect that and fall back to the existing
non-streaming `/api/llm/{anthropic,openai}` hooks; the typewriter
effect won't kick in for real providers until the restart lands.

The Stub provider streams without any backend involvement, so the UX
on a fresh checkout is already correct.
