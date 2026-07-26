# Proposed architecture

## Recommendation

Use a TypeScript React application built with Vite and packaged as a progressive web app (PWA). It is a pragmatic fit for a phone-first app: one codebase, a familiar web deployment path, and a later "Add to Home Screen" experience without separately building iOS and Android apps.

## Boundaries

```text
Browser / installed PWA
├── Entry feature      record pain, body regions, and optional context
├── History feature    timeline, calendar, and filters
├── Insight feature    private calculations from local entries
├── Backup feature     export and import a portable backup file
├── AI feature          consent + explicit request preparation
└── Local data layer    IndexedDB database on this device

Future optional server
└── AI summary endpoint protects the provider API key and receives data only after consent
```

## Why local storage uses IndexedDB

`localStorage` is easy but fragile for growing, structured health records. IndexedDB is built into modern browsers, supports larger structured records, works offline, and lets the app evolve without a backend. A small data-access layer keeps the storage choice isolated, so a future encrypted sync service does not require rewriting every screen.

## Feature-first source layout

Each feature owns its display, behavior, and tests. That makes it easier to change or remove a feature without turning the project into a single large set of shared folders.

```text
src/
  app/                 application startup, routes, and providers
  features/
    entries/           recording and editing entries
    body-map/          SVG regions and selection behavior
    history/           entry detail, edit handoff, and timeline
    insights/          local observations
    reports/           clinician-facing, user-controlled exports
    backup/            export/import
    ai-summary/        consent and future server integration
  shared/              reusable UI, types, utilities, and data layer
  styles/              global design tokens and base styles
```

## Privacy boundary

The app makes no network request for health data in its local-only mode. An AI summary cannot safely call a provider directly from browser code because that would expose the secret API key. When we add that feature, it will use a small server endpoint, explicit consent, minimal selected data, and a clear deletion/retention policy.

## Record lifecycle

Creating and editing share one validated input shape. A create operation generates a private ID and creation timestamp. An edit keeps both, changes the update timestamp, and replaces the validated record through the same database boundary. Deletion also passes through that boundary and requires a separate confirmation in the interface.

Backup recency is intentionally separate from health records. Only the last successful download timestamp is stored in `localStorage`; entries remain in IndexedDB and the backup file is created locally in the browser.
