// Renders AI and sample narratives with a small, safe Markdown subset:
// paragraphs, "- " bullets, and **bold**. Everything else becomes plain
// text: links lose their URL, images and HTML tags are removed, and stray
// markers are dropped. Output is React elements only, never raw HTML, so
// nothing in the model's text can create a link, image, or script.

export type Inline = { text: string; bold: boolean };
export type Block = { type: 'p'; inlines: Inline[] } | { type: 'ul'; items: Inline[][] };

const BULLET = /^\s*[-*•]\s+/;
const HEADING = /^\s*#{1,6}\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

function sanitize(source: string) {
  return source
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<\/?[a-z][^>]*>/gi, '');
}

export function parseInline(text: string, bold = false): Inline[] {
  const inlines: Inline[] = [];
  const pattern = /\*\*([^*]+?)\*\*|__([^_]+?)__/g;
  let last = 0;
  const plain = (value: string) => value.replace(/\*+|`+/g, '').replace(/__+/g, '');
  for (const match of text.matchAll(pattern)) {
    if ((match.index ?? 0) > last) inlines.push({ text: plain(text.slice(last, match.index)), bold });
    inlines.push({ text: plain(match[1] ?? match[2]), bold: true });
    last = (match.index ?? 0) + match[0].length;
  }
  if (last < text.length) inlines.push({ text: plain(text.slice(last)), bold });
  return inlines.filter((inline) => inline.text.length > 0);
}

export function parseNarrative(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: Inline[][] | null = null;

  const flushParagraph = () => {
    const text = paragraph.join(' ').replace(/\s+/g, ' ').trim();
    if (text) blocks.push({ type: 'p', inlines: parseInline(text) });
    paragraph = [];
  };
  const flushList = () => {
    if (list?.length) blocks.push({ type: 'ul', items: list });
    list = null;
  };

  for (const rawLine of sanitize(source).split('\n')) {
    // Blockquote markers and table pipes carry no meaning here.
    const line = rawLine.replace(/^\s*>\s?/, '').replace(/^\s*\|(.*)\|\s*$/, (_, cells: string) => cells.split('|').map((cell) => cell.trim()).join(' '));
    if (!line.trim()) {
      flushParagraph();
      flushList();
    } else if (BULLET.test(line)) {
      flushParagraph();
      list = list ?? [];
      list.push(parseInline(line.replace(BULLET, '').trim()));
    } else if (HEADING.test(line)) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'p', inlines: parseInline(line.replace(HEADING, '').trim(), true) });
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      // A horizontal rule: just a break.
      flushParagraph();
      flushList();
    } else {
      flushList();
      if (NUMBERED.test(line)) flushParagraph();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

function Inlines({ inlines }: { inlines: Inline[] }) {
  return <>{inlines.map((inline, index) => inline.bold ? <strong key={index}>{inline.text}</strong> : <span key={index}>{inline.text}</span>)}</>;
}

export function NarrativeText({ text }: { text: string }) {
  return (
    <div className="narrative-text">
      {parseNarrative(text).map((block, index) => block.type === 'p'
        ? <p key={index}><Inlines inlines={block.inlines} /></p>
        : <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><Inlines inlines={item} /></li>)}</ul>)}
    </div>
  );
}
