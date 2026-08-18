import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import { JOB_DOMAINS, ROLE_FAMILIES, TRADE_QUERIES } from './constants.js';
import { domainOf, normalizeUrl, normalizeWhitespace } from './utils.js';

export function partitionStates(states, partitionIndex = 0, partitionCount = 1) {
  const count = Math.max(1, Number(partitionCount) || 1);
  const index = Math.max(0, Math.min(count - 1, Number(partitionIndex) || 0));
  return states.filter((_, i) => i % count === index);
}

export function buildQueries({ states, roleFamilies, tradeBundles, partitionIndex = 0, partitionCount = 1 }) {
  const selectedStates = partitionStates(states, partitionIndex, partitionCount);
  const selectedRoles = roleFamilies?.length ? roleFamilies : Object.keys(ROLE_FAMILIES);
  const selectedTrades = tradeBundles?.length ? tradeBundles : Object.keys(TRADE_QUERIES);
  const tradeExpression = selectedTrades.map(key => TRADE_QUERIES[key]).filter(Boolean).join(' OR ');
  const queries = [];
  for (const state of selectedStates) {
    for (const roleFamily of selectedRoles) {
      const roleExpression = ROLE_FAMILIES[roleFamily];
      if (!roleExpression) continue;
      queries.push({
        query: `${roleExpression} (${tradeExpression}) jobs "${state}"`,
        state,
        roleFamily,
        tradeBundles: selectedTrades
      });
    }
  }
  return queries;
}

function googleFreshness(days) {
  if (days <= 1) return 'qdr:d';
  if (days <= 7) return 'qdr:w';
  if (days <= 31) return 'qdr:m';
  return null;
}

export async function fetchSerp(querySpec, proxyUrl, pages = 1, freshnessDays = 30) {
  const all = [];
  for (let page = 0; page < pages; page++) {
    // Apify's GOOGLE_SERP proxy only accepts an HTTP target URL. The proxy
    // performs the Google request upstream and returns the search response.
    const url = new URL('http://www.google.com/search');
    url.searchParams.set('q', typeof querySpec === 'string' ? querySpec : querySpec.query);
    url.searchParams.set('num', '10');
    url.searchParams.set('start', String(page * 10));
    url.searchParams.set('hl', 'en');
    url.searchParams.set('filter', '0');
    const tbs = googleFreshness(freshnessDays);
    if (tbs) url.searchParams.set('tbs', tbs);
    const { body } = await gotScraping({
      url: url.toString(),
      proxyUrl,
      timeout: { request: 45000 },
      retry: { limit: 2 },
      headers: { 'accept-language': 'en-US,en;q=0.9' }
    });
    all.push(...parseGoogleResults(body));
  }
  return uniqueResults(all);
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
    const domain = domainOf(url);
    if (/google\./i.test(domain)) return;
    const container = $(a).closest('div.MjjYud, div.tF2Cxc, div').first();
    const text = normalizeWhitespace(container.text());
    const snippet = text.replace(title, '').trim().slice(0, 1200);
    results.push({ title, url, domain, snippet });
  });
  return uniqueResults(results);
}

export function looksLikeJobResult(result) {
  const domain = result.domain || domainOf(result.url);
  if (JOB_DOMAINS.some(x => domain === x || domain.endsWith(`.${x}`))) return true;
  return /\bjob|career|hiring|receptionist|customer service|dispatcher|scheduler|coordinator\b/i.test(`${result.title} ${result.snippet} ${result.url}`);
}

export async function fetchHtml(url, proxyUrl = null) {
  const options = {
    url,
    timeout: { request: 45000 },
    retry: { limit: 2 },
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9'
    }
  };
  if (proxyUrl) options.proxyUrl = proxyUrl;
  const response = await gotScraping(options);
  return { html: response.body, statusCode: response.statusCode, finalUrl: response.url || url };
}

export function uniqueResults(results) {
  const map = new Map();
  for (const result of results) {
    const key = normalizeUrl(result.url);
    if (!key) continue;
    if (!map.has(key)) map.set(key, { ...result, url: key });
  }
  return [...map.values()];
}
