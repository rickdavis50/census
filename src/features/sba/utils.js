export const normalizeKey = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[_-]/g, " ");

export const findFieldKey = (keys, candidates) => {
  const normalizedKeys = keys.map((key) => ({
    original: key,
    normalized: normalizeKey(key).replace(/\s+/g, ""),
  }));

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeKey(candidate).replace(/\s+/g, "");
    const match = normalizedKeys.find(
      (entry) =>
        entry.normalized === normalizedCandidate ||
        entry.normalized.includes(normalizedCandidate)
    );
    if (match) return match.original;
  }

  return null;
};

export const parseNumber = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const cleaned = text.replace(/[$,]/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

export const parseYear = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const match = text.match(/(19|20)\d{2}/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
};

const MONTH_LOOKUP = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export const parseMonth = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 12) return numeric;
  const key = text.slice(0, 3).toLowerCase();
  return MONTH_LOOKUP[key] ?? null;
};

export const parseDateParts = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;

  const isoMatch = text.match(/((?:19|20)\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    if (Number.isFinite(year) && Number.isFinite(month)) {
      return { year, month };
    }
  }

  const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const year = Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]);
    if (Number.isFinite(year) && Number.isFinite(month)) {
      return { year, month };
    }
  }

  const yearMatch = parseYear(text);
  if (yearMatch) return { year: yearMatch };

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      year: parsed.getUTCFullYear(),
      month: parsed.getUTCMonth() + 1,
    };
  }

  return null;
};

export const formatNumber = (value) =>
  Number(value ?? 0).toLocaleString("en-US");

export const formatCompactNumber = (value) =>
  Number(value ?? 0).toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });

export const formatCurrency = (value) =>
  Number(value ?? 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export const formatCompactCurrency = (value) =>
  Number(value ?? 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });

export const NAICS_SECTOR_NAMES = {
  11: "Agriculture, Forestry, Fishing and Hunting",
  21: "Mining, Quarrying, and Oil and Gas Extraction",
  22: "Utilities",
  23: "Construction",
  31: "Manufacturing",
  32: "Manufacturing",
  33: "Manufacturing",
  42: "Wholesale Trade",
  44: "Retail Trade",
  45: "Retail Trade",
  48: "Transportation and Warehousing",
  49: "Transportation and Warehousing",
  51: "Information",
  52: "Finance and Insurance",
  53: "Real Estate and Rental and Leasing",
  54: "Professional, Scientific, and Technical Services",
  55: "Management of Companies and Enterprises",
  56: "Administrative and Support and Waste Management and Remediation Services",
  61: "Educational Services",
  62: "Health Care and Social Assistance",
  71: "Arts, Entertainment, and Recreation",
  72: "Accommodation and Food Services",
  81: "Other Services (except Public Administration)",
  92: "Public Administration",
};

export const parseNaicsSector = (value) => {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 2) return null;
  const sector = digits.slice(0, 2);
  if (!NAICS_SECTOR_NAMES[sector]) return null;
  return sector;
};
