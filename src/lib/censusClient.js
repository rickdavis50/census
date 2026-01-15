const memoryCache = new Map();
const STORAGE_PREFIX = "zb-census-cache:";
const DEFAULT_TTL_MS = 1000 * 60 * 60;

const getSessionItem = (key) => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
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

export const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
};

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

  const value = await fetchFn();
  const payload = { value, timestamp: now };
  memoryCache.set(key, payload);
  setSessionItem(key, JSON.stringify(payload));
  return value;
};
