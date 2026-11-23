const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const galleryRoot = path.join(root, "public", "about-me");
const outputGalleryRoot = path.join(root, "..", "public", "public", "about-me");
const generatorPath = path.join(__dirname, "generate-gallery-manifest.js");
const syncGalleryMedia = require("./sync-gallery-media");
const mediaPattern = /\.(jpg|jpeg|png|gif|webp|mp4|webm|ogv)$/i;
const galleryFilePattern = /^\d+\.\d{1,2}_\d{1,2}(?:\.[^.]+)?$/i;

const envFile = [path.join(root, ".env"), path.join(root, "..", ".env")]
  .find((filePath) => fs.existsSync(filePath));
if (envFile) {
  if (typeof process.loadEnvFile !== "function") {
    console.error("Loading .env files requires Node.js 20.12 or newer.");
    process.exit(1);
  }
  try {
    process.loadEnvFile(envFile);
    console.log(`Loaded local environment from ${path.relative(root, envFile)}.`);
  } catch (error) {
    console.error(`Could not load ${path.relative(root, envFile)}.`, error);
    process.exit(1);
  }
}

function getGalleryRootSignature(directory) {
  if (!fs.existsSync(directory)) return "";

  const entries = [];
  for (const yearFolder of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!yearFolder.isDirectory() || !/^\d{4}$/.test(yearFolder.name)) continue;

    const yearPath = path.join(directory, yearFolder.name);
    entries.push(`${yearFolder.name}/`);
    for (const file of fs.readdirSync(yearPath, { withFileTypes: true })) {
      if (!file.isFile() || (!mediaPattern.test(file.name) && !galleryFilePattern.test(file.name))) continue;
      const filePath = path.join(yearPath, file.name);
      const stats = fs.statSync(filePath);
      entries.push(`${yearFolder.name}/${file.name}:${stats.size}:${stats.mtimeMs}:${stats.ctimeMs}`);
    }
  }
  return entries.sort().join("|");
}

function getGallerySignature() {
  return `${getGalleryRootSignature(galleryRoot)}||${getGalleryRootSignature(outputGalleryRoot)}`;
}

function regenerateGallery() {
  try {
    syncGalleryMedia();
  } catch (error) {
    console.error("Could not synchronize gallery media.", error);
    return false;
  }
  const result = spawnSync(process.execPath, [generatorPath], { cwd: root, stdio: "inherit" });
  if (result.error) {
    console.error("Could not rebuild the gallery.", result.error);
    return false;
  }
  if (result.status !== 0) {
    console.error(`Gallery build failed with exit code ${result.status}.`);
    return false;
  }
  return true;
}

if (!regenerateGallery()) process.exit(1);

const server = spawn(process.execPath, [path.join(__dirname, "local-server.js")], {
  cwd: root,
  stdio: "inherit"
});

let lastSignature = getGallerySignature();
let pendingSignature = null;
let debounceTimer = null;
const galleryChangeDebounceMs = 1500;

const scanTimer = setInterval(() => {
  const signature = getGallerySignature();
  if (signature === lastSignature) {
    clearTimeout(debounceTimer);
    pendingSignature = null;
    return;
  }
  if (signature === pendingSignature) return;

  pendingSignature = signature;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (regenerateGallery()) lastSignature = getGallerySignature();
    pendingSignature = null;
  }, galleryChangeDebounceMs);
}, 750);

function stop(signal) {
  clearInterval(scanTimer);
  clearTimeout(debounceTimer);
  if (!server.killed) server.kill(signal);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
server.on("error", (error) => {
  clearInterval(scanTimer);
  console.error("Could not start the local development server.", error);
  process.exitCode = 1;
});
server.on("exit", (code, signal) => {
  clearInterval(scanTimer);
  clearTimeout(debounceTimer);
  if (signal) {
    process.exitCode = 1;
  } else {
    process.exitCode = code || 0;
  }
});

console.log("Watching public/about-me/<year>/ for added, renamed, or updated images and videos.");
