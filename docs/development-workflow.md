# Development workflow

## The cadence

Tender will be built in small vertical slices. A vertical slice is a complete piece of user value—not a collection of disconnected technical layers.

For example, the first slice is not "create an SVG." It is: **a person can select a body location, rate pain, save the entry locally, and see it after a refresh.**

## Cycle for every slice

1. **Specify** — write user-facing acceptance criteria and identify privacy/accessibility risks.
2. **Test first where practical** — add tests for the behaviour that must not regress.
3. **Implement narrowly** — make the smallest coherent change that meets the criteria.
4. **Validate automatically** — run unit/component tests and a production build.
5. **Validate like a person** — check the phone viewport, touch targets, empty states, and visual hierarchy.
6. **Review together** — compare the built behavior with the original outcome before adding more scope.

## Initial slice order

1. App shell, design tokens, and accessible layout
2. Visual body-map navigation, zoom, and region selection
3. Pain intensity and minimal entry saving to IndexedDB
4. Optional context and medication logging
5. History and local private observations
6. Export/import and clinician-ready report
7. Consent-gated AI narrative service

## Quality gates

Before a slice is considered complete, `npm run check` must pass. The command runs automated tests and creates a production build. End-to-end tests run before milestone handoff, and manual phone review is recorded in the pull-request or release notes once the project is shared publicly.
