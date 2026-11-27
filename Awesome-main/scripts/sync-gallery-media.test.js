const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const syncGalleryMedia = require("./sync-gallery-media");

function createFixture(t, manifestItems = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gallery-media-sync-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const sourceRoot = path.join(root, "Awesome-main", "public", "about-me");
  const outputRoot = path.join(root, "public", "public", "about-me");
  const manifestPath = path.join(root, "Awesome-main", "public", "gallery-manifest.json");
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifestItems));

  return { sourceRoot, outputRoot, manifestPath };
}

function writeGalleryFile(root, year, fileName, contents = "image") {
  const yearPath = path.join(root, year);
  fs.mkdirSync(yearPath, { recursive: true });
  fs.writeFileSync(path.join(yearPath, fileName), contents);
}

test("preserves user files with unsupported names while synchronizing valid media", (t) => {
  const fixture = createFixture(t);
  const contents = "renamed image";
  writeGalleryFile(fixture.sourceRoot, "2026", "15.6_1.jpg", contents);
  writeGalleryFile(fixture.sourceRoot, "2026", "104093eed7ec0eda525caef08c75017c.jpg", contents);
  writeGalleryFile(fixture.outputRoot, "2026", "15.6_1.jpg", contents);
  writeGalleryFile(fixture.outputRoot, "2026", "104093eed7ec0eda525caef08c75017c.jpg", contents);

  syncGalleryMedia(fixture);

  assert.equal(
    fs.existsSync(path.join(fixture.sourceRoot, "2026", "104093eed7ec0eda525caef08c75017c.jpg")),
    true
  );
  assert.equal(
    fs.existsSync(path.join(fixture.outputRoot, "2026", "104093eed7ec0eda525caef08c75017c.jpg")),
    true
  );
  assert.equal(fs.existsSync(path.join(fixture.outputRoot, "2026", "15.6_1.jpg")), true);
});

test("syncs added media from any four-digit year folder in either gallery root", (t) => {
  const fixture = createFixture(t);
  writeGalleryFile(fixture.sourceRoot, "2025", "1.6_1.jpg", "source image");
  writeGalleryFile(fixture.outputRoot, "2027", "2.7_1.png", "output image");

  syncGalleryMedia({
    ...fixture,
    changes: [
      { root: "source", relativePath: "2025/1.6_1.jpg", action: "upsert" },
      { root: "output", relativePath: "2027/2.7_1.png", action: "upsert" }
    ]
  });

  assert.equal(fs.readFileSync(path.join(fixture.outputRoot, "2025", "1.6_1.jpg"), "utf8"), "source image");
  assert.equal(fs.readFileSync(path.join(fixture.sourceRoot, "2027", "2.7_1.png"), "utf8"), "output image");
});

test("syncs a rename made in the generated gallery folder without keeping the old copy", (t) => {
  const fixture = createFixture(t, [{ year: "2026", src: "/about-me/2026/1.6_1.jpg" }]);
  writeGalleryFile(fixture.sourceRoot, "2026", "1.6_1.jpg", "image");
  writeGalleryFile(fixture.outputRoot, "2026", "2.6_1.jpg", "image");

  syncGalleryMedia({
    ...fixture,
    changes: [
      { root: "output", relativePath: "2026/1.6_1.jpg", action: "delete" },
      { root: "output", relativePath: "2026/2.6_1.jpg", action: "upsert" }
    ]
  });

  assert.equal(fs.existsSync(path.join(fixture.sourceRoot, "2026", "1.6_1.jpg")), false);
  assert.equal(fs.existsSync(path.join(fixture.outputRoot, "2026", "1.6_1.jpg")), false);
  assert.equal(fs.existsSync(path.join(fixture.sourceRoot, "2026", "2.6_1.jpg")), true);
  assert.equal(fs.existsSync(path.join(fixture.outputRoot, "2026", "2.6_1.jpg")), true);
});

