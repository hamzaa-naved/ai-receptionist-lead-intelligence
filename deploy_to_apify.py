"""Deploy this folder as a private Apify Actor using the REST API.
Usage:
    APIFY_TOKEN=... python deploy_to_apify.py
This script intentionally reads the token only from the environment.
"""
from pathlib import Path
import json, os, sys, time
import requests

BASE = 'https://api.apify.com/v2'
TOKEN = os.environ.get('APIFY_TOKEN')
if not TOKEN:
    raise SystemExit('Set APIFY_TOKEN in the environment.')
HEADERS = {'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'}
ROOT = Path(__file__).resolve().parent
ACTOR_NAME = os.environ.get('APIFY_ACTOR_NAME', 'ai-receptionist-lead-intelligence')

def req(method, path, **kwargs):
    r = requests.request(method, BASE + path, headers=HEADERS, timeout=60, **kwargs)
    if r.status_code >= 400:
        print(r.text, file=sys.stderr)
        r.raise_for_status()
    return r.json()['data']

actors = req('GET', '/actors?limit=1000')['items']
actor = next((a for a in actors if a.get('name') == ACTOR_NAME), None)
if actor is None:
    actor = req('POST', '/actors', data=json.dumps({
        'name': ACTOR_NAME,
        'title': 'AI Receptionist Lead Intelligence',
        'description': 'Private lead intelligence Actor for receptionist/CSR hiring intent.',
        'isPublic': False
    }))
print('Actor:', actor['id'], actor.get('name'))

source_files = []
for p in ROOT.rglob('*'):
    if not p.is_file():
        continue
    rel = p.relative_to(ROOT).as_posix()
    if rel.startswith('.git/') or rel.startswith('__pycache__/') or rel == 'deploy_to_apify.py' or rel.endswith('.zip') or 'node_modules/' in rel:
        continue
    source_files.append({'name': rel, 'format': 'TEXT', 'content': p.read_text(encoding='utf-8')})

versions = req('GET', f"/actors/{actor['id']}/versions")['items']
version_payload = {
    'versionNumber': '0.1',
    'sourceType': 'SOURCE_FILES',
    'sourceFiles': source_files,
    'buildTag': 'latest'
}
if any(v.get('versionNumber') == '0.1' for v in versions):
    req('PUT', f"/actors/{actor['id']}/versions/0.1", data=json.dumps(version_payload))
else:
    req('POST', f"/actors/{actor['id']}/versions", data=json.dumps(version_payload))
print('Uploaded source files:', len(source_files))

build = req('POST', f"/actors/{actor['id']}/builds?version=0.1&tag=latest&waitForFinish=60")
print('Build:', build['id'], build['status'])
while build['status'] in ('READY','RUNNING'):
    time.sleep(5)
    build = req('GET', f"/actor-builds/{build['id']}")
    print('Build status:', build['status'])
if build['status'] != 'SUCCEEDED':
    raise SystemExit(f"Build failed: {build.get('statusMessage')}")

sample_input = {
    'niches': ['electrical'],
    'states': ['Texas', 'Florida'],
    'freshnessDays': 14,
    'minimumScore': 65,
    'enrichThreshold': 70,
    'maxLeads': 20,
    'maxSerpRequests': 10,
    'resultsPerQueryPages': 1,
    'companyEnrichment': True,
    'trackHistory': True
}
run = req('POST', f"/actors/{actor['id']}/runs?build=latest&waitForFinish=60&maxTotalChargeUsd=2", data=json.dumps(sample_input))
print('Test run:', run['id'], run['status'])
while run['status'] in ('READY','RUNNING'):
    time.sleep(5)
    run = req('GET', f"/actor-runs/{run['id']}?waitForFinish=30")
    print('Run status:', run['status'])
print('Dataset:', run.get('defaultDatasetId'))
print('Console actor URL: https://console.apify.com/actors/' + actor['id'])
