#!/usr/bin/env node
/**
 * regen-favicons.mjs
 *
 * Regenerate ui/public/favicon-{16,32}x{16,32}.png and favicon.ico from
 * ui/public/apple-touch-icon.png (the design source-of-truth). Run again
 * any time the apple-touch-icon is updated.
 *
 *   node scripts/regen-favicons.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import toIco from "to-ico";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "../ui/public");
const distDir = resolve(__dirname, "../ui/dist");
const src = resolve(publicDir, "apple-touch-icon.png");

async function makePng(size) {
  return sharp(src).resize(size, size, { fit: "cover" }).png().toBuffer();
}

async function main() {
  const p16 = await makePng(16);
  const p32 = await makePng(32);
  writeFileSync(resolve(publicDir, "favicon-16x16.png"), p16);
  writeFileSync(resolve(publicDir, "favicon-32x32.png"), p32);

  const ico = await toIco([p16, p32]);
  writeFileSync(resolve(publicDir, "favicon.ico"), ico);

  // Mirror into ui/dist so a running server picks up the new icons
  // without a full UI rebuild. ui/dist is gitignored; this is best-effort.
  try {
    writeFileSync(resolve(distDir, "favicon-16x16.png"), p16);
    writeFileSync(resolve(distDir, "favicon-32x32.png"), p32);
    writeFileSync(resolve(distDir, "favicon.ico"), ico);
  } catch {
    /* dist may not exist before first build; ignore */
  }

  console.log("regenerated favicon-16x16.png, favicon-32x32.png, favicon.ico");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
