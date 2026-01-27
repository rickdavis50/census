const CBP_YEARS = [2023, 2022, 2021, 2020, 2019];
const ZBP_FALLBACK_YEAR = 2018;
const TEST_ZIP = "20002";
const TEST_STATE = "06";
const DEFAULT_NAICS = "72";
const ACS_YEAR = 2022;
const MAX_BATCH = 50;
const ESTAB_CONCURRENCY = 4;
const POP_CONCURRENCY = 8;

const estabCache = new Map();
const popCache = new Map();
const stateEstabCache = new Map();
const statePopCache = new Map();
let latestSourcePromise = null;
let latestStateSourcePromise = null;

const censusApiKey = import.meta.env.VITE_CENSUS_API_KEY;
const CENSUS_PROXY_URL = String(
  import.meta.env.VITE_CENSUS_PROXY_URL ?? ""
).trim().replace(/\/$/, "");

const buildParams = (pairs) => {
  const params = new URLSearchParams(pairs);
  if (censusApiKey) params.set("key", censusApiKey);
  return params.toString();
};

const parseCensusArray = (payload) => {
  if (!Array.isArray(payload) || payload.length < 2) return null;
  const headers = payload[0];
  const rows = payload.slice(1);
  return { headers, rows };
};

const buildProxyUrl = (targetUrl) => {
  if (!CENSUS_PROXY_URL) return targetUrl;
  return `${CENSUS_PROXY_URL}?url=${encodeURIComponent(targetUrl)}`;
};

const runWithConcurrency = async (items, limit, task) => {
  const results = [];
  let index = 0;
  const workers = new Array(limit).fill(0).map(async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      results.push(await task(current));
    }
  });
  await Promise.all(workers);
  return results;
};

const chunk = (items, size) => {
  const batches = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
};

const buildEstabUrl = ({ year, naics, zips, endpoint }) => {
  const base =
    endpoint === "cbp"
      ? `https://api.census.gov/data/${year}/cbp`
      : `https://api.census.gov/data/${year}/zbp`;
  const params = buildParams({
    get: "ESTAB",
    for: `zipcode:${zips.join(",")}`,
    NAICS2017: naics,
  });
  return `${base}?${params}`;
};

const buildStateEstabUrl = ({ year, naics }) => {
  const base = `https://api.census.gov/data/${year}/cbp`;
  const params = buildParams({
    get: "ESTAB",
    for: "state:*",
    NAICS2017: naics,
  });
  return `${base}?${params}`;
};

const fetchEstabBatch = async ({ year, endpoint, naics, zips }) => {
  const response = await fetch(
    buildProxyUrl(buildEstabUrl({ year, endpoint, naics, zips }))
  );
  if (!response.ok) {
    throw new Error(`Establishment fetch failed (${response.status}).`);
  }
  const data = await response.json();
  const parsed = parseCensusArray(data);
  if (!parsed) return new Map();

  const zipIndex = parsed.headers.indexOf("zipcode");
  const estabIndex = parsed.headers.indexOf("ESTAB");
  if (zipIndex === -1 || estabIndex === -1) return new Map();

  const batchMap = new Map();
  parsed.rows.forEach((row) => {
    const zip = String(row[zipIndex] ?? "").trim();
    const raw = String(row[estabIndex] ?? "").trim();
    const value = Number(raw);
    if (!zip) return;
    batchMap.set(zip, Number.isFinite(value) ? value : 0);
  });

  zips.forEach((zip) => {
    if (!batchMap.has(zip)) batchMap.set(zip, 0);
  });

  return batchMap;
};

const fetchPopBatch = async (zips) => {
  const params = buildParams({
    get: "B01003_001E",
    for: `zip code tabulation area:${zips.join(",")}`,
  });
  const url = `https://api.census.gov/data/${ACS_YEAR}/acs/acs5?${params}`;
  const response = await fetch(buildProxyUrl(url));
  if (!response.ok) {
    throw new Error(`Population fetch failed (${response.status}).`);
  }
  const data = await response.json();
  const parsed = parseCensusArray(data);
  if (!parsed) return new Map();
  const valueIndex = parsed.headers.indexOf("B01003_001E");
  const zipIndex = parsed.headers.indexOf("zip code tabulation area");
  if (valueIndex === -1 || zipIndex === -1) return new Map();
  const batchMap = new Map();
  parsed.rows.forEach((row) => {
    const zip = String(row?.[zipIndex] ?? "").trim();
    const value = Number(String(row?.[valueIndex] ?? "").trim());
    if (!zip) return;
    batchMap.set(zip, Number.isFinite(value) ? value : 0);
  });
  zips.forEach((zip) => {
    if (!batchMap.has(zip)) batchMap.set(zip, 0);
  });
  return batchMap;
};

const fetchStateEstab = async ({ year, naics }) => {
  const response = await fetch(buildProxyUrl(buildStateEstabUrl({ year, naics })));
  if (!response.ok) {
    throw new Error(`State establishment fetch failed (${response.status}).`);
  }
  const data = await response.json();
  const parsed = parseCensusArray(data);
  if (!parsed) return new Map();

  const stateIndex = parsed.headers.indexOf("state");
  const estabIndex = parsed.headers.indexOf("ESTAB");
  const nameIndex = parsed.headers.indexOf("NAME");
  if (stateIndex === -1 || estabIndex === -1) return new Map();

  const batchMap = new Map();
  parsed.rows.forEach((row) => {
    const state = String(row[stateIndex] ?? "").trim().padStart(2, "0");
    const raw = String(row[estabIndex] ?? "").trim();
    const value = Number(raw);
    if (!state) return;
    batchMap.set(state, {
      value: Number.isFinite(value) ? value : 0,
      name: nameIndex === -1 ? null : String(row[nameIndex] ?? "").trim(),
    });
  });

  return batchMap;
};

