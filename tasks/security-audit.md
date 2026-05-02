# HackStack Security Audit

**Date:** 2026-05-02  
**Scope:** Full codebase — frontend, backend migrations, browser extension  
**Auditor:** Security Reviewer Agent

---

## Critical Findings (must fix before demo)

### C-1: OpenAI API Key Exposed in Client Bundle
**Severity:** CRITICAL  
**Files:** `frontend/src/lib/ai-pipeline.ts:17`, `frontend/src/routes/capture.upload.tsx:41`  
**OWASP:** A02 Cryptographic Failures / A05 Security Misconfiguration

`VITE_OPENAI_API_KEY` is read via `import.meta.env` and used directly in browser-side `fetch()` calls to `https://api.openai.com`. Because Vite inlines all `VITE_*` variables into the production bundle at build time, the key is visible in plain text to anyone who opens DevTools → Sources or runs `strings` on the built JS.

**Attack scenario:** Any user (or competitor) visiting the deployed app downloads the bundle, searches for `sk-`, extracts the key, and makes unlimited OpenAI calls billed to your account. They can also access all model capabilities, exfiltrate any model you have fine-tuned, and exhaust your monthly quota.

**Fix:** Move all OpenAI calls to a thin server-side proxy (a PocketBase hook or a separate Edge/Node function). The client POSTs the transcript text; the server calls OpenAI with the secret key stored only in a server environment variable. The key must never appear in any `VITE_*` variable.

---

### C-2: Deepgram API Key Exposed in Client Bundle
**Severity:** CRITICAL  
**File:** `frontend/src/hooks/useDeepgramSTT.ts:39`  
**OWASP:** A02 Cryptographic Failures / A05 Security Misconfiguration

`VITE_DEEPGRAM_API_KEY` is inlined into the bundle and sent as a WebSocket sub-protocol header directly to `wss://api.deepgram.com`. Anyone inspecting network traffic or the JS bundle can extract it.

**Attack scenario:** Attacker subscribes unlimited transcription on your Deepgram account, potentially running up thousands of minutes of API usage overnight.

**Fix:** Use Deepgram's temporary token endpoint (`POST /v1/listen` via your own backend to obtain a short-lived token, then pass only that token to the client WebSocket connection). The permanent key stays server-side.

---

### C-3: Five Core Collections Have Fully Open Rules (World-Readable and Writable)
**Severity:** CRITICAL  
**File:** `backend/pb_migrations/1777500000_hackstack_collections.js:53-207`  
**OWASP:** A01 Broken Access Control

The following collections were created with every rule set to `""` (empty string). In PocketBase, an empty rule means "allow everyone including unauthenticated users":

| Collection | listRule | viewRule | createRule | updateRule | deleteRule |
|---|---|---|---|---|---|
| transcripts | `""` | `""` | `""` | `""` | `""` |
| notes | `""` | `""` | `""` | `""` | `""` |
| flashcards | `""` | `""` | `""` | `""` | `""` |
| quizzes | `""` | `""` | `""` | `""` | `""` |
| quiz_attempts | `""` | `""` | `""` | `""` | `""` |

This means any unauthenticated HTTP request to `/api/collections/transcripts/records` returns every user's full transcript text, which includes verbatim lecture audio recordings — private academic content.

The `study_sessions` collection was also created open and partially fixed by a later migration (`1777560000_study_sessions.js`), but the five above were never patched.

**Attack scenario:** Any attacker who knows (or guesses) the PocketBase URL can curl all transcripts, notes, flashcards, and quiz data for every user in the system without authenticating.

**Fix:** Apply user-scoped rules to every collection. For collections with a `user` relation field:
```
listRule:   "@request.auth.id = user.id"
viewRule:   "@request.auth.id = user.id"
createRule: "@request.auth.id != '' && @request.auth.id = @request.data.user"
updateRule: "@request.auth.id = user.id"
deleteRule: "@request.auth.id = user.id"
```
For `transcripts` (which links only to `lecture`, not directly to `user`), add a user relation field or traverse: `"@request.auth.id = lecture.user.id"`.

---

### C-4: Canvas Proxy Has No Domain Allowlist (SSRF)
**Severity:** CRITICAL  
**File:** `frontend/vite.config.ts:24`  
**OWASP:** A10 Server-Side Request Forgery

