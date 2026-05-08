# BLOCKED

## note_versions collection: 404 from running PocketBase instance

Migration `1778270000_note_versions.js` applied successfully via
`./pocketbase.exe migrate up` (output: `Applied 1778270000_note_versions.js`).

However, the running PB process at `127.0.0.1:8090` still returns 404 for
`/api/collections/note_versions/records?perPage=1`. The health endpoint
returns 200, so the daemon is alive — it just hasn't picked up the new
collection because the migration was applied against the DB file from a
sibling process, not the live one.

Per task instructions ("if 404, write to BLOCKED.md and proceed without
restarting PB"), the frontend changes were shipped anyway. Once the
running PocketBase is restarted (or the migrate-up was run from the same
process holding the DB), the collection will surface and the History
panel will start working live.
