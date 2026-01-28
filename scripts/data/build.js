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

const normalizeZip = (zip) => String(zip ?? "").trim().padStart(5, "0");

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
  const estabIndex = headers.indexOf("estab");

  if (zipIndex === -1 || naicsIndex === -1 || estabIndex === -1) {
    throw new Error("ZBP headers missing ZIP/NAICS/ESTAB columns.");
  }

  const matchers = buildCategoryMatchers();
  const byZip = new Map();

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const row = parseDelimitedLine(line, delimiter);
    const zip = normalizeZip(row[zipIndex]);
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

  return byZip;
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

const buildOutput = async ({
  zbpYear,
  acsYear,
  gazetteerYear,
  centroids,
  establishments,
  populations,
}) => {
  const outDir = path.join(ROOT_DIR, OUTPUT_DIR);
  await ensureDir(outDir);

  const chunks = {};
  const chunkData = new Map();

  centroids.forEach((centroid, zip) => {
    const pop = populations.get(zip) ?? 0;
    const estByCat = establishments.get(zip);
    const estObj = {};

    if (estByCat) {
      estByCat.forEach((value, key) => {
        if (value > 0) estObj[key] = value;
      });
    }

    const record = {
      z: zip,
      lat: centroid.lat,
      lon: centroid.lon,
      p: pop,
      a: centroid.area ?? null,
      e: estObj,
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
    chunks: chunkIndex,
  };

  await writeJson(path.join(outDir, "zcta_index.json"), index);
};

const run = async () => {
  const rawDir = path.join(ROOT_DIR, RAW_DIR);
  await ensureDir(rawDir);

  const { year: zbpYear, url: zbpUrl } = await findLatestZbp();
  const { year: acsYear } = await findLatestAcs();
  const { year: gazetteerYear, url: gazetteerUrl } = await findLatestGazetteer();

  const zbpZipPath = path.join(rawDir, `zbp_${zbpYear}.zip`);
  if (!(await fileExists(zbpZipPath))) {
    await downloadToFile(zbpUrl, zbpZipPath);
  }

  const gazetteerZipPath = path.join(rawDir, `gazetteer_zcta_${gazetteerYear}.zip`);
  if (!(await fileExists(gazetteerZipPath))) {
    await downloadToFile(gazetteerUrl, gazetteerZipPath);
  }

  const acsPath = await fetchAcsPopulation(acsYear, rawDir);
  const acsData = JSON.parse(await readText(acsPath));

  const zbpText = await loadZipEntriesFromZip(zbpZipPath);
  const gazText = await loadZipEntriesFromZip(gazetteerZipPath);

  const establishments = parseZbpDetail(zbpText);
  const populations = parseAcsPopulation(acsData);
  const centroids = parseGazetteerZcta(gazText);

  await buildOutput({
    zbpYear,
    acsYear,
    gazetteerYear,
    centroids,
    establishments,
    populations,
  });

  console.log(
    `Built ZIP opportunity data (ZBP ${zbpYear}, ACS ${acsYear}, Gazetteer ${gazetteerYear}).`
  );
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
