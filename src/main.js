import { Actor, log } from 'apify';
import { ALL_US_STATES, JOB_DOMAINS } from './constants.js';
import { buildQueries, fetchHtml, fetchSerp, looksLikeJobResult, selectOfficialWebsite, uniqueResults } from './discovery.js';
import { extractCompanyPage, extractJobPage } from './extract.js';
import { scoreJob } from './scoring.js';
import { applyHistory } from './history.js';
import { domainOf, normalizeUrl, unique } from './utils.js';

await Actor.init();

let actorExitCode = 0;
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

  log.info('Starting AI Receptionist Lead Intelligence', { niches, states: states.length, freshnessDays, minimumScore });

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
      log.info(`SERP ${serpRequests}/${maxSerpRequests}`, { query, results: found.length });
    } catch (err) {
      log.warning('SERP request failed', { query, error: err.message });
    }
  }

  const candidates = uniqueResults(discovered).slice(0, 2500);
  log.info('Discovery complete', { candidates: candidates.length, serpRequests });

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
        log.debug('Company enrichment failed', { company: job.company, error: err.message });
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
  log.info('Run complete', summary);
} catch (err) {
  actorExitCode = 1;
  log.exception(err, 'AI Receptionist Lead Intelligence failed');
} finally {
  await Actor.exit({ exitCode: actorExitCode });
}

function inferCompanyFromSerp(title = '') {
  const m = title.match(/(?: at | @ | - )(.+?)(?:\s*[|–—-]\s*(?:Indeed|LinkedIn|Glassdoor|ZipRecruiter))?$/i);
  return m ? m[1].trim() : null;
}
