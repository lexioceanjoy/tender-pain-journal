# ADR 0003: Lilac and fig visual direction

## Decision

Tender will use a **Lilac & Fig** visual direction: a warm off-white foundation, soft dusky lilac surfaces, deep fig-coloured text, and a restrained blush accent.

## Why

The palette feels warm, optimistic, and personal without copying the common orange-and-cream fertility/wellness look. It supports the product's purpose as a private, calming daily tool while still feeling contemporary enough for a consumer health product.

## Initial colour roles

| Role | Colour | Use |
| --- | --- | --- |
| Canvas | `#FFF9F4` | page background |
| Ink | `#3C2634` | primary text and high-emphasis UI |
| Lilac surface | `#DED2E8` | cards, selected controls, calm surfaces |
| Fig | `#5A314D` | primary actions, links, and selected body-map regions |
| Blush | `#ECAFA6` | supportive accent and highlights |
| Muted text | `#71626B` | secondary text |
| Border | `#E9DFE5` | dividers and field boundaries |

## Accessibility guardrails

- Text and interactive controls must meet WCAG AA contrast requirements against their specific background.
- Colour is reinforced with labels, patterns, shapes, and state text; it is never the only indicator of pain intensity, selection, or an error.
- Severity colours, if used later, will be tested separately and will not rely on red/green distinction.
