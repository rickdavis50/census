# ZIP Opportunity Heatmap Data Pipeline

This app’s NAICS heatmap is fully offline at runtime. All Census data is fetched and joined **at build time** and written into `/public/data`, which the UI reads as static assets.

## What gets built
- ZBP (ZIP Business Patterns) **latest available year**: establishments by NAICS at ZIP level.
- ACS 5-year **latest available year**: population by ZCTA.
- Gazetteer ZCTA centroids (latest available).
- Output: chunked, gzipped JSON files + an index.

Files:
- `/public/data/zcta_index.json` (metadata + chunk list)
- `/public/data/zcta_opportunity_zbpYYYY_acsYYYY_0.json.gz` … `_9.json.gz`

## One-command build
```bash
npm run data:build
```

## Optional cleanup
```bash
npm run data:clean
```

## Data sources
- ZBP ZIP Business Patterns: downloaded from Census program datasets.
- ACS 5-year population by ZCTA: fetched via Census API during build.
- Gazetteer ZCTA centroids: downloaded from Census Gazetteer files.

## API key (optional)
The build uses the Census API for ACS population. It works without a key for one-time builds, but you may hit 429 rate limits. If the API fails, the script automatically falls back to the ACS Summary File (table-based) download.

If you have a key:
```bash
CENSUS_API_KEY=your_key npm run data:build
```

## Output location
All final artifacts are written to:
- `public/data`

Raw downloads are cached in:
- `data/raw` (ignored by git)

## Updating later
Re-run:
```bash
npm run data:build
```

The script automatically detects the most recent ZBP and ACS 5-year releases.

## Troubleshooting
- **Build fails with 429**: re-run with `CENSUS_API_KEY` set or try later.
- **Missing ZIP in search**: some ZCTAs have zero population or no ZBP entries; they still appear in the dataset but may have zero establishments.
- **Large memory use**: the ZBP detail file is large; build runs best with several GB of free RAM.

## Expected size & runtime
- ZBP detail ZIP: hundreds of MB
- Gazetteer ZIP: tens of MB
- Output in `/public/data`: typically tens of MB compressed across 10 chunks
- Runtime: several minutes depending on network speed
