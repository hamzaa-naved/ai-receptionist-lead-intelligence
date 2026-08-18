import { companyKey, unique } from './utils.js';

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
