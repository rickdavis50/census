const SBA_7A_CSV_URL = `${import.meta.env.BASE_URL}foia-7a-fy2020-present-asof-250930.csv`;
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

const fetchSbaCsv = async () => {
  const response = await fetch(SBA_7A_CSV_URL);
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "SBA CSV not found. Ensure the FOIA CSV is in the public folder."
        : `SBA CSV request failed: ${response.status}`
    );
  }
  return response.text();
};

const parseNaicsSector = (value) => {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 2) return null;
  const sector = digits.slice(0, 2);
  if (!NAICS_SECTOR_NAMES[sector]) return null;
  return sector;
};

const parseLoanAmount = (value) => {
  const raw = value;
  if (raw === null || raw === undefined || raw === "") return null;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
};

const parseCsvRows = (text, onRow) => {
  let row = [];
  let value = "";
  let inQuotes = false;

  const pushValue = () => {
    row.push(value);
    value = "";
  };

  const pushRow = () => {
    onRow(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      pushValue();
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      pushValue();
      pushRow();
      continue;
    }

    value += char;
  }

  if (value.length || row.length) {
    pushValue();
    pushRow();
  }
};

const parseApprovalDate = (value) => {
  if (!value) return null;
  const parts = String(value).split("/");
  if (parts.length === 3) {
    const month = Number(parts[0]);
    const day = Number(parts[1]);
    const year = Number(parts[2]);
    if (
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      Number.isFinite(year)
    ) {
      return { year, month };
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return { year: parsed.getUTCFullYear(), month: parsed.getUTCMonth() + 1 };
};

const aggregateBySector = (text) => {
  let headerMap = null;
  const yearStats = new Map();

  const ensureYear = (year) => {
    if (!yearStats.has(year)) {
      yearStats.set(year, { months: new Set(), sectors: new Map() });
    }
    return yearStats.get(year);
  };

  parseCsvRows(text, (row) => {
    if (!headerMap) {
      headerMap = new Map(row.map((key, index) => [key.trim(), index]));
      return;
    }

    const program = row[headerMap.get("Program")]?.trim();
    if (program !== "7A") return;

    const approvalDate = row[headerMap.get("ApprovalDate")];
    const approvalFy = Number(row[headerMap.get("ApprovalFY")]);
    const approval = parseApprovalDate(approvalDate);
    const year = Number.isFinite(approvalFy) ? approvalFy : approval?.year;
    if (!year || !approval) return;

    const sector = parseNaicsSector(row[headerMap.get("NAICSCode")]);
    const amount = parseLoanAmount(row[headerMap.get("GrossApproval")]);
    if (!sector || !amount) return;

    const yearData = ensureYear(year);
    yearData.months.add(approval.month);
    const sectorData = yearData.sectors.get(sector) ?? {
      sector,
      total: 0,
      count: 0,
    };
    sectorData.total += amount;
    sectorData.count += 1;
    yearData.sectors.set(sector, sectorData);
  });

  if (!yearStats.size) {
    throw new Error("No SBA loan records matched the required fields.");
  }

  const fullYears = Array.from(yearStats.entries())
    .filter(([, data]) => data.months.size === 12)
    .map(([year]) => year);
  const availableYears = Array.from(yearStats.keys());
  const targetYear =
    (fullYears.length ? Math.max(...fullYears) : Math.max(...availableYears)) ||
    null;

  if (!targetYear) {
    throw new Error("Unable to determine a valid SBA loan year.");
  }

  const aggregates = yearStats.get(targetYear)?.sectors ?? new Map();
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

  const text = await fetchSbaCsv();
  const result = aggregateBySector(text);
  CACHE.set(cacheKey, result);
  return result;
};
