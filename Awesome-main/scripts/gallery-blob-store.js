const fs = require("node:fs");
const path = require("node:path");
const { list, put } = require("@vercel/blob");

const projectRoot = path.join(__dirname, "..");
const galleryRoot = path.join(projectRoot, "public", "about-me");
const localManifestPath = path.join(projectRoot, "public", "gallery-manifest.json");
const manifestBlobPath = "gallery/manifest.json";
const mediaPattern = /^\d+\.\d{1,2}_\d{1,2}\.(jpg|jpeg|png|gif|webp|mp4|webm|ogv)$/i;
const mediaTypes = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".ogv": "video/ogg",
  ".png": "image/png",
  ".webm": "video/webm",
  ".webp": "image/webp"
};

function getToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Set BLOB_READ_WRITE_TOKEN to enable live gallery sync.");
  return token;
}

function getFileName(item) {
  const match = typeof item?.src === "string"
    ? item.src.match(/^\/about-me\/(\d{4})\/([^/]+)$/)
    : null;
  if (!match || match[1] !== item.year || !mediaPattern.test(match[2])) {
    throw new Error(`Invalid source path in gallery manifest: ${item?.src}`);
  }
  return match[2];
}

async function readBlobGalleryManifest() {
  const token = getToken();
  const { blobs } = await list({ prefix: manifestBlobPath, limit: 10, token });
  const manifestBlob = blobs.find((blob) => blob.pathname === manifestBlobPath);
  if (!manifestBlob) return null;

  const url = new URL(manifestBlob.url);
  const uploadedAt = new Date(manifestBlob.uploadedAt).getTime();
  if (Number.isFinite(uploadedAt)) url.searchParams.set("updated", String(uploadedAt));
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not read the published gallery manifest (HTTP ${response.status}).`);
  }
  const manifest = await response.json();
  if (!Array.isArray(manifest)) throw new Error("The published gallery manifest must contain an array.");
  return manifest;
}

async function readGalleryManifest() {
  if (process.env.VERCEL) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error("BLOB_READ_WRITE_TOKEN is not configured in Vercel.");
    }
    return readBlobGalleryManifest();
  }
  if (!fs.existsSync(localManifestPath)) return null;

  const manifest = JSON.parse(fs.readFileSync(localManifestPath, "utf8"));
  if (!Array.isArray(manifest)) throw new Error("The local gallery manifest must contain an array.");
  return manifest;
}

async function publishGalleryManifest(manifest) {
  if (!Array.isArray(manifest)) throw new Error("The local gallery manifest must contain an array.");
  const token = getToken();
  const previousManifest = await readBlobGalleryManifest();
  const previousByFile = new Map((previousManifest || [])
    .filter((item) => item && typeof item.year === "string" && typeof item.fileName === "string")
    .map((item) => [`${item.year}/${item.fileName}`, item]));
  const publishedManifest = [];

  for (const item of manifest) {
    const fileName = getFileName(item);
    const filePath = path.resolve(galleryRoot, item.year, fileName);
    if (!filePath.startsWith(`${galleryRoot}${path.sep}`) || !fs.existsSync(filePath)) {
      throw new Error(`Gallery media file does not exist: ${item.year}/${fileName}`);
    }

    const stats = fs.statSync(filePath);
    const version = `${stats.size}-${Math.trunc(stats.mtimeMs).toString(36)}`;
    if (item.version !== version) {
      throw new Error(`Gallery media changed while it was being published: ${item.year}/${fileName}`);
    }

    const previousItem = previousByFile.get(`${item.year}/${fileName}`);
    if (previousItem?.version === version && typeof previousItem.src === "string") {
      publishedManifest.push({ ...item, fileName, src: previousItem.src });
      continue;
    }

    const extension = path.extname(fileName).toLowerCase();
    const versionedFileName = `${fileName.slice(0, -extension.length)}-${version}${extension}`;
    const blob = await put(
      `gallery/media/${item.year}/${versionedFileName}`,
      fs.readFileSync(filePath),
      {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: mediaTypes[extension],
        multipart: stats.size >= 5 * 1024 * 1024,
        token
      }
    );
    publishedManifest.push({ ...item, fileName, src: blob.url });
  }

  await put(manifestBlobPath, JSON.stringify(publishedManifest), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json",
    token
  });

  return publishedManifest;
}

module.exports = { publishGalleryManifest, readGalleryManifest };
