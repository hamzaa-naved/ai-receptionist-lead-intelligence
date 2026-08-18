import assert from 'node:assert/strict';
import { buildQueries, partitionStates } from '../src/discovery.js';
import { extractJobPage } from '../src/extract.js';
import { applyPostingHistory, shouldRefetch } from '../src/history.js';
import { assessRelevance } from '../src/relevance.js';

const states = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California'];
assert.deepEqual(partitionStates(states, 0, 2), ['Alabama', 'Arizona', 'California']);
assert.deepEqual(partitionStates(states, 1, 2), ['Alaska', 'Arkansas']);
const queries = buildQueries({ states, roleFamilies: ['dispatch'], tradeBundles: ['hvac_plumbing_electrical'] });
assert.equal(queries.length, states.length);
assert.match(queries[0].query, /service dispatcher/i);
assert.match(queries[0].query, /HVAC/i);

const html = `<!doctype html><html><head><script type="application/ld+json">{
  "@context":"https://schema.org","@type":"JobPosting","title":"Customer Service Representative / Dispatcher",
  "description":"Family-owned electrical contractor. Answer inbound calls, schedule service appointments, and dispatch service technicians.",
  "datePosted":"2026-08-17","hiringOrganization":{"name":"Example Electric LLC"},
  "jobLocation":{"address":{"addressLocality":"Austin","addressRegion":"TX","addressCountry":"US"}}
}</script></head><body></body></html>`;
const job = extractJobPage(html, 'https://example.com/jobs/123');
assert.equal(job.company, 'Example Electric LLC');
assert.equal(job.descriptionSource, 'json_ld');
assert.equal(job.location, 'Austin, TX, US');
const relevance = assessRelevance(job);
assert.equal(relevance.relevant, true);
assert.ok(relevance.matchedTradeTerms.includes('electrical contractor'));

const medical = assessRelevance({ title: 'Medical Receptionist', description: 'Answer phones and schedule appointments at our dental clinic.' });
assert.equal(medical.relevant, false);

const memory = new Map();
const store = { getValue: async key => memory.get(key) || null, setValue: async (key, value) => memory.set(key, value) };
const first = await applyPostingHistory(store, { ...job, fetchStatus: 'fetched' }, '2026-08-18T00:00:00.000Z');
assert.equal(first.isNew, true);
const second = await applyPostingHistory(store, { ...job, fetchStatus: 'cached' }, '2026-08-19T00:00:00.000Z');
assert.equal(second.isNew, false);
assert.equal(second.timesSeen, 2);
assert.equal(shouldRefetch(second, new Date('2026-08-20T00:00:00.000Z'), 7), false);

console.log('Collector tests passed');