The Vite dev-server Canvas proxy blindly forwards requests to any URL provided in the `x-canvas-url` header:

```ts
const target = canvasBase.replace(/\/+$/, "") + "/api/v1" + path;
const response = await fetch(target, { ... });
```

There is no allowlist, no URL validation, and no check that the target is an `instructure.com` hostname.

**Attack scenario:** An attacker sets `x-canvas-url: http://169.254.169.254` (AWS metadata endpoint) or `http://192.168.1.1` (internal router) and uses the proxy to scan or exfiltrate internal network resources. This is a classic SSRF pivot. Even if this proxy only runs in dev, if `npm run dev` is ever exposed on a network (CI, shared dev box), the attack is live.

**Fix:**
```ts
const ALLOWED_CANVAS_HOSTS = /^https:\/\/[a-z0-9-]+\.instructure\.com$/i;
if (!ALLOWED_CANVAS_HOSTS.test(canvasBase)) {
  res.writeHead(400);
  res.end(JSON.stringify({ error: "Canvas URL not allowed" }));
  return;
}
```
Also enforce `https://` only — reject plain `http://` Canvas URLs.

---

## High-Priority Findings

### H-1: PocketBase Auth Token Stored in localStorage (XSS-Accessible)
**Severity:** HIGH  
**File:** `frontend/src/lib/pocketbase.ts:3` (PocketBase SDK default)  
**OWASP:** A07 Identification and Authentication Failures

The PocketBase JS SDK stores its auth token in `localStorage` by default (key `pocketbase_auth`). localStorage is accessible to any JavaScript executing on the page origin, meaning an XSS vulnerability anywhere in the app (including third-party scripts, future dependencies, or injected content) would let an attacker silently steal the session token and fully impersonate the user.

**Fix:** Override the PocketBase auth store to use a `Secure; HttpOnly; SameSite=Strict` cookie set by the backend, or at minimum use `sessionStorage` (cleared on tab close) and implement short token lifetimes. Configure a custom auth store:

```ts
export const pb = new PocketBase(url, new LocalAuthStore("pocketbase_auth"));
// Replace LocalAuthStore with a cookieAuthStore backed by the server
```

---

### H-2: Canvas API Token Stored in localStorage
**Severity:** HIGH  
**File:** `frontend/src/lib/canvas.ts:50-64`  
**OWASP:** A02 Cryptographic Failures / A07 Authentication Failures

The Canvas API token (a long-lived institutional credential) is saved to `localStorage` under `hackstack_canvas_config` in plaintext. If any XSS is achieved, an attacker extracts this token and gains full Canvas API access as the user — including submitting assignments, viewing grades, and accessing institutional data.

**Fix:** Do not store the Canvas API token in the browser at all. Either:
1. Use the browser extension (which stores in `chrome.storage.local` — more isolated, though still readable by the extension) and relay Canvas requests through the extension's background service worker, or
2. Encrypt it at rest using the Web Crypto API with a key derived from the user's session, treating it as a vault secret.

---

### H-3: Extension Stores Auth Token in `chrome.storage.local` (Cleartext)
**Severity:** HIGH  
**File:** `extension/background.js:69-75`  
**OWASP:** A02 Cryptographic Failures

```js
await chrome.storage.local.set({
  authToken: data.token,
  authUserId: data.record.id,
  authEmail: data.record.email,
});
```

`chrome.storage.local` is readable by any script in the extension's origin and by extensions with the `storage` permission. If the extension is compromised or another extension with broad permissions is installed, the PocketBase auth token is leaked.

**Fix:** Use `chrome.storage.session` (cleared when the browser closes, not persisted to disk) instead of `chrome.storage.local` for the `authToken`. Session storage is not accessible to content scripts, reducing the attack surface.

---

### H-4: Extension Message Handler Does Not Validate Sender Origin
**Severity:** HIGH  
**File:** `extension/background.js:188`  
**OWASP:** A01 Broken Access Control

```js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "LOGIN") { ... }
  if (msg.type === "SYNC_CANVAS") { ... }
```

The `sender` argument is never inspected. Any content script running on any page the user visits can send a `LOGIN` message with arbitrary credentials, a `SYNC_CANVAS` message with fabricated course/assignment data to poison the user's HackStack account, or a `SET_PB_URL` message to redirect all future PocketBase requests to an attacker-controlled server.

