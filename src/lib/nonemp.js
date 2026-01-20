import { buildUrl, cachedFetch, fetchJson } from "./censusClient";
import { DATASETS, NONEMP_YEARS } from "./datasets";

const isSectorCode = (code) => code.length === 2 && code !== "00";

const parseRows = (data) =>
  data
    .slice(1)
    .map((row) => ({
      code: row[0],
      label: row[1],
      count: Number(row[2]),
    }))
    .filter((row) => isSectorCode(row.code) && Number.isFinite(row.count));

export const fetchNonemployerSectors = async ({ forceRefresh = false } = {}) => {
  for (const year of NONEMP_YEARS) {
    const variables = DATASETS.nonemp.variablesByYear[year];
    const url = buildUrl(DATASETS.nonemp.getBase(year), {
      get: [
        variables.naics,
        variables.label,
        DATASETS.nonemp.variables.establishments,
      ],
      for: "us:1",
    });
    const fetcher = () => fetchJson(url);
    const data = forceRefresh ? await fetcher() : await cachedFetch(url, fetcher);
    const rows = parseRows(data).sort((a, b) => b.count - a.count);
    if (rows.length) {
      return { year, rows };
    }
  }

  throw new Error("No nonemployer data available for recent years.");
};
