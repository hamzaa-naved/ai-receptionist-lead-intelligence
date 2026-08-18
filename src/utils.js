import crypto from 'node:crypto';

export function normalizeWhitespace(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

export function stripHtml(value = '') {
  return normalizeWhitespace(String(value).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

export function normalizeUrl(raw) {
  if (!raw) return null;
  try {
    let url = raw;
    if (raw.startsWith('/url?')) {
      const parsed = new URL(raw, 'http://www.google.com');
      url = parsed.searchParams.get('q') || parsed.searchParams.get('url');
    }
    const u = new URL(url);
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|gclid|fbclid|ved$|sa$|source$)/i.test(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return null;
  }
}

export function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

export function companyKey(company = '', location = '', website = '') {
  const domain = domainOf(website);
  const material = `${company.toLowerCase().replace(/[^a-z0-9]+/g,'')}|${location.toLowerCase()}|${domain}`;
  return crypto.createHash('sha1').update(material).digest('hex');
}

export function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? null : d;
}

export function ageDays(value, now = new Date()) {
  const d = parseDate(value);
  if (!d) return null;
  return Math.max(0, Math.floor((now - d) / 86400000));
}

export function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

export function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function findEmails(text = '') {
  return unique((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
    .filter(x => !/example\.|sentry\.|wixpress\.|cloudflare/i.test(x))).slice(0, 5);
}

export function findPhones(text = '') {
  const raw = text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g) || [];
  return unique(raw.map(normalizeWhitespace)).slice(0, 5);
}

export function extractNumberRange(text = '', regex) {
  const m = text.match(regex);
  if (!m) return null;
  const nums = m.slice(1).filter(Boolean).map(x => Number(String(x).replace(/,/g,''))).filter(Number.isFinite);
  if (!nums.length) return null;
  return nums.length === 1 ? { min: nums[0], max: nums[0] } : { min: Math.min(...nums), max: Math.max(...nums) };
}
