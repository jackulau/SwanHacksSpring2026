/* eslint-disable */
/**
 * Capture the Converge Chrome-extension popup UI for the Canvas integration scene.
 * Renders extension/popup.html in a fixed viewport, simulates the signed-in state,
 * and saves a PNG.
 */
import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const POPUP_PATH = path.join(REPO, "extension", "popup.html");
const OUT_DIR = path.join(__dirname, "..", "public", "screens");

const VIEWPORT = { width: 360, height: 420 };

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 3,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  await page.goto(`file://${POPUP_PATH}`, { waitUntil: "domcontentloaded" });

  // Force the connected view (skip login form) and populate the user info
  await page.evaluate(() => {
    const login = document.getElementById("login-view");
    const connected = document.getElementById("connected-view");
    if (login) login.classList.add("hidden");
    if (connected) connected.classList.remove("hidden");

    const avatar = document.getElementById("user-avatar");
    if (avatar) avatar.textContent = "D";
    const name = document.getElementById("user-name");
    if (name) name.textContent = "Demo Student";
    const email = document.getElementById("user-email");
    if (email) email.textContent = "demo@hackstack.dev";
    const lastSync = document.getElementById("last-sync");
    if (lastSync) lastSync.textContent = "Just now · 3 courses, 69 assignments";
  });

  // Screenshot of the popup, cropped to content
  await page.waitForTimeout(300);
  const box = await page.locator("#app").boundingBox();
  const clip = box
    ? { x: box.x, y: box.y, width: box.width, height: Math.min(box.height + 20, VIEWPORT.height) }
    : undefined;
  const out1 = path.join(OUT_DIR, "extension-popup-connected.png");
  await page.screenshot({ path: out1, clip });
  console.log("  ✓", out1);

  // Also show the "syncing" state with progress
  await page.evaluate(() => {
    const progress = document.getElementById("progress-container");
    if (progress) progress.classList.remove("hidden");
    const bar = document.getElementById("progress-bar");
    if (bar) {
      bar.style.width = "62%";
      bar.style.background = "#7bd88f";
    }
    const text = document.getElementById("progress-text");
    if (text) text.textContent = "Syncing 41 of 69 assignments…";
  });
  await page.waitForTimeout(300);
  const box2 = await page.locator("#app").boundingBox();
  const clip2 = box2
    ? { x: box2.x, y: box2.y, width: box2.width, height: Math.min(box2.height + 20, VIEWPORT.height) }
    : undefined;
  const out2 = path.join(OUT_DIR, "extension-popup-syncing.png");
  await page.screenshot({ path: out2, clip: clip2 });
  console.log("  ✓", out2);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
