import { gunzipSync, strFromU8 } from "fflate";

const INDEX_URL = "/data/zcta_index.json";

let indexPromise = null;
const chunkCache = new Map();

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (${response.status}).`);
  }
  return response.json();
};

const fetchGzipJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (${response.status}).`);
  }
  const buffer = new Uint8Array(await response.arrayBuffer());
  const data = gunzipSync(buffer);
  return JSON.parse(strFromU8(data));
};

export const loadOpportunityIndex = async () => {
  if (!indexPromise) {
    indexPromise = fetchJson(INDEX_URL);
  }
  return indexPromise;
};

export const loadOpportunityChunk = async (chunkId) => {
  const cacheKey = String(chunkId);
  if (chunkCache.has(cacheKey)) return chunkCache.get(cacheKey);

  const index = await loadOpportunityIndex();
  const chunkMeta = index.chunks?.[cacheKey];
  if (!chunkMeta?.file) {
    throw new Error(`Missing chunk metadata for ${cacheKey}.`);
  }
  const promise = fetchGzipJson(`/data/${chunkMeta.file}`);
  chunkCache.set(cacheKey, promise);
  return promise;
};

export const getChunkIdForZip = (zip) => String(zip ?? "").padStart(5, "0")[0];

export const normalizeZip = (zip) =>
  String(zip ?? "").replace(/\D/g, "").slice(0, 5).padStart(5, "0");

export const bboxIntersects = (bboxA, bboxB) =>
  bboxA[0] <= bboxB[2] &&
  bboxA[2] >= bboxB[0] &&
  bboxA[1] <= bboxB[3] &&
  bboxA[3] >= bboxB[1];

export const bboxFromMap = (bounds) => [
  bounds.getWest(),
  bounds.getSouth(),
  bounds.getEast(),
  bounds.getNorth(),
];
