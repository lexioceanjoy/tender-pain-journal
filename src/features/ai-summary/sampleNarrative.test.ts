import { checkBannedLanguage, checkComplete, checkLength } from '../../../eval/narrative/checks';
import { SAMPLE_NARRATIVE } from './sampleNarrative';

// Shown to every visitor without the demo passphrase, so it is held to the
// same non-diagnostic contract as a generated narrative (ADR 0008,
// docs/plans/narrative-eval.md).
describe('SAMPLE_NARRATIVE', () => {
  it('passes the Tier 1 banned-language check', () => {
    expect(checkBannedLanguage(SAMPLE_NARRATIVE).filter((finding) => finding.tier === 'fail')).toEqual([]);
  });

  it('is within the length limit and ends with a complete sentence', () => {
    expect([...checkLength(SAMPLE_NARRATIVE), ...checkComplete(SAMPLE_NARRATIVE)]).toEqual([]);
  });
});
