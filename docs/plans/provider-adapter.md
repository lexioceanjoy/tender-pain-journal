# Provider-adapter design: Anthropic support for the optional AI narrative

Status: proposal, not implemented. No code has been changed to produce this
document. Nothing here should be built without product-owner approval per
`docs/claude-code-handoff.md` ("AI state and next decision") and
`CLAUDE.md`'s engineering workflow.

## Why

The current Iteration B prototype (`server/aiService.ts`, `server/index.ts`,
`src/features/ai-summary/`) talks to OpenAI's Responses API directly, with no
seam between "build the minimized payload," "call a model," and "turn a
provider failure into a safe message." The handoff doc is explicit that we
should not just swap SDK calls: we need a small provider interface first, an
Anthropic adapter behind it, and a kept-or-removed OpenAI adapter as an
explicit decision — with consent copy, retention wording, validation, tests,
and the ADR updated together (`CLAUDE.md`, "Secrets" and "When changing the
AI provider or payload...").

## Interface sketch

A provider is anything that can turn a validated, minimized payload into a
narrative string, plus the safety/consent metadata the UI needs to describe
it truthfully. This lives in a new `server/providers/` module.

```ts
// server/providers/types.ts
import { z } from 'zod';
import type { AiSummaryRequest } from '../../src/features/ai-summary/aiSummary';

export type ProviderName = 'openai' | 'anthropic';

export interface AiProviderConfig {
  apiKey: string;
  model: string;
}

// The server must never boot with an incomplete consent disclosure — a
// half-filled consent box (e.g. an empty retentionSummary) is worse than
// refusing to start. This schema is the startup-time gate for that floor:
// non-empty, and (for the URL) syntactically well-formed. It cannot and
// does not verify that either value is actually true — that privacyNoticeUrl
// really points at the provider's current data-use page, or that
// retentionSummary still matches the provider's current terms. A
// syntactically valid but stale or wrong URL passes `.url()` and boots
// fine. That gap is closed by a human pre-ship verification step (see Open
// questions), not by this schema.
export const providerConsentMetadataSchema = z.object({
  name: z.enum(['openai', 'anthropic']),
  /** Human-facing name for consent copy, e.g. "Anthropic". */
  displayName: z.string().min(1),
  /** Link to that provider's current API data-use/retention page. */
  privacyNoticeUrl: z.string().url(),
  /** One or two accurate sentences on retention/training use, provider-specific. */
  retentionSummary: z.string().min(1),
  /** Name of the required server-side env var, e.g. "ANTHROPIC_API_KEY". */
  apiKeyEnvVar: z.string().min(1)
});

export interface AiProvider extends z.infer<typeof providerConsentMetadataSchema> {
  createNarrative(
    payload: AiSummaryRequest,
    safetyId: string,
    config: AiProviderConfig
  ): Promise<string>;

  /** Map a provider-specific failure to a safe, actionable, non-leaking message. */
  safeError(error: unknown): string;
}
```

```ts
// server/providers/index.ts
import { providerConsentMetadataSchema, type AiProvider, type ProviderName } from './types';
import { openaiProvider } from './openaiProvider';
import { anthropicProvider } from './anthropicProvider';

const registry: Record<ProviderName, AiProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider
};

// Called once at server startup (before listen()). Throws — and the server
// refuses to boot — if any registered provider's consent metadata is
// incomplete. Never serves partial consent copy to a browser.
export function assertProviderRegistryIsConsentReady() {
  for (const provider of Object.values(registry)) {
    providerConsentMetadataSchema.parse(provider);
  }
}

// TENDER_AI_PROVIDER is read exactly once, here, at startup — never from
// request input (headers, query params, body). This is a security property,
// not just simplicity: a per-request provider selector would let a client
// influence where health data gets routed.
export function resolveProvider(name: string | undefined): AiProvider {
  if (name !== 'openai' && name !== 'anthropic') {
    throw new Error("TENDER_AI_PROVIDER must be set to 'openai' or 'anthropic'.");
  }
  return registry[name];
}
```

```ts
// server/providers/instructions.ts
// The non-diagnostic prompt contract (ADR 0008) is provider-agnostic and
// must not fork per provider. Extracted verbatim from the current
// server/aiService.ts so both adapters share one copy.
export const AI_SUMMARY_INSTRUCTIONS = `You write a concise clinician-facing narrative...`;
```

```ts
// server/providers/anthropicProvider.ts
import Anthropic from '@anthropic-ai/sdk';
import type { AiProvider } from './types';
import { AI_SUMMARY_INSTRUCTIONS } from './instructions';

// Identified by class, not by .message — a human-facing message is free to
// be reworded later without silently breaking the classification in
// safeError() below. See the anthropicProvider.test.ts bullet in Test plan
// for the regression test that pins this down.
export class AnthropicTruncatedResponseError extends Error {
  constructor() {
    super('The Anthropic response was truncated at the max_tokens ceiling.');
    this.name = 'AnthropicTruncatedResponseError';
  }
}

export const anthropicProvider: AiProvider = {
  name: 'anthropic',
  displayName: 'Anthropic',
  apiKeyEnvVar: 'ANTHROPIC_API_KEY',
  // Both of these are intentionally left empty, symmetrically.
  // providerConsentMetadataSchema only proves non-emptiness and (for the
  // URL) syntactic validity — it cannot prove either value is *true*: that
  // this is really Anthropic's current privacy/retention page, or that the
  // retention sentence still matches Anthropic's current terms. A
  // syntactically valid but wrong or stale URL would pass `.url()` and
  // silently boot. assertProviderRegistryIsConsentReady() blocks boot on
  // emptiness as a forcing function, but passing it is necessary, not
  // sufficient — see the explicit pre-ship verification step in Open
  // questions, which a human must still do by hand before this ships.
  privacyNoticeUrl: '',
  retentionSummary: '',

  async createNarrative(payload, safetyId, config) {
    const client = new Anthropic({ apiKey: config.apiKey });
    const response = await client.messages.create({
      model: config.model,
      // A ceiling, not a length control. Output length is governed by the
      // shared AI_SUMMARY_INSTRUCTIONS' "no more than 250 words" rule; 1024
      // gives headroom so a well-behaved response is never cut off. A
      // response that *does* exhaust this budget is rejected below, not
      // truncated and returned.
      max_tokens: 1024,
      system: AI_SUMMARY_INSTRUCTIONS,
      metadata: { user_id: safetyId }, // closest Anthropic equivalent to OpenAI's safety_identifier
      messages: [{
        role: 'user',
        content: `Date range: ${payload.from} to ${payload.to}\nDiary records (JSON):\n${JSON.stringify(payload.entries)}`
      }]
    });
    if (response.stop_reason === 'max_tokens') {
      // A clinician-facing narrative truncated mid-sentence is actively
      // misleading in a way no later fallback catches. Fail into safeError
      // (and the rule-based path) rather than hand someone half a summary.
      throw new AnthropicTruncatedResponseError();
    }
    const narrative = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
    if (!narrative) throw new Error('The AI service returned an empty summary.');
    return narrative;
  },

  safeError(error) {
    if (error instanceof AnthropicTruncatedResponseError) {
      return 'The AI narrative could not finish safely within its length limit and was discarded rather than shown incomplete.';
    }
    const failure = error as { status?: number; error?: { type?: string } };
    if (failure.status === 401 || failure.status === 403) {
      return 'Anthropic could not authorize this API key. Check the key and its permissions.';
    }
    if (failure.status === 429) {
      return 'Anthropic API quota or rate limit reached. Check billing and try again.';
    }
    if (failure.status === 404 || failure.error?.type === 'not_found_error') {
      return 'The configured Anthropic model is unavailable to this API account.';
    }
    return 'The AI narrative could not be generated.';
  }
};
```

`server/providers/openaiProvider.ts` is the existing `server/aiService.ts`
logic (the `responses.create` call, `store: false`, `safety_identifier`,
`reasoning`, and `safeAiError`) moved behind the same `AiProvider` shape, so
behavior for existing OpenAI users doesn't change.

`server/aiService.ts` becomes provider-agnostic orchestration:

```ts
// server/aiService.ts
import { aiSummaryRequestSchema } from '../src/features/ai-summary/aiSummary.js';
import type { AiProvider, AiProviderConfig } from './providers/types.js';

export async function createAiNarrative(
  provider: AiProvider,
  untrustedPayload: unknown,
  safetyIdentifier: string,
  config: AiProviderConfig
) {
  const payload = aiSummaryRequestSchema.parse(untrustedPayload); // unchanged validation, still provider-agnostic
  return provider.createNarrative(payload, safetyIdentifier, config);
}
```

`server/index.ts` calls `assertProviderRegistryIsConsentReady()` once before
`listen()` — an invalid or incomplete provider registry stops the server
from starting at all, rather than serving broken consent copy — then
resolves the active provider from `TENDER_AI_PROVIDER` (no default — see
Config/env surface), and adds one new read-only route so the browser can
render truthful, provider-specific consent copy without ever seeing the key:

```
GET /api/ai-provider-info
  -> {
       provider: 'anthropic',
       displayName: 'Anthropic',
       privacyNoticeUrl,
       retentionSummary,
       ready: true   // provider.apiKeyEnvVar is present in config loaded from
                      // .env.local — never the key itself. See the false-positive
                      // caveat in Config/env surface: this is not simply
                      // process.env[apiKeyEnvVar], because ambient shell exports
                      // can make that check pass even when .env.local has nothing.
     }
```

`ready` closes a gap in the original sketch: without it, a user could check
the consent box and press Generate only to learn afterward that the key was
never configured — i.e. consent would have been solicited for a request
that was always going to fail. With `ready`, the panel disables Generate
and explains why *before* consent is ever asked for. This route returns no
secrets and no health data; it exists purely so `AiNarrativePanel` stops
hardcoding "OpenAI" in its consent text and stops offering a request that
can't succeed.

## Files touched

All paths relative to the repo root. Nothing below is created or edited yet.

**New:**
- `server/providers/types.ts` — the `AiProvider` interface and `providerConsentMetadataSchema`.
- `server/providers/instructions.ts` — `AI_SUMMARY_INSTRUCTIONS`, extracted verbatim from current `server/aiService.ts`, shared by both adapters.
- `server/providers/openaiProvider.ts` — current OpenAI logic from `server/aiService.ts`, adapted to `AiProvider`.
- `server/providers/anthropicProvider.ts` — new Anthropic adapter (sketch above), including `AnthropicTruncatedResponseError` and the `max_tokens`/`stop_reason` guard that throws it.
- `server/providers/index.ts` — the provider registry, `assertProviderRegistryIsConsentReady()`, and `resolveProvider(name: string | undefined): AiProvider`.
- `src/features/ai-summary/providerInfo.ts` — client fetch of `/api/ai-provider-info`, with a safe, generic fallback (see Fallback behavior) if that call fails; fallback's `ready` defaults to `false`.
- `docs/decisions/0009-anthropic-provider-adapter.md` — ADR recording this decision, modeled on ADR 0008, and stating explicitly that consent given while one provider is active never carries over to a different provider.
- Tests: `server/providers/openaiProvider.test.ts`, `server/providers/anthropicProvider.test.ts`, `server/providers/index.test.ts` (registry consent-metadata validation), `src/features/ai-summary/providerInfo.test.ts` (see Test plan).

**Modified:**
- `server/aiService.ts` — becomes the thin provider-agnostic orchestration shown above; existing `aiSummaryRequestSchema` validation is unchanged.
- `server/index.ts` — calls `assertProviderRegistryIsConsentReady()` before `listen()`; provider resolution from `TENDER_AI_PROVIDER` read once at startup only (never from request input); new `GET /api/ai-provider-info` route including `ready`.
- `server/aiService.test.ts` — narrows to orchestration concerns only (schema validation, empty-narrative rejection); provider-specific assertions move to the new per-provider test files.
- `.env.example` — add `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `TENDER_AI_PROVIDER`; keep `OPENAI_API_KEY`, `OPENAI_MODEL`.
- `src/features/ai-summary/AiNarrativePanel.tsx` — replace the hardcoded "OpenAI" copy and OpenAI data-controls link with values from `providerInfo.ts`; disable the Generate action and show an explanatory message when `ready` is `false`, before consent is solicited; consent-gating logic itself (unchecked-by-default checkbox, request-specific, revoke/clear) is unchanged.
- `src/features/ai-summary/AiNarrativePanel.test.tsx` — assert the panel renders the fetched provider's name/link, renders safe fallback copy when the info fetch fails, and disables Generate with an explanation when `ready` is `false`.
- `package.json` — add `@anthropic-ai/sdk` dependency. This is an implementation-time change; it is **not** made by this planning task (no new dependencies were added to produce this document).
- `README.md:55` — "replace the placeholder with your own OpenAI API key" needs to become provider-neutral, pointing at `.env.example` and `TENDER_AI_PROVIDER`.
- `CLAUDE.md` ("Secrets" section) — "The current implementation is OpenAI-only" becomes inaccurate once this ships; update alongside the ADR per the working agreement's own rule.
- `docs/claude-code-handoff.md` ("AI state and next decision") — update once an adapter is actually implemented and tested with a real key, not as part of this planning document.

No changes to `src/shared/data/painEntry.ts`, `src/features/insights/`, `src/features/body-map/`, or any IndexedDB code — this stays scoped to the optional AI path per the working agreement.

## Config/env surface

| Variable | Scope | Required when | Notes |
| --- | --- | --- | --- |
| `TENDER_AI_PROVIDER` | server (`.env.local`) | always, to run `npm run dev:ai` | `'openai' \| 'anthropic'`. **No default.** Forces an explicit choice rather than silently picking one, matching the handoff doc's "do not simply swap" instruction. Read exactly once, at startup — **never** accepted from request headers, query params, or body. This is a locked-in security property, not just simplicity: a per-request provider selector would let a client influence where health data is routed. Unset or unknown value → `resolveProvider()` throws at startup; the process exits before `listen()` and logs a clear startup error naming the problem. It never silently guesses a provider, and — because the failure is at startup, not per-request — there is no partially-running server that could return a request-time 503 for this case (see Fallback behavior, case 2). |
| `ANTHROPIC_API_KEY` | server only | `TENDER_AI_PROVIDER=anthropic` | Never read by browser code; same handling as `OPENAI_API_KEY` today (presence-checked, value never logged or echoed). |
| `ANTHROPIC_MODEL` | server only | optional | Defaults to a pinned Claude model id (e.g. `claude-sonnet-5`) chosen at implementation time, mirroring `OPENAI_MODEL`'s default-to-`gpt-5.6-sol` pattern. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | server only | `TENDER_AI_PROVIDER=openai` | Unchanged from today. |
| `TENDER_AI_PORT` | server only | optional | Unchanged. |

`vite.config.ts`'s `/api` proxy to `127.0.0.1:8787` is unchanged — the new
`/api/ai-provider-info` route rides the same proxy, same as
`/api/ai-summary`. No browser-visible env vars (`VITE_*`) are introduced;
the provider name reaches the UI only via the server response, which keeps
provider selection single-sourced on the server instead of duplicated in
two places that could drift.

**All provider config — `TENDER_AI_PROVIDER`, both API keys, both model
vars — loads explicitly from `.env.local`**, the same way `npm run dev:ai`
already loads it today (`tsx watch --env-file-if-exists=.env.local
server/index.ts`). This matters for `ready` specifically: `ready` must
reflect whether the key was deliberately configured in `.env.local`, not
whether `process.env[provider.apiKeyEnvVar]` merely happens to be set.
**False-positive risk, demonstrated directly in this session:** Node's
`--env-file` loading does not override a variable already present in the
inherited shell environment — if a variable with the same name (e.g.
`ANTHROPIC_API_KEY`) is exported in the parent shell for an unrelated
reason, `process.env.ANTHROPIC_API_KEY` reads as present even when
`.env.local` defines nothing. A naive `ready` check that reads
`process.env[apiKeyEnvVar]` directly would report `ready: true` from that
stray export, falsely telling the user the provider is configured when
`.env.local` — the file the consent copy and this whole design assume is
authoritative — has nothing in it. The implementation needs to read
`.env.local`'s contents as the source of truth for `ready` (e.g. parsing
the file directly, or otherwise distinguishing "set by this file" from
"present in `process.env` for any reason") rather than trusting ambient
`process.env` presence; the exact mechanism is implementation-time work, not
decided here.

## Consent and payload-minimization path

Unchanged and provider-agnostic, by design:

- `src/features/ai-summary/aiSummary.ts` (`buildAiSummaryRequest`) already
  builds the minimized payload — human-readable region/precision-area
  labels instead of internal IDs, no record IDs, no creation metadata, only
  the fields ADR 0008 lists. This logic does not know or care which
  provider will receive it, so it needs no change.
- `aiSummaryRequestSchema` (server-side re-validation in `aiService.ts`)
  stays as the single minimization/shape enforcement point regardless of
  provider — both adapters receive the same validated `AiSummaryRequest`.
- What *does* change: `AiNarrativePanel.tsx`'s consent copy must name the
  actual active provider and link to *that* provider's current data-use
  page, not a hardcoded OpenAI one. It fetches `/api/ai-provider-info` once
  (e.g. on mount, before the consent checkbox is interactive) and renders
  `displayName`, `privacyNoticeUrl`, and `retentionSummary` from that
  response. If `ready` is `false`, the panel disables the Generate action
  and explains why (e.g. "the configured AI provider isn't available right
  now") *before* the consent checkbox is ever presented as actionable —
  consent should not be solicited for a request that cannot succeed. The
  consent checkbox itself stays unchecked-by-default and request-specific,
  and "what will leave this device" language is unchanged because the
  payload shape doesn't change per provider.
- **Consent is provider-scoped and never carries across a provider change.**
  Because consent is already unchecked-by-default and request-specific (one
  checkbox per Generate action, cleared on revoke), this falls out of the
  existing design rather than requiring new gating logic — but it must be
  stated as an explicit invariant in ADR 0009, not left implicit: if
  `TENDER_AI_PROVIDER` changes between two requests (e.g. during local
  testing of both adapters), the user re-reads and re-checks consent for
  the newly active provider every time, with no notion of a consent that
  "sticks" across providers.
- The non-diagnostic prompt contract (`AI_SUMMARY_INSTRUCTIONS`) is shared
  verbatim across adapters via `server/providers/instructions.ts` so the
  safety contract can't drift between providers by accident — this is the
  main risk the interface is designed to prevent.
- Anthropic's Messages API has no exact equivalent of OpenAI's
  `store: false`; the closest levers are: (a) not using any Anthropic
  feature that persists conversation state (no Files/Batches/Message
  Batches storage), (b) `metadata.user_id` as the closest analog to
  `safety_identifier` for abuse monitoring without sending real user
  identity (continue using the existing random `tenderSafetyId()` value).
  The exact current retention/training-use wording for the Claude API must
  be verified against Anthropic's live documentation before it goes into
  `retentionSummary` and the consent notice — this is called out under Open
  questions rather than asserted here.
- `providerConsentMetadataSchema.parse()` runs for every registered provider
  at server startup (`assertProviderRegistryIsConsentReady()`). An empty
  `retentionSummary` or `privacyNoticeUrl` — exactly the placeholder state
  the sketch ships with today, for both fields symmetrically — fails
  validation and the server refuses to boot. This is deliberate: the
  failure mode for incomplete consent copy should be "the local AI server
  won't start," not "the panel renders a disclosure with a blank where the
  retention sentence or privacy link should be." It's a presence/shape
  floor, not a truth check — see the pre-ship verification step in Open
  questions for what the schema can't catch (e.g. a syntactically valid but
  wrong or stale `privacyNoticeUrl`).

## Fallback behavior when the provider is unavailable or consent is absent

Layered, matching the existing pattern in `AiNarrativePanel.tsx` and
`server/index.ts`:

0. **Provider registry fails consent-metadata validation at boot:** the
   server process exits immediately, logging which provider and which field
   was empty/invalid. This is a developer/config-time failure, not something
   a browser session ever observes — `npm run dev:ai` simply doesn't come
   up. It takes priority over every case below because nothing else can be
   correct if consent copy is incomplete.
1. **No consent given:** unchanged — the "Generate narrative" action stays
   disabled until the checkbox is checked; nothing is sent. This is
   client-side gating already present.
2. **`TENDER_AI_PROVIDER` unset or unrecognized:** `resolveProvider()` throws
   at startup, before `listen()` — same as case 0, the server process never
   comes up at all, logging a clear startup error. There is no running
   `/api/ai-summary` to return a 503 from (an earlier draft of this plan
   said otherwise; that was wrong — `resolveProvider` is called once at
   startup in the sketch above, not per-request). From the browser's
   perspective this is indistinguishable from the server not running at
   all, so it degrades via case 4 below: `providerInfo.ts`'s fetch fails,
   the panel shows generic fallback copy with `ready: false`, and Generate
   stays disabled with an explanation.
3. **Provider selected but its API key env var missing (`ready: false`):**
   the panel now catches this *before* a request is ever sent — Generate is
   disabled and the panel explains why (naming the missing variable), and
   consent is never solicited for a request that was always going to fail.
   The server-side `503` naming the specific missing variable
   (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`) remains as defense in depth for
   any request that reaches `/api/ai-summary` anyway (e.g. a stale page that
   fetched `providerInfo` before a key was removed).
