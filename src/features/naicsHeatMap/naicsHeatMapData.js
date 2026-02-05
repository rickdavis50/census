import { strFromU8, unzipSync } from "fflate";

export const NAICS_OPTIONS = [
  { value: "11", label: "11 Agriculture, Forestry, Fishing and Hunting" },
  { value: "21", label: "21 Mining, Quarrying, and Oil and Gas Extraction" },
  { value: "22", label: "22 Utilities" },
  { value: "23", label: "23 Construction" },
  { value: "31", label: "31-33 Manufacturing" },
  { value: "42", label: "42 Wholesale Trade" },
  { value: "44", label: "44-45 Retail Trade" },
  { value: "48", label: "48-49 Transportation and Warehousing" },
  { value: "51", label: "51 Information" },
  { value: "52", label: "52 Finance and Insurance" },
  { value: "53", label: "53 Real Estate and Rental and Leasing" },
  { value: "54", label: "54 Professional, Scientific, and Technical Services" },
  { value: "55", label: "55 Management of Companies and Enterprises" },
  {
    value: "56",
    label:
      "56 Administrative and Support and Waste Management and Remediation Services",
  },
  { value: "61", label: "61 Educational Services" },
  { value: "62", label: "62 Health Care and Social Assistance" },
  { value: "71", label: "71 Arts, Entertainment, and Recreation" },
  { value: "72", label: "72 Accommodation and Food Services" },
  { value: "81", label: "81 Other Services (except Public Administration)" },
];

export const DEFAULT_NAICS = "72";

const CACHE_KEY = "naics-zip-centroids-v1";
const STATE_CACHE_KEY = "naics-state-centroids-v1";
const DB_NAME = "census-cache";
const DB_STORE = "keyval";
const GAZETTEER_URL =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_zcta_national.zip";
const BASE_URL = String(import.meta.env.BASE_URL || "/");
const STATE_CENTROIDS_URL = `${BASE_URL.replace(/\/$/, "")}/state-centroids.json`;
const CENSUS_PROXY_URL = String(
  import.meta.env.VITE_CENSUS_PROXY_URL ?? ""
).trim().replace(/\/$/, "");

let centroidPromise = null;
let stateCentroidPromise = null;

export const getNaicsLabel = (code) => {
  const match = NAICS_OPTIONS.find((option) => option.value === code);
  return match ? match.label : `NAICS ${code}`;
};

export const sanitizeNaics = (value) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);

const openDb = () =>
  new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const idbGet = async (key) => {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, "readonly");
      const store = transaction.objectStore(DB_STORE);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    return null;
  }
};

const idbSet = async (key, value) => {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, "readwrite");
      const store = transaction.objectStore(DB_STORE);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    return true;
  } catch (error) {
    return false;
  }
};

const loadCachedCentroids = async () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (error) {
    // Ignore localStorage failures.
  }

  const idbValue = await idbGet(CACHE_KEY);
  if (idbValue) return idbValue;
  return null;
};

const loadCachedStateCentroids = async () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STATE_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (error) {
    // Ignore localStorage failures.
  }

  const idbValue = await idbGet(STATE_CACHE_KEY);
  if (idbValue) return idbValue;
  return null;
};

const saveCachedCentroids = async (centroids) => {
  if (typeof window === "undefined") return;
  let stored = false;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(centroids));
    stored = true;
  } catch (error) {
    stored = false;
  }

  if (!stored) {
    await idbSet(CACHE_KEY, centroids);
  }
};

const saveCachedStateCentroids = async (centroids) => {
  if (typeof window === "undefined") return;
  let stored = false;
  try {
    localStorage.setItem(STATE_CACHE_KEY, JSON.stringify(centroids));
    stored = true;
  } catch (error) {
    stored = false;
  }

  if (!stored) {
    await idbSet(STATE_CACHE_KEY, centroids);
  }
};

const parseGazetteer = (text) => {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headerLine = lines[0];
  const delimiter = headerLine.includes("\t")
    ? "\t"
    : headerLine.includes(",")
    ? ","
    : "|";
  const headers = headerLine.split(delimiter).map((item) => item.trim());
  const headerMap = new Map(
    headers.map((header, index) => [header.toLowerCase(), index])
  );

  const zipIndex =
    headerMap.get("zcta5") ??
    headerMap.get("geoid") ??
    headerMap.get("geo_id") ??
    headerMap.get("zcta") ??
    null;
  const latIndex =
    headerMap.get("intptlat") ?? headerMap.get("latitude") ?? null;
  const lngIndex =
    headerMap.get("intptlong") ?? headerMap.get("longitude") ?? null;

  if (zipIndex === null || latIndex === null || lngIndex === null) {
    return [];
  }

  const centroids = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const parts = line.split(delimiter);
    const zip = String(parts[zipIndex] ?? "").trim().padStart(5, "0");
    const lat = Number(String(parts[latIndex] ?? "").trim());
    const lng = Number(String(parts[lngIndex] ?? "").trim());
    if (!zip || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    centroids.push({ zip, lat, lng });
  }

  return centroids;
};

const unzipGazetteer = (buffer) => {
  const files = unzipSync(new Uint8Array(buffer));
  const entry = Object.values(files)[0];
  if (!entry) return "";
  return strFromU8(entry);
};

const buildProxyUrl = (targetUrl) => {
  if (!CENSUS_PROXY_URL) return targetUrl;
  return `${CENSUS_PROXY_URL}?url=${encodeURIComponent(targetUrl)}`;
};

export const loadZipCentroids = async () => {
  if (centroidPromise) return centroidPromise;

  centroidPromise = (async () => {
    const cached = await loadCachedCentroids();
    if (cached?.length) return cached;

    const response = await fetch(buildProxyUrl(GAZETTEER_URL));
    if (!response.ok) {
      throw new Error(`Failed to load ZIP centroids (${response.status}).`);
    }
    const buffer = await response.arrayBuffer();
    const text = unzipGazetteer(buffer);
    const centroids = parseGazetteer(text);

    if (!centroids.length) {
      throw new Error("Unable to parse ZIP centroid data.");
    }

    await saveCachedCentroids(centroids);
    return centroids;
  })();

  return centroidPromise;
};

export const loadStateCentroids = async () => {
  if (stateCentroidPromise) return stateCentroidPromise;

  stateCentroidPromise = (async () => {
    const cached = await loadCachedStateCentroids();
    if (cached?.length) return cached;

    const response = await fetch(STATE_CENTROIDS_URL);
    if (!response.ok) {
      throw new Error(`Failed to load state centroids (${response.status}).`);
    }
    const data = await response.json();
    if (!Array.isArray(data) || !data.length) {
      throw new Error("Unable to parse state centroid data.");
    }

    await saveCachedStateCentroids(data);
    return data;
  })();

  return stateCentroidPromise;
};
