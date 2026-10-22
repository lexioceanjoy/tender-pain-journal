import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NarrativeText, parseNarrative } from './NarrativeText';

function html(text: string) {
  return render(<NarrativeText text={text} />).container.innerHTML;
}

describe('NarrativeText', () => {
  it('renders paragraphs, joining single newlines inside a block', () => {
    expect(parseNarrative('First line\nsame paragraph.\n\nSecond.')).toEqual([
      { type: 'p', inlines: [{ text: 'First line same paragraph.', bold: false }] },
      { type: 'p', inlines: [{ text: 'Second.', bold: false }] }
    ]);
  });

  it('renders consecutive "- ", "* " or "• " lines as one list', () => {
    expect(html('Intro.\n- one\n* two\n• three')).toBe(
      '<div class="narrative-text"><p><span>Intro.</span></p><ul><li><span>one</span></li><li><span>two</span></li><li><span>three</span></li></ul></div>'
    );
  });

  it('renders **bold** and __bold__ as strong', () => {
    expect(html('**Change over time:** rose and __fell__.')).toBe(
      '<div class="narrative-text"><p><strong>Change over time:</strong><span> rose and </span><strong>fell</strong><span>.</span></p></div>'
    );
  });

  it('turns a heading into a bold paragraph without the #', () => {
    expect(html('## Summary\nText.')).toBe('<div class="narrative-text"><p><strong>Summary</strong></p><p><span>Text.</span></p></div>');
  });

  it('keeps link text but never creates a link', () => {
    const output = html('See [the notes](https://example.com) and https://example.org.');
    expect(output).not.toContain('<a');
    expect(output).not.toContain('example.com');
    expect(output).toContain('See the notes and https://example.org.');
  });

  it('removes images and HTML tags, keeping inner text', () => {
    const output = html('Before ![x](https://evil.example/p.png)<img src=x onerror="alert(1)"><b>bold</b> <script>alert(2)</script>after.');
    expect(output).not.toMatch(/<img|<script|<b>|onerror|evil\.example/);
    expect(output).toContain('Before bold alert(2)after.');
  });

  it('renders javascript: links and nested markers as inert text', () => {
    const output = html('[click](javascript:alert(1)) ***x*** `code` _y_');
    expect(output).not.toContain('<a');
    expect(output).not.toContain('javascript:');
    expect(output).not.toMatch(/\*|`/);
  });

  it('drops stray markers, table pipes, blockquote markers and rules', () => {
    expect(html('> quoted *text*\n\n| a | b |\n\n---')).toBe(
      '<div class="narrative-text"><p><span>quoted text</span></p><p><span>a b</span></p></div>'
    );
  });
});