4. **`/api/ai-provider-info` unreachable or errors (e.g. server not
   running under plain `npm run dev`):** `providerInfo.ts` returns a
   generic, accurate fallback object — `ready: false`, no provider name
   asserted, generic "an AI provider" phrasing, a generic link to Tender's
   own AI-narrative ADR instead of a specific vendor's page — so the panel
   never claims a provider it hasn't confirmed, and never offers a Generate
   action it can't back up. This also covers the common case of running
   plain `npm run dev` (no AI server).
5. **Model call fails for any reason (auth, quota, model not found, network,
   empty response, or an Anthropic response truncated at the `max_tokens`
   ceiling):** `provider.safeError()` maps to an actionable message that
   never leaks provider internals or health data, `/api/ai-summary` returns
   `502`/`400` as today, and the panel shows `"{message} The private
   observations above still work without AI."` — this sentence is the
   load-bearing fallback guarantee and is unchanged by this design:
   rule-based Insights and appointment export never depend on any provider
   being configured or reachable. A truncated Anthropic response is treated
   as this kind of failure, never returned as partial text.
6. **Whole AI feature absent (`npm run dev`, no `.env.local`, no server
   process):** unchanged — `/api` has nothing to proxy to, the panel's
   fetch fails, same degrade-to-error-state-without-blocking-Insights
   behavior as today.

