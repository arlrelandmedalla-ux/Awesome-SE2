const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");
const defaultSourceRoot = path.join(projectRoot, "public", "about-me");
const defaultOutputRoot = path.join(projectRoot, "..", "public", "public", "about-me");
const defaultManifestPath = path.join(projectRoot, "public", "gallery-manifest.json");
const mediaPattern = /\.(jpg|jpeg|png|gif|webp|mp4|webm|ogv)$/i;
const galleryFilePattern = /^(\d+)\.(\d{1,2})_(\d{1,2})\.(jpg|jpeg|png|gif|webp|mp4|webm|ogv)$/i;

function isValidGalleryFile(year, fileName) {
  const match = fileName.match(galleryFilePattern);
  if (!match) return false;

  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(Number(year), month - 1, day));
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function readGalleryFiles(root) {
  const files = new Map();
  if (!fs.existsSync(root)) return files;

  for (const yearFolder of fs.readdirSync(root, { withFileTypes: true })) {
    if (!yearFolder.isDirectory() || !/^\d{4}$/.test(yearFolder.name)) continue;
    const yearPath = path.join(root, yearFolder.name);
    for (const file of fs.readdirSync(yearPath, { withFileTypes: true })) {
      if (!file.isFile() || !mediaPattern.test(file.name) || !isValidGalleryFile(yearFolder.name, file.name)) continue;
      const filePath = path.join(yearPath, file.name);
      const stats = fs.statSync(filePath);
      const relativePath = `${yearFolder.name}/${file.name}`;
      files.set(relativePath, {
        root,
        path: filePath,
        relativePath,
        size: stats.size,
        mtimeMs: stats.mtimeMs,
        ctimeMs: stats.ctimeMs
      });
    }
  }
  return files;
}

function removeGalleryFile(root, relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

function copyGalleryFile(source, targetRoot, relativePath) {
  const targetPath = path.join(targetRoot, relativePath);
  if (source.path === targetPath) return;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(source.path, targetPath);
}

function syncGalleryChanges(sourceRoot, outputRoot, changes) {
  const changesByPath = new Map();
  for (const change of changes) {
    if (
      !change
      || (change.root !== "source" && change.root !== "output")
      || typeof change.relativePath !== "string"
      || (change.action !== "upsert" && change.action !== "delete")
    ) {
      throw new Error("Gallery changes must specify a root, relative path, and upsert or delete action.");
    }

    const previousChange = changesByPath.get(change.relativePath);
    if (!previousChange || change.root === "source") {
      changesByPath.set(change.relativePath, change);
    }
  }

  let changed = false;
  for (const change of changesByPath.values()) {
    const relativePathMatch = change.relativePath.match(/^(\d{4})\/([^/\\]+)$/);
    if (!relativePathMatch) {
      throw new Error(`Invalid gallery path: ${change.relativePath}`);
    }

    const [, year, fileName] = relativePathMatch;
    const sourcePath = path.join(sourceRoot, change.relativePath);
    const outputPath = path.join(outputRoot, change.relativePath);
    const targetRoot = change.root === "source" ? outputRoot : sourceRoot;

    if (change.action === "delete") {
      changed = removeGalleryFile(targetRoot, change.relativePath) || changed;
      continue;
    }

    const originRoot = change.root === "source" ? sourceRoot : outputRoot;
    const originPath = path.join(originRoot, change.relativePath);
    if (!fs.existsSync(originPath) || !fs.statSync(originPath).isFile()) continue;
    if (!isValidGalleryFile(year, fileName)) {
      console.warn(
        `Ignoring gallery filename "${change.relativePath}". `
        + "Use imageNumber.month_day with a supported extension, such as 1.6_1.jpg."
      );
      continue;
    }

    const filePath = change.root === "source" ? sourcePath : outputPath;
    copyGalleryFile({ path: filePath }, targetRoot, change.relativePath);
    changed = true;
  }

  return changed;
}

function readKnownGalleryFiles(manifestPath) {
  if (!fs.existsSync(manifestPath)) return new Set();
  const items = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(items)) throw new Error("The existing gallery manifest must contain an array.");
  return new Set(items.flatMap((item) => {
    if (
      !item
      || typeof item.year !== "string"
      || !/^\d{4}$/.test(item.year)
      || typeof item.src !== "string"
    ) return [];
    const fileName = item.src.split("/").pop();
    return fileName && isValidGalleryFile(item.year, fileName) ? [`${item.year}/${fileName}`] : [];
  }));
}

function syncGalleryMedia(options = {}) {
  const sourceRoot = options.sourceRoot || defaultSourceRoot;
  const outputRoot = options.outputRoot || defaultOutputRoot;
  const manifestPath = options.manifestPath || defaultManifestPath;
  if (Array.isArray(options.changes)) {
    return syncGalleryChanges(sourceRoot, outputRoot, options.changes);
  }

  const sourceFiles = readGalleryFiles(sourceRoot);
  const outputFiles = readGalleryFiles(outputRoot);
  const knownGalleryFiles = readKnownGalleryFiles(manifestPath);
  let changed = false;

  if (fs.existsSync(sourceRoot) && fs.existsSync(outputRoot)) {
    for (const relativePath of knownGalleryFiles) {
      const existsInSource = sourceFiles.has(relativePath);
      const existsInOutput = outputFiles.has(relativePath);
      if (existsInSource === existsInOutput) continue;

      const existingRoot = existsInSource ? sourceRoot : outputRoot;
      changed = removeGalleryFile(existingRoot, relativePath) || changed;
      (existsInSource ? sourceFiles : outputFiles).delete(relativePath);
    }
  }

  for (const [relativePath, outputFile] of outputFiles) {
    if (sourceFiles.has(relativePath) || knownGalleryFiles.has(relativePath)) continue;
    copyGalleryFile(outputFile, sourceRoot, relativePath);
    const sourcePath = path.join(sourceRoot, relativePath);
    const stats = fs.statSync(sourcePath);
    sourceFiles.set(relativePath, {
      ...outputFile,
      root: sourceRoot,
      path: sourcePath,
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      ctimeMs: stats.ctimeMs
    });
    changed = true;
  }

  for (const [relativePath, sourceFile] of sourceFiles) {
    const outputFile = outputFiles.get(relativePath);
    if (outputFile && sourceFile.size === outputFile.size && sourceFile.mtimeMs === outputFile.mtimeMs) continue;
    copyGalleryFile(sourceFile, outputRoot, relativePath);
    changed = true;
  }

  for (const relativePath of outputFiles.keys()) {
    if (sourceFiles.has(relativePath)) continue;
    removeGalleryFile(outputRoot, relativePath);
    changed = true;
  }

  return changed;
}

module.exports = syncGalleryMedia;
