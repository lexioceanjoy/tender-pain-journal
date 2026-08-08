# Milestone 04 — Iteration B AI narrative

## Goal

Let a person turn a selected range of pain records into a concise appointment narrative without removing the private, rules-based path.

## Acceptance criteria

1. Rules-based Insights work when AI is declined, unavailable, or unconfigured.
2. No records leave the device before explicit consent and Generate.
3. The notice names the selected fields, OpenAI, retention caveat, and limits of the output.
4. The browser never receives the API key.
5. Only records in the visible date range are sent, without record IDs or creation metadata.
6. The server validates payload size and shape, requests no response storage, and gives notes no authority over instructions.
7. The result is visibly AI-written, reviewable, clearable, and not automatically saved or shared.
8. Automated tests cover payload minimisation, consent gating, request settings, and fallback behavior.

## Review gate

The feature remains on its Iteration B branch until a local request is tested with the product owner's API key and the narrative quality is reviewed on representative, non-emergency diary data.
