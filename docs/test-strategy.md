# Test strategy

## Principle

Tests prove important user behavior, not implementation details. Manual phone testing remains essential because this app relies on touch interaction and visual anatomy selection.

## Test layers

| Layer | Purpose | Examples |
| --- | --- | --- |
| Unit | Validate small, deterministic rules | pain-score validation; export format; date-range calculations |
| Component | Validate a feature in isolation | selecting and deselecting a body region; optional fields stay optional |
| Integration | Validate features with local data | save an entry, reload, and see it in history |
| End-to-end | Validate a real user journey | create an entry on a phone viewport, export it, import it again |
| Manual accessibility | Validate what automation cannot fully judge | tap-target size, keyboard navigation, screen-reader labels, text contrast |

## Definition of done for each feature

1. Acceptance criteria are written before implementation.
2. Important behavior has automated coverage at the smallest useful level.
3. A phone-sized viewport is checked manually.
4. Empty, error, and privacy-sensitive states are covered.
5. The change is reviewed with the product goal, not only the code, in mind.
