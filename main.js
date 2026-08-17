import { Actor } from 'apify';
import * as cheerio from 'cheerio';
import { gotScraping } from 'got-scraping';
import crypto from 'node:crypto';



// ===== constants.js =====
const ALL_US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia',
  'Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts',
  'Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey',
  'New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
  'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming','District of Columbia'
];

const JOB_DOMAINS = [
  'indeed.com','linkedin.com','ziprecruiter.com','glassdoor.com','careerbuilder.com','monster.com',
  'workstream.us','careerplug.com','applicantpro.com','bamboohr.com','paylocity.com','paycomonline.net',
  'greenhouse.io','lever.co','workable.com','smartrecruiters.com','jazzhr.com','applytojob.com',
  'jobvite.com','icims.com','recruitee.com','breezy.hr','ashbyhq.com','jobright.ai','getonbrd.com',
  'simplyhired.com','talent.com','jooble.org','wayup.com','qureos.com','onlinejobs.ph'
];

const SOCIAL_DOMAINS = [
  'facebook.com','instagram.com','linkedin.com','youtube.com','x.com','twitter.com','tiktok.com'
];

const QUERY_FAMILIES = [
  '("customer service representative" OR CSR OR receptionist OR "customer care" OR "call taker")',
  '("service dispatcher" OR dispatcher OR "scheduling coordinator" OR scheduler OR "office assistant" OR "service coordinator")'
];

const NICHE_QUERY = {
  electrical: '(electrician OR "electrical contractor" OR "electrical service" OR "electric company")',
  hvac: '(HVAC OR "heating and cooling" OR "air conditioning")',
  plumbing: '(plumber OR plumbing)',
  roofing: '(roofer OR roofing)',
  restoration: '(restoration OR "water damage" OR "fire damage")',
  garage_door: '("garage door")'
};


