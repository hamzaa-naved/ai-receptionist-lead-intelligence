# AI Receptionist Lead Intelligence — GitHub Easy Build

This edition is intentionally **flat**: there are NO folders and NO hidden `.actor` directory.

Apify supports a legacy flat Actor layout when `.actor/actor.json` is absent. The platform can use:
- `apify.json`
- `Dockerfile`
- `README.md`
- `INPUT_SCHEMA.json`
- `package.json`
- `main.js`

## GitHub upload

1. Extract the ZIP.
2. You will see exactly 6 files and no folders.
3. On your GitHub repository choose **Add file → Upload files**.
4. Select all 6 files at once.
5. Commit them to `main`.

## Connect to Apify

In Apify create/develop an Actor and use **Git repository** as source:

`https://github.com/hamzaa-naved/ai-receptionist-lead-intelligence.git#main`

Then build.

## Safe first test

Use:
- niches: electrical
- states: Texas, Florida
- freshnessDays: 14
- minimumScore: 65
- enrichThreshold: 70
- maxLeads: 20
- maxSerpRequests: 10
- resultsPerQueryPages: 1
- companyEnrichment: true
- trackHistory: true

The Actor uses Apify's Google SERP proxy for discovery, then scores receptionist/CSR/dispatcher hiring intent and optionally enriches high-scoring companies.
