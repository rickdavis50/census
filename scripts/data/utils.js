import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

export const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

export const fileExists = async (filepath) => {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
};

export const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const fetchWithRetry = async (url, options = {}, retries = 3) => {
  let attempt = 0;
  while (attempt <= retries) {
    const response = await fetch(url, options);
    if (response.ok) return response;
    if (response.status === 429 && attempt < retries) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      const backoff = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : 800 * 2 ** attempt;
      await sleep(backoff);
      attempt += 1;
      continue;
    }
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  throw new Error(`Request failed (429) for ${url}`);
};

export const downloadToFile = async (url, filepath) => {
  const response = await fetchWithRetry(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filepath, buffer);
  return filepath;
};

export const readText = async (filepath) =>
  fs.readFile(filepath, "utf-8");

export const writeJson = async (filepath, data) => {
  const json = JSON.stringify(data);
  await fs.writeFile(filepath, json);
};

export const parseDelimitedLine = (line, delimiter) => {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current);
  return result;
};

export const detectDelimiter = (line) => {
  if (line.includes("\t")) return "\t";
  if (line.includes(",")) return ",";
  return "|";
};
