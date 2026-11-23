const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");
const sourceRoot = path.join(projectRoot, "public", "about-me");
const outputRoot = path.join(projectRoot, "..", "public", "public", "about-me");
const manifestPath = path.join(projectRoot, "public", "gallery-manifest.json");
const mediaPattern = /\.(jpg|jpeg|png|gif|webp|mp4|webm|ogv)$/i;

function readGalleryFiles(root) {
  const files = new Map();
  if (!fs.existsSync(root)) return files;

  for (const yearFolder of fs.readdirSync(root, { withFileTypes: true })) {
    if (!yearFolder.isDirectory() || !/^\d{4}$/.test(yearFolder.name)) continue;
    const yearPath = path.join(root, yearFolder.name);
    for (const file of fs.readdirSync(yearPath, { withFileTypes: true })) {
      if (!file.isFile() || !mediaPattern.test(file.name)) continue;
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
  if (!fs.existsSync(filePath)) return;
  fs.unlinkSync(filePath);
}

function copyGalleryFile(source, targetRoot, relativePath) {
  const targetPath = path.join(targetRoot, relativePath);
  if (source.path === targetPath) return;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(source.path, targetPath);
}

function readKnownGalleryFiles() {
  if (!fs.existsSync(manifestPath)) return new Set();
  const items = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(items)) throw new Error("The existing gallery manifest must contain an array.");
  return new Set(items.flatMap((item) => {
    if (!item || typeof item.year !== "string" || typeof item.src !== "string") return [];
    const fileName = item.src.split("/").pop();
    return fileName ? [`${item.year}/${fileName}`] : [];
  }));
}

function syncGalleryMedia() {
  const sourceFiles = readGalleryFiles(sourceRoot);
  const outputFiles = readGalleryFiles(outputRoot);
  const knownGalleryFiles = readKnownGalleryFiles();
  let changed = false;

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
