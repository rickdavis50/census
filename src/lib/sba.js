const SBA_7A_ENDPOINT = "https://api.sba.gov/loans/7a";
const PAGE_SIZE = 1000;
const MAX_PAGES = 50;
const CACHE = new Map();

const NAICS_SECTOR_NAMES = {
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

const getApiKey = () => {
  const key = import.meta.env?.VITE_SBA_API_KEY;
  if (!key || typeof key !== "string") return "";
  return key.trim();
};

const buildPageUrl = (page) => {
  const url = new URL(SBA_7A_ENDPOINT);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(PAGE_SIZE));
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String((page - 1) * PAGE_SIZE));
  return url.toString();
};

const fetchSbaJson = async (url, apiKey) => {
  const headers = apiKey ? { "X-API-Key": apiKey } : undefined;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && !apiKey) {
      throw new Error(
        "Missing SBA API key. Add VITE_SBA_API_KEY to your environment."
      );
    }
    throw new Error(`SBA request failed: ${response.status}`);
  }
  return response.json();
};

const extractRecords = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const getNextUrl = (payload) => {
  if (payload?.links?.next) return payload.links.next;
  if (payload?.next) return payload.next;
  if (payload?.pagination?.next) return payload.pagination.next;
  return null;
};

const getFirstField = (record, keys) => {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null) {
      return record[key];
    }
  }
  return null;
};

const parseApprovalDate = (record) => {
  const raw = getFirstField(record, [
    "approval_date",
    "ApprovalDate",
    "Approval_Date",
    "DateApproved",
    "date_approved",
  ]);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
  };
};

const parseNaicsSector = (value) => {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 2) return null;
  const sector = digits.slice(0, 2);
  if (!NAICS_SECTOR_NAMES[sector]) return null;
  return sector;
};

const parseLoanAmount = (record) => {
  const raw = getFirstField(record, [
    "loan_amount",
    "LoanAmount",
    "ApprovalAmount",
    "approval_amount",
    "GrossApproval",
    "gross_approval",
    "Gross_Approval",
  ]);
  if (raw === null || raw === undefined || raw === "") return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
};

const aggregateBySector = (records) => {
  const monthTracker = new Map();
  const normalized = [];

  records.forEach((record) => {
    const approval = parseApprovalDate(record);
    if (!approval) return;

    const sector = parseNaicsSector(
      getFirstField(record, ["naics_code", "NAICSCode", "NAICS", "naics"])
    );
    const amount = parseLoanAmount(record);
    if (!sector || !amount) return;

    const months = monthTracker.get(approval.year) ?? new Set();
    months.add(approval.month);
    monthTracker.set(approval.year, months);

    normalized.push({
      year: approval.year,
      sector,
      amount,
    });
  });

  if (!normalized.length) {
    throw new Error("No SBA loan records matched the required fields.");
  }

  const fullYears = Array.from(monthTracker.entries())
    .filter(([, months]) => months.size === 12)
    .map(([year]) => year);
  const availableYears = Array.from(monthTracker.keys());
  const targetYear =
    (fullYears.length ? Math.max(...fullYears) : Math.max(...availableYears)) ||
    null;

  if (!targetYear) {
    throw new Error("Unable to determine a valid SBA loan year.");
  }

  const aggregates = new Map();
  normalized.forEach((record) => {
    if (record.year !== targetYear) return;
    const current = aggregates.get(record.sector) ?? {
      sector: record.sector,
      total: 0,
      count: 0,
    };
    current.total += record.amount;
    current.count += 1;
    aggregates.set(record.sector, current);
  });

  const rows = Array.from(aggregates.values())
    .filter((item) => item.count > 0)
    .map((item) => {
      const name = NAICS_SECTOR_NAMES[item.sector];
      return {
        sector: item.sector,
        name,
        label: `${item.sector} — ${name}`,
        avgAmount: item.total / item.count,
        count: item.count,
      };
    })
    .sort((a, b) => b.avgAmount - a.avgAmount);

  return { year: targetYear, rows };
};

export const fetchSbaLoanSizeByNaics = async ({ forceRefresh = false } = {}) => {
  const cacheKey = "sba-7a-loan-size-by-naics";
  if (!forceRefresh && CACHE.has(cacheKey)) {
    return CACHE.get(cacheKey);
  }

  const apiKey = getApiKey();
  let page = 1;
  let nextUrl = buildPageUrl(page);
  const records = [];

  while (nextUrl && page <= MAX_PAGES) {
    const payload = await fetchSbaJson(nextUrl, apiKey);
    const batch = extractRecords(payload);
    records.push(...batch);
    const next = getNextUrl(payload);
    if (next) {
      nextUrl = next;
      page += 1;
      continue;
    }
    if (batch.length < PAGE_SIZE) break;
    page += 1;
    nextUrl = buildPageUrl(page);
  }

  const result = aggregateBySector(records);
  CACHE.set(cacheKey, result);
  return result;
};

export const getSbaApiKeyStatus = () => Boolean(getApiKey());
