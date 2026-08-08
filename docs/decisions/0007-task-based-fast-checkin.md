# ADR 0007 — task-based navigation and fast check-in

## Status

Accepted for Iteration A.

## Context

Tender's first prototype placed check-in, history, insights, backup, and safety in one long page. That preserved feature visibility but made a frequent pain entry feel heavier than it was. The product goal is a useful basic entry in under 30 seconds, including on a difficult day.

## Decision

- Separate the product into Today, History, Insights, and More.
- Make Today a launcher and recent-entry view, not the full check-in form.
- Require only a visual location and deliberately confirmed intensity before Save.
- Place Save before optional enrichment so additional context never blocks the basic path.
- Offer Repeat Last when history exists. It copies only pain-specific fields—location, intensity, sensation, per-area settings, and precision areas—into a new record with the current time.
- Do not copy activities, sleep, stress, mood, menstrual-cycle context, medication, or notes because they describe a particular episode.

## Consequences

The common path has fewer decisions and repeat entries are faster. Less-frequent capabilities remain available without competing with check-in. Navigation adds one tap before a new entry, but Today provides a clear primary action and a stable place to return after saving.
