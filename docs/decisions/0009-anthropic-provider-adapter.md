# ADR 0009 — Anthropic provider adapter

## Status

Accepted. The `retentionSummary` strings, `privacyNoticeUrl` values, and
new consent-panel copy below were reviewed and approved 2026-10-13,
resolving the plan's Open Question #1. No provider code exists yet — this
ADR and `docs/plans/provider-adapter.md` remain planning documents;
implementation still needs to happen and be tested with a real Anthropic
key before any merge, per `docs/claude-code-handoff.md` and `CLAUDE.md`.

## Decision (carried from the plan, restated here per the plan's own
instruction that ADR 0009 state it explicitly)

- One provider per server process, read once at startup from
  `TENDER_AI_PROVIDER`; never accepted from request input.
- Keep both the OpenAI and Anthropic adapters.
- Consent given while one provider is active never carries over to a
  different provider.
- `ANTHROPIC_MODEL` defaults to a pinned Claude Sonnet model id (see the
  plan's Decisions-locked section), not Haiku.
- **`retentionSummary` does not state specific retention periods, for
  either provider.** Rationale: a provider's retention/training terms are
  the provider's own policy, which they can and do change on their own
  schedule; a specific number we paraphrase into our own copy goes stale
  the moment their policy changes, and we would be making a claim about a
  third party's current behavior that we don't control and have no
  mechanism to keep current. Instead `retentionSummary` states only that
  retention is limited and can be longer in specific cases, and
  `privacyNoticeUrl` carries the actual detail by linking to the
  provider's own current page. What we *do* state with specificity and
  authority is our own behavior — the minimized payload, the per-request
  consent gate, which provider receives it, and that Insights/export work
  without it — because we control that and can keep it accurate by
  construction (see "New consent-panel copy" below).
- The boot gate is unchanged: `providerConsentMetadataSchema` still
  requires both `retentionSummary` (non-empty) and `privacyNoticeUrl`
  (non-empty, well-formed URL) for every registered provider, checked once
  at server startup. A dead link or a blank sentence still prevents the
  server from starting — this floor doesn't get weaker just because the
  sentence it's checking is now generic.

## Internal reference: retention/training research (NOT user-facing copy)

**This section exists so we can say we checked before shipping. None of
the specific numbers below appear in `retentionSummary` or any other
user-facing string** — per the decision above, specifics stay out of our
own copy and live only on the providers' own pages, which `privacyNoticeUrl`
links to.

Read 2026-10-13, directly from Anthropic's and OpenAI's live docs (not
from memory/training data). Both vendors' docs sites were recently
restructured: Anthropic's moved host from `anthropic.com`/`docs.anthropic.com`
to `claude.com`/`platform.claude.com` (old hosts 301-redirect, confirmed
while fetching); OpenAI's moved from
`platform.openai.com/docs/models/default-usage-policies-by-endpoint` to
`developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint`
(also a 301). Given both moved recently, **`privacyNoticeUrl` for both
adapters should be re-checked for link rot before any public deployment**,
not just at implementation time.

### Anthropic — retention

- Quote: "we automatically delete inputs and outputs on our backend within
  30 days of receipt or generation"
- Source: https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-personal-data
- Read: 2026-10-13
- Exceptions listed on the same page:
  - "a service with longer retention under your control (e.g. Files API)"
  - "you and we have agreed otherwise (e.g. zero data retention agreement)"
  - "retain them for longer to enforce our Usage Policy (UP)"
  - "In compliance with the law"
- **Flagged-content carve-out, same page** (this is the "longer in some
  cases" case `retentionSummary` gestures at without naming a number):
  - "We retain inputs and outputs for up to 2 years"
  - "trust and safety classification scores for up to 7 years"
  - Both apply only when automated trust-and-safety systems flag a chat as
    a Usage Policy violation.

### Anthropic — training

- Quote (full sentence): "By default, we will not use your inputs or
  outputs from our commercial products (e.g. Claude for Work, Anthropic
  API, Claude Gov, etc.) to train our models."
- Source: https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training
- Read: 2026-10-13
- Exception quote: "or otherwise choose to allow us to use your data"
- Corroborating quote (separate article, same collection): "We will not use
  your chats or coding sessions to train our models, unless you choose to
  participate in our Development Partner Program."
  - Source: https://privacy.claude.com/en/articles/7996885-how-do-you-use-personal-data-in-model-training
  - Read: 2026-10-13

### OpenAI — retention (for comparison; ADR 0008 already covers this
provider, re-verified here against the same "no specific numbers in our
copy" standard)

- Quote: "Prompts submitted to, and outputs generated by, covered models
  are retained for 30 days"
- Quote (flagged-content carve-out, no fixed duration given): "After 30
  days, the data is deleted automatically, except in the rare cases where
  it's been flagged ... by our automated trust and safety systems or we're
  legally required to keep it."
- Source: https://developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint
- Read: 2026-10-13
- Unlike Anthropic's page, OpenAI's does not state a fixed retention
  ceiling for flagged content — this asymmetry is one more reason not to
  put specific numbers in our own copy: even the two providers' own pages
  aren't structured the same way.

## New consent-panel copy (this app's own behavior, not a provider's policy)

> **Status update (Oct 2026):** the first paragraph below was inaccurate.
> It said timestamps were never sent, but each check-in's `occurredAt`
> (date and time) is sent, and it left out stress, mood, cycle, medication
> dose and perceived effect, the range dates, and the safety ID passed to
> the provider. The copy is now generated from the payload fields in
> `src/features/ai-summary/consentFields.ts`, and `consentFields.test.ts`
> fails if the copy and the payload diverge. The quoted text below is kept
> as the original decision.

This is the part we state with authority, because we control it. Replaces
the current hardcoded-OpenAI paragraphs in
`src/features/ai-summary/AiNarrativePanel.tsx:47-48`, provider-agnostic
except for the `displayName` it renders from `/api/ai-provider-info`:

> Only labels for this date range's regions, precision areas, sensations,
> intensity, activities, sleep, and medications, plus your note text, are
> sent — never record IDs, timestamps, or other identifiers. Nothing
> leaves this device unless you check the box below and choose Generate,
> and only for this one request.
>
> This request goes to {displayName}. {retentionSummary} [Review
> {displayName}'s data policy]({privacyNoticeUrl}).
>
> Insights and appointment export work without this.

This covers, in order: (1) exactly what leaves the device, matching what
`buildAiSummaryRequest` actually produces — region/precision-area labels,
sensations, intensity, activities, sleep, medications, note text; no record
IDs, no creation metadata; (2) that it only happens on explicit,
per-request consent; (3) which provider receives it, by name; (4) that
Insights and the appointment export work without it.

## Proposed `retentionSummary` strings — awaiting your approval

Identical structure for both adapters (deliberately — see "not materially
different" finding below), under two sentences, no day/year counts, points
to `privacyNoticeUrl` for specifics:

- **OpenAI:** "OpenAI retains submitted data for a limited period, which
  may be longer in specific cases such as content flagged for safety
  review. See OpenAI's current data policy, linked below, for exact terms."
- **Anthropic:** "Anthropic retains submitted data for a limited period,
  which may be longer in specific cases such as content flagged for safety
  review. See Anthropic's current data policy, linked below, for exact
  terms."

Not yet entered into `openaiProvider.ts` / `anthropicProvider.ts` in the
plan sketch — see the plan's Interface sketch, which still shows these as
proposed strings in comments pending your sign-off, not live code.

## Proposed `privacyNoticeUrl` values — verified live, 2026-10-13

Both resolve (200 OK, no 404, no dead-end redirect) and are each the
provider's actual data-retention page, not a hub or an unrelated page:

- **OpenAI:** https://developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint
  — this is the current location after a 301 from the previously-hardcoded
  `platform.openai.com` URL in `AiNarrativePanel.tsx:48`; that old URL
  should be updated to this one rather than left to redirect.
- **Anthropic:** https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-personal-data
  — chosen over the training-specific article or the 30-article
  "Commercial Customers" hub because it's the one page that states both
  the default retention window and the flagged-content carve-out, which is
  the specific "longer in some cases" claim `retentionSummary` makes
  without naming a number.

## Comparison against ADR 0008's OpenAI wording (internal record only —
no longer drives user-facing copy, since neither provider's copy states
specifics anymore)

Kept for context on why the two `retentionSummary` strings above are
identical in structure. Both providers describe the same shape of default
(no training without opt-in; a default retention ceiling with a longer,
flagged-content exception), with provider-specific exception mechanisms and
differently-structured pages (Anthropic states a fixed 2-year/7-year
flagged-content ceiling; OpenAI's page does not state one). Not materially
different enough to justify different-shaped copy — which is now moot for
the consent panel either way, since the panel no longer paraphrases either
provider's specifics.
