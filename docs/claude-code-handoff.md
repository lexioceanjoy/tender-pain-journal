# Tender — Claude Code continuity brief

## Start here

This repository is the full source of truth for Tender, a personal, phone-first pain journal created as both a personal tool and a public portfolio project. Read, in this order:

1. `CLAUDE.md` — non-negotiable working rules.
2. `docs/product-brief.md` — user outcome and first-release scope.
3. `docs/ux-spec.md` and `docs/architecture.md` — intended interaction and technical structure.
4. `docs/data-model.md` and `docs/test-strategy.md` — data constraints and quality gates.
5. `docs/decisions/` — why key decisions were made.

## Repository and branch reality — 2026-10-15

| Item | State |
| --- | --- |
| Canonical local checkout | `/Users/lexi/projects/tender-pain-journal` |
| GitHub remote | `https://github.com/lexioceanjoy/tender-pain-journal.git` |
| Published/default branch | `main` at `578891a` (`Ship Iteration A fast check-in workflow`) |
| Public site (Iteration A) | GitHub Pages, local-first app only |
| AI prototype branch | `feat/iteration-b`, 12+ commits ahead of `main` |
| AI branch checkout | `/Users/lexi/projects/tender-pain-journal-iteration-b` |
| Public demo (Iteration B) | Vercel, passphrase-gated AI narrative — see `CLAUDE.md` rule 5's explicit exception |

`main` is stable, published, and should not be overwritten. Iteration B is intentionally not merged into `main`. It now has a provider-adapter (OpenAI + Anthropic) and a Vercel demo deployment path, but the AI narrative still has not been reviewed with a real provider account — see "AI state and next decision" below.

## Product intent that should survive future work

- The person often cannot reproduce their typical pain during an appointment. Tender helps capture a clear, factual trajectory while it is fresh, then helps them bring that information to a clinician.
- A core check-in is location + deliberately confirmed intensity. It should take under 30 seconds; repeating a familiar pattern should take about 10 seconds.
- Activities/interventions, sensation, sleep, stress, mood, cycle, medication, and notes are useful context but optional. Interventions are often exercises or movements, not only medication.
- The desired visual voice is warm and optimistic but not overly cute or derivative: the selected direction is **Lilac & Fig**. The name is **Tender**.
- The user specifically needs precise, visual pain selection: distinct front/back orientation; full/upper/lower zoom; neck and shoulders; feet; side-of-upper-leg surfaces; and detailed lower-back / SI-joint / sacrum / hip / glute / upper-hamstring choices. No freehand drawing in this release.
- When areas differ, Tender supports optional per-area intensity and sensation without making the default check-in slow.
- The fixed task paths are Today, History, Insights, and More. This replaced a long all-in-one scroll because frequent use needs a lighter mental load.
- The safety note is compact and expandable. It should advise appropriate care without pretending Tender can assess or exhaustively list emergencies.

## What is built

### Iteration A — released on `main`

- PWA shell and phone-first navigation.
- Fast check-in and Repeat Last.
- 74-region attributed CHOIR body map with front/back and zoom, plus Tender’s detail surface map.
- Local IndexedDB journal, history editing/deletion, range insights, plain-text appointment summary, JSON export/import, and backup reminder.
- Optional context fields and medications.
- Rules-based observations that state co-occurrence, not causation.

### Iteration B — on `feat/iteration-b`, now also a Vercel demo

