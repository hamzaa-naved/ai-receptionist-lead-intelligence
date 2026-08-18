import { clamp, extractNumberRange, normalizeWhitespace } from './utils.js';

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

export function scoreJob(job, company = null, now = new Date()) {
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

export function extractCallVolume(text = '') {
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
