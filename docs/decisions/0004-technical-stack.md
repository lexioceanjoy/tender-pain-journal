# ADR 0004: TypeScript React PWA with local-first data

## Decision

Build Tender as a TypeScript React progressive web app using Vite. Use IndexedDB through Dexie for on-device records, Zod for validation at storage/import boundaries, Vitest for unit/component tests, and Playwright for end-to-end tests at phone and desktop viewport sizes.

## Why this stack

- **React + TypeScript:** clear component boundaries and safer refactoring as the body map and data model grow.
- **Vite:** fast local feedback and a simple static deployment path.
- **PWA:** can be installed to a phone home screen without building two native apps first.
- **IndexedDB + Dexie:** robust local storage for structured, growing records.
- **Zod:** rejects malformed imports instead of silently accepting broken health records.
- **Vitest + Playwright:** fast feedback for behaviour plus real-browser checks for touch-oriented flows.

## Consequences

The project needs an initial dependency installation and a future small secure server only when opt-in AI summaries are introduced. The first release itself remains a static, local-only app.