**Fix:** Validate that messages originate from trusted sources:
```js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Allow only messages from the extension itself (popup, options)
  if (sender.id !== chrome.runtime.id) return;
  // For content script messages, validate sender.url matches allowed Canvas origins
  if (msg.type === "SYNC_CANVAS" && !sender.url?.match(/^https:\/\/[^/]+\.instructure\.com\//)) return;
  ...
});
```

---

### H-5: Extension `optional_host_permissions` Grants Access to All URLs
**Severity:** HIGH  
**File:** `extension/manifest.json:9-10`  
**OWASP:** A05 Security Misconfiguration

```json
"optional_host_permissions": ["https://*/*", "http://*/*"]
```

When the user clicks "Inject Sync Button on This Tab" in the popup, the extension requests access to the currently active tab via `chrome.scripting.executeScript`. With these optional permissions declared, a user can grant the extension full access to any website. Combined with the missing sender validation (H-4), a malicious page could send messages to the background worker after injection.

**Fix:** Remove the `http://*/*` optional permission entirely (Canvas only runs on HTTPS). Narrow `https://*/*` to specific Canvas institution domains if possible, or at minimum add a user-confirmation step before injecting on non-Canvas domains.

---

### H-6: PocketBase Filter Injection via URL-Derived Parameters
**Severity:** HIGH  
**File:** `frontend/src/routes/lectures.$lectureId.tsx:56,64,72,79`, `frontend/src/routes/courses.$courseId.tsx:23`  
**OWASP:** A03 Injection

Route parameters from the URL are embedded directly into PocketBase filter strings without sanitization:

```ts
const { lectureId } = Route.useParams();
// ...
filter: `lecture = "${lectureId}"`,
```

PocketBase's filter syntax is not SQL, but it is a server-evaluated expression language. A crafted URL like `/lectures/x" || 1=1 || "` could alter filter semantics. The server-side access rules on `lectures` do enforce ownership (`@request.auth.id = user.id`), so cross-user data leakage is blocked — but the injection could produce unexpected query behavior or information disclosure through error messages.

For `courses.$courseId.tsx:23`, the `courses` collection fetches lectures with `course = "${courseId}"` — with no authentication guard on the route itself (no redirect on missing user). An unauthenticated visitor who guesses a valid course ID can enumerate its lectures.

**Fix:** Use PocketBase's filter placeholder syntax where supported, or validate that `lectureId` / `courseId` match the expected ID format (15-character alphanumeric) before interpolation:
```ts
if (!/^[a-z0-9]{15}$/.test(lectureId)) throw new Error("Invalid ID");
```
Also add authentication guards to `courses.$courseId.tsx`.

---

## Medium-Priority Findings

### M-1: Unvalidated JSON Paste from Canvas Console Script
**Severity:** MEDIUM  
**File:** `frontend/src/hooks/useCanvasSync.ts:44-57`  
**OWASP:** A08 Software and Data Integrity Failures

The import flow accepts arbitrary JSON pasted by the user (originally produced by a console script they ran on Canvas). Only a shallow structural check is performed (`Array.isArray(data.courses)`). Fields like `cc.name`, `ca.description`, `ca.html_url` are stored directly into PocketBase without any length or content validation. A malicious or corrupted payload could write unbounded-length strings or unexpected types into the database.

**Fix:** Validate the payload against a strict schema (Zod recommended) before calling `syncFromPayload`. Enforce maximum lengths on string fields matching the database column definitions.

---

### M-2: PII Logged to Browser Console
**Severity:** MEDIUM  
**File:** `frontend/src/components/canvas/CanvasConnect.tsx:56,64,88,94,96`  
**OWASP:** A09 Security Logging and Monitoring Failures

Multiple `console.log` statements emit the Canvas user's real name and course information:
```ts
console.log("Hi " + u.name + "!");
console.log(cs.length + " courses");
```

Browser console output persists in crash reports, browser sync logs, and any monitoring tooling that captures console output. Canvas user names are PII.

**Fix:** Remove all `console.log` calls from production code. Use a logging abstraction that is a no-op in production builds. The inline `IMPORT_SCRIPT` constant also embeds these logs — it should be trimmed of PII-emitting statements before shipping.

