# Check-in additions for clinician usefulness

Status: approved by the product owner and implemented on
`feat/iteration-c` (2026-10-22); see "Implementation notes" at the end.
None of the new fields is sent to the AI provider.

## Why

`docs/plans/narrative-eval.md` (on branch `docs/narrative-eval`) lists
what Tender's data model can't record today, so neither Insights nor the
AI narrative can report it. This plan closes four of those gaps:

1. **Daily-life impact:** did pain get in the way, and of what.
2. **Better/worse:** whether a logged activity made pain worse or helped.
3. **Timing:** whether an area is new, how long it has been recorded, and
   whether it is steady or comes and goes.
4. **Sleep:** whether pain woke the person.

**Out of scope:** attributing mood or stress to pain, and the direction
pain spreads.

## Invariants

Every proposal below has to keep all three:

- **A basic check-in stays under 30 seconds.** The basic path is still:
  New check-in → tap a location → set intensity → Save. No addition
  appears in that path or adds a step to it.
- **Every addition is optional.** Each new control lives inside an
  existing collapsed section (**Add context**) or appears only after an
  optional choice. Nothing is open by default.
- **Nothing new is required.** Save stays enabled on location + intensity
  alone. A check-in saved without touching a new control stores none of
  the new fields: no default value, no "neutral", no `false`.