// ===== utils.js =====
function normalizeWhitespace(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function stripHtml(value = '') {
  return normalizeWhitespace(String(value).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

function normalizeUrl(raw) {
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

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

function companyKey(company = '', location = '', website = '') {
  const domain = domainOf(website);
  const material = `${company.toLowerCase().replace(/[^a-z0-9]+/g,'')}|${location.toLowerCase()}|${domain}`;
  return crypto.createHash('sha1').update(material).digest('hex');
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? null : d;
}

function ageDays(value, now = new Date()) {
  const d = parseDate(value);
  if (!d) return null;
  return Math.max(0, Math.floor((now - d) / 86400000));
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function findEmails(text = '') {
  return unique((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
    .filter(x => !/example\.|sentry\.|wixpress\.|cloudflare/i.test(x))).slice(0, 5);
}

function findPhones(text = '') {
  const raw = text.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g) || [];
  return unique(raw.map(normalizeWhitespace)).slice(0, 5);
}

function extractNumberRange(text = '', regex) {
  const m = text.match(regex);
  if (!m) return null;
  const nums = m.slice(1).filter(Boolean).map(x => Number(String(x).replace(/,/g,''))).filter(Number.isFinite);
  if (!nums.length) return null;
  return nums.length === 1 ? { min: nums[0], max: nums[0] } : { min: Math.min(...nums), max: Math.max(...nums) };
}


// ===== discovery.js =====
function buildQueries({ niches, states }) {
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

function parseGoogleResults(html) {
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

function looksLikeJobResult(result) {
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

function selectOfficialWebsite(results, company) {
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

function uniqueResults(results) {
  const map = new Map();
  for (const r of results) {
    const key = normalizeUrl(r.url);
    if (key && !map.has(key)) map.set(key, r);
  }
  return [...map.values()];
}


// ===== extract.js =====
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

function extractJobPage(html, url, serp = {}) {
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

function extractCompanyPage(html, url) {
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


// ===== scoring.js =====
const rules = [
  { key: 'electrical', points: 18, re: /\belectric(?:al|ian|ians)?\b|\belectrical contractor\b|\belectrical service/i, label: 'Electrical/home-service company signal' },
  { key: 'homeService', points: 5, re: /\bhome service|homeowner|residential service|field technician|service technician/i, label: 'Home-service operating model' },
  { key: 'role', points: 8, re: /\breceptionist\b|\bcustomer service representative\b|\bCSR\b|\bservice dispatcher\b|\bscheduling coordinator\b|\bservice coordinator\b|\bcall taker\b/i, label: 'Receptionist/CSR/dispatcher role' },
  { key: 'inbound', points: 15, re: /answer(?:ing)? (?:incoming|inbound|customer|phone)? ?calls|handle (?:incoming|inbound) calls|inbound (?:phone )?calls|high call volume|multiple phone lines/i, label: 'Inbound phone-answering responsibility' },
  { key: 'scheduling', points: 15, re: /schedule (?:service|customer|technician|appointment|estimate|job)s?|book(?:ing)? (?:service )?appointments|appointment scheduling|fill(?:ing)? the schedule/i, label: 'Appointment/job scheduling' },
  { key: 'dispatch', points: 9, re: /dispatch(?:ing)? (?:field |service )?technicians?|dispatch board|route technicians|technician dispatch/i, label: 'Technician dispatching' },
  { key: 'followup', points: 6, re: /missed[- ]call|speed[- ]to[- ]lead|follow up (?:with )?(?:leads|customers|unsold estimates)|outbound follow[- ]?up|re[- ]engage/i, label: 'Lead/missed-call follow-up' },
  { key: 'crm', points: 6, re: /ServiceTitan|Housecall Pro|HouseCallPro|Jobber|FieldEdge|Service Fusion|ServiceTrade/i, label: 'Home-service CRM mentioned' },
  { key: 'remote', points: 5, re: /fully remote|100% remote|work from home|remote position|\bhybrid\b/i, label: 'Remote/hybrid accepted' },
  { key: 'emergency', points: 4, re: /after[- ]hours|24\/7|emergency calls?|on[- ]call/i, label: 'After-hours/emergency coverage' },
  { key: 'smallBiz', points: 4, re: /family[- ]owned|locally owned|small (?:business|team|company)|growing (?:local )?(?:business|company|team)|owner[- ]operated/i, label: 'Small/local business signal' },
  { key: 'salary', points: 3, re: /\$\s?\d{2,3}(?:\.\d+)?\s*(?:-|–|to)\s*\$?\s?\d{2,3}|\$\s?\d{2,3},\d{3}/i, label: 'Compensation disclosed' }
];

const negatives = [
  { points: -45, re: /freight dispatcher|truck dispatcher|logistics dispatcher|CDL|fleet dispatch|transportation management system|TMS\b/i, label: 'Freight/logistics role mismatch' },
  { points: -35, re: /medical receptionist|dental receptionist|patient scheduling|healthcare|clinic|hospital/i, label: 'Healthcare role mismatch' },
  { points: -25, re: /hotel front desk|hospitality|guest services|retail store|property leasing/i, label: 'Non-home-service front desk role' },
  { points: -20, re: /software support|SaaS|technical support engineer|IT help desk/i, label: 'Software/IT support mismatch' }
];

function scoreJob(job, company = null, now = new Date()) {
  const text = normalizeWhitespace([
    job.title, job.company, job.description, job.pageText,
    company?.title, company?.text
  ].filter(Boolean).join(' '));

  let score = 0;
  const evidence = [];
  const penalties = [];
  const signals = {};

  for (const rule of rules) {
    const m = text.match(rule.re);
    if (m) {
      score += rule.points;
      signals[rule.key] = true;
      evidence.push({ signal: rule.key, points: rule.points, evidence: rule.label, match: normalizeWhitespace(m[0]).slice(0, 120) });
    } else signals[rule.key] = false;
  }
  for (const rule of negatives) {
    const m = text.match(rule.re);
    if (m) {
      score += rule.points;
      penalties.push({ points: rule.points, evidence: rule.label, match: normalizeWhitespace(m[0]).slice(0, 120) });
    }
  }

  const age = job.postingAgeDays;
  if (age != null) {
    if (age <= 3) { score += 8; evidence.push({ signal: 'freshness', points: 8, evidence: 'Posted in last 3 days', match: `${age} days old` }); }
    else if (age <= 7) { score += 6; evidence.push({ signal: 'freshness', points: 6, evidence: 'Posted in last 7 days', match: `${age} days old` }); }
    else if (age <= 14) { score += 3; evidence.push({ signal: 'freshness', points: 3, evidence: 'Posted in last 14 days', match: `${age} days old` }); }
  }

  const callRange = extractCallVolume(text);
  if (callRange) {
    score += 10;
    evidence.push({ signal: 'callVolume', points: 10, evidence: 'Explicit inbound call volume', match: `${callRange.min}-${callRange.max} calls/day` });
    signals.callVolume = true;
  } else signals.callVolume = false;

  // Synergy bonuses: the combination is much more meaningful than isolated keywords.
  if (signals.inbound && signals.scheduling) {
    score += 7;
    evidence.push({ signal: 'coreWorkflow', points: 7, evidence: 'Core receptionist workflow: answer + book', match: 'Inbound calls + scheduling' });
  }
  if (signals.inbound && signals.dispatch) {
    score += 4;
    evidence.push({ signal: 'serviceDesk', points: 4, evidence: 'Phone-to-technician workflow', match: 'Inbound calls + dispatch' });
  }
  if (signals.electrical && (signals.inbound || signals.scheduling)) {
    score += 5;
    evidence.push({ signal: 'nicheFit', points: 5, evidence: 'Electrical niche + receptionist duties', match: 'Strong niche fit' });
  }

  score = clamp(score);
  return {
    score,
    priority: score >= 90 ? 'HOT' : score >= 80 ? 'HIGH' : score >= 70 ? 'GOOD' : score >= 60 ? 'WATCH' : 'LOW',
    evidence,
    penalties,
    signals,
    callsPerDay: callRange,
    crm: detectCrm(text),
    recommendedAngle: pitchAngle(signals, callRange)
  };
}

function extractCallVolume(text = '') {
  const patterns = [
    /(?:handle|answer|manage|receive|take)?\s*(\d{1,3})\s*(?:-|–|to)\s*(\d{1,3})\s+(?:inbound |incoming |customer )?(?:phone )?calls?\s*(?:per|a|each)?\s*day/i,
    /(\d{1,3})\s*(?:\+)?\s+(?:inbound |incoming |customer )?(?:phone )?calls?\s*(?:per|a|each)?\s*day/i,
    /(?:call volume|volume of)\s*(?:of|:)?\s*(\d{1,3})\s*(?:-|–|to)?\s*(\d{1,3})?\s*(?:calls?)?\s*(?:per|a|each)?\s*day/i
  ];
  for (const p of patterns) {
    const r = extractNumberRange(text, p);
    if (r) return r;
  }
  return null;
}

function detectCrm(text = '') {
  for (const name of ['ServiceTitan','Housecall Pro','Jobber','FieldEdge','Service Fusion','ServiceTrade']) {
    if (new RegExp(name.replace(' ', '\\s*'), 'i').test(text)) return name;
  }
  return null;
}

function pitchAngle(s, callRange) {
  if (callRange && s.inbound) return 'Overflow + missed-call coverage around documented inbound call volume';
  if (s.followup) return 'Speed-to-lead + missed-call recovery + after-hours coverage';
  if (s.remote && s.inbound && s.scheduling) return 'Remote receptionist augmentation for inbound calls and booking';
  if (s.dispatch && s.scheduling) return 'Answer, qualify, schedule, then hand off/dispatch cleanly';
  if (s.inbound && s.scheduling) return '24/7 inbound answering and appointment booking';
  return 'Overflow and after-hours receptionist coverage';
}


// ===== history.js =====
export async function applyHistory(store, lead, nowIso) {
  if (!store) return { ...lead, firstSeen: nowIso, lastSeen: nowIso, timesSeen: 1, repostLikely: false };
  const key = companyKey(lead.company, lead.location, lead.companyWebsite);
  const old = await store.getValue(key);
  const urls = unique([...(old?.jobUrls || []), lead.jobUrl]).slice(-20);
  const timesSeen = (old?.timesSeen || 0) + 1;
  const repostLikely = urls.length >= 2 || timesSeen >= 2;
  const record = {
    company: lead.company,
    location: lead.location,
    companyWebsite: lead.companyWebsite || old?.companyWebsite || null,
    firstSeen: old?.firstSeen || nowIso,
    lastSeen: nowIso,
    timesSeen,
    jobUrls: urls,
    highestScore: Math.max(old?.highestScore || 0, lead.score || 0),
    lastScore: lead.score || 0
  };
  await store.setValue(key, record);
  const repeatBonus = repostLikely ? Math.min(10, 4 + (timesSeen - 1) * 2) : 0;
  return {
    ...lead,
    firstSeen: record.firstSeen,
    lastSeen: record.lastSeen,
    timesSeen,
    repostLikely,
    historyBonus: repeatBonus,
    scoreBeforeHistory: lead.score,
    score: Math.min(100, lead.score + repeatBonus),
    priority: Math.min(100, lead.score + repeatBonus) >= 90 ? 'HOT' : Math.min(100, lead.score + repeatBonus) >= 80 ? 'HIGH' : Math.min(100, lead.score + repeatBonus) >= 70 ? 'GOOD' : lead.priority
  };
}


// ===== main.js =====
await Actor.init();

try {
  const input = await Actor.getInput() || {};
  const states = input.states?.length ? input.states : ALL_US_STATES;
  const niches = input.niches?.length ? input.niches : ['electrical'];
  const freshnessDays = input.freshnessDays ?? 14;
  const minimumScore = input.minimumScore ?? 65;
  const enrichThreshold = input.enrichThreshold ?? 70;
  const maxLeads = input.maxLeads ?? 100;
  const maxSerpRequests = input.maxSerpRequests ?? 120;
  const pages = input.resultsPerQueryPages ?? 1;
  const companyEnrichment = input.companyEnrichment !== false;
  const trackHistory = input.trackHistory !== false;
  const now = new Date();
  const nowIso = now.toISOString();

  Actor.log.info('Starting AI Receptionist Lead Intelligence', { niches, states: states.length, freshnessDays, minimumScore });

  const serpProxy = await Actor.createProxyConfiguration({ groups: ['GOOGLE_SERP'] });
  const normalProxy = await Actor.createProxyConfiguration({ countryCode: 'US' });
  if (!serpProxy) throw new Error('Google SERP proxy is not available on this account.');
  const serpProxyUrl = await serpProxy.newUrl();

  let normalProxyUrl = null;
  try { normalProxyUrl = normalProxy ? await normalProxy.newUrl() : null; } catch {}

  const discovered = [];
  const seedUrls = (input.seedUrls || []).map(x => typeof x === 'string' ? x : x?.url).filter(Boolean);
  for (const url of seedUrls) discovered.push({ url: normalizeUrl(url), title: '', snippet: '', domain: domainOf(url), sourceQuery: 'seed' });

  const queries = buildQueries({ niches, states });
  let serpRequests = 0;
  for (const query of queries) {
    if (serpRequests >= maxSerpRequests) break;
    serpRequests += pages;
    try {
      const found = await fetchSerp(query, serpProxyUrl, pages);
      for (const r of found.filter(looksLikeJobResult)) discovered.push({ ...r, sourceQuery: query });
      Actor.log.info(`SERP ${serpRequests}/${maxSerpRequests}`, { query, results: found.length });
    } catch (err) {
      Actor.log.warning('SERP request failed', { query, error: err.message });
    }
  }

  const candidates = uniqueResults(discovered).slice(0, 2500);
  Actor.log.info('Discovery complete', { candidates: candidates.length, serpRequests });

  const leads = [];
  const seenCompanyJobs = new Set();
  for (let idx = 0; idx < candidates.length; idx++) {
    const serp = candidates[idx];
    if (!serp.url) continue;
    let job;
    try {
      const { html, finalUrl } = await fetchHtml(serp.url, normalProxyUrl);
      job = extractJobPage(html, finalUrl || serp.url, serp);
    } catch (err) {
      // A blocked job board still gives us SERP title/snippet; score it at lower confidence.
      job = extractJobPage('', serp.url, serp);
      job.fetchError = err.message;
    }

    if (!job.title && !job.description) continue;
    if (job.postingAgeDays != null && job.postingAgeDays > freshnessDays) continue;

    let scoring = scoreJob(job, null, now);
    if (scoring.score < Math.min(55, minimumScore)) continue;

    let companyWebsite = null;
    let companyData = null;
    if (companyEnrichment && scoring.score >= enrichThreshold && job.company) {
      try {
        if (serpRequests < maxSerpRequests) {
          const q = `\"${job.company}\" ${job.location || ''} electrician electrical official website`;
          serpRequests += 1;
          const results = await fetchSerp(q, serpProxyUrl, 1);
          companyWebsite = selectOfficialWebsite(results, job.company);
        }
        if (companyWebsite) {
          const home = await fetchHtml(companyWebsite, normalProxyUrl);
          companyData = extractCompanyPage(home.html, home.finalUrl || companyWebsite);
          // Re-score with the company website evidence.
          scoring = scoreJob(job, companyData, now);
        }
      } catch (err) {
        Actor.log.debug('Company enrichment failed', { company: job.company, error: err.message });
      }
    }

    const company = job.company || inferCompanyFromSerp(serp.title);
    const dedupeKey = `${String(company).toLowerCase()}|${job.title.toLowerCase()}|${job.location || ''}`;
    if (seenCompanyJobs.has(dedupeKey)) continue;
    seenCompanyJobs.add(dedupeKey);

    if (scoring.score < minimumScore) continue;

    const lead = {
      score: scoring.score,
      priority: scoring.priority,
      company,
      jobTitle: job.title,
      jobUrl: job.jobUrl,
      sourceDomain: domainOf(job.jobUrl),
      sourceQuery: serp.sourceQuery || null,
      datePosted: job.datePosted,
      postingAgeDays: job.postingAgeDays,
      location: job.location,
      remoteType: job.remoteType,
      employmentType: job.employmentType,
      salaryText: job.salaryText,
      callsPerDay: scoring.callsPerDay,
      crm: scoring.crm,
      recommendedAngle: scoring.recommendedAngle,
      companyWebsite,
      phone: companyData?.phones?.[0] || job.phones?.[0] || null,
      phones: unique([...(companyData?.phones || []), ...(job.phones || [])]),
      email: companyData?.emails?.[0] || job.emails?.[0] || null,
      emails: unique([...(companyData?.emails || []), ...(job.emails || [])]),
      social: companyData?.social || [],
      evidence: scoring.evidence,
      penalties: scoring.penalties,
      signals: scoring.signals,
      structuredJob: job.structuredJob,
      fetchError: job.fetchError || null,
      discoveredAt: nowIso
    };
    leads.push(lead);
  }

  // Rank before history so we don't write thousands of low-value history records.
  leads.sort((a,b) => b.score - a.score);
  let finalLeads = leads.slice(0, Math.max(maxLeads * 2, maxLeads));

  let historyStore = null;
  if (trackHistory) {
    historyStore = await Actor.openKeyValueStore(input.historyStoreName || 'ai-receptionist-lead-history-v1');
    const withHistory = [];
    for (const lead of finalLeads) withHistory.push(await applyHistory(historyStore, lead, nowIso));
    finalLeads = withHistory;
  }

  finalLeads.sort((a,b) => b.score - a.score);
  finalLeads = finalLeads.slice(0, maxLeads);

  for (const lead of finalLeads) await Actor.pushData(lead);

  const summary = {
    generatedAt: nowIso,
    candidatesDiscovered: candidates.length,
    qualifiedBeforeLimit: leads.length,
    outputLeads: finalLeads.length,
    serpRequests,
    minimumScore,
    hotLeads: finalLeads.filter(x => x.score >= 90).length,
    highLeads: finalLeads.filter(x => x.score >= 80 && x.score < 90).length,
    top: finalLeads.slice(0, 10).map(x => ({ company: x.company, score: x.score, jobTitle: x.jobTitle, jobUrl: x.jobUrl }))
  };
  await Actor.setValue('OUTPUT', summary);
  Actor.log.info('Run complete', summary);
} finally {
  await Actor.exit();
}

function inferCompanyFromSerp(title = '') {
  const m = title.match(/(?: at | @ | - )(.+?)(?:\s*[|–—-]\s*(?:Indeed|LinkedIn|Glassdoor|ZipRecruiter))?$/i);
  return m ? m[1].trim() : null;
}
