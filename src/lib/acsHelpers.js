import { buildUrl, cachedFetch, fetchJson } from "./censusClient";
import { DATASETS } from "./datasets";

const surveyLabel = {
  acs1: "ACS 1-year",
  acs5: "ACS 5-year",
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
          const data = await cachedFetch(url, () => fetchJson(url));
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
      const data = await cachedFetch(url, () => fetchJson(url));
      return { survey, label: surveyLabel[survey], data };
    } catch (err) {
      if (survey === "acs5") throw err;
    }
  }
  throw new Error("ACS data unavailable.");
};
