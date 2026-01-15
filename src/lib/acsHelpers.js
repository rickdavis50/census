import { buildUrl, cachedFetch, fetchJson } from "./censusClient";
import { DATASETS } from "./datasets";

const surveyLabel = {
  acs1: "ACS 1-year",
  acs5: "ACS 5-year",
};

const buildCacheKey = ({ survey, year, variables, geoParams }) => {
  const geoPart = Object.entries(geoParams || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return `acs:${survey}:${year}:${variables.join("|")}:${geoPart}`;
};

export const fetchAcsSeries = async ({
  years,
  variables,
  geoParams,
  fallback = true,
}) => {
  const attempts = fallback ? ["acs1", "acs5"] : ["acs1"];

  for (const survey of attempts) {
    try {
      const results = await Promise.all(
        years.map(async (year) => {
          const base =
            survey === "acs1"
              ? DATASETS.acs.getBase(year)
              : DATASETS.acs.getBase5(year);
          const url = buildUrl(base, {
            get: ["NAME", ...variables],
            ...geoParams,
          });
          const cacheKey = buildCacheKey({
            survey,
            year,
            variables,
            geoParams,
          });
          const data = await cachedFetch(cacheKey, () => fetchJson(url));
          if (!Array.isArray(data) || data.length < 2) {
            throw new Error("No ACS data returned.");
          }
          return { year, data };
        })
      );
      return { survey, label: surveyLabel[survey], results };
    } catch (err) {
      if (survey === "acs5") throw err;
    }
  }
  throw new Error("ACS data unavailable.");
};

export const fetchAcsStates = async ({
  year,
  variables,
  fallback = true,
}) => {
  const attempts = fallback ? ["acs1", "acs5"] : ["acs1"];

  for (const survey of attempts) {
    try {
      const base =
        survey === "acs1"
          ? DATASETS.acs.getBase(year)
          : DATASETS.acs.getBase5(year);
      const url = buildUrl(base, {
        get: ["NAME", ...variables],
        for: "state:*",
      });
      const cacheKey = buildCacheKey({
        survey,
        year,
        variables,
        geoParams: { for: "state:*" },
      });
      const data = await cachedFetch(cacheKey, () => fetchJson(url));
      if (!Array.isArray(data) || data.length < 2) {
        throw new Error("No ACS data returned.");
      }
      return { survey, label: surveyLabel[survey], data };
    } catch (err) {
      if (survey === "acs5") throw err;
    }
  }
  throw new Error("ACS data unavailable.");
};
