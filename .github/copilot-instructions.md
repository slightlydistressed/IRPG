# IRPG Reader PWA — Copilot Instructions

## Project standard

This repository is an **offline-first, local-first, installable PDF reader PWA** built for **desktop, tablet, and phone** use.

The product standard is:

- polished, reader-first PDF experience
- strong usability on desktop and touch devices
- local persistence of user data with no required backend
- schema-driven forms and checklists tied to documents
- safe public deployment as a static site
- clear, maintainable TypeScript and React code

Unless the user explicitly asks otherwise, keep the product **static-site deployable, local-first, and installable as a PWA**.

## Technical baseline

Use and extend the existing stack:

- React 19
- TypeScript
- Vite
- current CSS/Tailwind approach already in the repo
- `react-pdf` / `pdfjs-dist` for PDF rendering
- browser storage only for persistence
- GitHub Pages deployment

Prefer existing project patterns for:

- shared state in `src/context/`
- reusable UI in `src/components/`
- shared hooks in `src/hooks/`
- utilities in `src/utils/`
- shared types in `src/types/`
- static assets and PWA files in `public/`

## Change strategy

Prefer **incremental, scoped changes** that fit the existing React/Vite/PWA structure.

- Reuse established patterns for context, persistence, and UI composition unless there is a clear reason to introduce a new pattern.
- Make the smallest change that solves the task cleanly.
- Avoid broad rewrites unless the task clearly requires one.
- Do not introduce a backend, account system, cloud sync, analytics, or server dependency unless explicitly requested.
- Keep code readable, typed, and easy to maintain.

## Product rules

### 1. Offline-first and local-first are core requirements

The app must continue to work as a static, installable PWA.

Do not break:

- service worker registration
- manifest-based installability
- static hosting
- bundled asset loading
- local persistence of reader state
- offline reopening of previously saved local data where supported

### 2. Document-scoped persistence is required

Persist reader data per document, not in a single global bucket.

Document-scoped data includes, as applicable:

- highlights
- bookmarks
- page position
- zoom
- forms/checklists values
- notes
- other lightweight reader state

Use browser storage appropriately:

- IndexedDB for larger binary data such as uploaded PDFs
- localStorage or other lightweight browser storage for document-scoped reader state

### 3. The bundled IRPG is a first-class document

The bundled IRPG PDF is a primary supported experience.

IRPG-specific features such as structured forms/checklists may exist for the bundled document. Those behaviors must not leak into unrelated uploaded PDFs.

For non-IRPG documents, prefer graceful fallback behavior over showing broken or irrelevant IRPG-specific UI.

## Forms and checklists standard

This project uses **schema-driven forms/checklists**, not generic PDF question extraction.

Prefer a hand-authored data file such as `src/data/forms.ts` or `src/data/irpgForms.ts`.

A form definition should include:

- `id`
- `title`
- `documentId`
- `page` or `relatedPage`
- optional `description`
- `sections`

A section should include:

- `id`
- `title`
- `fields`

A field should include at minimum:

- `id`
- `label`
- `type`

Supported field types should stay practical and mobile-friendly. Prefer:

- `text`
- `textarea`
- `checklist`
- `checkbox`
- `date`
- `time`
- `number`
- `richText` only where the extra complexity is justified

Store user-entered values separately from the schema.

### Device-assisted fields

Some form fields may optionally support device-assisted actions.

Supported actions may include:

- geolocation
- current date
- current time

If a field supports a device action:

- render a clear **Set** action
- autofill using browser APIs only when the user requests it
- keep manual editing available at all times
- fail gracefully if permission is denied or the API is unavailable
- keep the field simple and touch-friendly

Do not make location/date/time fields complex editors.

## PDF reader rules

The PDF reading experience is central to the product.

Preserve or improve:

- text-layer-based selection and highlighting
- bookmark behavior
- page navigation
- outline / table of contents navigation
- stable rendering across zoom levels
- touch, mouse, and pen usability
- scroll and jump-to-page behavior

When changing highlight behavior:

- keep stored highlight geometry stable
- keep behavior compatible with zoom changes
- preserve existing note/edit flows where applicable
- prefer incremental improvement over replacing the PDF engine

Do not replace `react-pdf` / `pdfjs-dist` unless explicitly requested.

## UI and design standard

The app should feel **polished, calm, and reader-first**.

Design goals:

- keep the PDF reading area central and comfortable
- make mobile layouts feel app-like, not like cramped desktop ports
- use a clean, modern, premium visual language
- improve consistency rather than inventing a new design system for each change

Styling guidance:

- prefer existing CSS variables, tokens, and utility patterns
- use consistent spacing, borders, radii, and elevation
- avoid one-off inline styles unless clearly necessary
- avoid random color additions; define or reuse a small consistent palette
- keep dark mode intentional and readable

## Accessibility standard

This is a public-facing reading tool. Accessibility is required.

- prefer semantic HTML first
- use ARIA only where needed
- provide accessible names for controls
- preserve visible focus states
- keep keyboard access working for interactive features
- ensure forms and actions remain usable on narrow screens
- do not rely on color alone to communicate meaning
- maintain adequate contrast in light and dark modes

## Performance standard

The app depends on heavy libraries such as PDF rendering and export tooling. Performance matters.

- keep initial load focused on the reader core
- lazy-load heavy, optional features where practical
- avoid unnecessary rerenders in reader-heavy components
- avoid large new dependencies unless the benefit is clear
- favor stable PDF behavior over risky optimization

## Security and privacy standard

This project is local-first and privacy-sensitive.

- do not add secrets to source control
- do not add analytics or telemetry by default
- treat geolocation and other browser permissions as optional
- explain permission-dependent behavior briefly and clearly in the UI when needed
- validate imported backup data before applying it
- keep export/import explicit and user-driven
- do not send user document contents to external services unless explicitly requested

## Public deployment standard

Code should remain compatible with static hosting and GitHub Pages.

- keep asset paths base-path safe
- avoid assumptions that only work at the domain root
- keep bundled assets working under subpath deployment
- keep the build reproducible in CI

## Documentation standard

When code changes alter behavior, also update the relevant documentation.

Examples include:

- `README.md`
- feature descriptions
- user-facing help text
- manifest/app metadata
- deployment instructions

Documentation should match the actual product behavior.

## Code quality standard

Write code that is self-explanatory and easy to review.

- use descriptive names
- keep components and helpers focused
- add comments only where they help explain non-obvious decisions
- prefer explicit types over unclear implicit behavior
- remove dead code when it is no longer part of the product direction
- keep exported utilities small and purposeful

If a task can be solved with a small, clean change, prefer that over cleverness.
