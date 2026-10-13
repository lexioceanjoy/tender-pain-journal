# Tender

Tender is a phone-first pain journal for recording pain locations and context over time, then preparing a careful, clinician-friendly summary. It is designed to be local-first: by default, entries remain on the person's device.

## Status

Tender is now a working local-first prototype. Product decisions and architecture live in [`docs/`](./docs/).

Implemented:

- phone-first installable web-app shell;
- task-based Today, History, Insights, and More navigation instead of one long scroll;
- a basic location-and-intensity check-in designed for under 30 seconds;
- Repeat Last for a familiar pain pattern without copying stale activity, medication, sleep, or notes;
- attributed 74-region CHOIR front/back body map with upper/lower focus and two source outlines;
- optional visual Tender detail map for SI-joint, sacrum, hip, glute, and upper-hamstring surface areas;
- pain intensity and optional sensation, activity, sleep, stress, mood, cycle, medication, and notes;
- optional per-area intensity and sensation when selected locations feel different;
- editable occurrence date and time for recording pain after it happened;
- IndexedDB storage that remains on the current device;
- detailed local history with edit and confirmed deletion;
- date-range observations;
- downloadable plain-text appointment summary with chronology and context;
- versioned JSON backup, merge-safe import, and an on-device backup recency reminder;
- expandable safety information.

Tender's map is based on the validated CHOIR Body Map model and retains its source attribution. This validates the location-reporting instrument, not Tender as a diagnostic or clinically validated product. See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

## Project map

- `docs/` — product requirements, architecture, recorded decisions, and test strategy
- `src/` — application code, grouped by feature rather than by technical file type
- `public/` — static, publicly served assets such as the app icon
- `tests/` — automated unit, integration, and end-to-end tests

## Intended development cycle

Each feature follows: define the user outcome → agree the interaction → write tests for the important behavior → implement a small vertical slice → test on phone-sized screens → review before expanding scope.

## Run locally

```bash
npm install
npm run dev
```

Run automated tests and a production build:

```bash
npm run check
```

## Run the optional local AI narrative

1. Copy `.env.example` to `.env.local`, set `TENDER_AI_PROVIDER` to `openai` or `anthropic`, and replace the matching placeholder with your own API key for that provider. Never commit `.env.local`.
2. Run `npm run dev:ai` instead of `npm run dev`.
3. Open Insights, choose a date range with at least one check-in, review the privacy notice, and explicitly consent before generating.

The normal `npm run dev` and GitHub Pages build remain local-only and do not expose an API key. The AI response is not automatically saved to the diary.

## Privacy boundary

Tender makes no network request with health entries in its current mode. Records are stored in the browser's IndexedDB database. The app records the last backup date only on the same device; it never uploads the backup. The user must download backups themselves, because uninstalling or clearing browser data can otherwise remove the journal.

The publicly hosted application serves the same local-first build through GitHub Pages. Public access exposes the app interface and source behavior, not one visitor's diary to another visitor or to a Tender account.
