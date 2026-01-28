import fs from "node:fs/promises";
import path from "node:path";
import { strFromU8, unzipSync, gzipSync, strToU8 } from "fflate";
import {
  ACS_API_BASE,
  GAZETTEER_BASE_URL,
  NAICS_CATEGORIES,
  OPPORTUNITY_EPS,
  OUTPUT_DIR,
  RAW_DIR,
  ZBP_BASE_URL,
} from "./config.js";
import {
  ROOT_DIR,
  detectDelimiter,
  downloadToFile,
  ensureDir,
  fileExists,
  fetchWithRetry,
  parseDelimitedLine,
  readText,
  writeJson,
} from "./utils.js";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2015;
const POP_FLOOR = 1000;
const DENSITY_BANDS = 5;
const MIN_STATE_SAMPLE = 50;

const normalizeZip = (zip) => String(zip ?? "").trim().padStart(5, "0");
const log10p1 = (value) => Math.log10(Math.max(0, value) + 1);

const findLatestGazetteer = async () => {
  for (let year = CURRENT_YEAR; year >= MIN_YEAR; year -= 1) {
    const url = `${GAZETTEER_BASE_URL}/${year}_Gazetteer/${year}_Gaz_zcta_national.zip`;
    try {
      const response = await fetchWithRetry(url, { method: "HEAD" }, 1);
      if (response.ok) return { year, url };
    } catch {
      // Try prior year.
    }
  }
  throw new Error("Unable to detect a Gazetteer ZCTA release.");
};

const findLatestZbp = async () => {
  for (let year = CURRENT_YEAR; year >= MIN_YEAR; year -= 1) {
    const indexUrl = `${ZBP_BASE_URL}/${year}/zbp/`;
    try {
      const response = await fetchWithRetry(indexUrl, {}, 1);
      const html = await response.text();
      const match = html.match(/zbp(\d{2})detail\.zip/i);
      if (match) {
        const filename = match[0];
        return { year, url: `${indexUrl}${filename}` };
      }
    } catch {
      // Try prior year.
    }
  }
  throw new Error("Unable to detect a ZBP detail release.");
};

const findLatestAcs = async () => {
  for (let year = CURRENT_YEAR; year >= MIN_YEAR; year -= 1) {
    const url = `${ACS_API_BASE}/${year}/acs/acs5?get=B01003_001E&for=zip%20code%20tabulation%20area:01001`;
    try {
      const response = await fetchWithRetry(url, {}, 1);
      if (response.ok) return { year };
    } catch {
      // Try prior year.
    }
  }
  throw new Error("Unable to detect an ACS 5-year release.");
};

const findLatestAcsSummary = async () => {
  for (let year = CURRENT_YEAR; year >= MIN_YEAR; year -= 1) {
    const url = `https://www2.census.gov/programs-surveys/acs/summary_file/${year}/table-based-SF/data/5YRData/acsdt5y${year}-b01003.dat`;
    try {
      const response = await fetchWithRetry(url, { method: "HEAD" }, 1);
      if (response.ok) return { year, url };
    } catch {
      // Try prior year.
    }
  }
  throw new Error("Unable to detect an ACS Summary File release.");
};

const loadZipEntriesFromZip = async (zipPath) => {
  const buffer = await fs.readFile(zipPath);
  const files = unzipSync(new Uint8Array(buffer));
  const [entry] = Object.values(files);
  if (!entry) {
    throw new Error(`No file found in ${zipPath}`);
  }
  return strFromU8(entry);
};

const buildCategoryMatchers = () => {
  const matchers = [];
  NAICS_CATEGORIES.forEach((category) => {
    category.prefixes.forEach((prefix) => {
      matchers.push({ id: category.id, prefix });
    });
  });
  matchers.sort((a, b) => b.prefix.length - a.prefix.length);
  return matchers;
};

const mapNaicsToCategory = (code, matchers) => {
  if (!code) return null;
  const cleaned = String(code).trim();
  if (!cleaned || cleaned === "00" || cleaned === "------") return null;
  return matchers.find((matcher) => cleaned.startsWith(matcher.prefix))?.id ?? null;
};