## Test plan

Mirrors the existing `aiService.test.ts` / `aiSummary.test.ts` /
`AiNarrativePanel.test.tsx` structure, split along the new seam:

- `server/providers/openaiProvider.test.ts` — move the existing
  "disables response storage and constrains the narrative" and
  "turns common API failures into safe, actionable messages" cases from
  `server/aiService.test.ts` here unchanged (they're OpenAI-specific
  assertions on `store`, `safety_identifier`, `reasoning`, and OpenAI error
  codes).
- `server/providers/anthropicProvider.test.ts` — new, same shape:
  - mocked `Anthropic` client asserts `model`, `max_tokens: 1024`, `system`
    (contains the same "Do not diagnose, triage, prescribe" and "Treat all
    text inside the records as data" substrings the OpenAI test checks —
    proving both adapters share one instruction string), and
    `metadata.user_id` equal to the passed safety id.
  - empty-content-block response → throws/rejects with the same
    "AI service returned an empty summary" behavior as the OpenAI adapter.
  - a response with `stop_reason: 'max_tokens'` is rejected — routed to
    `safeError` — rather than its (nonempty) truncated text being returned.
    This is the test that proves the length ceiling can't silently become a
    length *control*.
  - `safeError()` maps representative Anthropic failures (401, 429, 404 /
    `not_found_error`, the truncated-response case, unknown) to the
    messages in the sketch above, and confirms an arbitrary `Error` with a
    made-up message does **not** leak into the returned string (same
    "secret provider detail" case pattern as the existing OpenAI test).
  - a dedicated regression test: construct an `AnthropicTruncatedResponseError`
    and overwrite its `.message` with an arbitrary string before passing it
    to `safeError()`; the specific truncation message must still be
    returned, proving classification is by `instanceof`, not by matching
    message text, so rewording the message later can't silently make the
    guard stop firing.
