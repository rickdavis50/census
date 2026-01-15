export const ACS_YEARS = [2023, 2022, 2021];
export const NONEMP_YEARS = [2023, 2022, 2021];
export const NESD_YEAR = 2023;

export const DATASETS = {
  acs: {
    name: "ACS 1-Year Estimates",
    getBase: (year) => `https://api.census.gov/data/${year}/acs/acs1`,
    variables: {
      population: "B01003_001E",
    },
    geos: ["us", "state"],
    sample: {
      get: ["NAME", "B01003_001E"],
      for: "state:*",
    },
  },
  nonemp: {
    name: "Nonemployer Statistics",
    getBase: (year) => `https://api.census.gov/data/${year}/nonemp`,
    variablesByYear: {
      2023: { naics: "NAICS2022", label: "NAICS2022_LABEL" },
      2022: { naics: "NAICS2022", label: "NAICS2022_LABEL" },
      2021: { naics: "NAICS2017", label: "NAICS2017_LABEL" },
    },
    variables: {
      establishments: "NESTAB",
    },
    geos: ["us", "state"],
    sample: {
      get: ["NAICS2022", "NAICS2022_LABEL", "NESTAB"],
      for: "state:06",
    },
  },
  nesd: {
    name: "Nonemployer Statistics by Demographics (NES-D)",
    getBase: (year) => `https://api.census.gov/data/${year}/absnesd`,
    variables: {
      firms: "FIRMNOPD",
      sex: "SEX",
      sexLabel: "SEX_LABEL",
      race: "RACE_GROUP",
      raceLabel: "RACE_GROUP_LABEL",
      ethnicity: "ETH_GROUP",
      ethnicityLabel: "ETH_GROUP_LABEL",
    },
    geos: ["us", "state"],
    sample: {
      get: ["SEX", "SEX_LABEL", "FIRMNOPD"],
      for: "state:06",
    },
  },
};
