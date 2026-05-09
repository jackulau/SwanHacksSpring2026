/**
 * HackStack — collection-rule invariant check.
 *
 * Asserts that every collection with a relation field pointing to the `users`
 * auth collection has a createRule that ties record ownership to the caller —
 * specifically, the canonical pattern established by
 * `backend/pb_migrations/1777570000_security_rules.js`:
 *
 *     "@request.auth.id = @request.body.user"
 *
 * Accepts either operand order (PB `=` is commutative in rule expressions),
 * and accepts stricter rules that contain the canonical pattern as a substring
 * (e.g. an extra `@request.auth.id != "" && ...` clause).
 *
 * Why this exists:
 *   The 1777570000 consolidation hardened every user-attributed collection
 *   that existed at the time. Any collection migration shipped AFTER that
 *   consolidation (e.g. 1777900000_calendar_events.js) hand-rolls its own
 *   rules and can silently re-introduce the loose `@request.auth.id != ''`
 *   create rule that the consolidation was specifically written to eliminate.
 *   Run this script in CI on every PB-touching PR to prevent that drift.
 *
 * Implementation note:
 *   Uses raw fetch against PB's REST API rather than the `pocketbase` SDK so
 *   the script has no node_modules dependency and can run from anywhere.
 *
 * Usage:
 *   PB_URL=http://127.0.0.1:8090 \
 *   PB_ADMIN_EMAIL=admin@hackstack.dev \
 *   PB_ADMIN_PASSWORD=<secret> \
 *   cd frontend && npm run check-rules
 *
 * Exit codes:
 *   0 — all user-attributed collections pass the invariant.
 *   1 — one or more drift, OR setup error (missing env, auth fail, etc.).
 */

const PB_URL = process.env.PB_URL ?? "http://127.0.0.1:8090";
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

const CANONICAL_A = "@request.auth.id = @request.body.user";
const CANONICAL_B = "@request.body.user = @request.auth.id";

if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
  console.error(
    "Missing required env vars. Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD " +
      "(superuser credentials) before running this script.",
  );
  process.exit(1);
}

interface CollectionField {
  type: string;
  name: string;
  collectionId?: string;
}
interface CollectionRecord {
  id: string;
  name: string;
  type: string;
  createRule: string | null;
  fields: CollectionField[];
}

function ruleSatisfiesInvariant(rule: string | null): boolean {
  if (!rule) return false;
  return rule.includes(CANONICAL_A) || rule.includes(CANONICAL_B);
}

function userRelationFields(
  fields: CollectionField[],
  usersCollectionId: string,
): CollectionField[] {
  return fields.filter(
    (f) => f.type === "relation" && f.collectionId === usersCollectionId,
  );
}

async function authSuperuser(): Promise<string> {
  const res = await fetch(
    `${PB_URL}/api/collections/_superusers/auth-with-password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: PB_ADMIN_EMAIL,
        password: PB_ADMIN_PASSWORD,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Superuser auth failed: HTTP ${res.status} ${body.slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as { token: string };
  return json.token;
}

async function fetchCollections(token: string): Promise<CollectionRecord[]> {
  // PB lists collections via this admin endpoint; perPage 200 is well above
  // the realistic ceiling for this app and avoids paging.
  const res = await fetch(
    `${PB_URL}/api/collections?perPage=200`,
    { headers: { Authorization: token } },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `GET /api/collections failed: HTTP ${res.status} ${body.slice(0, 300)}`,
    );
  }
  const json = (await res.json()) as { items: CollectionRecord[] };
  return json.items;
}

async function main(): Promise<void> {
  console.log(`Connecting to PocketBase at ${PB_URL}...`);
  const token = await authSuperuser();
  console.log(`Authenticated as ${PB_ADMIN_EMAIL}.\n`);

  const collections = await fetchCollections(token);

  const usersCollection = collections.find(
    (c) => c.name === "users" && c.type === "auth",
  );
  if (!usersCollection) {
    console.error(
      'Could not find an auth collection named "users". The check assumes ' +
        "this repo's user-attributed collections relate to a collection by " +
        'that name. If "users" was renamed, update this script.',
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Resolved users auth collection: name="${usersCollection.name}" id=${usersCollection.id}\n`,
  );
  console.log("Canonical createRule pattern (must appear as substring):");
  console.log(`  "${CANONICAL_A}"`);
  console.log(`  or "${CANONICAL_B}"`);
  console.log(
    "  Source of truth: backend/pb_migrations/1777570000_security_rules.js (userScoped factory).\n",
  );

  let checked = 0;
  let passed = 0;
  const failures: { name: string; rule: string | null; relations: string }[] = [];

  for (const c of collections) {
    if (c.type !== "base") continue;
    const userRels = userRelationFields(c.fields ?? [], usersCollection.id);
    if (userRels.length === 0) continue;

    checked += 1;
    const relNames = userRels.map((r) => r.name).join(", ");
    if (ruleSatisfiesInvariant(c.createRule)) {
      passed += 1;
      console.log(`  PASS  ${c.name}  (user-relation fields: ${relNames})`);
    } else {
      failures.push({ name: c.name, rule: c.createRule, relations: relNames });
      console.log(`  FAIL  ${c.name}  (user-relation fields: ${relNames})`);
      console.log(`        current createRule: ${JSON.stringify(c.createRule)}`);
    }
  }

  console.log(
    `\nChecked ${checked} user-attributed collection(s): ${passed} passed, ${failures.length} failed.`,
  );

  if (failures.length > 0) {
    console.log("");
    console.log("DRIFT DETECTED. To fix, write a migration that sets each failing");
    console.log("collection's createRule to the canonical pattern, e.g.:");
    console.log("");
    console.log("    collection.createRule =");
    console.log(`      '${CANONICAL_A}';`);
    console.log("");
    console.log(
      "Or a stricter expression that contains the canonical substring " +
        '(for example, an extra `@request.auth.id != "" && ...` clause).',
    );
    console.log("");
    console.log("Failing collections:");
    for (const f of failures) {
      console.log(`  - ${f.name}`);
      console.log(`      rule = ${JSON.stringify(f.rule)}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("OK — no drift.");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Unhandled error: ${msg}`);
  process.exitCode = 1;
});
