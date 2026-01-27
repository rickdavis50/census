const memoryCache = new Map();
const inFlight = new Map();
const STORAGE_PREFIX = "zb-census-cache:";
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;
const MAX_CONCURRENCY = 4;
const MAX_RETRIES = 3;
const BASE_RETRY_MS = 800;
const CENSUS_PROXY_URL = String(
  import.meta.env.VITE_CENSUS_PROXY_URL ?? ""
).trim().replace(/\/$/, "");
let activeRequests = 0;
const queue = [];

const getSessionItem = (key) => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
  } catch (err) {
    return null;
  }
};

const getLocalItem = (key) => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
  } catch (err) {
    return null;
  }
};

const setSessionItem = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
  } catch (err) {
    return;
  }
};

const setLocalItem = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
  } catch (err) {
    return;
  }
};

const withProxy = (url) => {
  if (!CENSUS_PROXY_URL) return url;
  if (url.startsWith(CENSUS_PROXY_URL)) return url;
  return `${CENSUS_PROXY_URL}?url=${encodeURIComponent(url)}`;
};

const runNext = () => {
  if (activeRequests >= MAX_CONCURRENCY || queue.length === 0) return;
  activeRequests += 1;
  const next = queue.shift();
  if (!next) return;
  next()
    .catch(() => {})
    .finally(() => {
      activeRequests -= 1;
      runNext();
    });
};

const enqueue = (task) =>
  new Promise((resolve, reject) => {
    queue.push(async () => {
      try {
        const result = await task();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
    runNext();
  });

export const buildUrl = (datasetBase, params) => {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      search.set(key, value.join(","));
      return;
    }
    search.set(key, value);
  });

  return `${datasetBase}?${search.toString()}`;
};

const fetchWithRetry = async (url) => {
  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    const response = await fetch(withProxy(url));
    if (response.ok) return response.json();

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      const backoff =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : BASE_RETRY_MS * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, backoff));
      attempt += 1;
      continue;
    }

    throw new Error(`Request failed: ${response.status}`);
  }
  throw new Error("Request failed: 429");
};

export const fetchJson = async (url) => enqueue(() => fetchWithRetry(url));

export const cachedFetch = async (key, fetchFn, ttlMs = DEFAULT_TTL_MS) => {
  const now = Date.now();
  const inMemory = memoryCache.get(key);
  if (inMemory && now - inMemory.timestamp < ttlMs) {
    return inMemory.value;
  }

  const sessionItem = getSessionItem(key);
  if (sessionItem) {
    try {
      const parsed = JSON.parse(sessionItem);
      if (parsed && now - parsed.timestamp < ttlMs) {
        memoryCache.set(key, parsed);
        return parsed.value;
      }
    } catch (err) {
      // Ignore invalid cache entries.
    }
  }

  const localItem = getLocalItem(key);
  if (localItem) {
    try {
      const parsed = JSON.parse(localItem);
      if (parsed && now - parsed.timestamp < ttlMs) {
        memoryCache.set(key, parsed);
        return parsed.value;
      }
    } catch (err) {
      // Ignore invalid cache entries.
    }
  }

  const inflight = inFlight.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const value = await fetchFn();
    const payload = { value, timestamp: Date.now() };
    memoryCache.set(key, payload);
    setSessionItem(key, JSON.stringify(payload));
    setLocalItem(key, JSON.stringify(payload));
    return value;
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
};
