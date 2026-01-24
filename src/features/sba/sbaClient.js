const SBA_BASE_URL = "https://data.sba.gov";
const CKAN_BASE_URL = `${SBA_BASE_URL}/api/3/action`;
const PROXY_BASE_URL = String(
  import.meta.env.VITE_SBA_PROXY_URL ?? ""
).trim().replace(/\/$/, "");
const CACHE = new Map();

export const getCached = async (key, fetcher) => {
  if (CACHE.has(key)) {
    return CACHE.get(key);
  }

  const promise = Promise.resolve().then(fetcher);
  CACHE.set(key, promise);

  try {
    const result = await promise;
    CACHE.set(key, result);
    return result;
  } catch (error) {
    CACHE.delete(key);
    throw error;
  }
};

const normalizeFormat = (value) => String(value ?? "").trim().toLowerCase();

const normalizeResourceUrl = (resource) => {
  const url = String(resource?.url ?? "").trim();
  if (!url) return "";
  if (url.startsWith("http://")) return `https://${url.slice(7)}`;
  return url;
};

const fetchDatastoreRows = async (resourceId) => {
  const limit = 10000;
  let offset = 0;
  const records = [];

  while (true) {
    const url = `${CKAN_BASE_URL}/datastore_search?resource_id=${encodeURIComponent(
      resourceId
    )}&limit=${limit}&offset=${offset}`;
    const response = await fetch(buildProxyUrl(url));
    if (!response.ok) {
      throw new Error(`SBA datastore fetch failed (${response.status}).`);
    }
    const payload = await response.json();
    const batch = payload?.result?.records ?? [];
    records.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return records;
};

export const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  const pushValue = () => {
    row.push(value);
    value = "";
  };

  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      pushValue();
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      pushValue();
      pushRow();
      continue;
    }

    value += char;
  }

  if (value.length || row.length) {
    pushValue();
    pushRow();
  }

  if (!rows.length) return [];
  const [headers, ...body] = rows;
  const headerKeys = headers.map((header) => String(header ?? "").trim());

  return body
    .filter((cells) => cells.some((cell) => String(cell ?? "").trim() !== ""))
    .map((cells) => {
      const entry = {};
      headerKeys.forEach((key, index) => {
        entry[key] = cells[index] ?? "";
      });
      return entry;
    });
};

const normalizeJsonRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.records)) return payload.records;
  if (payload && payload.type === "FeatureCollection") {
    return payload.features.map((feature) => feature.properties ?? {});
  }
  return [];
};

export const selectBestResource = (resources = []) => {
  const ranked = rankResources(resources);
  return ranked.length ? ranked[0] : null;
};

export const rankResources = (resources = []) =>
  resources
    .map((resource) => {
      const format = normalizeFormat(resource.format);
      const url = normalizeResourceUrl(resource);
      const name = String(resource.name ?? "").toLowerCase();
      let score = 0;

      if (["json", "geojson"].includes(format)) score += 3;
      if (format === "csv") score += 2;
      if (!format) score += 1;
      if (resource.datastore_active) score += 2;
      if (name.includes("data") || url.toLowerCase().includes("data")) score += 1;
      if (name.includes("documentation") || url.toLowerCase().includes("documentation")) {
        score -= 2;
      }

      return { resource, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.resource);

const buildProxyUrl = (targetUrl) => {
  if (!PROXY_BASE_URL) return targetUrl;
  return `${PROXY_BASE_URL}?url=${encodeURIComponent(targetUrl)}`;
};

export const ckanSearch = async (query, { forceRefresh = false } = {}) => {
  const key = `ckan-search:${query}`;
  const fetcher = async () => {
    const url = `${CKAN_BASE_URL}/package_search?q=${encodeURIComponent(query)}`;
    const response = await fetch(buildProxyUrl(url));
    if (!response.ok) {
      throw new Error(`SBA search failed (${response.status}).`);
    }
    const payload = await response.json();
    return payload?.result?.results ?? [];
  };

  if (forceRefresh) return fetcher();
  return getCached(key, fetcher);
};

export const ckanPackageShow = async (id, { forceRefresh = false } = {}) => {
  const key = `ckan-package:${id}`;
  const fetcher = async () => {
    const url = `${CKAN_BASE_URL}/package_show?id=${encodeURIComponent(id)}`;
    const response = await fetch(buildProxyUrl(url));
    if (!response.ok) {
      throw new Error(`SBA package lookup failed (${response.status}).`);
    }
    const payload = await response.json();
    return payload?.result ?? null;
  };

  if (forceRefresh) return fetcher();
  return getCached(key, fetcher);
};

export const discoverDataset = async ({ keywords, forceRefresh = false }) => {
  for (const keyword of keywords) {
    const results = await ckanSearch(keyword, { forceRefresh });
    for (const dataset of results) {
      const detailed = await ckanPackageShow(dataset.id, { forceRefresh });
      const resources = rankResources(detailed?.resources ?? []);
      if (resources.length) {
        return { dataset: detailed, resources };
      }
    }
  }

  throw new Error("SBA dataset not found via open data search");
};

export const fetchResource = async (resource) => {
  const url = normalizeResourceUrl(resource);
  if (!url) {
    throw new Error("SBA dataset resource URL missing.");
  }

  if (resource?.datastore_active && resource?.id) {
    return fetchDatastoreRows(resource.id);
  }

  const format = normalizeFormat(resource.format);
  if (
    format === "json" ||
    format === "geojson" ||
    url.endsWith(".json") ||
    url.endsWith(".geojson")
  ) {
    const response = await fetch(buildProxyUrl(url));
    if (!response.ok) {
      throw new Error(`SBA resource fetch failed (${response.status}).`);
    }
    const payload = await response.json();
    return normalizeJsonRows(payload);
  }

  const response = await fetch(buildProxyUrl(url));
  if (!response.ok) {
    throw new Error(`SBA resource fetch failed (${response.status}).`);
  }
  const text = await response.text();
  return parseCsv(text);
};
