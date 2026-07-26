# ADR 0005: Base the production body map on a validated pain-map model

## Decision

Replace Tender's hand-designed prototype segmentation with a license-compatible, attributed implementation based on the **Collaborative Health Outcomes Information Registry (CHOIR) Body Map**.

CHOIR provides 74 predefined patient-selectable areas: 36 anterior (front) and 38 posterior (back). Tender will preserve its own visual design and interaction layer while aligning region boundaries, IDs, and patient-facing labels with the validated model.

## Implementation

Implemented from the CTSI Imagemap source snapshot at commit `0bf201d6cb95c7eaedb5449b36e4fa1d9cd9907f`.

- Both original body outlines are preserved and selectable without changing region IDs.
- The 36 anterior and 38 posterior source polygons are generated rather than hand-copied.
- New records use namespaced IDs such as `choir-f01` and `choir-b38`.
- Prototype-era IDs remain label-resolvable so existing local records and backups stay readable.
- Source assets, Apache 2.0 license, provenance, in-app credit, and publication citation are preserved.

## Why

The product team should not invent or informally certify anatomical regions. The CHOIR Body Map was developed for patient-reported chronic-pain location and validated against verbal region reporting. Its resolution is also closer to Tender's need for granular visual selection than broader 35-area instruments.

## Guardrails

- This validates a method for recording patient-reported location; it does not make Tender a diagnostic or clinically validated product.
- The map describes surface locations and joints. It does not claim to identify a muscle, nerve, organ, or source of pain.
- Front/back and left/right orientation must remain explicit.
- The original CHOIR attribution and publication citation must be included wherever required by the source license.
- Any changes to the validated region boundaries must be documented and later reviewed by an appropriate clinician before public release.

## Product review responsibility

The user reviews comprehension, comfort, and usability. Anatomical segmentation is reviewed against the validated source and, before a public health-product launch, by a qualified clinician.
