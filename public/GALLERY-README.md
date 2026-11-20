# About Us Gallery Guide

The gallery is maintained from:

`Awesome-main/public/about-me/<YEAR>/`

Do not edit `public/public/about-me/` manually. It is the generated deployed copy.

## Add media

1. Create or use a four-digit year folder, such as `Awesome-main/public/about-me/2027/`.
2. Name each file using:

```text
<imageNumber>.<month>_<day>.<extension>
```

For example, `1.2_15.jpg` means February 15 of the year represented by the folder.

Supported formats:

- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Videos: `.mp4`, `.webm`, `.ogv`

## Add a year

1. Create `Awesome-main/public/about-me/2027/`.
2. Add the validly named media files.
3. Run `npm run build`.
4. Commit the source media, captions, manifest, and updated HTML.

## Change a caption

Edit `Awesome-main/scripts/gallery-descriptions.js` and match the year and exact filename:

```js
"2027": {
  "1.2_15.jpg": {
    "title": "Short Caption",
    "description": "A clear factual description of the image."
  }
}
```

Keep titles concise and descriptions factual. Then run `npm run build`.
