# Milestone 02 review

## User outcome

Tender now supports the basic lifecycle needed for ongoing personal use: record an episode at the correct time, inspect what was saved, correct a record later, remove an unwanted record deliberately, and see whether a recent backup has been downloaded.

## Delivered

- Editable occurrence date and time, defaulting to now
- Detailed history dialog with locations, area-specific values, refined locations, context, medication, and note
- Load-for-edit flow that preserves the record's private identity and creation time
- Permanent deletion behind a second confirmation
- Fourteen-day backup recency reminder stored only on the current device
- Backward-compatible version-one entry format and backup parsing

## Verification

- Twenty-eight automated tests pass across nine test files.
- TypeScript compilation and the production PWA build pass.
- Create/update identity preservation, history detail, delete confirmation, and backup timing have targeted automated coverage.

## Product limits retained deliberately

- Records and backup-reminder state remain local to the browser.
- A downloaded backup is not encrypted by Tender and must be stored somewhere the person controls.
- The local observations are not diagnoses.
- AI narrative remains unimplemented until the consent, data minimisation, service, and retention design are agreed.
- Deployment is separate from cloud sync: hosting the app code does not itself sync diary records.

## Next decision

Choose how the phone-installable build should be hosted: private/unlisted for personal testing, or public for portfolio use. That decision affects access and disclosure, so it is not made automatically.