const parseZbpDetail = (text) => {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) throw new Error("ZBP file is empty.");

  const header = lines[0];
  const delimiter = detectDelimiter(header);
  const headers = parseDelimitedLine(header, delimiter).map((value) =>
    value.trim().toLowerCase()
  );
  const zipIndex =
    headers.indexOf("zip") !== -1
      ? headers.indexOf("zip")
      : headers.indexOf("zipcode");
  const naicsIndex = headers.findIndex((value) => value.startsWith("naics"));
  const estabIndex =
    headers.indexOf("estab") !== -1 ? headers.indexOf("estab") : headers.indexOf("est");
  const stateIndex = headers.indexOf("stabbr");

  if (zipIndex === -1 || naicsIndex === -1 || estabIndex === -1) {
    throw new Error("ZBP headers missing ZIP/NAICS/ESTAB columns.");
  }

  const matchers = buildCategoryMatchers();
  const byZip = new Map();
  const stateByZip = new Map();

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const row = parseDelimitedLine(line, delimiter);
    const zip = normalizeZip(row[zipIndex]);
    if (stateIndex !== -1) {
      const state = String(row[stateIndex] ?? "").trim();
      if (state && !stateByZip.has(zip)) {
        stateByZip.set(zip, state);
      }
    }
    const naics = row[naicsIndex];
    const category = mapNaicsToCategory(naics, matchers);
    if (!zip || !category) continue;
    const estabRaw = Number(String(row[estabIndex] ?? "").trim());
    const estab = Number.isFinite(estabRaw) ? estabRaw : 0;

    let entry = byZip.get(zip);
    if (!entry) {
      entry = new Map();
      byZip.set(zip, entry);
    }
    entry.set(category, (entry.get(category) ?? 0) + estab);
  }

  return { byZip, stateByZip };
};

const parseGazetteerZcta = (text) => {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) throw new Error("Gazetteer file is empty.");
  const header = lines[0];
  const delimiter = detectDelimiter(header);
  const headers = parseDelimitedLine(header, delimiter).map((value) =>
    value.trim().toLowerCase()
  );
  const zipIndex =
    headers.indexOf("zcta5") !== -1
      ? headers.indexOf("zcta5")
      : headers.indexOf("geoid");
  const latIndex = headers.indexOf("intptlat");
  const lonIndex = headers.indexOf("intptlong");
  const alandSqmiIndex = headers.indexOf("aland_sqmi");
  const alandIndex = headers.indexOf("aland");

  if (zipIndex === -1 || latIndex === -1 || lonIndex === -1) {
    throw new Error("Gazetteer headers missing ZCTA/lat/lon columns.");
  }

  const byZip = new Map();
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const row = parseDelimitedLine(line, delimiter);
    const zip = normalizeZip(row[zipIndex]);
    const lat = Number(String(row[latIndex] ?? "").trim());
    const lon = Number(String(row[lonIndex] ?? "").trim());
    if (!zip || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    let area = null;
    if (alandSqmiIndex !== -1) {
      const raw = Number(String(row[alandSqmiIndex] ?? "").trim());
      if (Number.isFinite(raw) && raw > 0) area = raw;
    } else if (alandIndex !== -1) {
      const raw = Number(String(row[alandIndex] ?? "").trim());
      if (Number.isFinite(raw) && raw > 0) area = raw / 2_589_988.110336;
    }

    byZip.set(zip, { lat, lon, area });
  }
  return byZip;
};

const fetchAcsPopulation = async (year, rawDir) => {
  const outPath = path.join(rawDir, `acs_population_${year}.json`);
  if (await fileExists(outPath)) return outPath;

  const apiKey = process.env.CENSUS_API_KEY || process.env.VITE_CENSUS_API_KEY;
  const url = new URL(`${ACS_API_BASE}/${year}/acs/acs5`);
  url.searchParams.set("get", "B01003_001E");
  url.searchParams.set("for", "zip code tabulation area:*");
  if (apiKey) url.searchParams.set("key", apiKey);

  const response = await fetchWithRetry(url.toString(), {}, 3);
  const data = await response.json();
  await writeJson(outPath, data);
  return outPath;
};

