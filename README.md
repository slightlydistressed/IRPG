# IRPG PDF Reader

An offline-first, installable PDF reader PWA built with React, TypeScript, and Vite. Load any PDF document and annotate it with highlights, bookmarks, and structured forms/checklists — all stored locally in your browser, no account or internet connection required.

## Features

- **PDF Rendering** — Smooth page-by-page rendering powered by [react-pdf](https://github.com/wojtekmaj/react-pdf) and PDF.js
- **Text Highlighting** — Select any text and highlight it in five colours; add notes to each highlight
- **Bookmarks** — Bookmark any page for quick navigation
- **Table of Contents** — Automatically extracted from the PDF outline
- **Forms & Checklists** — Schema-driven forms tied to the IRPG document; supports device-assisted fields (current date, time, and optional geolocation — all optional and stored locally)
- **Export** — Export your session (forms, highlights, bookmarks) as a Word (.docx) file or copy it to the clipboard
- **Backup & Restore** — Download a per-document JSON backup and reimport it at any time
- **Dark & Light Mode** — Toggle between themes; preference is remembered
- **Offline / PWA** — Progressive Web App with a service worker; works without a network connection after the first load. Installable on desktop and mobile.
- **Keyboard Shortcuts** — Navigate pages with Arrow keys or Page Up / Page Down

## Privacy & data storage

All data — highlights, bookmarks, form values, page position, zoom — is stored **only in your browser** (localStorage for reader state, IndexedDB for uploaded PDFs). Nothing is sent to any server. Uploaded PDFs and annotations stay on your device unless you explicitly export or back them up.

Device-assisted form fields (location, date, time) are **optional**. You can always type values manually. If location is requested, your browser will ask for permission first, and the result is only written to the form field — it is never transmitted anywhere.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm (comes with Node.js)

### Installation

```bash
git clone https://github.com/slightlydistressed/IRPG.git
cd IRPG
npm install
```

### Development

```bash
npm run dev
```

Opens the app at `http://localhost:5173` with hot module replacement enabled.

### Production Build

```bash
npm run build
```

Outputs an optimised static bundle to the `dist/` directory. Deploy the contents of `dist/` to any static hosting service (Vercel, Netlify, GitHub Pages, AWS S3, etc.).

> **Note:** The service worker requires HTTPS in production. Most static hosting providers enable HTTPS by default.

### Preview the Production Build Locally

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Usage

1. **Open a PDF** — On the home screen, tap **Open** next to the built-in IRPG, reopen a previously saved upload, or tap **Open a PDF from your device** to upload any PDF.
2. **Highlight text** — Select any text on a page; a floating toolbar appears where you can pick a colour and confirm the highlight.
3. **Add notes** — Open the **Highlights** tab in the sidebar to add or edit notes attached to each highlight.
4. **Bookmarks** — Click the bookmark icon in the header to bookmark the current page. Manage bookmarks from the **Table of Contents** tab.
5. **Forms & Checklists** — Open the **Forms** tab in the sidebar to fill in structured checklists linked to the IRPG document. Device-assisted fields (location, date, time) are optional; tap **Set** to auto-fill or type manually.
6. **Export** — In the Forms tab, click the export icon to download a `.docx` file or copy your session to the clipboard.
7. **Backup & Restore** — In the reader header, use the download icon to save a JSON backup of your highlights, bookmarks, and form values; use the folder icon to restore a backup.
8. **Navigate** — Use the toolbar arrows, click the page counter to jump to a specific page, or use keyboard shortcuts (← → Page Up Page Down).
9. **Zoom** — Use the ± buttons in the toolbar or reset zoom with the reset button.

## Project Structure

```
src/
├── components/       # UI components (Header, Sidebar, PDFViewer, …)
├── context/          # React Context for global app state
├── data/             # Form/checklist schema definitions
├── hooks/            # Custom React hooks
├── types/            # TypeScript interfaces and constants
└── utils/            # Export, backup, and storage utilities
public/
├── irpg.pdf          # Default bundled PDF
├── manifest.json     # PWA manifest
└── sw.js             # Service worker for offline support
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS v4 |
| PDF rendering | react-pdf / PDF.js |
| Word export | docx + file-saver |
| Icons | lucide-react |

## Deployment (GitHub Pages)

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically lints, builds, and deploys the app to GitHub Pages on every push to `main`.

### 1. Enable GitHub Pages

1. Go to **Settings → Pages** in this repository.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Save. The first deployment will run automatically on the next push to `main`, or you can trigger it manually from the **Actions** tab.

Your site will be available at:
```
https://slightlydistressed.github.io/IRPG/
```

### 2. Add a Custom Domain

If you want the site to be served from your own domain (e.g. `irpg.yourdomain.com`):

#### Step 1 — Create the CNAME file

Add a file called `public/CNAME` containing only your domain name (no `https://`, no trailing slash):

```
irpg.yourdomain.com
```

Committing this file ensures GitHub never loses the domain setting between deployments.

#### Step 2 — Configure DNS

Log in to your domain registrar and add a DNS record pointing to GitHub Pages:

| Record type | Host / Name | Value |
|-------------|-------------|-------|
| `CNAME` | `irpg` (subdomain) | `slightlydistressed.github.io` |

> For an **apex domain** (e.g. `yourdomain.com` with no subdomain) use four `A` records pointing to GitHub's IP addresses instead: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.

DNS changes can take a few minutes to a few hours to propagate.

#### Step 3 — Update the workflow base path

Open `.github/workflows/deploy.yml` and change the `VITE_BASE_URL` environment variable from `/IRPG/` to `/`:

```yaml
env:
  VITE_BASE_URL: /
```

This tells Vite to build assets relative to the domain root rather than the `/IRPG/` sub-path.

#### Step 4 — Confirm in GitHub Settings

1. Go to **Settings → Pages → Custom domain** and enter your domain.
2. Tick **Enforce HTTPS** once GitHub has provisioned a TLS certificate (usually within a few minutes of DNS propagating).

## License

This project is private. All rights reserved.