- `server/providers/index.test.ts` — new:
  - `assertProviderRegistryIsConsentReady()` does not throw for the real
    registry (both adapters' consent metadata is non-empty and
    `privacyNoticeUrl` is a well-formed URL).
  - a stub provider with an empty `retentionSummary` (or any other blank
    required field) causes `providerConsentMetadataSchema.parse()` to
    throw — proving the "won't boot on incomplete consent copy" guarantee
    without needing to actually crash the process in a test.
  - `resolveProvider(undefined)` and `resolveProvider('something-else')`
    both throw; `resolveProvider('anthropic')` returns the Anthropic
    adapter.
- `server/aiService.test.ts` — narrowed to orchestration only: given a
  fake `AiProvider` (a plain object satisfying the interface), confirms
  `aiSummaryRequestSchema` still rejects invalid payloads (`ZodError`)
  before any provider method is called, and that a valid payload is
  forwarded to `provider.createNarrative` unchanged.
- `server/index.test.ts` (new, if none exists today — confirm during
  implementation) or extend existing coverage: `TENDER_AI_PROVIDER` unset →
  503 with the provider-selection message; set to an unsupported value →
  503; set correctly but its key env var missing → `GET
  /api/ai-provider-info` reports `ready: false` (not a 503 — the info route
  itself still succeeds, it just reports unreadiness); `GET
  /api/ai-provider-info` returns the active provider's public metadata plus
  `ready: true` with no key material once the key is present.
