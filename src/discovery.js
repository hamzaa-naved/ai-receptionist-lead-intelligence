import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import { JOB_DOMAINS, NICHE_QUERY, QUERY_FAMILIES } from './constants.js';
import { domainOf, normalizeUrl, normalizeWhitespace, unique } from './utils.js';

export function buildQueries({ niches, states }) {
  const nicheExpr = (niches || ['electrical']).map(n => NICHE_QUERY[n] || `(${JSON.stringify(n)})`).join(' OR ');
  const queries = [];
  for (const state of states) {
    for (const role of QUERY_FAMILIES) {
      queries.push(`${role} (${nicheExpr}) jobs ${state}`);
    }
  }
  return queries;
}

export async function fetchSerp(query, proxyUrl, pages = 1) {
  const url = new URL('http://www.google.com/search');
  url.searchParams.set('q', query);
  url.searchParams.set('numPages', String(pages));
  url.searchParams.set('tbs', 'qdr:m');
  url.searchParams.set('hl', 'en');
  const { body } = await gotScraping({
    url: url.toString(),
    proxyUrl,
    timeout: { request: 45000 },
    retry: { limit: 2 },
    headers: { 'accept-language': 'en-US,en;q=0.9' }
  });
  return parseGoogleResults(body);
}

export function parseGoogleResults(html) {
  const $ = cheerio.load(html || '');
  const results = [];
  $('a').each((_, a) => {
    const h3 = $(a).find('h3').first();
    if (!h3.length) return;
    const title = normalizeWhitespace(h3.text());
    const url = normalizeUrl($(a).attr('href'));
    if (!url || !/^https?:/i.test(url)) return;
    const d = domainOf(url);
    if (/google\./i.test(d)) return;
    const container = $(a).closest('div.MjjYud, div.tF2Cxc, div').first();
    const text = normalizeWhitespace(container.text());
    const snippet = text.replace(title, '').trim().slice(0, 900);
    results.push({ title, url, domain: d, snippet });
  });
  const dedup = new Map();
  for (const r of results) if (!dedup.has(r.url)) dedup.set(r.url, r);
  return [...dedup.values()];
}

export function looksLikeJobResult(result) {
  const d = result.domain || domainOf(result.url);
  if (JOB_DOMAINS.some(x => d === x || d.endsWith(`.${x}`))) return true;
  return /job|career|hiring|receptionist|customer service|dispatcher|scheduler|CSR/i.test(`${result.title} ${result.snippet} ${result.url}`);
}

export async function fetchHtml(url, proxyUrl = null) {
  const opts = {
    url,
    timeout: { request: 45000 },
    retry: { limit: 2 },
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9'
    }
  };
  if (proxyUrl) opts.proxyUrl = proxyUrl;
  const res = await gotScraping(opts);
  return { html: res.body, statusCode: res.statusCode, finalUrl: res.url || url };
}

export function selectOfficialWebsite(results, company) {
  const companyTokens = company.toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length >= 3);
  const blocked = /indeed|linkedin|ziprecruiter|glassdoor|facebook|instagram|yelp|bbb|mapquest|yellowpages|angi|thumbtack|jobright|talent|jooble|simplyhired/i;
  const candidates = results.filter(r => {
    if (blocked.test(r.domain)) return false;
    if (/job|career|hiring/i.test(r.url)) return false;
    const hay = `${r.title} ${r.snippet} ${r.domain}`.toLowerCase();
    const hits = companyTokens.filter(t => hay.includes(t)).length;
    return hits >= Math.min(2, Math.max(1, companyTokens.length));
  });
  return candidates[0]?.url || null;
}

export function uniqueResults(results) {
  const map = new Map();
  for (const r of results) {
    const key = normalizeUrl(r.url);
    if (key && !map.has(key)) map.set(key, r);
  }
  return [...map.values()];
}
