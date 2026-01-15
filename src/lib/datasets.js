export const ACS_YEARS = [2023, 2022, 2021];
export const NONEMP_YEARS = [2023, 2022, 2021];
export const NESD_YEAR = 2023;

export const DATASETS = {
  acs: {
    name: "ACS 1-Year Estimates",
    getBase: (year) => `https://api.census.gov/data/${year}/acs/acs1`,
    getBase5: (year) => `https://api.census.gov/data/${year}/acs/acs5`,
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

export const VIEW_CONFIGS = {
  income: {
    name: "Household Income Tailwind",
    datasets: { primary: "acs1", fallback: "acs5" },
    yearHandling: "Use ACS 1-year; fallback to ACS 5-year if unavailable.",
    geoFormat: "for=us:1 or for=state:{FIPS}",
    variables: {
      medianIncome: "B19013_001E",
    },
    geos: ["us", "state"],
    years: ACS_YEARS,
    sample: {
      get: ["NAME", "B19013_001E"],
      for: "state:06",
    },
  },
  cost: {
    name: "Cost-of-Living Signal",
    datasets: { primary: "acs1", fallback: "acs5" },
    yearHandling: "Use most recent ACS 1-year; fallback to ACS 5-year.",
    geoFormat: "for=state:* (filtered to major states list)",
    variables: {
      medianRent: "B25064_001E",
    },
    geos: ["state"],
    years: [ACS_YEARS[0]],
    sample: {
      get: ["NAME", "B25064_001E"],
      for: "state:*",
    },
  },
  workstyle: {
    name: "Remote/Commute Landscape",
    datasets: { primary: "acs1", fallback: "acs5" },
    yearHandling: "Use 3-year ACS 1-year series; fallback to ACS 5-year.",
    geoFormat: "for=us:1 or for=state:{FIPS}",
    variables: {
      workersTotal: "B08006_001E",
      workedFromHome: "B08006_017E",
    },
    geos: ["us", "state"],
    years: ACS_YEARS,
    sample: {
      get: ["NAME", "B08006_001E", "B08006_017E"],
      for: "state:06",
    },
  },
  demand: {
    name: "Customer Demographics: Movers & Builders",
    datasets: { primary: "acs1", fallback: "acs5" },
    yearHandling: "Use most recent ACS 1-year; fallback to ACS 5-year.",
    geoFormat: "for=us:1 or for=state:{FIPS}",
    variables: {
      popTotal: "B01001_001E",
      age25_29_m: "B01001_011E",
      age30_34_m: "B01001_012E",
      age25_29_f: "B01001_035E",
      age30_34_f: "B01001_036E",
      hhTotal: "B11005_001E",
      hhWithKids: "B11005_002E",
    },
    geos: ["us", "state"],
    years: [ACS_YEARS[0]],
    sample: {
      get: ["B01001_001E", "B01001_011E", "B01001_012E"],
      for: "state:06",
    },
  },
  housing: {
    name: "New Neighborhoods = New Demand",
    datasets: { primary: "acs1", fallback: "acs5" },
    yearHandling: "Use most recent ACS 1-year; fallback to ACS 5-year.",
    geoFormat: "for=state:* (filtered to major states list)",
    variables: {
      totalUnits: "B25034_001E",
      built2020: "B25034_002E",
      built2010_2019: "B25034_003E",
    },
    geos: ["state"],
    years: [ACS_YEARS[0]],
    sample: {
      get: ["NAME", "B25034_001E", "B25034_002E", "B25034_003E"],
      for: "state:*",
    },
  },
};