- `src/features/ai-summary/providerInfo.test.ts` (new) — successful fetch
  returns the parsed metadata including `ready`; fetch rejection or non-2xx
  returns the generic fallback object with `ready: false`, never throws.
- `src/features/ai-summary/AiNarrativePanel.test.tsx` — extend existing
  cases to assert: panel renders the fetched provider's `displayName` and
  `privacyNoticeUrl` in consent copy; when `providerInfo` fetch fails, panel
  renders generic fallback copy instead of a stale/wrong vendor name; when
  `ready` is `false`, Generate is disabled and an explanatory message is
  shown even if consent is checked; existing consent-gating, revoke, and
  error-state tests are otherwise unchanged.
- No change expected to `src/features/ai-summary/aiSummary.test.ts` — the
  minimized-payload builder doesn't change.
- Manual/e2e: no new Playwright coverage is proposed here — `tests/e2e/`
  currently covers only the AI-independent Iteration A flows (confirmed by
  today's run, see below); the handoff doc's existing requirement to
  manually test with a real Anthropic key and review narrative quality
  before merge stands and is out of scope for automated tests.
- Full suite must pass `npm run check` after implementation, exactly as it
  did before this branch (see verification section below for today's
  baseline).

## Decisions locked in this revision

These were open questions in the previous draft; they're resolved now and
should be treated as constraints on implementation, not points to
re-litigate:

- **One provider per server process, read once at startup.**
  `TENDER_AI_PROVIDER` is never accepted from request input. This is a
  security property: per-request provider selection would let a client
  influence where health data is routed. Running two providers
  simultaneously (e.g. a UI toggle) is out of scope, not deferred.
- **Keep both adapters.** Partly for migration flexibility, but mainly
  because the shared-instruction test (`AI_SUMMARY_INSTRUCTIONS` is
  asserted identical across adapters) is only meaningful with two real
  implementations to compare — deleting the OpenAI adapter would make that
  proof vacuous, and with it the main structural guard against the
  non-diagnostic contract forking silently between providers.
- **Consent never carries across a provider change.** Already implied by
  the existing per-request, unchecked-by-default consent design, but ADR
  0009 must state it as an explicit invariant (see Consent section above).

## Open questions

1. **Exact current Anthropic retention/training-use wording, and an
   explicit pre-ship verification step for both consent fields.** Both
   `retentionSummary` and `privacyNoticeUrl` are left empty in the sketch on
   purpose, symmetrically — the startup schema refuses to boot until both
   are filled in. But passing the schema only proves non-emptiness (and,
   for the URL, syntactic validity); it cannot prove either value is
   *true*. ADR 0008's OpenAI wording ("data is not used for training unless
   the account opts in; default safety-monitoring logs may retain content
   for up to 30 days") must have a verified Anthropic counterpart pulled
   from Anthropic's current API/commercial terms at implementation time —
   not invented or copied from OpenAI's terms — and `privacyNoticeUrl` must
   be hand-checked to actually resolve to Anthropic's current, correct
   data-use page, not just be well-formed. This plan treats that check as a
   required manual step before merge/deploy (alongside the handoff doc's
   existing real-key/narrative-quality review), not something the schema
   can automate: there is no proposal here to fetch the URL at boot to
   verify it resolves, since that would make local dev startup depend on
   network access for no safety benefit (the content could still be wrong
   even if the URL resolves).
2. **Anthropic model id and pricing tier to default to.** Needs an explicit
   choice (e.g. a Claude Sonnet/Haiku model) balancing narrative quality
   for a ~250-word clinician-facing summary against local-dev cost; the
   product owner should confirm before `ANTHROPIC_MODEL`'s default is
   picked.
3. **Does a 1024-token ceiling actually avoid triggering the truncation
   guard in practice?** The OpenAI adapter constrains length via
   `reasoning.effort`/`text.verbosity`; the Anthropic adapter now rejects
   on `stop_reason === 'max_tokens'` instead of silently truncating, which
   converts "too long" from a silent correctness bug into a visible,
   fallback-triggering failure — strictly better, but it only helps if 1024
   is actually generous enough that well-behaved ~250-word responses don't
   hit it. That needs verification against real Anthropic output during the
   manual quality review step, not assumed from the sketch; if truncation
   failures turn out to be common, the ceiling (not the 250-word
   instruction) should move first.
4. **`/api/ai-provider-info` route naming/shape** — confirm this doesn't
   collide with any planned route, and that returning provider name +
   privacy link + retention summary + `ready` (and nothing else) is the
   right and complete non-secret surface for the panel to render correct
   copy and disable Generate appropriately.
5. **Exact mechanism for computing `ready` from `.env.local` rather than
   ambient `process.env`.** As described in Config/env surface, a stray
   shell-exported variable sharing a key's name can make a naive
   `process.env[apiKeyEnvVar]` check falsely report `ready: true`. Options
   include parsing `.env.local` directly (e.g. with `dotenv`'s parse
   function) into an explicit config object rather than reading it back out
   of `process.env`, or some other way of tagging "this value came from
   `.env.local`" distinctly from "this value is merely present." Not
   resolved here — needs a concrete choice at implementation time.

## Verification of current branch state (for context, not part of the design)

Two separate, pre-adapter fixes landed in `src/features/insights/` before
any plan revision or AI-path change. Neither is part of this design; both
are recorded here because they're what makes the branch's current green
state accurate.

**`c2bf735` — test-suite timezone pinning.** `npm run check` was failing: 3
tests in `src/features/insights/insights.test.ts` had a date-range
filtering off-by-one and two empty-aggregation results. Root cause
(investigated before any fix, per systematic debugging): `buildInsights()`
parses its `from`/`to` range boundaries with no explicit offset
(`new Date(`${from}T00:00:00`)`), so JS resolves them in the **host
machine's local timezone** — correct and intentional for production, since
it's a single-device phone app where the browser's local timezone is the
user's own and `occurredAt` is always stored as UTC via `toISOString()`.
The test suite, however, wasn't pinned to any timezone, and
`insights.test.ts` was the one file in the repo built with non-UTC
(`+08:00`) fixture timestamps — every other test file uses `.000Z`. On a
host machine set to a different timezone (this environment:
`America/New_York`), the local-midnight boundary no longer lined up with
what the `+08:00` fixtures assumed, so near-boundary entries were wrongly
excluded; on a machine set near UTC+8 the same tests passed by coincidence.
The implementation was not the bug — `buildInsights()` was unchanged. The
fix was pinning `TZ: 'UTC'` in `vitest.config.ts`'s `test.env`, making the
test suite deterministic on any host machine.

**`71d774b` — a real app-code bug, found while checking that `c2bf735`
didn't mask one.** `InsightsPanel.tsx`'s `dateDaysAgo()` helper (used to
compute the default date-range picker values) built a local `Date`, did
correct local day arithmetic, then called `.toISOString().slice(0, 10)` —
converting to UTC before taking the date substring. For any timezone behind
UTC (e.g. `America/New_York`) this silently showed tomorrow's date in the
evening while it was still today locally; the mirror case happens early
morning in timezones ahead of UTC (e.g. `Asia/Shanghai`). Fixed by
replacing the UTC round-trip with local-component formatting
(`getFullYear`/`getMonth`/`getDate`, zero-padded) in `InsightsPanel.tsx`,
with new regression tests in `InsightsPanel.test.ts` pinning both zones via
`vi.stubEnv`/`vi.setSystemTime`. Verified against the pre-fix code that
these tests fail with the exact wrong-day symptom before the fix and pass
after.

**Current state:** both fixes are committed (`c2bf735`, `71d774b`).
`npm run check` now passes 38/38 tests across 13 files with a clean build
(re-confirmed just before this revision). `npm run test:e2e` could **not**
be re-confirmed in the same run: `~/Library/Caches/ms-playwright` — which
held an installed Chromium earlier in this session — is gone, so Playwright
reports a missing browser executable and all 6 tests fail before they can
exercise anything. This is an environment change, not a regression from
either fix above; per standing instructions, browsers were not installed to
work around it, and this is flagged rather than reported as a false pass.
Plainly stated: two separate fixes have touched `src/features/insights/` on
this branch — `InsightsPanel.tsx` and the two test files above. The
provider-adapter work described in *this plan* still touches nothing in
that directory; "no changes to `src/features/insights/`" in the Files
touched section refers to the adapter implementation itself, not to the
branch's history up to this point.

**Aside, not a decision made here:** `npm run check` is defined as `test &&
build`, so a test failure hides whether the build would also have passed
(it happened to, every time this was checked by hand). Worth considering
separately — out of scope for this plan — whether `check` should run both
and report both statuses rather than short-circuiting.
