import * as cheerio from 'cheerio';
import { ageDays, normalizeUrl, normalizeWhitespace, stripHtml } from './utils.js';

function flattenJsonLd(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) {
    for (const value of node) flattenJsonLd(value, out);
  } else if (typeof node === 'object') {
    out.push(node);
    for (const value of Object.values(node)) if (value && typeof value === 'object') flattenJsonLd(value, out);
  }
  return out;
}

function salaryFromJob(job) {
  const base = job?.baseSalary;
  if (!base) return null;
  if (typeof base === 'string') return base;
  const currency = base.currency || '';
  const value = base.value || base;
  if (typeof value === 'number') return `${currency} ${value}`.trim();
  if (value && typeof value === 'object') {
    const min = value.minValue ?? value.value;
    const max = value.maxValue;
    const unit = value.unitText ? `/${value.unitText}` : '';
    if (min != null && max != null) return `${currency} ${min}-${max}${unit}`.trim();
    if (min != null) return `${currency} ${min}${unit}`.trim();
  }
  return null;
}

function locationFromJob(job) {
  if (job?.jobLocationType === 'TELECOMMUTE') return 'Remote';
  const locations = Array.isArray(job?.jobLocation) ? job.jobLocation : [job?.jobLocation].filter(Boolean);
  return locations.map(location => {
    const address = location?.address || location;
    return [address?.addressLocality, address?.addressRegion, address?.addressCountry].filter(Boolean).join(', ');
  }).filter(Boolean).join(' / ') || null;
}

function descriptionFromDom($) {
  const selectors = [
    '#jobDescriptionText','[data-testid="job-description"]','[data-testid*="jobDescription"]',
    '[itemprop="description"]','.job-description','.jobDescription','.description','main article','main'
  ];
  for (const selector of selectors) {
    const text = normalizeWhitespace($(selector).first().text());
    if (text.length >= 150) return text.slice(0, 70000);
  }
  return '';
}

function inferCompanyFromTitle(title = '') {
  const cleaned = title.replace(/\s+[|–—-]\s+(Indeed|LinkedIn|Glassdoor|ZipRecruiter).*$/i, '');
  const match = cleaned.match(/(?:at|@)\s+(.+?)$/i);
  return match ? match[1].trim() : '';
}

function inferLocation(text = '') {
  const match = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/);
  return match ? `${match[1]}, ${match[2]}` : null;
}

function inferSalary(text = '') {
  const match = text.match(/\$\s?\d{2,3}(?:\.\d{1,2})?\s*(?:-|–|to)\s*\$?\s?\d{2,3}(?:\.\d{1,2})?\s*(?:an?\s+)?(?:hour|hr)|\$\s?\d{2,3}(?:,\d{3})?\s*(?:-|–|to)\s*\$?\s?\d{2,3}(?:,\d{3})?\s*(?:an?\s+)?year/i);
  return match ? normalizeWhitespace(match[0]) : null;
}

function inferRemote(job, text = '') {
  if (job?.jobLocationType === 'TELECOMMUTE') return 'remote';
  if (/\bfully remote\b|\b100% remote\b|\bwork from home\b|\bremote position\b/i.test(text)) return 'remote';
  if (/\bhybrid\b|\bremote and in[- ]office\b|\bin[- ]office and remote\b/i.test(text)) return 'hybrid';
  if (/\bon[- ]site\b|\bin[- ]office\b/i.test(text)) return 'onsite';
  return 'unknown';
}

export function extractJobPage(html, url, serp = {}) {
  const $ = cheerio.load(html || '');
  const nodes = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try { flattenJsonLd(JSON.parse($(element).contents().text()), nodes); } catch {}
  });
  const structured = nodes.find(node => {
    const type = node?.['@type'];
    return type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'));
  });
  const bodyText = normalizeWhitespace($('body').text()).slice(0, 100000);
  const domDescription = descriptionFromDom($);
  const metaDescription = normalizeWhitespace($('meta[name="description"]').attr('content') || '');
  const description = stripHtml(structured?.description || domDescription || metaDescription || serp.snippet || '');
  const descriptionSource = structured?.description ? 'json_ld' : domDescription ? 'dom' : metaDescription ? 'meta' : serp.snippet ? 'serp_snippet' : 'none';
  const title = normalizeWhitespace(structured?.title || $('meta[property="og:title"]').attr('content') || $('title').text() || serp.title || '');
  const canonical = normalizeUrl($('link[rel="canonical"]').attr('href') || $('meta[property="og:url"]').attr('content') || url) || url;
  const company = normalizeWhitespace(structured?.hiringOrganization?.name || inferCompanyFromTitle(title));
  const datePosted = structured?.datePosted || structured?.datePublished || null;
  const validThrough = structured?.validThrough || null;
  const employmentType = Array.isArray(structured?.employmentType) ? structured.employmentType.join(', ') : structured?.employmentType || null;
  const location = locationFromJob(structured) || inferLocation(`${title} ${description}`);
  return {
    jobUrl: canonical,
    discoveredUrl: url,
    sourceTitle: serp.title || null,
    sourceSnippet: serp.snippet || null,
    title,
    company,
    description,
    descriptionSource,
    descriptionChars: description.length,
    datePosted,
    validThrough,
    employmentType,
    location,
    salaryText: salaryFromJob(structured) || inferSalary(bodyText),
    remoteType: inferRemote(structured, `${title} ${description}`),
    structuredJob: Boolean(structured),
    postingAgeDays: ageDays(datePosted)
  };
}
