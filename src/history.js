import { jobKey, sha1, unique } from './utils.js';

export function historyKeyForUrl(url) {
  return `JOB_${jobKey(url)}`;
}

export async function getHistory(store, url) {
  if (!store || !url) return null;
  return store.getValue(historyKeyForUrl(url));
}

export function shouldRefetch(record, now = new Date(), revisitAfterDays = 7) {
  if (!record?.lastFetchedAt) return true;
  const then = new Date(record.lastFetchedAt);
  if (Number.isNaN(then.valueOf())) return true;
  return now - then >= revisitAfterDays * 86400000;
}

export async function applyPostingHistory(store, posting, nowIso) {
  const key = historyKeyForUrl(posting.jobUrl || posting.discoveredUrl);
  const old = store ? await store.getValue(key) : null;
  const contentHash = sha1(`${posting.title || ''}|${posting.company || ''}|${posting.location || ''}|${posting.description || ''}`);
  const isNew = !old;
  const isChanged = Boolean(old?.contentHash && old.contentHash !== contentHash);
  const timesSeen = (old?.timesSeen || 0) + 1;
  const urlVariants = unique([...(old?.urlVariants || []), posting.discoveredUrl, posting.jobUrl]).slice(-20);
  const repostLikely = !isNew && (
    isChanged ||
    urlVariants.length > (old?.urlVariants?.length || 0) ||
    timesSeen >= 3 ||
    (posting.datePosted && old?.datePosted && posting.datePosted !== old.datePosted)
  );
  const enriched = {
    ...posting,
    jobKey: jobKey(posting.jobUrl || posting.discoveredUrl, posting.company, posting.title, posting.location),
    firstSeen: old?.firstSeen || nowIso,
    lastSeen: nowIso,
    lastFetchedAt: posting.fetchStatus === 'cached' ? old?.lastFetchedAt : nowIso,
    timesSeen,
    isNew,
    isChanged,
    repostLikely,
    contentHash
  };
  if (store) {
    await store.setValue(key, {
      ...enriched,
      urlVariants,
      cachedPosting: {
        title: enriched.title,
        company: enriched.company,
        description: enriched.description,
        descriptionSource: enriched.descriptionSource,
        descriptionChars: enriched.descriptionChars,
        datePosted: enriched.datePosted,
        validThrough: enriched.validThrough,
        employmentType: enriched.employmentType,
        location: enriched.location,
        salaryText: enriched.salaryText,
        remoteType: enriched.remoteType,
        structuredJob: enriched.structuredJob
      }
    });
  }
  return enriched;
}

export function postingFromCache(candidate, record) {
  if (!record?.cachedPosting) return null;
  return {
    ...record.cachedPosting,
    jobUrl: record.jobUrl || candidate.url,
    discoveredUrl: candidate.url,
    sourceTitle: candidate.title || record.sourceTitle || null,
    sourceSnippet: candidate.snippet || record.sourceSnippet || null,
    fetchStatus: 'cached',
    fetchError: null
  };
}
