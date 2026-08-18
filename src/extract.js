import * as cheerio from 'cheerio';
import { ageDays, findEmails, findPhones, normalizeWhitespace, stripHtml, unique } from './utils.js';

function flattenJsonLd(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) {
    for (const x of node) flattenJsonLd(x, out);
    return out;
  }
  if (typeof node === 'object') {
    out.push(node);
    if (node['@graph']) flattenJsonLd(node['@graph'], out);
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') flattenJsonLd(value, out);
    }
  }
  return out;
}

function salaryFromJob(job) {
  const b = job?.baseSalary;
  if (!b) return null;
  if (typeof b === 'string') return b;
  const currency = b.currency || '';
  const v = b.value || b;
  if (typeof v === 'number') return `${currency} ${v}`.trim();
  if (v && typeof v === 'object') {
    const min = v.minValue ?? v.value;
    const max = v.maxValue;
    const unit = v.unitText ? `/${v.unitText}` : '';
    if (min != null && max != null) return `${currency} ${min}-${max}${unit}`.trim();
    if (min != null) return `${currency} ${min}${unit}`.trim();
  }
  return null;
}

function locationFromJob(job) {
  if (job?.jobLocationType === 'TELECOMMUTE') {
    const req = job?.applicantLocationRequirements;
    const label = Array.isArray(req) ? req.map(x => x?.name).filter(Boolean).join(', ') : req?.name;
    return label ? `Remote (${label})` : 'Remote';
  }
  const locs = Array.isArray(job?.jobLocation) ? job.jobLocation : [job?.jobLocation].filter(Boolean);
  const parts = locs.map(loc => {
    const a = loc?.address || loc;
    return [a?.addressLocality, a?.addressRegion, a?.addressCountry].filter(Boolean).join(', ');
  }).filter(Boolean);
  return parts.join(' / ') || null;
}

export function extractJobPage(html, url, serp = {}) {
  const $ = cheerio.load(html || '');
  const ld = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).contents().text());
      flattenJsonLd(parsed, ld);
    } catch {}
  });
  const job = ld.find(x => {
    const t = x?.['@type'];
    return t === 'JobPosting' || (Array.isArray(t) && t.includes('JobPosting'));
  });

  const pageText = normalizeWhitespace($('body').text()).slice(0, 70000);
  const title = normalizeWhitespace(job?.title || $('meta[property="og:title"]').attr('content') || $('title').text() || serp.title || '');
  const description = stripHtml(job?.description || $('meta[name="description"]').attr('content') || serp.snippet || pageText.slice(0, 12000));
  const company = normalizeWhitespace(job?.hiringOrganization?.name || $('meta[property="og:site_name"]').attr('content') || inferCompanyFromTitle(title));
  const datePosted = job?.datePosted || job?.datePublished || null;
  const validThrough = job?.validThrough || null;
  const employmentType = Array.isArray(job?.employmentType) ? job.employmentType.join(', ') : job?.employmentType || null;
  const location = locationFromJob(job) || inferLocationFromText(`${title} ${description}`);
  const salaryText = salaryFromJob(job) || inferSalary(pageText);
  const remoteType = inferRemote(job, `${title} ${description} ${pageText.slice(0,15000)}`);

  return {
    jobUrl: url,
    sourceTitle: serp.title || null,
    sourceSnippet: serp.snippet || null,
    title,
    company,
    description,
    datePosted,
    validThrough,
    employmentType,
    location,
    salaryText,
    remoteType,
    pageText: pageText.slice(0, 30000),
    emails: findEmails(pageText),
    phones: findPhones(pageText),
    structuredJob: Boolean(job),
    postingAgeDays: ageDays(datePosted)
  };
}

function inferCompanyFromTitle(title = '') {
  const cleaned = title.replace(/\s+[|–—-]\s+(Indeed|LinkedIn|Glassdoor|ZipRecruiter).*$/i, '');
  const m = cleaned.match(/(?:at|@)\s+(.+?)$/i);
  return m ? m[1].trim() : '';
}

function inferLocationFromText(text = '') {
  const m = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/);
  return m ? `${m[1]}, ${m[2]}` : null;
}

function inferSalary(text = '') {
  const m = text.match(/\$\s?\d{2,3}(?:\.\d{1,2})?\s*(?:-|–|to)\s*\$?\s?\d{2,3}(?:\.\d{1,2})?\s*(?:an?\s+)?(?:hour|hr)|\$\s?\d{2,3}(?:,\d{3})?\s*(?:-|–|to)\s*\$?\s?\d{2,3}(?:,\d{3})?\s*(?:an?\s+)?year/i);
  return m ? normalizeWhitespace(m[0]) : null;
}

function inferRemote(job, text = '') {
  if (job?.jobLocationType === 'TELECOMMUTE') return 'remote';
  const t = text.toLowerCase();
  if (/\bfully remote\b|\b100% remote\b|\bwork from home\b|\bremote position\b/.test(t)) return 'remote';
  if (/\bhybrid\b|\bremote and in[- ]office\b|\bin[- ]office and remote\b/.test(t)) return 'hybrid';
  if (/\bon[- ]site\b|\bin[- ]office\b/.test(t)) return 'onsite';
  return 'unknown';
}

export function extractCompanyPage(html, url) {
  const $ = cheerio.load(html || '');
  const text = normalizeWhitespace($('body').text()).slice(0, 70000);
  const links = [];
  $('a[href]').each((_, el) => {
    try { links.push(new URL($(el).attr('href'), url).toString()); } catch {}
  });
  const social = unique(links.filter(x => /facebook\.com|instagram\.com|linkedin\.com|youtube\.com|tiktok\.com|x\.com|twitter\.com/i.test(x))).slice(0, 10);
  return {
    url,
    title: normalizeWhitespace($('title').text()),
    text: text.slice(0, 40000),
    phones: findPhones(text),
    emails: findEmails(text),
    social,
    candidateLinks: unique(links.filter(x => /\/(about|services|contact|team|careers|jobs|faq)(?:\/|$|\?)/i.test(x))).slice(0, 8)
  };
}