test("keeps a pasted file until it is renamed to a supported gallery filename", (t) => {
  const fixture = createFixture(t);
  const invalidPath = path.join(fixture.outputRoot, "2026", "16,7_1.jpg");
  const validPath = path.join(fixture.outputRoot, "2026", "16.7_1.jpg");
  writeGalleryFile(fixture.outputRoot, "2026", "16,7_1.jpg", "image");

  syncGalleryMedia({
    ...fixture,
    changes: [{ root: "output", relativePath: "2026/16,7_1.jpg", action: "upsert" }]
  });
  assert.equal(fs.existsSync(invalidPath), true);

  fs.renameSync(invalidPath, validPath);
  syncGalleryMedia({
    ...fixture,
    changes: [
      { root: "output", relativePath: "2026/16,7_1.jpg", action: "delete" },
      { root: "output", relativePath: "2026/16.7_1.jpg", action: "upsert" }
    ]
  });

  assert.equal(fs.existsSync(path.join(fixture.sourceRoot, "2026", "16.7_1.jpg")), true);
  assert.equal(fs.existsSync(validPath), true);
});

test("removes the previous valid filename when a source image is renamed", (t) => {
  const fixture = createFixture(t, [{ year: "2026", src: "/about-me/2026/1.6_1.jpg" }]);
  writeGalleryFile(fixture.sourceRoot, "2026", "2.6_1.jpg");
  writeGalleryFile(fixture.outputRoot, "2026", "1.6_1.jpg");

  syncGalleryMedia(fixture);

  assert.equal(fs.existsSync(path.join(fixture.sourceRoot, "2026", "1.6_1.jpg")), false);
  assert.equal(fs.existsSync(path.join(fixture.outputRoot, "2026", "1.6_1.jpg")), false);
  assert.equal(fs.existsSync(path.join(fixture.outputRoot, "2026", "2.6_1.jpg")), true);
});

test("does not restore a valid source image after deletion", (t) => {
  const fixture = createFixture(t, [{ year: "2026", src: "/about-me/2026/1.6_1.jpg" }]);
  writeGalleryFile(fixture.outputRoot, "2026", "1.6_1.jpg");

  syncGalleryMedia(fixture);

  assert.equal(fs.existsSync(path.join(fixture.sourceRoot, "2026", "1.6_1.jpg")), false);
  assert.equal(fs.existsSync(path.join(fixture.outputRoot, "2026", "1.6_1.jpg")), false);
});

test("propagates a deletion from the generated gallery folder after restarting", (t) => {
  const fixture = createFixture(t, [{ year: "2026", src: "/about-me/2026/1.6_1.jpg" }]);
  writeGalleryFile(fixture.sourceRoot, "2026", "1.6_1.jpg");
  fs.mkdirSync(path.join(fixture.outputRoot, "2026"), { recursive: true });

  syncGalleryMedia(fixture);

  assert.equal(fs.existsSync(path.join(fixture.sourceRoot, "2026", "1.6_1.jpg")), false);
  assert.equal(fs.existsSync(path.join(fixture.outputRoot, "2026", "1.6_1.jpg")), false);
});

test("propagates a rename from the generated gallery folder after restarting", (t) => {
  const fixture = createFixture(t, [{ year: "2026", src: "/about-me/2026/1.6_1.jpg" }]);
  writeGalleryFile(fixture.sourceRoot, "2026", "1.6_1.jpg", "old image");
  writeGalleryFile(fixture.outputRoot, "2026", "2.6_1.jpg", "renamed image");

  syncGalleryMedia(fixture);

  assert.equal(fs.existsSync(path.join(fixture.sourceRoot, "2026", "1.6_1.jpg")), false);
  assert.equal(fs.existsSync(path.join(fixture.outputRoot, "2026", "1.6_1.jpg")), false);
  assert.equal(fs.readFileSync(path.join(fixture.sourceRoot, "2026", "2.6_1.jpg"), "utf8"), "renamed image");
  assert.equal(fs.readFileSync(path.join(fixture.outputRoot, "2026", "2.6_1.jpg"), "utf8"), "renamed image");
});