const parseAcsPopulation = (data) => {
  if (!Array.isArray(data) || data.length < 2) {
    throw new Error("ACS population payload invalid.");
  }
  const headers = data[0];
  const rows = data.slice(1);
  const popIndex = headers.indexOf("B01003_001E");
  const zipIndex = headers.findIndex((value) =>
    String(value).toLowerCase().includes("zip code tabulation area")
  );
  if (popIndex === -1 || zipIndex === -1) {
    throw new Error("ACS population headers missing.");
  }
  const byZip = new Map();
  rows.forEach((row) => {
    const zip = normalizeZip(row[zipIndex]);
    const pop = Number(String(row[popIndex] ?? "").trim());
    byZip.set(zip, Number.isFinite(pop) ? pop : 0);
  });
  return byZip;
};

const fetchAcsSummaryFiles = async (year, rawDir) => {
  const dataPath = path.join(rawDir, `acs_summary_b01003_${year}.dat`);
  const geoPath = path.join(rawDir, `acs_summary_geo_${year}.txt`);

  if (!(await fileExists(dataPath))) {
    const dataUrl = `https://www2.census.gov/programs-surveys/acs/summary_file/${year}/table-based-SF/data/5YRData/acsdt5y${year}-b01003.dat`;
    await downloadToFile(dataUrl, dataPath);
  }

  if (!(await fileExists(geoPath))) {
    const geoUrl = `https://www2.census.gov/programs-surveys/acs/summary_file/${year}/table-based-SF/documentation/Geos${year}5YR.txt`;
    await downloadToFile(geoUrl, geoPath);
  }

  return { dataPath, geoPath };
};

const extractZctaFromGeo = (value) => {
  const text = String(value ?? "").trim();
  const match = text.match(/US(\d{5})$/);
  if (match) return match[1];
  if (/^\d{5}$/.test(text)) return text;
  return null;
};

const parseAcsSummaryPopulation = async (dataPath, geoPath) => {
  const dataText = await readText(dataPath);
  const dataLines = dataText.split(/\r?\n/).filter(Boolean);
  if (!dataLines.length) throw new Error("ACS summary data file is empty.");

  const dataHeader = dataLines[0];
  const dataDelimiter = detectDelimiter(dataHeader);
  const dataHeaders = parseDelimitedLine(dataHeader, dataDelimiter).map((value) =>
    value.trim().toLowerCase()
  );
  const dataGeoIndex =
    dataHeaders.indexOf("geo_id") !== -1
      ? dataHeaders.indexOf("geo_id")
      : dataHeaders.indexOf("geoid");
  const dataPopIndex =
    dataHeaders.indexOf("b01003_001e") !== -1
      ? dataHeaders.indexOf("b01003_001e")
      : dataHeaders.indexOf("b01003_e001");

  if (dataGeoIndex !== -1 && dataPopIndex !== -1) {
    const byZip = new Map();
    for (let i = 1; i < dataLines.length; i += 1) {
      const row = parseDelimitedLine(dataLines[i], dataDelimiter);
      const zip = extractZctaFromGeo(row[dataGeoIndex]);
      if (!zip) continue;
      const pop = Number(String(row[dataPopIndex] ?? "").trim());
      byZip.set(zip, Number.isFinite(pop) ? pop : 0);
    }
    return byZip;
  }

  const geoText = await readText(geoPath);
  const geoLines = geoText.split(/\r?\n/).filter(Boolean);
  if (!geoLines.length) throw new Error("ACS summary GEO file is empty.");

  const geoHeader = geoLines[0];
  const geoDelimiter = detectDelimiter(geoHeader);
  const geoHeaders = parseDelimitedLine(geoHeader, geoDelimiter).map((value) =>
    value.trim().toLowerCase()
  );
  const geoLogRecIndex = geoHeaders.indexOf("logrecno");
  const geoSumLevelIndex = geoHeaders.indexOf("sumlevel");
  const geoIdIndex =
    geoHeaders.indexOf("geoid") !== -1
      ? geoHeaders.indexOf("geoid")
      : geoHeaders.indexOf("geo_id");
  const geoId2Index = geoHeaders.indexOf("geoid2");

  if (geoLogRecIndex === -1 || geoSumLevelIndex === -1) {
    throw new Error("ACS summary GEO headers missing LOGRECNO or SUMLEVEL.");
  }

  const logrecToZip = new Map();
  for (let i = 1; i < geoLines.length; i += 1) {
    const row = parseDelimitedLine(geoLines[i], geoDelimiter);
    const sumLevel = String(row[geoSumLevelIndex] ?? "").trim();
    if (sumLevel !== "860") continue;
    const logrec = String(row[geoLogRecIndex] ?? "").trim();
    const geoCandidate = row[geoId2Index] ?? row[geoIdIndex];
    const zip = extractZctaFromGeo(geoCandidate);
    if (logrec && zip) {
      logrecToZip.set(logrec, zip);
    }
  }

  const dataLogRecIndex = dataHeaders.indexOf("logrecno");
  if (dataLogRecIndex === -1 || dataPopIndex === -1) {
    throw new Error("ACS summary data headers missing LOGRECNO/B01003.");
  }

  const byZip = new Map();
  for (let i = 1; i < dataLines.length; i += 1) {
    const row = parseDelimitedLine(dataLines[i], dataDelimiter);
    const logrec = String(row[dataLogRecIndex] ?? "").trim();
    const zip = logrecToZip.get(logrec);
    if (!zip) continue;
    const pop = Number(String(row[dataPopIndex] ?? "").trim());
    byZip.set(zip, Number.isFinite(pop) ? pop : 0);
  }

  return byZip;
};

