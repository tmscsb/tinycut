import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const site = "https://tinycut.pages.dev/";
const description =
  "Free print layout editor in your browser. Crop and size images in millimeters, then export SVG, JPEG, PNG, or PDF. No account — files stay on your device.";

function pngSize(path: string) {
  const buf = readFileSync(path);
  assert.equal(buf.toString("ascii", 1, 4), "PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function meta(html: string, attr: "name" | "property", key: string) {
  const pattern = new RegExp(`<meta ${attr}="${key}" content="([^"]+)"`);
  const match = html.match(pattern);
  assert.ok(match, `missing ${attr}="${key}"`);
  return match[1];
}

test("index.html exposes crawler and social metadata for the public site", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>TinyCut — Free Print Layout Editor<\/title>/);
  assert.equal(meta(html, "name", "description"), description);
  assert.ok(description.length >= 70 && description.length <= 160, description.length);
  assert.match(html, /<link rel="canonical" href="https:\/\/tinycut\.pages\.dev\/" \/>/);
  assert.equal(meta(html, "name", "robots"), "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
  assert.equal(meta(html, "property", "og:url"), site);
  assert.equal(meta(html, "property", "og:title"), "TinyCut — Free Print Layout Editor");
  assert.equal(meta(html, "property", "og:description"), description);
  assert.equal(meta(html, "property", "og:image"), `${site}og-image.png`);
  assert.equal(meta(html, "property", "og:image:width"), "1200");
  assert.equal(meta(html, "property", "og:image:height"), "630");
  assert.equal(meta(html, "name", "twitter:card"), "summary_large_image");
  assert.equal(meta(html, "name", "twitter:image"), `${site}og-image.png`);
  assert.match(html, /<link rel="manifest" href="\/site\.webmanifest" \/>/);
  assert.match(html, /<noscript>/);
  assert.match(html, /JavaScript is required to use the editor/);

  const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(jsonLd, "missing JSON-LD");
  const data = JSON.parse(jsonLd[1]) as {
    "@type": string;
    url: string;
    isAccessibleForFree: boolean;
    offers: { price: string };
  };
  assert.equal(data["@type"], "WebApplication");
  assert.equal(data.url, site);
  assert.equal(data.isAccessibleForFree, true);
  assert.equal(data.offers.price, "0");
});

test("public SEO assets are present at the expected sizes", () => {
  const robots = readFileSync(join(root, "public/robots.txt"), "utf8");
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/tinycut\.pages\.dev\/sitemap\.xml/);

  const sitemap = readFileSync(join(root, "public/sitemap.xml"), "utf8");
  assert.match(sitemap, /<loc>https:\/\/tinycut\.pages\.dev\/<\/loc>/);

  const manifest = JSON.parse(readFileSync(join(root, "public/site.webmanifest"), "utf8")) as {
    name: string;
    start_url: string;
  };
  assert.equal(manifest.name, "TinyCut");
  assert.equal(manifest.start_url, "/");

  assert.deepEqual(pngSize(join(root, "public/og-image.png")), { width: 1200, height: 630 });
  assert.deepEqual(pngSize(join(root, "public/favicon-32.png")), { width: 32, height: 32 });
  assert.deepEqual(pngSize(join(root, "public/apple-touch-icon.png")), { width: 180, height: 180 });
  assert.deepEqual(pngSize(join(root, "public/icon-192.png")), { width: 192, height: 192 });
  assert.deepEqual(pngSize(join(root, "public/icon-512.png")), { width: 512, height: 512 });
});

test("the editor toolbar exposes a visible TinyCut heading", () => {
  const toolbar = readFileSync(join(root, "src/lib/components/TopToolbar.svelte"), "utf8");
  assert.match(toolbar, /<h1 class="toolbar-brand">/);
  assert.match(toolbar, /<span>TinyCut<\/span>/);
});

test("page size is shown in the toolbar instead of over the canvas", () => {
  const toolbar = readFileSync(join(root, "src/lib/components/TopToolbar.svelte"), "utf8");
  const canvas = readFileSync(join(root, "src/lib/components/PageCanvas.svelte"), "utf8");
  assert.match(toolbar, /page-size-readout/);
  assert.match(toolbar, /formatDisplay\(doc\.page\.widthMm/);
  assert.doesNotMatch(canvas, /doc\.page\.name/);
  assert.doesNotMatch(canvas, /widthMm\.toFixed/);
});
