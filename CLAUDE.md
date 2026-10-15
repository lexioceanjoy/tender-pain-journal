# Tender — Claude Code guide

Read `docs/claude-code-handoff.md` before changing code. It records the product decisions, current delivery status, and safety boundaries that are not obvious from the UI alone.

## Working agreement

- This is a phone-first, local-first pain journal. A basic check-in must remain usable in under 30 seconds; optional details must never be mandatory or in the critical path.
- Do not turn Tender into a diagnostic, triage, treatment-recommendation, advertising, or analytics product.
- Preserve the task-based navigation: Today, History, Insights, More. Do not collapse the experience back into one long screen.
- Preserve the visual, touchable body-map approach. Do not replace it with anatomy names or text-only selectors. Keep the detailed SI / hip / glute surface locations.
- Local diary data stays in IndexedDB by default. Do not add accounts, cloud sync, tracking, or network requests with health entries without an explicit product decision.
- Do not expose API keys in browser code, commit `.env.local`, log diary payloads, or silently send health data to an AI provider.
- The AI narrative is optional. Rules-based Insights and appointment export must remain fully usable without AI.
- When changing the AI provider or payload, update the consent notice, provider-specific privacy wording, server validation, tests, and the relevant ADR together.

## Engineering workflow

1. Read the relevant product and decision documents under `docs/` before changing a feature.
2. Keep changes narrow and make tests cover user-important behavior.
3. Run `npm run check` for every implementation change. Run `npm run test:e2e` for interaction/navigation changes.
4. Review the check-in and Insights flows at a phone-sized viewport; touch targets, readable hierarchy, empty states, and error states matter.
5. Do not merge `feat/iteration-b` into `main`, or let the AI narrative run ungated for the general public, until the local AI path has been tested with a real provider key and the narrative quality is approved.
   - **Explicit, product-owner-approved exception (2026-10-15):** a passphrase-gated public demo deployment (Vercel) is allowed before that review, specifically because the passphrase (`TENDER_DEMO_PASSPHRASE`, server-side only) keeps live AI generation to whoever holds it — everyone else sees a clearly labeled, pre-written sample instead. The rest of the app (check-in, body map, Insights, export, backup) is not gated and was always fine to show publicly. Removing or widening the passphrase gate still requires the real-key review first.

## Commands

```bash
npm install
npm run dev              # local-only Tender
npm run dev:ai           # local Tender plus optional AI server; requires .env.local
npm run check            # unit/component tests plus production build
npm run test:e2e         # desktop and mobile Playwright journeys
```

## Secrets

Copy `.env.example` to `.env.local`; never share, commit, or print that file. The implementation supports OpenAI and Anthropic behind a shared `server/providers/` adapter interface (`TENDER_AI_PROVIDER` selects one, read once at server startup — never from request input), and is intended for local testing. The only public deployment is the Vercel demo at https://tender-pain-journal.vercel.app (see below). Adding another provider means writing a new adapter against that interface, not a one-off API call.

For the Vercel public demo, `server/app.ts`'s request-handling logic is reused as-is by thin wrappers in `api/ai-summary.ts` and `api/ai-provider-info.ts` (Vercel serverless functions reading `process.env` instead of `.env.local`). `api/ai-summary.ts` additionally checks an `X-Tender-Demo-Passphrase` header against `TENDER_DEMO_PASSPHRASE` — a Vercel-only env var, never read by local dev's Express entry point. Both the provider API keys and the demo passphrase are set directly in the Vercel dashboard, never in a committed file.

