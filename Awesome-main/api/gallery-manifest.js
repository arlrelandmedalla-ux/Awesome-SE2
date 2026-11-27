const { readGalleryManifest } = require("../scripts/gallery-blob-store");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const manifest = await readGalleryManifest();
    if (!manifest) {
      return res.status(404).json({ error: "The live gallery has not been published yet." });
    }

    res.setHeader(
      "Cache-Control",
      process.env.BLOB_READ_WRITE_TOKEN ? "public, s-maxage=3, stale-while-revalidate=5" : "no-store"
    );
    return res.status(200).json(manifest);
  } catch (error) {
    console.error("Could not load the live gallery manifest.", error);
    return res.status(503).json({ error: "The live gallery is not available." });
  }
};
