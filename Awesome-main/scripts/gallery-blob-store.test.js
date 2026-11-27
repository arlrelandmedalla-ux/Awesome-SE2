const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { after, test } = require("node:test");
const blob = require("@vercel/blob");

let listResult = { blobs: [] };
const putCalls = [];
const originalList = blob.list;
const originalPut = blob.put;
const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
const originalVercel = process.env.VERCEL;
const originalFetch = global.fetch;

blob.list = async () => listResult;
blob.put = async (pathname, body, options) => {
  putCalls.push({ pathname, body, options });
  return { url: `https://gallery-test.blob.vercel-storage.com/${pathname}` };
};

const galleryBlobStore = require("./gallery-blob-store");

after(() => {
  blob.list = originalList;
  blob.put = originalPut;
  global.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
});

test("publishes new media before its live manifest", async () => {
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  delete process.env.VERCEL;
  listResult = { blobs: [] };
  putCalls.length = 0;

  const manifestPath = path.join(__dirname, "..", "public", "gallery-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const item = manifest.find((entry) => entry.src.endsWith("/16.11_4.jpg"));
  assert.ok(item);

  const published = await galleryBlobStore.publishGalleryManifest([item]);

  assert.equal(putCalls.length, 2);
  assert.match(putCalls[0].pathname, /^gallery\/media\/2026\/16\.11_4-/);
  assert.equal(putCalls[0].options.token, "test-token");
  assert.equal(putCalls[1].pathname, "gallery/manifest.json");
  assert.equal(published[0].fileName, "16.11_4.jpg");
  assert.equal(published[0].src, `https://gallery-test.blob.vercel-storage.com/${putCalls[0].pathname}`);
});

test("reuses an unchanged media URL on later syncs", async () => {
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  delete process.env.VERCEL;
  putCalls.length = 0;
  const manifestPath = path.join(__dirname, "..", "public", "gallery-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const item = manifest.find((entry) => entry.src.endsWith("/16.11_4.jpg"));
  const previousItem = { ...item, fileName: "16.11_4.jpg", src: "https://gallery-test.example/previous.jpg" };
  listResult = {
    blobs: [{
      pathname: "gallery/manifest.json",
      url: "https://gallery-test.blob.vercel-storage.com/gallery/manifest.json",
      uploadedAt: new Date("2026-11-24T00:00:00.000Z")
    }]
  };
  global.fetch = async () => ({ ok: true, json: async () => [previousItem] });

  const published = await galleryBlobStore.publishGalleryManifest([item]);

  assert.equal(putCalls.length, 1);
  assert.equal(putCalls[0].pathname, "gallery/manifest.json");
  assert.equal(published[0].src, previousItem.src);
});

test("serves the generated local manifest outside Vercel", async () => {
  delete process.env.VERCEL;
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";

  const manifest = await galleryBlobStore.readGalleryManifest();

  assert.ok(Array.isArray(manifest));
  assert.ok(manifest.length > 0);
  assert.ok(manifest.some((item) => item.src.endsWith("/16.11_4.jpg")));
});

test("loads the live manifest from Blob on Vercel", async () => {
  const liveManifest = [{ year: "2026", fileName: "1.1_20.jpg", src: "https://gallery-test.example/image.jpg" }];
  process.env.VERCEL = "1";
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  listResult = {
    blobs: [{
      pathname: "gallery/manifest.json",
      url: "https://gallery-test.blob.vercel-storage.com/gallery/manifest.json",
      uploadedAt: new Date("2026-11-24T00:00:00.000Z")
    }]
  };
  global.fetch = async (url, options) => {
    assert.match(String(url), /updated=/);
    assert.equal(options.cache, "no-store");
    return { ok: true, json: async () => liveManifest };
  };

  assert.deepEqual(await galleryBlobStore.readGalleryManifest(), liveManifest);
});
