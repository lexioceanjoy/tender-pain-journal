# ADR 0008 — consent-gated local AI narrative

> Status update (Oct 2026): GitHub Pages deployment retired; Vercel is the only public site.

## Status

Accepted for Iteration B implementation and product review.

## Decision

- Keep rule-based Insights and exports available without AI.
- Run the OpenAI request through a local server so the API key never enters browser code or the GitHub Pages build.
- Send only entries in the date range currently shown in Insights, converted to patient-facing labels without private record IDs or creation metadata.
- Require an unchecked, request-specific consent control after explaining the fields sent, provider, retention caveat, and non-diagnostic purpose.
- Use the Responses API with `store: false`, a random privacy-preserving safety identifier, `gpt-5.6-sol`, and low reasoning effort.
- Keep the generated narrative in component memory only. Do not silently add it to the diary, backup, or report.

## Safety contract

The model may summarize recorded trajectory, repeated locations, sensations, and co-occurring context. It must not diagnose, triage, prescribe, recommend treatment, infer causation, or invent missing facts. Notes are untrusted data and cannot change the prompt contract.

## Deployment consequence

GitHub Pages continues to host the local-only app. The AI path works during local development and can later be deployed only behind a separately secured server endpoint with secrets, abuse controls, rate limits, and an explicit retention policy.
