import { Actor, log } from 'apify';
import { ALL_US_STATES } from './constants.js';
import { buildQueries, fetchHtml, fetchSerp, looksLikeJobResult, uniqueResults } from './discovery.js';
import { extractJobPage } from './extract.js';
import { applyPostingHistory, getHistory, postingFromCache, shouldRefetch } from './history.js';
import { assessRelevance } from './relevance.js';
import { domainOf, normalizeUrl } from './utils.js';

await Actor.init();

let exitCode = 0;
try {
  const input = await Actor.getInput() || {};
  const states = input.states?.length ? input.states : ALL_US_STATES;
  const freshnessDays = input.freshnessDays ?? (input.mode === 'backfill' ? 60 : 30);
  const maxSerpRequests = input.maxSerpRequests ?? 220;
  const pagesPerQuery = input.resultsPerQueryPages ?? 1;
  const maxJobFetches = input.maxJobFetches ?? 2000;
  const maxPostings = input.maxPostings ?? 5000;
  const fetchConcurrency = input.fetchConcurrency ?? 12;
  const revisitAfterDays = input.revisitAfterDays ?? 7;
  const strictHomeService = input.strictHomeService !== false;
  const includeSnippetOnly = input.includeSnippetOnly !== false;
  const includeExpired = input.includeExpired === true;
  const trackHistory = input.trackHistory !== false;
  const now = new Date();
  const nowIso = now.toISOString();

  log.info('Starting bulk receptionist job collector', {
    states: states.length,
    mode: input.mode || 'recent',
    freshnessDays,
    maxSerpRequests,
    partition: `${input.partitionIndex || 0}/${input.partitionCount || 1}`
  });

  const serpProxy = await Actor.createProxyConfiguration({ groups: ['GOOGLE_SERP'] });
  if (!serpProxy) throw new Error('Google SERP proxy is unavailable on this account.');
  const serpProxyUrl = await serpProxy.newUrl();
  const pageProxy = await Actor.createProxyConfiguration({ countryCode: 'US' });
  let pageProxyUrl = null;
  try { pageProxyUrl = pageProxy ? await pageProxy.newUrl() : null; } catch {}

  const historyStore = trackHistory
    ? await Actor.openKeyValueStore(input.historyStoreName || 'receptionist-job-history-v2')
    : null;

  const allQueries = buildQueries({
    states,
    roleFamilies: input.roleFamilies,
    tradeBundles: input.tradeBundles,
    partitionIndex: input.partitionIndex ?? 0,
    partitionCount: input.partitionCount ?? 1
  });
  const queryLimit = Math.max(0, Math.floor(maxSerpRequests / pagesPerQuery));
  const queries = allQueries.slice(0, queryLimit);
  const queryResults = await mapLimit(queries, Math.min(10, fetchConcurrency), async spec => {
    try {
      const results = await fetchSerp(spec, serpProxyUrl, pagesPerQuery, freshnessDays);
      log.info('Search completed', { state: spec.state, roleFamily: spec.roleFamily, results: results.length });
      return results.filter(looksLikeJobResult).map(result => ({
        ...result,
        sourceQuery: spec.query,
        searchState: spec.state,
        roleFamily: spec.roleFamily
      }));
    } catch (error) {
      log.warning('Search failed', { query: spec.query, error: error.message });
      return [];
    }
  });

  const seedCandidates = (input.seedUrls || [])
    .map(value => typeof value === 'string' ? value : value?.url)
    .filter(Boolean)
    .map(url => ({ url: normalizeUrl(url), title: '', snippet: '', sourceQuery: 'seed', searchState: null, roleFamily: 'seed' }));
  const candidates = uniqueResults([...seedCandidates, ...queryResults.flat()]).slice(0, maxJobFetches);
  log.info('Discovery complete', {
    searchesPlanned: queries.length,
    serpRequests: queries.length * pagesPerQuery,
    candidates: candidates.length
  });

  const processed = await mapLimit(candidates, fetchConcurrency, async candidate => {
    if (!candidate.url) return null;
    const old = await getHistory(historyStore, candidate.url);
    let posting = null;
    if (old && !shouldRefetch(old, now, revisitAfterDays)) posting = postingFromCache(candidate, old);
    if (!posting) {
      try {
        const page = await fetchHtml(candidate.url, pageProxyUrl);
        posting = extractJobPage(page.html, page.finalUrl || candidate.url, candidate);
        posting.fetchStatus = 'fetched';
        posting.httpStatus = page.statusCode;
        posting.fetchError = null;
      } catch (error) {
        posting = extractJobPage('', candidate.url, candidate);
        posting.fetchStatus = 'snippet_only';
        posting.httpStatus = null;
        posting.fetchError = error.message;
      }
    }

    if (!posting.title && !posting.description) return null;
    if (!includeSnippetOnly && posting.descriptionSource === 'serp_snippet') return null;
    if (posting.postingAgeDays != null && posting.postingAgeDays > freshnessDays) return null;
    if (!includeExpired && posting.validThrough) {
      const expiry = new Date(posting.validThrough);
      if (!Number.isNaN(expiry.valueOf()) && expiry < now) return null;
    }

    const relevance = assessRelevance(posting, { strictHomeService });
    if (!relevance.relevant) return null;
    const record = await applyPostingHistory(historyStore, {
      ...posting,
      ...relevance,
      sourceDomain: domainOf(posting.jobUrl || candidate.url),
      sourceQuery: candidate.sourceQuery || null,
      searchState: candidate.searchState || null,
      roleFamily: candidate.roleFamily || null,
      discoveredAt: nowIso
    }, nowIso);
    return record;
  });

  const postings = processed.filter(Boolean)
    .sort((a, b) => Number(b.isNew) - Number(a.isNew) || (a.postingAgeDays ?? 9999) - (b.postingAgeDays ?? 9999))
    .slice(0, maxPostings);
  for (let index = 0; index < postings.length; index += 100) {
    await Actor.pushData(postings.slice(index, index + 100));
  }

  const summary = {
    generatedAt: nowIso,
    mode: input.mode || 'recent',
    partitionIndex: input.partitionIndex ?? 0,
    partitionCount: input.partitionCount ?? 1,
    statesSearched: [...new Set(queries.map(query => query.state))],
    searchesRun: queries.length,
    serpRequests: queries.length * pagesPerQuery,
    candidatesDiscovered: candidates.length,
    postingsOutput: postings.length,
    newPostings: postings.filter(posting => posting.isNew).length,
    changedPostings: postings.filter(posting => posting.isChanged).length,
    likelyReposts: postings.filter(posting => posting.repostLikely).length,
    fullDescriptions: postings.filter(posting => !['serp_snippet', 'none'].includes(posting.descriptionSource)).length,
    snippetOnly: postings.filter(posting => posting.descriptionSource === 'serp_snippet').length,
    fetchFailures: postings.filter(posting => posting.fetchError).length
  };
  await Actor.setValue('OUTPUT', summary);
  log.info('Bulk collection complete', summary);
} catch (error) {
  exitCode = 1;
  log.exception(error, 'Bulk receptionist job collector failed');
} finally {
  await Actor.exit({ exitCode });
}

async function mapLimit(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length || 1) }, worker));
  return results;
}
