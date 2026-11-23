const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");
const sourceRoot = path.join(projectRoot, "public", "about-me");
const outputRoot = path.join(projectRoot, "..", "public", "public", "about-me");
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
      const relativePath = path.join(yearFolder.name, file.name);
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

function syncGalleryMedia() {
  const sourceFiles = readGalleryFiles(sourceRoot);
  const outputFiles = readGalleryFiles(outputRoot);
  let changed = false;

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
