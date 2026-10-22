import { render } from '@testing-library/react';
import { createElement } from 'react';
import { checkBannedLanguage, checkComplete, checkLength } from '../../../eval/narrative/checks';
import { NarrativeText } from './NarrativeText';
import { SAMPLE_NARRATIVE } from './sampleNarrative';

// Shown to every visitor without the demo passphrase, so it is held to the
// same non-diagnostic contract as a generated narrative (ADR 0008,
// docs/plans/narrative-eval.md) and the same v2 format.
describe('SAMPLE_NARRATIVE', () => {
  it('passes the Tier 1 banned-language check', () => {
    expect(checkBannedLanguage(SAMPLE_NARRATIVE).filter((finding) => finding.tier === 'fail')).toEqual([]);
  });

  it('is within the length limit and ends with a complete sentence', () => {
    expect([...checkLength(SAMPLE_NARRATIVE), ...checkComplete(SAMPLE_NARRATIVE)]).toEqual([]);
  });

  it('ends with exactly one limits sentence in the server\'s wording', () => {
    expect(SAMPLE_NARRATIVE.match(/doesn't assess/g)).toHaveLength(1);
    expect(SAMPLE_NARRATIVE.trim().endsWith("This summary doesn't assess whether poor sleep affected pain ratings.")).toBe(true);
  });

  it('renders through NarrativeText with bold labels and no raw markers', () => {
    const { container } = render(createElement(NarrativeText, { text: SAMPLE_NARRATIVE }));
    expect(container.querySelectorAll('strong')).toHaveLength(3);
    expect(container.textContent).not.toContain('**');
  });
});
