# IRPG PDF Reader

An interactive PDF reader built with React, TypeScript, and Vite. Load any PDF document and annotate it with highlights, bookmarks, and Q&A pairs — all stored locally in your browser.

## Features

- **PDF Rendering** — Smooth page-by-page rendering powered by [react-pdf](https://github.com/wojtekmaj/react-pdf) and PDF.js
- **Text Highlighting** — Select any text and highlight it in five colours; add notes to each highlight
- **Bookmarks** — Bookmark any page for quick navigation
- **Table of Contents** — Automatically extracted from the PDF outline
- **Q&A Section** — Questions are auto-extracted from the document; write answers and export as a Word (.docx) file or send by email
- **Dark & Light Mode** — Toggle between themes; preference is remembered
- **Offline Support** — Progressive Web App with a service worker so the reader works without a network connection
- **Keyboard Shortcuts** — Navigate pages with Arrow keys or Page Up / Page Down

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/slightlydistressed/IRPG.git
cd IRPG

# Install dependencies
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

1. **Open a PDF** — Click the folder icon in the header to upload any PDF file, or the bundled `irpg.pdf` loads automatically on first launch.
2. **Highlight text** — Select any text on a page; a floating toolbar appears where you can pick a colour and confirm the highlight.
3. **Add notes** — Open the **Highlights** tab in the sidebar to add or edit notes attached to each highlight.
4. **Bookmarks** — Click the bookmark icon in the header to bookmark the current page. Manage bookmarks from the **Table of Contents** tab.
5. **Q&A** — Open the **Q&A** tab to see questions extracted from the document. Write answers in the text fields, then export to Word or email.
6. **Navigate** — Use the toolbar arrows, click the page counter to jump to a specific page, or use keyboard shortcuts (← → Page Up Page Down).
7. **Zoom** — Use the ± buttons in the toolbar or reset zoom with the reset button.

## Project Structure

```
src/
├── components/       # UI components (Header, Sidebar, PDFViewer, …)
├── context/          # React Context for global app state
├── hooks/            # Custom React hooks
├── types/            # TypeScript interfaces and constants
└── utils/            # Export utilities (Word, email)
public/
├── irpg.pdf          # Default bundled PDF
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