const fetchStatePop = async () => {
  const params = buildParams({
    get: "B01003_001E",
    for: "state:*",
  });
  const url = `https://api.census.gov/data/${ACS_YEAR}/acs/acs5?${params}`;
  const response = await fetch(buildProxyUrl(url));
  if (!response.ok) {
    throw new Error(`State population fetch failed (${response.status}).`);
  }
  const data = await response.json();
  const parsed = parseCensusArray(data);
  if (!parsed) return new Map();
  const valueIndex = parsed.headers.indexOf("B01003_001E");
  const stateIndex = parsed.headers.indexOf("state");
  const nameIndex = parsed.headers.indexOf("NAME");
  if (valueIndex === -1 || stateIndex === -1) return new Map();

  const batchMap = new Map();
  parsed.rows.forEach((row) => {
    const state = String(row?.[stateIndex] ?? "").trim().padStart(2, "0");
    const value = Number(String(row?.[valueIndex] ?? "").trim());
    if (!state) return;
    batchMap.set(state, {
      value: Number.isFinite(value) ? value : 0,
      name: nameIndex === -1 ? null : String(row[nameIndex] ?? "").trim(),
    });
  });
  return batchMap;
};

const testCbpYear = async (year) => {
  const response = await fetch(
    buildProxyUrl(buildEstabUrl({
      year,
      endpoint: "cbp",
      naics: DEFAULT_NAICS,
      zips: [TEST_ZIP],
    }))
  );
  if (!response.ok) return false;
  const data = await response.json();
  const parsed = parseCensusArray(data);
  if (!parsed) return false;
  return true;
};

const testCbpStateYear = async (year) => {
  const response = await fetch(
    buildProxyUrl(buildStateEstabUrl({
      year,
      naics: DEFAULT_NAICS,
    }))
  );
  if (!response.ok) return false;
  const data = await response.json();
  const parsed = parseCensusArray(data);
  if (!parsed) return false;
  const stateIndex = parsed.headers.indexOf("state");
  if (stateIndex === -1) return false;
  return parsed.rows.some(
    (row) => String(row?.[stateIndex] ?? "").trim() === TEST_STATE
  );
};

export const getLatestEstabSource = async () => {
  if (latestSourcePromise) return latestSourcePromise;
  latestSourcePromise = (async () => {
    for (const year of CBP_YEARS) {
      try {
        const ok = await testCbpYear(year);
        if (ok) return { year, endpoint: "cbp" };
      } catch (error) {
        // Try next year.
      }
    }
    return { year: ZBP_FALLBACK_YEAR, endpoint: "zbp" };
  })();
  return latestSourcePromise;
};

export const getLatestStateEstabSource = async () => {
  if (latestStateSourcePromise) return latestStateSourcePromise;
  latestStateSourcePromise = (async () => {
    for (const year of CBP_YEARS) {
      try {
        const ok = await testCbpStateYear(year);
        if (ok) return { year, endpoint: "cbp" };
      } catch (error) {
        // Try next year.
      }
    }
    return { year: CBP_YEARS[CBP_YEARS.length - 1], endpoint: "cbp" };
  })();
  return latestStateSourcePromise;
};

export const getEstablishmentsByZip = async ({ year, endpoint, naics, zips }) => {
  const key = `${endpoint}:${year}:${naics}`;
  let cache = estabCache.get(key);
  if (!cache) {
    cache = new Map();
    estabCache.set(key, cache);
  }

  const missing = zips.filter((zip) => !cache.has(zip));
  if (!missing.length) return cache;

  const batches = chunk(missing, MAX_BATCH);

  await runWithConcurrency(batches, ESTAB_CONCURRENCY, async (batch) => {
    try {
      const batchMap = await fetchEstabBatch({ year, endpoint, naics, zips: batch });
      batchMap.forEach((value, zip) => cache.set(zip, value));
    } catch (error) {
      batch.forEach((zip) => cache.set(zip, 0));
    }
  });

  return cache;
};

export const getEstablishmentsByState = async ({ year, naics }) => {
  const key = `${year}:${naics}`;
  let cache = stateEstabCache.get(key);
  if (!cache) {
    cache = new Map();
    stateEstabCache.set(key, cache);
  }
  if (cache.size) return cache;

  const data = await fetchStateEstab({ year, naics });
  data.forEach((entry, state) => cache.set(state, entry));
  return cache;
};

export const getPopulationByZip = async (zips) => {
  const missing = zips.filter((zip) => !popCache.has(zip));
  if (!missing.length) return popCache;

  const batches = chunk(missing, MAX_BATCH);
  await runWithConcurrency(batches, POP_CONCURRENCY, async (batch) => {
    try {
      const batchMap = await fetchPopBatch(batch);
      batchMap.forEach((value, zip) => popCache.set(zip, value));
    } catch (error) {
      batch.forEach((zip) => popCache.set(zip, 0));
    }
  });

  return popCache;
};

export const getPopulationByState = async () => {
  if (statePopCache.size) return statePopCache;
  const data = await fetchStatePop();
  data.forEach((entry, state) => statePopCache.set(state, entry));
  return statePopCache;
};

export const getPopYear = () => ACS_YEAR;
