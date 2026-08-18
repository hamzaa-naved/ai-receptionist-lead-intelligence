# AI Receptionist Lead Intelligence — Apify Actor

Purpose-built lead intelligence for selling AI receptionists to electricians and other home-service businesses.

## What it does

1. Searches Google through Apify's **GOOGLE_SERP proxy** for recent receptionist / CSR / dispatcher / scheduler job signals.
2. Discovers job pages across Indeed, LinkedIn, ZipRecruiter, ATS systems, and company career sites.
3. Extracts `JobPosting` JSON-LD when available, with resilient text fallbacks when a job board is blocked.
4. Scores the actual duties—not just the title—for:
   - inbound phone answering
   - appointment/job scheduling
   - technician dispatch
   - missed-call / speed-to-lead follow-up
   - ServiceTitan / Jobber / Housecall Pro
   - remote / hybrid acceptance
   - explicit calls-per-day
   - electrical/home-service fit
5. Applies strong negative filters for freight dispatch, healthcare reception, hospitality, etc.
6. Enriches strong candidates by resolving the company's official website and extracting phone/email/public business details.
7. Stores cross-run history in a named Apify key-value store and boosts companies repeatedly hiring the same function.
8. Outputs only ranked sales opportunities with the evidence behind each score.

## Why this is not a generic job scraper

The ranking is deterministic and evidence-backed. A company hiring somebody to answer 40–60 inbound calls/day, book electrical service appointments, dispatch techs, and work in ServiceTitan can score 90+ while a freight dispatcher or hospital receptionist is heavily penalized.

## Default cost philosophy

- Cheap Google SERP discovery first.
- No browser for every job.
- Deep company enrichment only above `enrichThreshold`.
- Persistent history only for qualified leads.
- Hard `maxSerpRequests` and `maxLeads` controls.

## Recommended first run

```json
{
  "niches": ["electrical"],
  "states": ["Texas", "Florida", "Arizona", "North Carolina", "Georgia"],
  "freshnessDays": 14,
  "minimumScore": 65,
  "enrichThreshold": 70,
  "maxLeads": 50,
  "maxSerpRequests": 30,
  "resultsPerQueryPages": 1,
  "companyEnrichment": true,
  "trackHistory": true
}
```

Then expand to all states by leaving `states` empty.

## Deployment

Use Apify CLI (`apify push`) from this folder, or use the included `deploy_to_apify.py` with an `APIFY_TOKEN` environment variable.

Do not hard-code API tokens in source code.
