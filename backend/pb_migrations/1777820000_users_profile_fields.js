/// <reference path="../pb_data/types.d.ts" />
//
// Add `display_name`, `preferences`, and `onboarding_done` to the users
// collection.
//
// Why:
//   The frontend already writes these fields:
//     - settings.tsx:339          → pb.users.update(id, { display_name })
//     - lib/preferences.tsx:148   → pb.users.update(id, { preferences })
//     - frontend/scripts/seed.ts  → upserts user with display_name +
//                                   onboarding_done
//   PocketBase silently drops unknown keys on auth collections, so today
//   these writes appear to succeed but never persist. Settings reverts on
//   reload (display_name) and the preferences toggle fires a 400 on every
//   change.
//
// Field choices:
//   - display_name : text, optional, max 100 chars  (separate from PB's
//                    built-in `name` field so neither collides with the auth
//                    plugin's identity helpers).
//   - preferences  : json, optional. Stores the same shape that
//                    `lib/preferences.tsx` keeps in localStorage so the
//                    cloud copy can rehydrate across devices.
//   - onboarding_done : bool, optional. Already referenced by seed.ts; add
//                    here so it actually persists.
//
// Idempotency:
//   Each field add checks for existing presence on the collection before
//   pushing. Re-running the migration is a no-op.

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (!users) {
    console.log("[users_profile_fields] users collection not found, skipping");
    return;
  }

  const has = (name) => Boolean(users.fields.find((f) => f.name === name));

  if (!has("display_name")) {
    users.fields.push(new Field({
      id: "f_users_display_name",
      name: "display_name",
      type: "text",
      autogeneratePattern: "",
      hidden: false,
      max: 100,
      min: 0,
      pattern: "",
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
    }));
  }

  if (!has("preferences")) {
    users.fields.push(new Field({
      id: "f_users_preferences",
      name: "preferences",
      type: "json",
      hidden: false,
      maxSize: 100000,
      presentable: false,
      required: false,
      system: false,
    }));
  }

  if (!has("onboarding_done")) {
    users.fields.push(new Field({
      id: "f_users_onboarding_done",
      name: "onboarding_done",
      type: "bool",
      hidden: false,
      presentable: false,
      required: false,
      system: false,
    }));
  }

  app.save(users);
}, (app) => {
  // Down: best-effort remove the fields we added. Safe because nothing else
  // in the app schema references them.
  try {
    const users = app.findCollectionByNameOrId("users");
    if (!users) return;
    const dropNames = ["display_name", "preferences", "onboarding_done"];
    users.fields = users.fields.filter((f) => !dropNames.includes(f.name));
    app.save(users);
  } catch (e) {
    // ignore
  }
});
