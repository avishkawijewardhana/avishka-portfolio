# Avishka portfolio

The public portfolio remains a static HTML, CSS and JavaScript site. No build or database is needed for hosting.

## Edit your portfolio

1. Install Node.js 22 or newer.
2. Open a terminal in this project and run `npm run admin` (no dependency installation needed).
3. Open **http://127.0.0.1:4173/admin/** and keep the terminal running.
4. Edit your content, use **Preview draft**, then choose **Save to project**.
5. Review, commit and push the changed files using your normal Git workflow.

The dashboard manages home/about/contact text, images, links, page title and search description, navigation and footer, rotating roles, contact details, and skill/education/project entries. Entries can be added, edited, removed and reordered. Projects include technologies, gallery images, GitHub and demo links. New entries inherit the existing visual style; replace their sample content before saving.

Uploads support PNG, JPG, WebP, GIF and PDF up to 10 MB. Copy the uploaded path into an image/gallery/link field. Uploads save immediately to `assets/uploads/`; content saves to `index.html`. Unused uploads can be removed manually after verifying that nothing references them.

For skill icons, paste a complete `<svg>...</svg>` into **SVG icon code**, click **Apply SVG icon**, check the icon preview, then **Save to project**. Existing SVG code is available for editing. Static SVG paths, shapes, gradients and clipping are supported; scripts, styles and external references are rejected. Use `fill` and `stroke` attributes for colors. You can also replace an icon with text or an emoji.

## Publish updates

Commit **and push** to the branch your current hosting provider deploys. A local commit alone does not update a hosted site. For example, after reviewing `git diff`:

```powershell
git add index.html script.js admin package.json README.md .gitignore assets
git commit -m "Update portfolio content"
git push origin main
```

The repository currently uses `main`. Your existing host must be configured to deploy that branch and serve the repository root. This change does not alter hosting settings or introduce a build step. If automatic deployment is not enabled, enable it in your existing host's settings. GitHub Pages can serve the root of `main`; other static hosts can use the repository root as the publish directory.

## Local admin access

The editor runs only on your computer at `127.0.0.1`. It is not a hosted login panel. It rejects outside origins, checks a session token for writes, and prevents stale tabs from overwriting newer changes. On static hosting, `/admin/` cannot save files and displays local startup instructions. No passwords or Git credentials are stored in the website. Use Git to review or restore saved content. Reloading discards unsaved form changes.

## Verify

Run `npm test` to check file persistence, stale revision handling, upload paths and local API access protections.
