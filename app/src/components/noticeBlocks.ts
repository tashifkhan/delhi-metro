import type { NoticeBlock } from '../types';

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&ndash;': '–',
  '&mdash;': '—',
};

function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&[a-z]+;|&#39;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity);
}

function clean(html: string): string {
  return decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/**
 * Turn a notice's HTML into text blocks, for API deploys that don't send
 * `body_blocks` yet and for notices saved before they did. Only text survives:
 * scripts, styles and buttons are dropped, and links keep their text.
 */
export function blocksFromHtml(html: string): NoticeBlock[] {
  const body = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, '');
  const blocks: NoticeBlock[] = [];
  const pattern = /<(h[1-6]|p|li|div)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body))) {
    const tag = match[1].toLowerCase();
    // A div that wraps other blocks is handled through its children.
    if (tag === 'div' && /<(p|h[1-6]|li|div)\b/i.test(match[2])) continue;
    const text = clean(match[2]);
    if (!text) continue;
    blocks.push({ type: tag.startsWith('h') ? 'heading' : tag === 'li' ? 'list_item' : 'paragraph', text });
  }
  if (blocks.length === 0) {
    const text = clean(body);
    if (text) blocks.push({ type: 'paragraph', text });
  }
  return blocks;
}

function key(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Drop the blocks that repeat what the card already shows: a "Press release"
 * label and the headline, which is the card's title.
 */
export function readableBlocks(blocks: NoticeBlock[], title: string): NoticeBlock[] {
  const titleKey = key(title);
  return blocks.filter((block) => {
    if (block.type === 'link') return Boolean(block.href);
    const k = key(block.text);
    if (!k) return false;
    if (k === 'press release') return false;
    if (titleKey.length > 12 && k === titleKey) return false;
    return true;
  });
}
