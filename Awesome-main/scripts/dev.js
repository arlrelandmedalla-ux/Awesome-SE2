const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const galleryRoot = path.join(root, "public", "about-me");
const outputGalleryRoot = path.join(root, "..", "public", "public", "about-me");
const generatorPath = path.join(__dirname, "generate-gallery-manifest.js");
const publisherPath = path.join(__dirname, "publish-gallery.js");
const syncGalleryMedia = require("./sync-gallery-media");
const mediaPattern = /\.(jpg|jpeg|png|gif|webp|mp4|webm|ogv)$/i;
const galleryFilePattern = /^\d+\.\d{1,2}_\d{1,2}(?:\.[^.]+)?$/i;
let blobConfigurationWarningShown = false;

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

function getGalleryRootSnapshot(directory) {
  const files = new Map();
  if (!fs.existsSync(directory)) return files;

  for (const yearFolder of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!yearFolder.isDirectory() || !/^\d{4}$/.test(yearFolder.name)) continue;

    const yearPath = path.join(directory, yearFolder.name);
    for (const file of fs.readdirSync(yearPath, { withFileTypes: true })) {
      if (!file.isFile() || (!mediaPattern.test(file.name) && !galleryFilePattern.test(file.name))) continue;
      const filePath = path.join(yearPath, file.name);
      const stats = fs.statSync(filePath);
      files.set(`${yearFolder.name}/${file.name}`, {
        size: stats.size,
        mtimeMs: stats.mtimeMs,
        ctimeMs: stats.ctimeMs
      });
    }
  }
  return files;
}

function getGallerySnapshot() {
  return {
    source: getGalleryRootSnapshot(galleryRoot),
    output: getGalleryRootSnapshot(outputGalleryRoot)
  };
}

function getGallerySnapshotSignature(snapshot) {
  return ["source", "output"].map((root) => [...snapshot[root].entries()]
    .map(([relativePath, stats]) =>
      `${relativePath}:${stats.size}:${stats.mtimeMs}:${stats.ctimeMs}`
    )
    .sort()
    .join("|")
  ).join("||");
}

function getGalleryChanges(previous, current) {
  const changes = [];
  for (const root of ["source", "output"]) {
    const previousFiles = previous[root];
    const currentFiles = current[root];
    const relativePaths = new Set([...previousFiles.keys(), ...currentFiles.keys()]);
    for (const relativePath of relativePaths) {
      const previousStats = previousFiles.get(relativePath);
      const currentStats = currentFiles.get(relativePath);
      if (!currentStats) {
        changes.push({ root, relativePath, action: "delete" });
      } else if (
        !previousStats
        || previousStats.size !== currentStats.size
        || previousStats.mtimeMs !== currentStats.mtimeMs
        || previousStats.ctimeMs !== currentStats.ctimeMs
      ) {
        changes.push({ root, relativePath, action: "upsert" });
      }
    }
  }
  return changes;
}

function regenerateGallery(changes) {
  try {
    syncGalleryMedia(changes ? { changes } : {});
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
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const publishResult = spawnSync(process.execPath, [publisherPath], { cwd: root, stdio: "inherit" });
    if (publishResult.error) {
      console.error("Could not start the live gallery publisher.", publishResult.error);
      return false;
    }
    if (publishResult.status !== 0) {
      console.error(`Live gallery publishing failed with exit code ${publishResult.status}.`);
      return false;
    }
  } else if (!blobConfigurationWarningShown) {
    console.warn("Live gallery sync is disabled. Set BLOB_READ_WRITE_TOKEN to publish gallery changes.");
    blobConfigurationWarningShown = true;
  }
  return true;
}

if (!regenerateGallery()) process.exit(1);

const server = spawn(process.execPath, [path.join(__dirname, "local-server.js")], {
  cwd: root,
  stdio: "inherit"
});

let lastSnapshot = getGallerySnapshot();
let lastSignature = getGallerySnapshotSignature(lastSnapshot);
let pendingSignature = null;
let debounceTimer = null;
const galleryChangeDebounceMs = 1500;

const scanTimer = setInterval(() => {
  const snapshot = getGallerySnapshot();
  const signature = getGallerySnapshotSignature(snapshot);
  if (signature === lastSignature) {
    clearTimeout(debounceTimer);
    pendingSignature = null;
    return;
  }
  if (signature === pendingSignature) return;

  pendingSignature = signature;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const latestSnapshot = getGallerySnapshot();
    const changes = getGalleryChanges(lastSnapshot, latestSnapshot);
    if (regenerateGallery(changes)) {
      lastSnapshot = getGallerySnapshot();
      lastSignature = getGallerySnapshotSignature(lastSnapshot);
    }
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

console.log("Watching public/about-me/<year>/ and ../public/public/about-me/<year>/ for gallery changes.");
