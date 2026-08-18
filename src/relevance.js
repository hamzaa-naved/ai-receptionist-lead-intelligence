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
  const nonJobTitle = /\b(?:ai|virtual) receptionist\b|answering service|\b(?:alternatives?|software|tools?|comparison|review)\b|\btop \d+\b/i.test(title);
  const jobSeekerPost = /\b(?:i am|i'm|currently) looking for (?:a )?job\b|\bseeking (?:a )?(?:job|work|employment)\b|\bhire me\b/i.test(content);
  const structuredJobEvidence = Boolean(job.company || job.datePosted || job.employmentType || job.salary);
  const textualJobEvidence = /\b(?:apply|job description|responsibilities|qualifications|requirements|benefits|compensation|salary|pay range|full[- ]time|part[- ]time|now hiring|we(?:'re| are) hiring|join (?:our|the) team)\b/i.test(content);
  const jobPostingLikely = !nonJobTitle && !jobSeekerPost && (structuredJobEvidence || textualJobEvidence);
  const roleRelevant = titleRoleTerms.length > 0 || roleTerms.length >= 2 || taskTerms.length >= 2;
  const homeServiceLikely = tradeTerms.length > 0 || /\b(service|field) technicians?\b|\bservice calls?\b/i.test(content);
  const relevant = excluded.length === 0 && jobPostingLikely && roleRelevant && (!strictHomeService || homeServiceLikely);
  return {
    relevant,
    jobPostingLikely,
    roleRelevant,
    homeServiceLikely,
    matchedRoleTerms: [...new Set(roleTerms)],
    matchedTaskTerms: [...new Set(taskTerms)],
    matchedTradeTerms: [...new Set(tradeTerms)],
    excludedContexts: [...new Set(excluded)]
  };
}
