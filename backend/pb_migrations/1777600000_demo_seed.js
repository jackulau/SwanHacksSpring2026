/// <reference path="../pb_data/types.d.ts" />
//
// Demo data seed — DEFERRED TO `frontend/scripts/seed.ts`.
//
// PocketBase's goja runtime can't `require()` external JS modules from a
// migration file (paths outside its built-in module space throw "Invalid
// module"). Inlining the 540-line dataset here would work but couples the
// data to a specific migration version, making future updates noisy.
//
// Instead the dataset lives at `backend/seed/demo-data.js` and is loaded by
// the Node-side script `frontend/scripts/seed.ts`. To populate the demo
// content, run:
//
//   cd frontend && PB_ADMIN_EMAIL=<email> PB_ADMIN_PASSWORD=<pass> npm run seed
//
// This migration is intentionally a no-op so the migration ledger stays
// consistent across environments.
migrate((app) => {
  // no-op
}, (app) => {
  // no-op
});
