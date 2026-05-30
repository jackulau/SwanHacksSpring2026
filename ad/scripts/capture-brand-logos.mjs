#!/usr/bin/env node
/**
 * Capture official logos for Wispr Flow, Canvas (Instructure), and Notion.
 *
 * Strategy per site:
 *   1. Navigate to the homepage
 *   2. Find the header logo element via fallback selectors
 *   3. Compute its bounding box; take a clipped screenshot with
 *      `omitBackground: true` so the PNG keeps a transparent alpha
 *
 * Output:  ad/public/logos/{wispr,canvas,notion}.png
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "logos");

const TARGETS = [
  {
    name: "wispr",
    url: "https://wisprflow.ai",
    // Wispr Flow's header logo is an <img alt="Flow Logo">
    selectors: [
      'img[alt*="flow logo" i]',
      'a[href="/"] img',
      'header img',
      'nav img',
    ],
    padding: 8,
  },
  {
    name: "canvas",
    // The official RED Canvas logomark (the white "Canvas" ring on a red tile),
    // served as the Canvas app touch-icon. instructure.com only exposes the
    // black "Instructure" wordmark, which is NOT the Canvas product logo.
    url: "https://canvas.instructure.com/apple-touch-icon.png",
    selectors: ["img"],
    padding: 0,
  },
  {
    name: "notion",
    url: "https://www.notion.com/",
    selectors: [
      'header a[href="/"] svg',
      'a[aria-label*="notion" i] svg',
      'nav svg',
      'header svg',
      'header img',
    ],
    padding: 8,
  },
];

async function captureLogo(browser, target) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  console.log(`→ ${target.name}: navigating to ${target.url}`);
  await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 45000 });
  // Give styles + lazy SVGs a beat to render
  await page.waitForTimeout(2500);

  // Dismiss obvious cookie banners that may overlap the header
  await page
    .locator(
      'button:has-text("Accept"), button:has-text("Got it"), button:has-text("OK")',
    )
    .first()
    .click({ timeout: 1500 })
    .catch(() => undefined);
  await page.waitForTimeout(400);

  let element = null;
  for (const selector of target.selectors) {
    const found = page.locator(selector).first();
    if (await found.count()) {
      try {
        await found.waitFor({ state: "visible", timeout: 3000 });
        element = found;
        console.log(`   selector matched: ${selector}`);
        break;
      } catch {
        // try next
      }
    }
  }

  if (!element) {
    throw new Error(`No logo element found for ${target.name}`);
  }

  const box = await element.boundingBox();
  if (!box) {
    throw new Error(`Element has no bounding box for ${target.name}`);
  }
  const pad = target.padding;
  const clip = {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };
  console.log(
    `   box ${Math.round(box.width)}x${Math.round(box.height)} at (${Math.round(box.x)}, ${Math.round(box.y)})`,
  );

  const outPath = path.join(OUT_DIR, `${target.name}.png`);
  await page.screenshot({
    path: outPath,
    clip,
    omitBackground: true,
  });
  console.log(`   ✓ saved ${outPath}`);
  await context.close();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const target of TARGETS) {
      try {
        await captureLogo(browser, target);
      } catch (err) {
        console.error(`✗ ${target.name} failed:`, err.message);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
