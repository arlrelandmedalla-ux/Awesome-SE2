# Awesome Accounting Services — Website

This repository contains a simple company profile website and a serverless contact API ready to deploy to Vercel.

What I changed / added:
- Converted the site to a static `index.html` (fast and compatible with Vercel static hosting).
- Added `api/contact.js` — a Vercel serverless function that sends contact form submissions via SendGrid.
- Added `package.json` with `@sendgrid/mail` dependency so Vercel installs it.
- Added a placeholder logo in `public/header-logo.svg` and a `README` with deployment instructions.

Why static + serverless (short):
- Vercel does not natively run PHP pages. For free deploys and simplicity we keep the site static and use a serverless API for dynamic parts (contact form). If you prefer a PHP runtime, you can use a community builder but the path above is simpler for Vercel.

Setup & Deploy (Vercel)
1. Create a Vercel account and connect your repository.
2. Add the following Environment Variables in Vercel Dashboard -> Project -> Settings -> Environment Variables:
   - `SENDGRID_API_KEY` (required if you want email sending via SendGrid)
   - `TO_EMAIL` (where contact emails should be delivered, default: `aweclient@gmail.com`)
   - `FROM_EMAIL` (optional; recommended a verified sender in SendGrid)
   - `GEMINI_API_KEY` (required for the Voice AI assistant; keep this server-side and never expose it in browser code)
   - `GEMINI_MODEL` (optional; defaults to `gemini-3.8-flash`)
   - `GEMINI_TRANSLATION_MODEL` (optional; defaults to the same model as `GEMINI_MODEL` so translation uses the same project access)
   - `BLOB_READ_WRITE_TOKEN` (optional; only for Blob live sync, not needed when publishing gallery changes through Git)
3. Push to your repository and Vercel will build and deploy automatically.

Local development
- From the downloaded `Awesome-main` folder, install dependencies with `npm install --prefix Awesome-main` and start the local site with `npm run dev`.
- You can also run `npm install` and `npm run dev` from the inner project folder that contains `index.html`.
- The dev script loads `.env` from the project folder or its parent, then serves the site and API locally; no Vercel CLI login is required.
- Set `GEMINI_API_KEY` in your local environment before starting the server to enable `/api/assistant` and gallery captions.
- Set `SENDGRID_API_KEY` to enable local contact-form delivery. Without it, the contact API returns a configuration error.
- Set `BLOB_READ_WRITE_TOKEN` in the local `.env` file only if enabling optional Blob live sync. Never commit this token.
- Set `PORT` to use a port other than `3000`.
- From the repository root, Vercel can use the root `npm run build` command and `public` as its Output Directory. The root build stages the site files and gallery media, and root `api/` wrappers expose the same serverless handlers. Alternatively, set Vercel's Root Directory to this inner `Awesome-main` folder, use `npm run build`, and leave Output Directory blank.

Voice AI
- The floating assistant supports six service tabs, typed questions, browser speech recognition, and browser speech synthesis in English and Tagalog.
- Selecting a service switches from the service picker to its detailed service overview, with per-answer speech and translation controls.
- Speech recognition depends on browser support and microphone permission. Browsers without Web Speech recognition can still use typed questions.
- Gemini detects whether each question is primarily English or Tagalog and replies in that language. Each assistant message has controls to read it aloud or translate it to the other language.
- The assistant answers common English and Tagalog/Taglish questions about service purpose, use, and importance from published website details; it does not guess unpublished prices or case-specific amounts.
- Gemini requests and translation are handled by `api/assistant.js`; the API key is read only from the server environment. Questions requiring case-specific review are directed to the contact form.
- Common service and gallery-year questions are answered immediately from published details. Other questions use Gemini with the curated company facts plus current page content, published gallery items, and contact links.
- For the repository-root setup shown in the deployment logs, use **Root Directory** `.` (the repository root), **Framework Preset** **Other**, **Build Command** `npm run build`, and **Output Directory** `public`. The root build generates this output directory and Vercel discovers the AI, gallery-caption, and contact functions from the root `api/` directory.
- If you instead set **Root Directory** to this inner `Awesome-main` folder, use **Build Command** `npm run build` and leave **Output Directory** blank. Do not mix the inner-folder settings with the repository-root build.

About Us media gallery
- Put images and videos in a four-digit year folder under the source folder `Awesome-main/public/about-me/` (for example, `Awesome-main/public/about-me/2026/`), not the generated root `public/public/about-me/` output folder.
- Name each file `imageNumber.month_day.extension`, using the year folder for the year (for example, `1.1_20.jpg` or `1.1_20.mp4`).
- Supported gallery formats are JPG, JPEG, PNG, GIF, WebP, MP4, WebM, and OGV. For browser compatibility, MP4 or WebM is recommended for videos.
- The gallery defaults to 2026. Add, rename, or delete media in either `Awesome-main/public/about-me/<YEAR>/` or `public/public/about-me/<YEAR>/` using the required filename format. While `npm run dev` is running from the repository root, the watcher mirrors changes between both folders for every four-digit year and updates the local gallery automatically. Files with an invalid name or date are kept on disk but ignored by the gallery. Other years remain available through the year selector. Items sort by year, month, and day. For media with the same date, images appear before videos; items of the same type follow the order they were added or renamed. The gallery initially shows three items; **Show more** expands the remaining rows and **Show less** collapses them again. Video cards have playback controls.
- Existing titles and descriptions are keyed by filename in `scripts/gallery-descriptions.js`. Add or edit an entry there to keep a custom description, then run `npm run build` to update the generated gallery data. New files get a date-based default description until a custom one is added.
- To make a gallery change visible on the published website, commit and push the source image, its generated copy, and the updated manifests/index files to `main`; include `scripts/gallery-descriptions.js` if captions changed. Vercel publishes the committed files after its deployment finishes. A Git push does not include uncommitted changes. This Git-push workflow does not require `BLOB_READ_WRITE_TOKEN`; never commit `.env` or a Blob token.

Alternatives (no API keys required)
- Use Formspree or Getform: replace the form `action` with the provider endpoint and you can receive messages without a server.

Security / Improvements to consider
- Add server-side rate limiting or CAPTCHA to prevent spam.
- Use a dedicated verified sender email (or a transactional email provider like SendGrid/Mailgun).
- Add TLS and SPF/DKIM for deliverability (handled by your email provider).

If you want, I can:
- Add reCAPTCHA integration and server-side rate limits
- Implement an SMTP-based (Nodemailer) handler instead of SendGrid
- Convert this back to PHP using a community PHP runtime (requires extra config)

---

If you'd like me to proceed with reCAPTCHA or a different email provider, tell me which and I will implement it next.
