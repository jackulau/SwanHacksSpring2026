# BLOCKED

PocketBase needs a restart to pick up the `note_presence` migration
applied at `backend/pb_migrations/1778280000_note_presence.js`.

Verification:

```
$ ./pocketbase.exe migrate up
Applied 1778280000_note_presence.js

$ curl http://127.0.0.1:8090/api/collections/note_presence/records?perPage=1
{"data":{},"message":"Missing collection context.","status":404}
```

The migrate-up succeeded but the running PB process has the old
schema cache. Per the operating constraints I do not restart PB
myself. After restart this file can be removed.

The frontend wiring (types, component, mount) was completed against
the migration — it will pick up the collection automatically once
the restart lands.
