# ADR 0006: Add an optional Tender precision layer

## Decision

Keep the validated CHOIR region as the primary recorded location and allow an optional, targeted Tender detail selection for the posterior lower-back, hip, glute, and upper-hamstring area.

## Why

CHOIR's 74 regions balance patient effort and location precision, but its hip and buttock regions do not distinguish personally important surface areas such as the left and right SI-joint area, central sacrum, or tailbone.

Replacing or silently subdividing CHOIR polygons would make Tender's custom geometry look validated when it is not. Storing both levels preserves the source instrument while allowing a more useful personal record.

## Data meaning

```text
CHOIR parent region: Left buttock
Tender detail area: Left SI-joint area
```

- The CHOIR selection is always retained.
- Tender detail areas are optional and approximate.
- Detail areas describe where the person points on the surface; they do not identify the anatomical source of pain.
- Summaries and reports show refined locations separately and state that they have not been clinically validated.
- A future public health-product release requires review of the custom detail geometry and labels by an appropriate clinician.
