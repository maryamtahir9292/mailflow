/**
 * Extracts readable plain-text from a Gmail message payload.
 * Prefers text/plain. Falls back to text/html with HTML stripping.
 */
export function extractBody(payload) {
  if (!payload) return '';

  const plain = findPart(payload, 'text/plain');
  if (plain) return cleanText(decodeEntities(decode(plain)));

  const html = findPart(payload, 'text/html');
  if (html) return cleanText(stripHtml(decode(html)));

  return '';
}

// ── Helpers ────────────────────────────────────────────────────────────────

function findPart(payload, mimeType) {
  if (payload.mimeType === mimeType && payload.body?.data) return payload.body.data;
  for (const part of payload.parts || []) {
    const found = findPart(part, mimeType);
    if (found) return found;
  }
  return null;
}

function decode(data) {
  return Buffer.from(data, 'base64').toString('utf8');
}

/**
 * Strips HTML entities — shared by both plain-text and HTML paths.
 */
function decodeEntities(text) {
  return text
    .replace(/&zwnj;/gi,  '')
    .replace(/&zwsp;/gi,  '')
    .replace(/&shy;/gi,   '')
    .replace(/&#x[0-9a-f]+;/gi, '')
    .replace(/&#\d+;/g,   '')
    .replace(/&nbsp;/gi,  ' ')
    .replace(/&amp;/gi,   '&')
    .replace(/&lt;/gi,    '<')
    .replace(/&gt;/gi,    '>')
    .replace(/&quot;/gi,  '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&[a-z][a-z0-9.]*;/gi, '');
}

// Newsletter footer keywords — lines containing these are stripped
const FOOTER_PATTERNS = [
  /unsubscribe/i,
  /manage\s+(your\s+)?(subscription|preferences)/i,
  /email\s+preferences/i,
  /you('re| are) receiving this (because|email)/i,
  /view\s+(this\s+)?(email|newsletter)\s+in\s+(your\s+)?browser/i,
  /privacy\s+policy/i,
  /terms\s+of\s+(service|use)/i,
  /\u00a9\s*\d{4}/,     // © 2024
  /all rights reserved/i,
];

/**
 * Cleans plain text:
 * - Strips URLs in [ ] or ( ) — e.g. "Click here [ https://... ]"
 * - Strips bare URL-only lines
 * - Strips newsletter footer lines (unsubscribe, privacy policy, etc.)
 * - Deduplicates repeated lines (newsletters echo content twice)
 * - Collapses blank lines, truncates to 3000 chars
 */
function cleanText(text) {
  // 1. Remove embedded URLs in brackets/parens, then collapse leftover spaces
  let out = text
    .replace(/\[\s*https?:\/\/[^\]]*\]/g, '')
    .replace(/\(\s*https?:\/\/[^\)]{10,}\)/g, '')
    .replace(/[ \t]{2,}/g, ' ');  // collapse double spaces left after URL removal

  // 2. Process line by line — remove URL-only lines, footer lines, deduplicate
  const seenLines = new Set();
  const lines = out.split('\n');
  const kept = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip bare URL lines (bare or wrapped in angle brackets)
    if (/^<?https?:\/\/\S+>?$/.test(trimmed)) continue;
    if (trimmed.length > 0 && /^https?:\/\//.test(trimmed) && !/\s/.test(trimmed)) continue;

    // Skip lines that are only leftover brackets/punctuation
    if (/^[\[\](){}<>|*\-=_]{1,5}$/.test(trimmed)) continue;

    // Skip newsletter footer lines
    if (trimmed.length > 0 && FOOTER_PATTERNS.some(p => p.test(trimmed))) continue;

    // Deduplicate — normalise line for comparison
    const key = trimmed.toLowerCase().replace(/\s+/g, ' ');
    if (key.length > 12 && seenLines.has(key)) continue;
    if (key.length > 12) seenLines.add(key);

    kept.push(line);
  }

  out = kept.join('\n')
    .replace(/^[ \t]+$/gm, '')   // lines with only spaces → empty
    .replace(/\n{3,}/g, '\n\n')  // 3+ blank lines → 1
    .trim();

  // 3. Truncate very long emails
  if (out.length > 3000) {
    out = out.slice(0, 3000) + '\n\n[— email truncated —]';
  }

  return out;
}

function stripHtml(html) {
  return decodeEntities(
    html
      .replace(/<!--\[if[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<\/?(p|div|tr|li|br|h[1-6]|blockquote|pre)[^>]*>/gi, '\n')
      .replace(/<\/?(td|th)[^>]*>/gi, ' ')
      .replace(/<a[^>]+href="https?:\/\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]{2,}/g, ' ')
  );
}
