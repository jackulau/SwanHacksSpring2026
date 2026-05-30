/* eslint-disable */
/**
 * Capture real Converge UI screenshots for the ad video.
 *
 * Assumes:
 *  - frontend dev server is running at http://localhost:3000
 *  - PocketBase backend is up at http://127.0.0.1:8090
 *  - demo data has been seeded (demo@hackstack.dev / demohackstack)
 *
 * Output: ad/public/screens/*.png at 2x DPR for crisp UI cards.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "screens");
const APP = "http://localhost:3000";
const PB = "http://127.0.0.1:8090";
const EMAIL = "demo@hackstack.dev";
const PASSWORD = "demohackstack";

const VIEWPORT = { width: 1440, height: 900 };
const DPR = 2;

const SHOTS = [
  { name: "dashboard-light", route: "/", theme: "light", wait: 1200 },
  { name: "dashboard-dark", route: "/", theme: "dark", wait: 1200 },
  { name: "courses-light", route: "/courses", theme: "light", wait: 900 },
  { name: "capture-light", route: "/capture", theme: "light", wait: 1000 },
  { name: "study-light", route: "/study", theme: "light", wait: 1000 },
  { name: "study-flashcards-light", route: "/study/flashcards", theme: "light", wait: 1400 },
  { name: "study-planner-light", route: "/study/planner", theme: "light", wait: 1000 },
  { name: "calendar-light", route: "/calendar", theme: "light", wait: 900 },
  { name: "settings-a11y-light", route: "/settings/accessibility", theme: "light", wait: 900 },
  // Lecture detail page — transcript + notes view
  {
    name: "lecture-bio-light",
    route: "/lectures/demolecbio02002",
    theme: "light",
    wait: 1600,
  },
  {
    name: "lecture-cog-light",
    route: "/lectures/demoleccog01001",
    theme: "light",
    wait: 1600,
  },
  {
    name: "lecture-math-light",
    route: "/lectures/demolecmth01001",
    theme: "light",
    wait: 1600,
  },
];

const DARK_CSS = `
  html { color-scheme: dark; }
  html, html *:not(svg):not(svg *) { transition: none !important; animation: none !important; }
`;

async function loginViaApi(page) {
  const res = await page.request.post(`${PB}/api/collections/users/auth-with-password`, {
    data: { identity: EMAIL, password: PASSWORD },
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok()) {
    throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
  }
  const payload = await res.json();
  return payload;
}

async function seedAuthInBrowser(page, payload) {
  // Pocketbase JS SDK persists auth in localStorage under "pocketbase_auth".
  await page.addInitScript(({ token, record }) => {
    const value = JSON.stringify({ token, record });
    try {
      window.localStorage.setItem("pocketbase_auth", value);
    } catch {}
  }, { token: payload.token, record: payload.record });
}

async function ensureTheme(page, theme) {
  await page.evaluate((t) => {
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
      root.dataset.theme = "dark";
    } else {
      root.classList.remove("dark");
      root.dataset.theme = "light";
    }
    try {
      window.localStorage.setItem("converge:theme", t);
      window.localStorage.setItem("theme", t);
    } catch {}
  }, theme);
}

async function shoot(page, shot) {
  console.log(`📸 ${shot.name}  → ${shot.route} (${shot.theme})`);
  await page.goto(`${APP}${shot.route}`, { waitUntil: "domcontentloaded" });
  await ensureTheme(page, shot.theme);
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(shot.wait);
  const out = path.join(OUT_DIR, `${shot.name}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log(`   ✓ ${out}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    colorScheme: "light",
    reducedMotion: "reduce",
  });

  const page = await context.newPage();

  const auth = await loginViaApi(page);
  await seedAuthInBrowser(page, auth);
  console.log(`🔐 authed as ${auth.record.email}`);

  for (const shot of SHOTS) {
    try {
      await shoot(page, shot);
    } catch (err) {
      console.error(`✗ ${shot.name}:`, err.message);
    }
  }

  // Tab variants on the bio lecture page — Notes, Flashcards, Quiz
  const TABS = [
    { name: "lecture-notes-light", route: "/lectures/demolecbio02002", click: "text=Notes" },
    { name: "lecture-flashcards-light", route: "/lectures/demolecbio02002", click: "text=Flashcards" },
    { name: "lecture-quiz-light", route: "/lectures/demolecbio02002", click: "text=Quiz" },
  ];

  for (const tab of TABS) {
    try {
      console.log(`📸 ${tab.name} → ${tab.route} (click ${tab.click})`);
      await page.goto(`${APP}${tab.route}`, { waitUntil: "domcontentloaded" });
      await ensureTheme(page, "light");
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const target = page.locator(tab.click).first();
      if (await target.count()) {
        await target.click({ trial: false }).catch(() => {});
        await page.waitForTimeout(1000);
      }
      const out = path.join(OUT_DIR, `${tab.name}.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`   ✓ ${out}`);
    } catch (err) {
      console.error(`✗ ${tab.name}:`, err.message);
    }
  }

  await browser.close();
  console.log("✅ done. screens →", OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
