const fs = require("node:fs");
const path = require("node:path");
const { publishGalleryManifest } = require("./gallery-blob-store");

const manifestPath = path.join(__dirname, "..", "public", "gallery-manifest.json");

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const publishedManifest = await publishGalleryManifest(manifest);
  console.log(`Published ${publishedManifest.length} gallery item(s) to Vercel Blob.`);
}

main().catch((error) => {
  console.error("Could not publish the gallery to Vercel Blob.", error);
  process.exitCode = 1;
});