const percentileRank = (sorted, value) => {
  if (!sorted?.length || !Number.isFinite(value)) return null;
  if (sorted.length === 1) return 0.5;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo / (sorted.length - 1);
};

const buildDensityBands = (centroids, populations) => {
  const densityLogs = [];
  centroids.forEach((centroid, zip) => {
    const pop = populations.get(zip) ?? 0;
    if (!centroid.area || pop <= 0) return;
    const density = pop / centroid.area;
    if (Number.isFinite(density) && density > 0) {
      densityLogs.push(log10p1(density));
    }
  });

  densityLogs.sort((a, b) => a - b);
  const quantile = (q) => {
    if (!densityLogs.length) return 0;
    const index = Math.floor(q * (densityLogs.length - 1));
    return densityLogs[Math.max(0, Math.min(index, densityLogs.length - 1))];
  };
  const thresholds = [
    quantile(0.2),
    quantile(0.4),
    quantile(0.6),
    quantile(0.8),
  ];
  const median = quantile(0.5);

  const bandByZip = new Map();
  centroids.forEach((centroid, zip) => {
    const pop = populations.get(zip) ?? 0;
    const densityLog =
      centroid.area && pop > 0 ? log10p1(pop / centroid.area) : median;
    let band = thresholds.findIndex((threshold) => densityLog <= threshold);
    if (band === -1) band = DENSITY_BANDS - 1;
    bandByZip.set(zip, band);
  });

  return { thresholds, bandByZip };
};

