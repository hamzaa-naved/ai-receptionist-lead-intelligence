import assert from 'node:assert/strict';
import { scoreJob } from '../src/scoring.js';

const hot = {
  title: 'Customer Service Representative / Dispatcher',
  company: 'Example Electric LLC',
  description: 'Family-owned electrical contractor. Answer 40-60 inbound calls per day, schedule service appointments, dispatch technicians, follow up missed calls and use ServiceTitan. Hybrid work available. $22-$26 per hour.',
  pageText: '',
  postingAgeDays: 2,
  remoteType: 'hybrid'
};
const hotScore = scoreJob(hot);
assert.ok(hotScore.score >= 90, `Expected HOT score, got ${hotScore.score}`);
assert.deepEqual(hotScore.callsPerDay, { min: 40, max: 60 });
assert.equal(hotScore.crm, 'ServiceTitan');

const freight = {
  title: 'Truck Dispatcher',
  company: 'ABC Logistics',
  description: 'Dispatch CDL drivers, use TMS, coordinate freight loads and fleet routes.',
  pageText: '',
  postingAgeDays: 1
};
const bad = scoreJob(freight);
assert.ok(bad.score < 40, `Expected freight mismatch score < 40, got ${bad.score}`);

const medium = {
  title: 'Office Assistant',
  company: 'Smith Electric',
  description: 'Electrical contractor seeking office assistant to answer customer calls and schedule estimates.',
  postingAgeDays: 5
};
const med = scoreJob(medium);
assert.ok(med.score >= 60, `Expected useful electrical lead, got ${med.score}`);

console.log('Scoring tests passed:', { hot: hotScore.score, freight: bad.score, medium: med.score });
