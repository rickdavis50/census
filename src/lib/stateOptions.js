import { buildUrl, cachedFetch, fetchJson } from "./censusClient";
import { ACS_YEARS, DATASETS } from "./datasets";

export const fetchStateOptions = async () => {
  const year = ACS_YEARS[0];
  const url = buildUrl(DATASETS.acs.getBase(year), {
    get: ["NAME", DATASETS.acs.variables.population],
    for: "state:*",
  });
  const cacheKey = `states:${year}`;
  const data = await cachedFetch(cacheKey, () => fetchJson(url));
  return data
    .slice(1)
    .map((row) => ({
      value: row[2],
      label: row[0],
      type: "state",
      fips: row[2],
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
};