const buildPercentileTables = ({
  centroids,
  populations,
  establishments,
  stateByZip,
  bandByZip,
  categoryIds,
}) => {
  const national = {};
  categoryIds.forEach((id) => {
    national[id] = Array.from({ length: DENSITY_BANDS }, () => []);
  });

  const stateTables = new Map();

  const ensureState = (state) => {
    if (!state) return null;
    if (!stateTables.has(state)) {
      const table = {};
      categoryIds.forEach((id) => {
        table[id] = Array.from({ length: DENSITY_BANDS }, () => []);
      });
      stateTables.set(state, table);
    }
    return stateTables.get(state);
  };

  centroids.forEach((_, zip) => {
    const pop = populations.get(zip) ?? 0;
    if (pop < POP_FLOOR) return;
    const band = bandByZip.get(zip) ?? 0;
    const estByCat = establishments.get(zip);
    const state = stateByZip.get(zip) ?? null;
    const stateTable = ensureState(state);

    categoryIds.forEach((id) => {
      const est = estByCat?.get(id) ?? 0;
      const per10k = pop > 0 ? (est / pop) * 10000 : 0;
      const value = log10p1(per10k);
      national[id][band].push(value);
      if (stateTable) {
        stateTable[id][band].push(value);
      }
    });
  });

  categoryIds.forEach((id) => {
    national[id].forEach((bucket) => bucket.sort((a, b) => a - b));
  });

  stateTables.forEach((table) => {
    categoryIds.forEach((id) => {
      table[id].forEach((bucket) => bucket.sort((a, b) => a - b));
    });
  });

  return { national, stateTables };
};
const buildOutput = async ({
  zbpYear,
  acsYear,
  gazetteerYear,
  centroids,
  establishments,
  populations,
  stateByZip,
  bandByZip,
  percentiles,
  densityMeta,
}) => {
  const outDir = path.join(ROOT_DIR, OUTPUT_DIR);
  await ensureDir(outDir);

  const chunks = {};
  const chunkData = new Map();
  const categoryIds = NAICS_CATEGORIES.map(({ id }) => id);

  centroids.forEach((centroid, zip) => {
    const pop = populations.get(zip) ?? 0;
    const estByCat = establishments.get(zip);
    const estObj = {};
    const state = stateByZip.get(zip) ?? null;
    const band = bandByZip.get(zip) ?? 0;
    const lowPop = pop < POP_FLOOR;
    const pn = new Array(categoryIds.length).fill(0);
    const ps = new Array(categoryIds.length).fill(0);

    if (estByCat) {
      estByCat.forEach((value, key) => {
        if (value > 0) estObj[key] = value;
      });
    }

    categoryIds.forEach((id, index) => {
      if (lowPop || pop <= 0) {
        pn[index] = 0;
        ps[index] = 0;
        return;
      }
      const est = estByCat?.get(id) ?? 0;
      const per10k = (est / pop) * 10000;
      const value = log10p1(per10k);
      const nationalBucket = percentiles.national[id]?.[band] ?? [];
      const nationalRank = percentileRank(nationalBucket, value);
      const nationalOpp = nationalRank === null ? 0 : 1 - nationalRank;

      let stateOpp = nationalOpp;
      const stateTable = state ? percentiles.stateTables.get(state) : null;
      const stateBucket = stateTable?.[id]?.[band] ?? [];
      if (stateBucket.length >= MIN_STATE_SAMPLE) {
        const stateRank = percentileRank(stateBucket, value);
        stateOpp = stateRank === null ? nationalOpp : 1 - stateRank;
      }

      pn[index] = Number.isFinite(nationalOpp) ? nationalOpp : 0;
      ps[index] = Number.isFinite(stateOpp) ? stateOpp : pn[index];
    });

    const record = {
      z: zip,
      lat: centroid.lat,
      lon: centroid.lon,
      p: pop,
      a: centroid.area ?? null,
      s: state,
      d: band,
      lp: lowPop,
      e: estObj,
      pn,
      ps,
    };

    const chunkId = zip[0];
    const list = chunkData.get(chunkId) ?? [];
    list.push(record);
    chunkData.set(chunkId, list);

    const bbox = chunks[chunkId]?.bbox ?? [Infinity, Infinity, -Infinity, -Infinity];
    bbox[0] = Math.min(bbox[0], centroid.lon);
    bbox[1] = Math.min(bbox[1], centroid.lat);
    bbox[2] = Math.max(bbox[2], centroid.lon);
    bbox[3] = Math.max(bbox[3], centroid.lat);
    chunks[chunkId] = { bbox, count: (chunks[chunkId]?.count ?? 0) + 1 };
  });

  const tag = `zbp${zbpYear}_acs${acsYear}`;
  const chunkIndex = {};

  for (const [chunkId, records] of chunkData.entries()) {
    const filename = `zcta_opportunity_${tag}_${chunkId}.json.gz`;
    const payload = JSON.stringify(records);
    const gz = gzipSync(strToU8(payload));
    await fs.writeFile(path.join(outDir, filename), Buffer.from(gz));
    chunkIndex[chunkId] = {
      file: filename,
      bbox: chunks[chunkId].bbox,
      count: chunks[chunkId].count,
    };
  }

  const index = {
    version: 1,
    zbpYear,
    acsYear,
    gazetteerYear,
    eps: OPPORTUNITY_EPS,
    categories: NAICS_CATEGORIES.map(({ id, label }) => ({ id, label })),
    densityBands: {
      thresholds: densityMeta.thresholds,
      popFloor: POP_FLOOR,
      minStateSample: MIN_STATE_SAMPLE,
    },
    chunks: chunkIndex,
  };

  await writeJson(path.join(outDir, "zcta_index.json"), index);
};