---

### M-3: Error Messages May Expose Internal Details
**Severity:** MEDIUM  
**File:** `frontend/src/lib/ai-pipeline.ts:139,161`  
**OWASP:** A04 Insecure Design

Pipeline error strings that include raw exception messages are stored in the `lectures.error_message` field and may be surfaced to users:
```ts
result.errors.push(`Transcript cleanup failed: ${e}`);
```
If `e` is an OpenAI or PocketBase error response, it may contain internal server details, stack traces, or information about the data model.

**Fix:** Log the full error internally (server-side), but store only a generic, user-safe error message in `error_message`. Map known error types to friendly strings.

---

### M-4: No Validation of `pb_url` Set by Extension Popup
**Severity:** MEDIUM  
**File:** `extension/popup.js:75-78`, `extension/background.js:4-6`  
**OWASP:** A05 Security Misconfiguration

The user can type any URL into the Server Settings field in the popup, and it is saved without any validation. The background script then sends all API requests — including authentication credentials — to that URL. A social engineering attack ("paste this URL to unlock premium features") would redirect login to an attacker's server.

**Fix:** Validate that the URL is well-formed, uses HTTPS (in non-dev environments), and matches an expected pattern before storing. Show a warning when the user attempts to save a non-localhost HTTP URL.

---

### M-5: Missing `duration_secs` on Lecture Create Allowing Null
**Severity:** MEDIUM (data integrity)  
**File:** `frontend/src/routes/capture.upload.tsx:27-35`  
**OWASP:** A04 Insecure Design

The upload path does not set `duration_secs` on the lecture record (unlike the recording path). The field is not required in the schema, so it silently stores as null. Code elsewhere computes `Math.ceil(lec.duration_secs / 60)` without a null check, which will render `NaN` in the UI and could cause runtime errors in statistics hooks.

This is a data integrity issue that can also manifest as a denial-of-service if a statistics query aggregates over null values unexpectedly.

---

## Browser Extension Findings

### E-1: No Content Security Policy in `popup.html`
**Severity:** HIGH  
**File:** `extension/popup.html`  
**OWASP:** A05 Security Misconfiguration

`popup.html` has no `Content-Security-Policy` meta tag. MV3 extensions default to a reasonably restrictive CSP, but explicitly declaring one is required to prevent future regressions and to block inline script injection.

**Fix:** Add to `manifest.json`:
```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'none';"
}
```

### E-2: Content Script Injects DOM Elements with Static `innerHTML`
**Severity:** MEDIUM  
**File:** `extension/content.js:12-18`  
**OWASP:** A03 Injection (XSS)

```js
btn.innerHTML = `<svg ...><span>Sync to HackStack</span></svg>`;
```

The content injected is fully static (no user data), so this specific instance is safe. However, the pattern of using `innerHTML` in a content script is flagged as a policy violation by many extension store reviewers and sets a risky precedent. If any future dynamic value is ever interpolated here, it becomes an XSS vector against Canvas pages.

**Fix:** Construct DOM elements programmatically using `document.createElement` and `textContent` throughout the content script.

### E-3: Toast Message Uses `textContent` Correctly (No Issue — Noted for Completeness)
**File:** `extension/content.js:28`  
`toast.textContent = message;` — this is safe. `textContent` does not parse HTML. No action needed.

### E-4: `chrome.scripting.executeScript` Can Inject into Arbitrary Tabs
**Severity:** MEDIUM  
**File:** `extension/popup.js:85-98`  
**OWASP:** A01 Broken Access Control

The "Inject Sync Button on This Tab" button injects `content.js` into whatever tab is currently active, with no check that the tab is actually a Canvas page. If the user is on a banking site or sensitive page and accidentally clicks this, the extension injects a button and establishes `chrome.runtime.sendMessage` channels on that page.

**Fix:** Check `tab.url` before injecting:
```js
if (!tab.url?.match(/^https:\/\/[^/]+\.instructure\.com\//)) {
  injectBtn.textContent = "Not a Canvas page";
  return;
}
```

---

## PocketBase Rule Audit (Per Collection)

