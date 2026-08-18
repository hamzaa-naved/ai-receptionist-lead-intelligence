import { EXCLUDED_CONTEXTS, ROLE_TERMS, TASK_TERMS, TRADE_TERMS } from './constants.js';

function matches(text, terms) {
  const haystack = String(text || '').toLowerCase();
  return terms.filter(term => haystack.includes(term));
}

export function assessRelevance(job, { strictHomeService = true } = {}) {
  const title = job.title || '';
  const content = `${job.title || ''} ${job.company || ''} ${job.description || ''} ${job.sourceSnippet || ''}`;
  const excluded = matches(content, EXCLUDED_CONTEXTS);
  const roleTerms = matches(content, ROLE_TERMS);
  const titleRoleTerms = matches(title, ROLE_TERMS);
  const taskTerms = matches(content, TASK_TERMS);
  const tradeTerms = matches(content, TRADE_TERMS);
  const roleRelevant = titleRoleTerms.length > 0 || roleTerms.length >= 2 || taskTerms.length >= 2;
  const homeServiceLikely = tradeTerms.length > 0 || /\b(service|field) technicians?\b|\bservice calls?\b/i.test(content);
  const relevant = excluded.length === 0 && roleRelevant && (!strictHomeService || homeServiceLikely);
  return {
    relevant,
    roleRelevant,
    homeServiceLikely,
    matchedRoleTerms: [...new Set(roleTerms)],
    matchedTaskTerms: [...new Set(taskTerms)],
    matchedTradeTerms: [...new Set(tradeTerms)],
    excludedContexts: [...new Set(excluded)]
  };
}
