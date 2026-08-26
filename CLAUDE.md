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
5. Do not merge `feat/iteration-b` into `main` or deploy it until the local AI path has been tested with a real provider key and the narrative quality is approved.

## Commands

```bash
npm install
npm run dev              # local-only Tender
npm run dev:ai           # local Tender plus optional AI server; requires .env.local
npm run check            # unit/component tests plus production build
npm run test:e2e         # desktop and mobile Playwright journeys
```

## Secrets

Copy `.env.example` to `.env.local`; never share, commit, or print that file. The current implementation is OpenAI-only and is intended for local testing, not GitHub Pages. A future provider abstraction should be introduced before adding Claude, Gemini, or another provider.