const run = async () => {
  const rawDir = path.join(ROOT_DIR, RAW_DIR);
  await ensureDir(rawDir);

  const rawFiles = await fs.readdir(rawDir).catch(() => []);
  const localZbpZip = rawFiles.find((name) => name.match(/^zbp_(\d{4})\.zip$/));
  const localZbpTxt = rawFiles.find((name) => name.match(/^zbp_(\d{4})\.txt$/));
  let zbpYear = null;
  let zbpUrl = null;

  if (localZbpZip) {
    zbpYear = Number(localZbpZip.match(/^zbp_(\d{4})\.zip$/)[1]);
  } else if (localZbpTxt) {
    zbpYear = Number(localZbpTxt.match(/^zbp_(\d{4})\.txt$/)[1]);
  } else {
    const remote = await findLatestZbp();
    zbpYear = remote.year;
    zbpUrl = remote.url;
  }
  let acsYear = null;
  try {
    acsYear = (await findLatestAcs()).year;
  } catch {
    // Defer to summary file detection if API probing fails.
  }
  const { year: gazetteerYear, url: gazetteerUrl } = await findLatestGazetteer();

  const zbpZipPath = path.join(rawDir, `zbp_${zbpYear}.zip`);
  const zbpTxtPath = path.join(rawDir, `zbp_${zbpYear}.txt`);
  if (!(await fileExists(zbpZipPath)) && !(await fileExists(zbpTxtPath))) {
    await downloadToFile(zbpUrl, zbpZipPath);
  }

  const gazetteerZipPath = path.join(rawDir, `gazetteer_zcta_${gazetteerYear}.zip`);
  if (!(await fileExists(gazetteerZipPath))) {
    await downloadToFile(gazetteerUrl, gazetteerZipPath);
  }

  let populations = null;
  if (acsYear) {
    try {
      const acsPath = await fetchAcsPopulation(acsYear, rawDir);
      const acsData = JSON.parse(await readText(acsPath));
      populations = parseAcsPopulation(acsData);
    } catch {
      populations = null;
    }
  }

  if (!populations) {
    const { year: summaryYear } = await findLatestAcsSummary();
    acsYear = summaryYear;
    const { dataPath, geoPath } = await fetchAcsSummaryFiles(summaryYear, rawDir);
    populations = await parseAcsSummaryPopulation(dataPath, geoPath);
  }

  const zbpText = (await fileExists(zbpTxtPath))
    ? await readText(zbpTxtPath)
    : await loadZipEntriesFromZip(zbpZipPath);
  const gazText = await loadZipEntriesFromZip(gazetteerZipPath);

  const { byZip: establishments, stateByZip } = parseZbpDetail(zbpText);
  const centroids = parseGazetteerZcta(gazText);
  const densityMeta = buildDensityBands(centroids, populations);
  const percentiles = buildPercentileTables({
    centroids,
    populations,
    establishments,
    stateByZip,
    bandByZip: densityMeta.bandByZip,
    categoryIds: NAICS_CATEGORIES.map(({ id }) => id),
  });

  await buildOutput({
    zbpYear,
    acsYear,
    gazetteerYear,
    centroids,
    establishments,
    populations,
    stateByZip,
    bandByZip: densityMeta.bandByZip,
    percentiles,
    densityMeta,
  });

  console.log(
    `Built ZIP opportunity data (ZBP ${zbpYear}, ACS ${acsYear}, Gazetteer ${gazetteerYear}).`
  );
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