- Optional AI appointment narrative in Insights.
- Explicit request-specific consent with a provider/privacy notice (copy intentionally states Tender's own behavior, not a paraphrase of the provider's retention terms — see ADR 0009).
- Only selected date-range entries leave the device; IDs, record metadata, and the API key do not.
- A real provider adapter interface (`server/providers/`) with both an OpenAI and an Anthropic implementation (ADR 0009); `TENDER_AI_PROVIDER` picks one, read once at server startup, never from request input.
- Two runtimes share the same handler logic (`server/app.ts`, deliberately extracted from port-binding so it's unit-testable):
  - Local dev: a Node server on `127.0.0.1:8787`, started by `npm run dev:ai`; Vite proxies `/api` only during local development.
  - Public demo: Vercel serverless functions (`api/ai-summary.ts`, `api/ai-provider-info.ts`), thin wrappers around the same `server/app.ts` logic, reading `process.env` instead of `.env.local`.
- The public demo additionally gates `api/ai-summary.ts` behind an `X-Tender-Demo-Passphrase` header checked against `TENDER_DEMO_PASSPHRASE` (Vercel env var, server-side only, never in the client bundle or git). Local dev never checks this header. When it's absent/wrong, or the provider call fails for any other reason, the panel shows a clearly labeled pre-written sample narrative instead of a raw error — never silence, never a stack trace.
- The public demo seeds a handful of sample check-ins on first visit (empty IndexedDB + no prior decision recorded) so a visitor sees a populated body map and Insights immediately; a "Clear sample data" control on Today removes exactly those seeded entries and remembers that choice, so they never silently reappear.
- `store: false`, payload-size/schema validation, random safety identifier, and instructions that forbid diagnosis, triage, treatment, causal claims, and following instructions contained in diary notes.
- Result stays only in component memory, can be cleared/revoked, and is not included in diary records, backups, or reports.
- Clear UI message for missing API key, billing/credits, authorization, model, and generic provider failures — now unified with the demo-passphrase failure path into the same labeled-sample fallback.

## AI state and next decision

The provider-adapter migration described in the previous version of this doc is **done** (ADR 0009, Accepted): both OpenAI and Anthropic adapters exist behind `server/providers/`, each with its own env vars, consent/retention copy, minimized payload, and the ADR 0008 non-diagnostic contract.

**What's still outstanding:** no representative diary payload has been sent to a real Anthropic (or OpenAI) account yet, and no narrative-quality review has happened. `CLAUDE.md` rule 5 still blocks merging to `main` or running the AI narrative ungated for the general public until that happens.

The Vercel public demo is a deliberate, narrower exception to that rule (approved 2026-10-15): it's safe to deploy *before* the real-key review specifically because live generation is passphrase-gated to whoever holds `TENDER_DEMO_PASSPHRASE` — an anonymous visitor only ever sees the labeled sample narrative, never a real model call. Removing or widening that gate, or merging to `main`, still requires the real-key test and quality approval first.

When that review does happen: use synthetic or non-emergency entries, inspect the output as a clinician-facing factual summary, and obtain product-owner approval before merge or before loosening the demo gate.

## Constraints and non-goals

- No diagnosis, triage, treatment recommendation, condition prediction, or causal claims.
- No mandatory optional fields, no account system, no cloud sync, no user analytics, and no ads in the first release.
- GitHub Pages must remain local-only: it cannot safely host server keys.
- A public portfolio app is not evidence of clinical validation. Keep CHOIR attribution and its caveat.
- Do not use a `--force` upgrade or destructive Git operation to solve routine dependency or branch problems.

## How to resume safely

1. Open the Iteration B worktree shown above, not a disposable blank folder.
2. Run `git status --branch`, then `npm install` and `npm run check` before modifications.
3. For visual or flow changes, run `npm run test:e2e` and inspect the phone viewport manually.
4. Make commits on a feature branch. Review and merge deliberately into `main`; verify branch, commit, remote, and deployed GitHub Pages build before claiming publication.
5. Never include `.env.local`, browser IndexedDB, downloaded backups, or actual health entries in commits, issues, or screenshots.

## Important files

| Concern | Files |
| --- | --- |
| Core app composition | `src/app/`, `src/features/` |
| Body-map source and attribution | `src/features/body-map/`, `vendor/choir-body-map/`, `THIRD_PARTY_NOTICES.md` |
| Local data model | `src/shared/data/painEntry.ts`, `docs/data-model.md` |
| Insights and reports | `src/features/insights/` |
| Optional AI narrative, provider adapters | `src/features/ai-summary/`, `server/`, `.env.example`, `docs/decisions/0008-consent-gated-ai-narrative.md`, `docs/decisions/0009-anthropic-provider-adapter.md` |
| Vercel demo deploy, passphrase gate | `api/`, `vercel.json`, `src/features/ai-summary/demoAccess.ts`, `src/features/ai-summary/sampleNarrative.ts` |
| Demo seed data | `src/shared/data/demoData.ts`, `src/features/today/TodayScreen.tsx` |
| Automated tests | `src/**/*.test.ts*`, `tests/e2e/` |
| Hosting | `.github/workflows/`, `vite.config.ts`, `vercel.json` |

## Suggested first Claude Code task

Review the project without changing code. Confirm the branch state, run the full checks, read ADR 0008, and propose a minimal Anthropic-provider migration plan that preserves the consent, privacy, and safety contract. Wait for approval before implementing the provider change.
