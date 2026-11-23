const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");
const galleryRoot = path.join(projectRoot, "public", "about-me");
const descriptionsPath = path.join(__dirname, "gallery-descriptions.js");
const mediaPattern = /^\d+\.\d{1,2}_\d{1,2}\.(jpg|jpeg|png|gif|webp|mp4|webm|ogv)$/i;
const datePattern = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4})\b/i;

function getMediaVersion(filePath) {
  const stats = fs.statSync(filePath);
  return `${stats.size}-${Math.trunc(stats.mtimeMs).toString(36)}`;
}

function formatGalleryDescriptions(descriptions) {
  return [
    "module.exports = {",
    ...Object.entries(descriptions).flatMap(([year, images], yearIndex) => [
      `  // ===== ${year} =====`,
      `  ${JSON.stringify(year)}: {`,
      ...Object.entries(images).flatMap(([fileName, description], imageIndex) => [
        `    // Media/file: public/about-me/${year}/${fileName}`,
        `    ${JSON.stringify(fileName)}: ${JSON.stringify(description)}${imageIndex < Object.keys(images).length - 1 ? "," : ""}`
      ]),
      `  }${yearIndex < Object.keys(descriptions).length - 1 ? "," : ""}`
    ]),
    "};",
    ""
  ].join("\n");
}

function readGalleryDescriptions() {
  const resolvedPath = require.resolve(descriptionsPath);
  delete require.cache[resolvedPath];
  return require(resolvedPath);
}

function saveGalleryCaption(input) {
  const { year, fileName, version } = input || {};
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";

  if (
    typeof year !== "string"
    || !/^\d{4}$/.test(year)
    || typeof fileName !== "string"
    || !mediaPattern.test(fileName)
    || typeof version !== "string"
  ) {
    const error = new Error("A valid year, gallery filename, and media version are required.");
    error.statusCode = 400;
    throw error;
  }
  if (
    !title
    || title.length > 80
    || !description
    || description.length > 300
    || (description.match(/[^.!?]+(?:[.!?]+|$)/g) || []).length > 2
    || datePattern.test(title)
    || datePattern.test(description)
  ) {
    const error = new Error("The caption must be specific, date-free, and no longer than two sentences.");
    error.statusCode = 400;
    throw error;
  }

  const mediaPath = path.resolve(galleryRoot, year, fileName);
  if (!mediaPath.startsWith(`${galleryRoot}${path.sep}`) || !fs.existsSync(mediaPath)) {
    const error = new Error("The gallery media file does not exist.");
    error.statusCode = 404;
    throw error;
  }
  if (getMediaVersion(mediaPath) !== version) {
    const error = new Error("The gallery media changed while its caption was being generated.");
    error.statusCode = 409;
    throw error;
  }

  const descriptions = readGalleryDescriptions();
  descriptions[year] = descriptions[year] || {};
  descriptions[year][fileName] = { title, description, mediaVersion: version };

  const temporaryPath = `${descriptionsPath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, formatGalleryDescriptions(descriptions), { flag: "wx" });
    fs.renameSync(temporaryPath, descriptionsPath);
  } catch (error) {
    try {
      fs.unlinkSync(temporaryPath);
    } catch (cleanupError) {
      if (cleanupError.code !== "ENOENT") throw cleanupError;
    }
    throw error;
  }

  return { year, fileName, version, title, description };
}

module.exports = { formatGalleryDescriptions, getMediaVersion, saveGalleryCaption };
