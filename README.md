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

## License

This project is private. All rights reserved.
