# Tender — first-release UX specification

## Design principle

Tender should feel like a gentle, capable personal tool—not a medical questionnaire. Recording an entry must work on a difficult day, with one hand, on a phone.

## Visual direction

The interface follows the **Lilac & Fig** direction: warm off-white space, soft dusky-lilac surfaces, deep fig emphasis, and restrained blush highlights. It should feel personal and contemporary, not clinical, overly feminine, or like a fertility-app visual clone. Colour supports hierarchy and warmth; it never carries meaning alone. The exact accessible colour roles are recorded in [ADR 0003](./decisions/0003-visual-direction.md).

## Primary journey: record a pain entry

### 1. Open Tender

The home screen opens directly to **Today's check-in**. It never presents a login, upsell, or empty dashboard before the person can record something.

### 2. Mark what hurts

The person sees a front/back toggle above a high-contrast body silhouette. Pain regions are visible as subtle outlines. They tap one or more regions; each selected region changes colour and is added to a short readable list below the map.

#### Zoom and precision interaction

The map has two complementary ways to make dense areas easy to use:

1. **Explicit visual focus:** The map offers `Full body`, `Upper body`, and `Lower body` views. Cropping is always named and user-controlled, so a person never mistakes a lower-body focus for the complete map. Detailed selectable regions remain drawn on the silhouette—there is no text-only anatomy menu.
2. **Orientation reinforcement:** `Front view` and `Back view` use high-contrast selected controls, a persistent in-map label, and distinguishing visual details. A person should not have to remember which side is active.

The detailed view is the source of truth for granular selection. For example, the overview's lower-back/pelvis area opens the zoomed map; it does not incorrectly record "lower back" when the person meant a precise area within it. A visible `Entire area hurts` choice remains available for days when a broad record is more accurate.

The body map must:

- be fully visual; no anatomy knowledge is required before choosing;
- support multiple selections in one entry;
- provide a zoomed, visually contextual view for every dense group of regions;
- provide explicit zoom controls in addition to touch gestures;
- give each tappable region an accessible label;
- use touch targets at least 44 × 44 CSS pixels where the body shape permits;
- not imply it can identify a precise structure such as a specific muscle or nerve.

### 3. Rate intensity

The only required detail after selecting a location is a 0–10 pain intensity. The scale displays the selected number and plain-language anchors: `none`, `mild`, `moderate`, `severe`, `worst`.

When several areas are selected, this value applies to all of them by default. An optional **Do any areas feel different?** section allows the person to change intensity and sensation for only the exceptional areas. It never requires one form per area. Returning an area to **Use overall settings** removes the exception.

### 4. Add context, if useful

The default screen stays short. An **Add context** affordance expands optional groups only when wanted:

| Group | First-release interaction |
| --- | --- |
| Sensation | multi-select chips: aching, sharp, burning, tight, tingling, numb, radiating, other |
| Activity / possible trigger | reusable chips plus an optional short note |
| Sleep | one tap: poor, okay, good |
| Stress | one tap: low, medium, high |
| Mood | one tap: low, neutral, good |
| Menstrual cycle | optional status/phase; never inferred |
| Medication | a simple name, dose/text, time, and optional perceived effect |
| Notes | free text for details that do not fit a category |

Recently used options should appear before the full catalog. Nothing in this section is required.

### 5. Save

Saving gives a calm confirmation and returns to the current entry. It never claims the entry is medically normal, safe, or diagnostic.

The occurrence date and time default to now but remain directly editable, so a person can accurately record pain after an episode has passed.

## Body-map region model

The map uses the 74-region CHOIR Body Map model as its validated reference, with its attribution and licensing requirements preserved. Each region has an internal stable ID, a human-readable label, a side, a view, and an SVG polygon. The person may choose between two source body outlines; both use the same semantic region IDs.

The map prioritizes usability around the lower back, hip, glute, and upper-leg areas through its focus controls, without changing or inventing the underlying region boundaries. It records patient-reported surface location rather than an assumed anatomical source.

When a person selects a posterior lower-back, hip, buttock, or upper-leg CHOIR region, an optional **Refine lower back, hip or glute** section becomes available. It opens a visual close-up with approximate Tender detail areas including the SI-joint area, sacrum, tailbone, pelvic rim, outer hip, glute subdivisions, and upper hamstring area. These custom areas are stored and summarized separately from CHOIR and are clearly identified as not clinically validated.

### Back view regions

- Head and neck: left/right head; left/right neck
- Upper limbs: left/right shoulder, upper arm, elbow, forearm, hand
- Upper back: left, centre, right
- Mid back: left, centre, right
- Low back: left paraspinal, centre/spine, right paraspinal
- Pelvis: left/right upper pelvic crest; sacrum/tailbone; left/right SI area
- Glutes: left/right upper-inner, central, upper-outer, lower-inner, lower-outer
- Hips: left/right outer hip
- Upper legs: left/right upper hamstring, back-inner thigh, back-outer thigh
- Lower legs and feet: left/right knee, lower leg, ankle, foot

### Front view regions

- Head and neck: left/right head; left/right neck
- Upper limbs: left/right shoulder, upper arm, elbow, forearm, hand
- Chest: left and right
- Lower abdomen/pelvis: centre, left, right
- Hip/groin: left/right front hip crease; left/right groin
- Upper legs: left/right front thigh, inner thigh, outer thigh
- Lower legs and feet: left/right knee, lower leg, ankle, foot

This is intentionally an anatomical reference map, not a diagnostic map. Region labels are shown only after selection or deliberate exploration so the screen does not feel intimidating.

## History and summary

The history view starts with a calm chronological list. Opening a check-in shows its locations, per-area details, refined locations, context, medication, and note. A person may load it back into the check-in to edit it. Deletion requires an explicit second confirmation and warns that recovery depends on a backup.

The summary view asks the person to choose a date range and produces:

1. **Recorded facts** — counts, average overall intensity, common selected regions, per-area average intensity, and the person’s own entries.
2. **Private observations** — clearly labelled associations based only on local records, never stated as causes.
3. **Optional AI narrative** — only after a separate consent decision. It composes a clinician-ready description from the selected data; it does not diagnose, triage, or prescribe.

## Safety message

The entry screen contains a compact link: **Urgent symptoms? Get help now.** It opens this exact text:

> This app cannot assess urgent symptoms. Seek urgent medical care for new, severe, rapidly worsening, or worrying symptoms—especially new changes in bladder or bowel control, numbness around the groin/buttocks, or worsening weakness or difficulty walking. This is not a complete list.

The message is informational safety-netting, not an interactive screening tool. It remains accessible from summaries and exports.

## Empty and failure states

- No entries yet: explain the value of the first small entry; do not overwhelm with instructions.
- No selected region: disable Save and state what is missing.
- Browser storage unavailable: plainly explain that private records cannot be saved on this device.
- Import invalid: preserve existing entries and show what was wrong with the file.
- Delete selected: require confirmation; never delete from the first tap.
- Backup overdue: remind without interrupting check-in or uploading anything.
- AI unavailable/declined: keep private observations and export usable without AI.

## Acceptance criteria for the first vertical slice

1. On a 375px-wide viewport, a person can select one or more body regions, set an intensity, and save an entry without horizontal scrolling.
2. An entry persists after refreshing the browser.
3. Selecting an already selected region removes it.
4. The visual map is usable with keyboard navigation and announces selected regions to assistive technology.
5. Optional context never prevents saving a valid basic entry.