These follow `CLAUDE.md` ("optional details must never be mandatory or in
the critical path") and `docs/ux-spec.md` rule 5 ("Optional context never
prevents saving a valid basic entry").

## AI payload: needs product-owner approval

None of the new fields is added to the AI request by this plan.
`buildAiSummaryRequest` and `aiSummaryRequestSchema` stay unchanged until
the product owner explicitly approves each field under the
payload-minimization rule. Approving one means changing, together and per
`CLAUDE.md`:

- the consent copy, which lists exactly which fields are sent
  (`AiNarrativePanel.tsx`; wording in ADR 0009)
- server validation (`aiSummaryRequestSchema`)
- tests
- ADR 0008, or a new ADR recording the payload change
- the narrative evaluation: a before/after run with fixtures that use the
  new field

Each section below says what would be sent if approved. Two limits
already decided:

- Derived timing ("new area", "recorded since") is never sent.
- The payload only ever contains data from inside the range the person
  chose.

---

## 1. Daily-life impact

### Research: the PEG scale

The PEG (Krebs EE et al., "Development and initial validation of the PEG,
a three-item scale assessing pain intensity and interference," *J Gen
Intern Med* 2009;24(6):733–738, doi:10.1007/s11606-009-0981-1) is a
public-domain, three-item measure derived from the Brief Pain Inventory
for "chronic pain assessment in primary care and other ambulatory care
settings." Its items, from the published form:

1. "What number best describes your pain on average in the past week?"
   (0 "No pain" to 10 "Pain as bad as you can imagine")
2. "What number best describes how, during the past week, pain has
   interfered with your enjoyment of life?"
3. "What number best describes how, during the past week, pain has
   interfered with your general activity?"

Items 2–3 are anchored 0 "Does not interfere" to 10 "Completely
interferes." The score is the average of the three items.

**Should our wording align with it? Partly.**

- **Don't present this as the PEG.** Tender's question is about one day
  and uses four plain-language levels. The PEG is a 0–10 rating over the
  past week, validated as a set of three. Changing the recall period and
  the scale means the results aren't PEG scores. Tender must not compute,
  label, or export anything as a PEG score, and the narrative must not
  call it one.
- **Do align the concept.** "Did pain get in the way today?" asks about
  PEG item 3's construct (interference with general activity) in plainer
  words. The top level, "Couldn't do usual things", matches "Completely
  interferes" for general activity. Keep "get in the way" rather than
  "interfere": it's plainer and fits Tender's tone. Clinicians will still
  recognize it as an interference question.
- **No "enjoyment" chip.** PEG item 2 (enjoyment of life) gets no chip
  of its own. The existing Mood field is the closest thing Tender records
  (product-owner decision).
- **Chips, not sliders,** as requested. A four-level chip row takes one
  tap. A 0–10 slider would be a second intensity-style control and invite
  confusion with pain intensity.

### UI placement

In **Add context**, a new fieldset directly after "Activity or possible
trigger":

- **Legend:** "Did pain get in the way today?" When `occurredAt` is not
  today (a backdated check-in), the legend reads "...that day?"
- **One chip row, single choice:** No · A little · A lot · Couldn't do
  usual things. Nothing selected by default. Tapping the selected chip
  again clears it.
- **Only when "A lot" or "Couldn't do usual things" is selected,** a
  second chip row appears beneath it, multiple choice: Work · Exercise ·
  Chores · Social. Legend: "What did it get in the way of?" There's no
  Sleep chip, because "Pain woke me" (section 4) covers sleep.
- If the person then changes to No or A little, the second row hides and
  its selections are cleared, not just hidden, so no hidden data is saved.

No new screen. One fieldset that grows by one row.

### Data model

In `context`:

```ts
interference?: 'none' | 'a-little' | 'a-lot' | 'unable';
interferenceAreas?: Array<'work' | 'exercise' | 'chores' | 'social'>;
```

Validation (`superRefine`): `interferenceAreas` is only allowed when
`interference` is `a-lot` or `unable`, and has no duplicates.

### Repeat last and edit

- **Repeat last** does not copy either field. It's one-off context for
  that day, like sleep and stress (`docs/ux-spec.md`: Repeat Last "never
  copies one-off context").
- **Edit** loads and saves both fields.

### Insights and exports

- **Insights:** a new observation block, "Days pain got in the way":
  - It counts days, not check-ins, because the question is about a day.
    With several check-ins on one day, the day takes its highest recorded
    level.
  - It shows the count for each level, plus how often each life area was
    marked.
  - Caption: "As you recorded it. Days without an answer aren't counted."
- **Appointment summary:** one line per entry ("Got in the way: a lot —
  work, chores") and the day counts in the summary section.
- **CSV export:** two new columns, `interference` and `interferenceAreas`.

### AI payload (needs approval)

If approved, it would send `interference` and `interferenceAreas` per
entry, as their plain labels.

---

## 2. Better/worse markers on activities

### UI placement

In the existing "Activity or possible trigger" fieldset:

- For each **selected** activity chip, a compact line appears beneath the
  chip row: "Long sitting: Made worse · Helped". Both options are
  unpressed by default, which is the neutral state.
- Tapping one presses it; tapping it again returns to neutral. The two
  are mutually exclusive.
- Unselecting the activity chip removes its line and its marker.
- No new screen and no extra tap for someone who only selects chips.
- Each option is a 44 × 44 px touch target (`docs/ux-spec.md`).

**No markers on "Poor sleep".** It's one of the six activity chips
(`OptionalContext.tsx`), but "Poor sleep: Made worse" would overlap with
the Sleep field and "Pain woke me". The chip itself stays; it just never
shows a marker line, and validation rejects an `activityEffects` key of
"Poor sleep".

### Data model

In `context`, keeping `activities: string[]` unchanged so nothing that
reads it breaks:

```ts
activityEffects?: Partial<Record<string, 'worse' | 'helped'>>;
```

- Validation: every key must be in `activities`.
- Neutral is the absence of a key, never stored as a value.

### Repeat last and edit

- **Repeat last** does not copy activities today, so it doesn't copy
  markers either.
- **Edit** loads and saves both.

### Insights and exports

The person's marker is their own judgment, not something Tender
inferred. Insights shows it as theirs and keeps the existing
co-occurrence caption.

- **Insights:** the "Context recorded alongside pain" block adds, per
  activity: "marked as making it worse: 3×, helped: 1×". Caption: "These
  are your own markers, not evidence that an activity caused pain."
- **Appointment summary:** "Activities: Long sitting (you marked: made
  worse), Walking".
- **CSV export:** one new column, `activityEffects`, formatted as
  "Long sitting: worse; Walking: helped".

### AI payload (needs approval)

If approved, it would send per entry `activityEffects` as
`{ "Long sitting": "marked as making it worse" }`.

**Narrative evaluation.** `docs/plans/narrative-eval.md` now has an
attributed-marker rule. "The person marked long sitting as making it
worse" is allowed; the narrative asserting that long sitting worsens pain
is a Tier 1 causation failure. Sending markers stays a separate approval,
made only after the baseline evaluation, and would add an
`activity-markers` fixture with its own before/after run.

---

## 3. Timing

### 3a. Derived from history: "new area" and "recorded since"

Nothing new is entered. These are computed from existing check-ins in
`src/features/insights/insights.ts`, per CHOIR region and per precision
area:

- **New area:** an area is "new" on an entry if no earlier check-in
  recorded it in the previous **30 days** (`NEW_AREA_LOOKBACK_DAYS`).
- **Recorded since:** for each area, the start of its current run, where
  a run ends after a gap of more than **14 days** without that area
  (`RUN_GAP_DAYS`).

Both thresholds are named constants in `insights.ts`, so changing one is
a one-line edit with its tests. This
  is shown as "first recorded Oct 3; recorded on 9 of the 15 days since."

Check-ins are samples, not a continuous record. "Recorded since" is not
"pain has lasted", and the UI must not say it is.

- **Data model:** none. Nothing stored, so no migration.
- **Insights:** "New in this period" lists areas whose first recording in
  a run falls in the selected range. Each row in "Most recorded locations"
  gains "since Oct 3".
- **Appointment summary:** the same two items.
- **AI payload: never sent.** "New area" and "recorded since" depend on
  check-ins *before* the selected range, so sending them would reveal
  information outside the range the person chose to share. They are
  in-app only (Insights and the appointment summary), by product-owner
  decision. The AI payload only ever contains data from inside the chosen
  range.

### 3b. Steady or comes and goes, per area

**UI placement.** In **Add context**, a new fieldset: "Steady or comes and
goes?"

- One row per selected CHOIR region (not per precision area), each with
  two chips: Steady · Comes and goes. Nothing pressed unless pre-filled.
- It works with one region selected. It doesn't depend on the "Do any
  areas feel different?" section, which only appears for two or more
  areas.

**Pre-fill.** Each row pre-fills from the most recent earlier check-in
that recorded a pattern for that region. A pre-filled chip shows a small
"from last time" tag until the person taps either chip.

**Rule: a pre-filled value is saved only if the person opened Add
context during that check-in** (product-owner decision). Otherwise nothing
is saved. That way the record never contains a value the person didn't
see, and the basic path stores nothing new.

**Data model.** A new top-level field:

```ts
areaPatterns?: Array<{ regionId: string; pattern: 'steady' | 'comes-and-goes' }>;
```

Validation: each `regionId` must be in `regions`, with no duplicates.
This is kept apart from `areaDetails`, because `areaDetails` means
"exceptions to the overall rating" and has fallback behavior
(`getAreaDetails`) that patterns shouldn't share.

**Repeat last and edit.**

- **Repeat last** copies `areaPatterns`. It's a property of the pain, like
  sensations and area details, which Repeat already copies.
- **Edit** loads and saves it.

**Insights and exports.**

- **Insights:** "Most recorded locations" rows gain "mostly comes and
  goes" or "mostly steady" when at least half of that area's check-ins
  recorded a pattern.
- **Appointment summary:** per-entry "Pattern: Left lower back — comes
  and goes".
- **CSV export:** one new column, `areaPatterns`.

**AI payload (needs approval).** If approved, it would send per entry
`patterns: [{ "location": "Left lower back", "pattern": "comes and goes" }]`
using the same region labels the payload already uses.

---

## 4. "Pain woke me"

### UI placement

In **Add context**, a single toggle chip, "Pain woke me", directly after
the Sleep select in the compact grid. It is unpressed by default, and
tapping it again unpresses it.

### Data model

In `context`:

```ts
painWokeMe?: true;
```

Only `true` is stored. An unpressed chip stores nothing. A chip can't
tell "didn't wake me" apart from "didn't answer", so Insights treats a
missing value as unknown, never as "slept through".

### Repeat last and edit

- **Repeat last** does not copy it; it's about one night.
- **Edit** loads and saves it.

### Insights and exports

- **Insights:** in a sleep line, "Pain woke you on 4 nights (of 11 with a
  sleep answer)." Nights count once per day, like interference.
- **Appointment summary:** per-entry "Sleep: poor; pain woke me".
- **CSV export:** one new column, `painWokeMe`.

### Sleep is covered here only

"Pain woke me" is the only pain-and-sleep field. Sleep is not one of the
"got in the way of" chips (section 1), so the two never overlap.

### AI payload (needs approval)

If approved, it would send `painWokeMe: true` per entry when set.

---

## Migration for existing entries

All new fields are optional, so every existing entry is already valid
under the new schema. **No existing entry is rewritten**, and IndexedDB
needs no Dexie version change because no index changes.

The version number still changes, to protect backups:

- `painEntrySchema.schemaVersion` accepts `1 | 2`. New and edited entries
  are written as `2`; untouched old entries stay `1`.
- The backup envelope (`src/features/backup/backup.ts`) is written as
  `schemaVersion: 2`, and import accepts `1` and `2`.

**Why bump at all:** Zod's default object parsing silently strips unknown
keys. An older cached copy of the app (the PWA updates automatically, but
not instantly) restoring a newer backup would drop the new fields without
warning. With the bump, the older app rejects the backup visibly instead.
It's a trade-off: a clear error rather than silent data loss.

**Tests:**

- a v1 entry and a v1 backup still parse and import
- a v2 entry round-trips every new field through backup and restore
- schema rejections:
  - `interferenceAreas` without `a-lot` or `unable`
  - an `activityEffects` key not in `activities`
  - an `activityEffects` key of "Poor sleep"
  - an `areaPatterns` region not in `regions`

`docs/data-model.md` is updated alongside.

## Proving the basic check-in stays under 30 seconds

A Playwright script can't measure how long a person takes. What it can
prove is that nothing new was added to the basic path, and that the path
has no new waiting. The human phone review in `docs/test-strategy.md`
still judges the "comfortably under 30 seconds" feel.

New file `tests/e2e/check-in-budget.spec.ts`, run on both existing
projects (Pixel 7 mobile and desktop):

1. **Same required steps.**
   - From Today, the basic path is exactly four actions: New check-in,
     tap "Left lower back", set intensity, Save.
   - Save is enabled after location + intensity without touching any new
     control.
2. **New controls are hidden by default.**
   - Before Save, none of these is visible: "Did pain get in the way",
     "Made worse", "Steady", "Pain woke me".
   - Add context is collapsed.
3. **Nothing is stored by default.**
   - After Save, the stored entry (read via the History detail dialog or
     backup download) contains none of: `interference`,
     `interferenceAreas`, `activityEffects`, `areaPatterns`,
     `painWokeMe`.
   - This includes the case where an earlier check-in recorded a pattern
     for that region, so the pre-fill rule is tested too.
4. **Time budget with human pacing.**
   - Each of the four actions gets a fixed 4-second "person deciding"
     pause, which is generous on purpose.
   - The test asserts the whole path, from page load to "Check-in saved
     privately on this device.", finishes in under 30 seconds of wall
     clock.
   - The pauses total 16 seconds, so this fails if the app adds roughly
     14 seconds of loading, blocking, or extra steps. It is a regression
     guard, not a claim about real people.
5. **Repeat last stays about 10 seconds**, as the product intent in the
   handoff doc says. Two actions (Repeat last, Save) with the same pacing
   finish in under 10 seconds.

The existing test "a basic check-in is short, deliberate, and persists"
stays as it is.

## Build order (if approved)

Each step is independently shippable and leaves the basic path untouched:

1. Schema version bump and backup handling (no UI), with migration tests.
2. Derived timing in Insights (3a). No data change, so it's the cheapest
   win.
3. "Pain woke me" (4).
4. Daily-life impact (1).
5. Activity markers (2).
6. Steady or comes and goes (3b).

`check-in-budget.spec.ts` lands with step 3, the first change to the
check-in UI, and runs for every step after. Every step runs
`npm run check` and `npm run test:e2e`, plus a phone-viewport review of
the check-in and Insights flows.

## Decisions (product owner, 2026-10-20)

1. **Attributed markers.** `docs/plans/narrative-eval.md` gets an
   attributed-marker rule now. Sending markers to the AI stays a separate
   approval, after the baseline evaluation.
2. **Derived timing.** "New area" and "recorded since" are in-app only
   and never sent to the AI. The AI payload uses only data inside the
   chosen range.
3. **Pattern pre-fill.** A pre-filled pattern is saved only if Add
   context was opened during that check-in.
4. **Sleep overlap.** No markers on "Poor sleep". "Sleep" is removed from
   the impact chips, since "Pain woke me" covers it. The impact chips are
   Work, Exercise, Chores, Social.
5. **Thresholds.** 30-day "new area" lookback and 14-day run gap, as
   named constants.
6. **PEG enjoyment of life.** No new chip; Mood covers it.
7. **AI payload for the other new fields** (interference, activity
   markers, patterns, "Pain woke me"). Still not sent. Each needs
   separate explicit approval.

## Implementation notes (2026-10-22, `feat/iteration-c`)

- Built as planned, in one commit. Schema version 2 for new and edited
  entries and for backups; version 1 entries and backups still load.
- **"New in this period"** uses the new-area rule (no recording of that
  area in the previous 30 days), for CHOIR regions and precision areas.
  Insights hides the block when every area in the range is new (for
  example the first period of data, or the seeded demo), and otherwise
  shows 3 areas plus "And N more" (`NEW_AREAS_SHOWN`; product-owner
  decision, 2026-10-22). The appointment summary still lists every new
  area.
- **"Recorded since"** shows "since Oct 3 · recorded on 9 of 15 days",
  where the span runs from the start of the current run to the latest
  recording on or before the range end. A caption says check-ins are
  samples, not how long pain has lasted.
- **Pre-fill:** tapping either chip on a pre-filled row makes it the
  person's choice (the "from last time" tag goes); tapping their own
  pressed chip clears it, and a cleared row doesn't pre-fill again.
- Marker and pattern chips are 44 px tall for touch.
- The seeded demo data now includes impact, markers, patterns and "Pain
  woke me", so the new Insights blocks show in the demo.
- `tests/e2e/check-in-budget.spec.ts` covers the four-action path under
  30 seconds with 4-second pauses, the hidden controls, nothing stored by
  default (including with an earlier pattern to pre-fill), Repeat last
  under 10 seconds, and the new controls saving and showing in Insights.
- `aiSummary.test.ts` checks that none of the new fields reaches the AI
  request.