| Collection | listRule | viewRule | createRule | updateRule | deleteRule | Status |
|---|---|---|---|---|---|---|
| courses | `@request.auth.id = user.id` | same | `@request.auth.id != ''` | same as list | same | ACCEPTABLE — createRule allows any authenticated user to create for another user's ID. Should add `&& @request.auth.id = @request.data.user` |
| lectures | `@request.auth.id = user.id` | same | `@request.auth.id != ''` | same | same | Same issue as courses createRule |
| transcripts | `""` | `""` | `""` | `""` | `""` | CRITICAL — fully open, see C-3 |
| notes | `""` | `""` | `""` | `""` | `""` | CRITICAL — fully open, see C-3 |
| flashcards | `""` | `""` | `""` | `""` | `""` | CRITICAL — fully open, see C-3 |
| quizzes | `""` | `""` | `""` | `""` | `""` | CRITICAL — fully open, see C-3 |
| quiz_attempts | `""` | `""` | `""` | `""` | `""` | CRITICAL — fully open, see C-3 |
| study_sessions | `@request.auth.id = user.id` | same | `@request.auth.id != '' && @request.auth.id = user.id` | same | same | GOOD — fixed by migration 1777560000 |
| assignments | `@request.auth.id = user.id` | same | `@request.auth.id != ''` | same | same | ACCEPTABLE — same createRule gap as courses |

**createRule gap for courses, lectures, assignments:** The rule `@request.auth.id != ''` only verifies the user is logged in, not that they are creating a record owned by themselves. An authenticated user can POST `{ user: "<victim_user_id>" }` and create records attributed to another account. Fix by adding `&& @request.auth.id = @request.data.user` to all three createRules.

---

## Secrets Handling

| Secret | Location | Status |
|---|---|---|
| `VITE_OPENAI_API_KEY` | Vite env var, inlined into client bundle | CRITICAL — client-exposed |
| `VITE_DEEPGRAM_API_KEY` | Vite env var, inlined into client bundle | CRITICAL — client-exposed |
| `VITE_POCKETBASE_URL` | Vite env var | Low risk — URL is not a secret |
| PocketBase auth token | `localStorage` (frontend), `chrome.storage.local` (extension) | HIGH — XSS-accessible |
| Canvas API token | `localStorage` under `hackstack_canvas_config` | HIGH — XSS-accessible |
| HackStack credentials | Sent over HTTP in extension (if `pbUrl` is `http://127.0.0.1`) | Acceptable for localhost; must enforce HTTPS in prod |

**No hardcoded secrets were found in the committed source files.** The `.env.local` files are correctly gitignored. The critical issue is that `VITE_*` keys are meant to be public (they go into the client bundle) — using them for third-party API keys is architecturally incorrect.

---

## Recommended Next Steps

**Before demo (today):**
1. Move OpenAI and Deepgram calls to a PocketBase server hook or proxy endpoint. Remove both `VITE_OPENAI_API_KEY` and `VITE_DEEPGRAM_API_KEY`. (C-1, C-2)
2. Write a new migration that applies user-scoped rules to `transcripts`, `notes`, `flashcards`, `quizzes`, and `quiz_attempts`. (C-3)
3. Add the Canvas URL allowlist to the Vite proxy and to the production equivalent. (C-4)

**Before first real users:**
4. Add `sender.id` validation to the extension's `onMessage` listener. (H-4)
5. Fix the createRule gap on `courses`, `lectures`, and `assignments` to include `&& @request.auth.id = @request.data.user`. (PB Rule Audit)
6. Replace `chrome.storage.local` with `chrome.storage.session` for `authToken`. (H-3)
7. Add authentication guard to `courses.$courseId.tsx` route. (H-6)
8. Validate URL params match `[a-z0-9]{15}` before embedding in PocketBase filters. (H-6)
9. Remove `console.log` statements from `CanvasConnect.tsx` in production builds. (M-2)
10. Add a Zod schema to validate pasted Canvas JSON before import. (M-1)

**Ongoing:**
- Establish a `package-lock.json` and run `npm audit` in CI on every pull request.
- Add `Content-Security-Policy` headers on the PocketBase server side (or via a reverse proxy like Caddy/nginx) for the frontend origin.
- Rotate any OpenAI or Deepgram keys that were ever in `.env.local` files on machines that have pushed to any shared environment — treat them as potentially exposed.
