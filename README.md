# Bulk Home-Service Receptionist Job Collector

An Apify Actor that produces a large, frequently refreshed US dataset of receptionist, CSR, dispatcher, scheduling, intake, and service-coordinator postings at home-service companies.

## Deliberately narrow scope

This Actor collects job-market data. It does **not** score sales leads, estimate company size, find decision-makers, enrich companies, or call an AI model. Those steps belong downstream, after multiple postings have accumulated for the same company.

## Collection pipeline

1. Searches Google through Apify's `GOOGLE_SERP` proxy using four receptionist-adjacent role families and the full home-service trade taxonomy.
2. Discovers public postings from Indeed, ZipRecruiter, career sites, and common ATS platforms.
3. Retrieves full descriptions through inexpensive HTTP requests and extracts `JobPosting` JSON-LD where available.
4. Falls back to search snippets when a board blocks the detail page.
5. Applies only objective role, industry, freshness, expiry, and duplicate checks.
6. Stores job-level history and description hashes so known pages are not repeatedly downloaded.
7. Marks new, changed, and likely reposted vacancies.
8. Outputs every accepted posting to the default dataset.

## Creator-plan schedule

Use four daily tasks with `partitionCount: 4` and `partitionIndex` values `0`, `1`, `2`, and `3`. At the defaults, the complete US search matrix is approximately 204 SERP pages per day, or roughly 6,120 pages in a 30-day month. This stays below the Creator plan's 10,000 monthly SERP limit.

Run one weekly backfill with `mode: "backfill"`, `freshnessDays: 60`, and a conservative SERP cap to recover older or reposted vacancies.

## Complete national run

```json
{
  "mode": "recent",
  "states": [],
  "roleFamilies": ["reception", "customer_service", "dispatch", "scheduling"],
  "tradeBundles": ["hvac_plumbing_electrical", "exterior_construction", "restoration_specialty", "property_services"],
  "freshnessDays": 30,
  "partitionIndex": 0,
  "partitionCount": 1,
  "maxSerpRequests": 220,
  "resultsPerQueryPages": 1,
  "maxJobFetches": 2000,
  "maxPostings": 5000,
  "fetchConcurrency": 12,
  "revisitAfterDays": 7,
  "strictHomeService": true,
  "includeSnippetOnly": true,
  "trackHistory": true
}
```

## Output

Each row includes the job title, company, location, complete description when retrievable, source, search provenance, structured metadata, matched role/task/trade terms, fetch quality, first/last seen dates, observation count, content hash, and new/change/repost flags.

## Deployment

Deploy with Apify CLI or set `APIFY_TOKEN` and run `python deploy_to_apify.py`. Never place tokens in source control.
