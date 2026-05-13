// Generates the PNG icon variants from public/icon.svg using sharp.
// Run via:  node scripts/gen-pwa-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "..", "public");
const svg = readFileSync(resolve(publicDir, "icon.svg"));

// Same artwork, but with extra interior padding so the "C" survives the
// platform-applied maskable safe-zone crop (~20% inset).
const maskableSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#0a0a0a"/>
    <g transform="translate(64 64) scale(0.75)">
      <rect width="512" height="512" rx="96" fill="#0a0a0a"/>
      <circle cx="256" cy="256" r="156" fill="none" stroke="#2f5d4f" stroke-width="36"/>
      <path d="M 360 178 A 140 140 0 1 0 360 334" fill="none" stroke="#fbfbf9" stroke-width="48" stroke-linecap="round"/>
    </g>
  </svg>`,
);

async function render(input, size, outName) {
  const buf = await sharp(input, { density: 384 })
    .resize(size, size)
    .png()
    .toBuffer();
  writeFileSync(resolve(publicDir, outName), buf);
  console.log(`wrote ${outName} (${size}x${size}, ${buf.length} bytes)`);
}

await render(svg, 192, "icon-192.png");
await render(svg, 512, "icon-512.png");
await render(maskableSvg, 512, "icon-maskable-512.png");
