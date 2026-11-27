# About Us Gallery Guide

## Folder location

Add gallery media to:

`public/about-me/<YEAR>/`

Examples:

```text
public/about-me/2024/
public/about-me/2025/
public/about-me/2026/
```

From the repository root, add, rename, or delete gallery files in either `Awesome-main/public/about-me/<YEAR>/` or `public/public/about-me/<YEAR>/`. While `npm run dev` is running, the watcher mirrors changes between both folders for every four-digit year. Use the required filename format; unsupported names are kept on disk but ignored by the gallery.

The gallery is generated from valid media files, not from manually edited entries in `index.html` or `gallery-manifest.json`. If a file listed in the existing manifest is missing from either folder when the dev server starts, it is treated as deleted or renamed and removed from both copies.

## Adding a new year

1. Create a four-digit folder under `public/about-me/`, for example `public/about-me/2027/`.
2. Add image or video files inside that folder using the required filename format.
3. Keep `npm run dev` running from the repository root. The local watcher updates the local gallery automatically when a valid image is added or renamed in either year-folder tree.
4. Commit and push the source image and generated gallery files to the deployment branch (`main`). The Vercel production build regenerates the manifest and, when `BLOB_READ_WRITE_TOKEN` is configured, publishes it so the live gallery updates. Include `scripts/gallery-descriptions.js` if its captions changed.
5. After pushing, wait for the Vercel deployment to finish. A Git push only uploads committed changes; uncommitted local files will not appear on the published website.
6. Without `BLOB_READ_WRITE_TOKEN`, the deployed static manifest is updated but live Blob syncing is disabled. Never commit `.env` or a Blob token.

The folder name must match `YYYY`, such as `2027`.

## Supported formats

- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Videos: `.mp4`, `.webm`, `.ogv`

Use `.jpg` or `.webp` for photographs. Use `.png` for transparency or crisp graphics. Avoid extremely large files because they slow down the gallery.

## Required filename format

Use:

```text
<imageNumber>.<month>_<day>.<extension>
```

Examples:

```text
1.1_20.jpg
2.1_19.mp4
7.4_1.jpg
```

- `imageNumber`: sorting or display order
- `month`: month number from `1` to `12`
- `day`: day number from `1` to `31`
- `extension`: supported file format

The year comes from the folder name. For example, `public/about-me/2026/1.1_20.jpg` becomes January 20, 2026.
Keep the image's actual extension in its filename: `6.6_1.jpg` is valid, while `6.6_1` is not recognized as gallery media. Windows may hide known extensions; in File Explorer, turn on **View > Show > File name extensions** to check the full name.

Use a unique `imageNumber` for each file unless an image and video belong to the same entry.

New media without a custom caption is captioned automatically on the local site: images use their visible content, and videos use sampled frames. The caption is stored in the shared descriptions file rather than browser storage, so desktop and mobile display the same saved text. The AI caption does not include the date shown separately below the media. This requires `GEMINI_API_KEY`; if caption generation fails, the generic gallery caption remains until a later local retry succeeds.

## Changing a caption

Edit the exact filename entry in:

`scripts/gallery-descriptions.js`

```js
"2026": {
  "1.1_20.jpg": {
    "title": "Floral Design",
    "description": "A delicate floral illustration adds a calm, personal touch to a deep blue background."
  }
}
```

After saving:

1. Run `npm run build`.
2. The build updates `public/gallery-manifest.json` and the gallery items in `index.html`.
3. Commit and push the updated description and generated gallery files to `main` for the published website to use the new caption.

Keep titles concise and descriptions factual. A description of 24 words or fewer is recommended. Do not include the media date in the description because the gallery displays it separately.

## Renaming, removing, or replacing a file

1. Remove or replace the file under `public/about-me/<YEAR>/`, or rename it to a valid filename.
2. The gallery manifest includes only existing media with the required filename format. While `npm run dev` is running, the watcher mirrors changes between both gallery folders and updates the local manifest. The production build regenerates and publishes the manifest, so removed or invalidly named media no longer appears after deployment.

## Testing locally

From `Awesome-main`, run:

```bash
npm run build
npm run dev
```

Confirm the year folder, file date, title, and description on the local website.
