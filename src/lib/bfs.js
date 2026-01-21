const BFS_MONTHLY_URL = "https://www.census.gov/econ/bfs/csv/bfs_monthly.csv";
const BFS_MONTH_DATE_URL =
  "https://www.census.gov/econ/bfs/csv/month_date_table.csv";
const BFS_WEEKLY_STATE_URL =
  "https://www.census.gov/econ/bfs/csv/bfs_state_apps_weekly_nsa.csv";
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

const fetchCache = new Map();
const parsedCache = {
  monthly: null,
  weekly: null,
};

const MONTHS = [
  { key: "jan", month: 1 },
  { key: "feb", month: 2 },
  { key: "mar", month: 3 },
  { key: "apr", month: 4 },
  { key: "may", month: 5 },
  { key: "jun", month: 6 },
  { key: "jul", month: 7 },
  { key: "aug", month: 8 },
  { key: "sep", month: 9 },
  { key: "oct", month: 10 },
  { key: "nov", month: 11 },
  { key: "dec", month: 12 },
];

const normalizeHeader = (value) => String(value ?? "").trim().toLowerCase();

const buildHeaderMap = (headers) =>
  new Map(headers.map((key, index) => [normalizeHeader(key), index]));

const findHeaderIndex = (headerMap, names) => {
  for (const name of names) {
    const index = headerMap.get(normalizeHeader(name));
    if (index !== undefined) return index;
  }
  return null;
};

const csvParse = (text) => {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  const pushValue = () => {
    row.push(value);
    value = "";
  };

  const pushRow = () => {
    rows.push(row);
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

  return rows;
};

const parseBfsValue = (raw) => {
  if (raw === null || raw === undefined) return { value: null, flags: [] };
  const trimmed = String(raw).trim();
  if (!trimmed) return { value: null, flags: [] };
  const normalized = trimmed.toUpperCase();
  if (normalized === "D" || normalized === "S" || normalized === "NA") {
    return { value: null, flags: [normalized] };
  }
  if (normalized === "N/A") {
    return { value: null, flags: ["NA"] };
  }
  const parsed = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) {
    return { value: null, flags: ["NA"] };
  }
  return { value: parsed, flags: [] };
};

const getMonthEndIso = (year, month) => {
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
};

const buildMonthDateMap = (rows) => {
  if (!rows.length) return new Map();
  const headers = rows[0];
  const headerMap = buildHeaderMap(headers);
  const yearIndex = findHeaderIndex(headerMap, ["year"]);
  const monthIndex = findHeaderIndex(headerMap, ["month"]);
  const endIndex = findHeaderIndex(headerMap, [
    "month_end",
    "month_end_date",
    "month_end_dt",
  ]);

  const map = new Map();
  for (const row of rows.slice(1)) {
    const year = Number(row[yearIndex]);
    const month = Number(row[monthIndex]);
    if (!Number.isFinite(year) || !Number.isFinite(month)) continue;
    const fallback = getMonthEndIso(year, month);
    const endValue = endIndex !== null ? row[endIndex] : null;
    const date = endValue ? String(endValue).slice(0, 10) : fallback;
    map.set(`${year}-${month}`, date);
  }
  return map;
};

const fetchCsv = async (url) => {
  if (fetchCache.has(url)) return fetchCache.get(url);
  const request = async (target) => {
    const response = await fetch(target);
    if (!response.ok) {
      throw new Error(`BFS request failed: ${response.status}`);
    }
    return response.text();
  };
  try {
    const text = await request(url);
    fetchCache.set(url, text);
    return text;
  } catch (err) {
    const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
    try {
      const text = await request(proxyUrl);
      fetchCache.set(url, text);
      return text;
    } catch (proxyErr) {
      throw err;
    }
  }
};

const parseMonthly = (monthlyText, dateText) => {
  const rows = csvParse(monthlyText);
  const dateRows = csvParse(dateText);
  const monthDateMap = buildMonthDateMap(dateRows);

  if (!rows.length) {
    throw new Error("Empty monthly BFS dataset.");
  }

  const headers = rows[0];
  const headerMap = buildHeaderMap(headers);
  const yearIndex = findHeaderIndex(headerMap, ["year"]);
  const seriesIndex = findHeaderIndex(headerMap, ["series", "series_id"]);
  const geoIndex = findHeaderIndex(headerMap, ["geo", "geography", "region"]);
  const geoLabelIndex = findHeaderIndex(headerMap, [
    "geo_name",
    "geo_label",
    "geography_label",
    "region_label",
  ]);
  const saIndex = findHeaderIndex(headerMap, ["sa", "seasonal_adj", "seasonal"]);
  const industryIndex = findHeaderIndex(headerMap, [
    "naics_sector",
    "industry",
    "naics",
  ]);

  if (yearIndex === null || seriesIndex === null || geoIndex === null) {
    throw new Error("Monthly BFS headers do not match expected format.");
  }

  const monthColumns = [];
  headers.forEach((header, index) => {
    const lower = normalizeHeader(header);
    const match = MONTHS.find((month) => lower.startsWith(month.key));
    if (match) {
      monthColumns.push({ index, month: match.month });
    }
  });

  if (!monthColumns.length) {
    throw new Error("Monthly BFS month columns not found.");
  }

  const data = [];
  const geoLabels = new Map();
  const saValues = new Set();
  const industryValues = new Set();

  for (const row of rows.slice(1)) {
    const year = Number(row[yearIndex]);
    if (!Number.isFinite(year)) continue;
    const series = String(row[seriesIndex] ?? "").trim();
    const geo = String(row[geoIndex] ?? "").trim();
    if (!series || !geo) continue;
    const geoLabel = geoLabelIndex !== null ? String(row[geoLabelIndex] ?? "").trim() : "";
    if (geoLabel) geoLabels.set(geo, geoLabel);
    const sa = saIndex !== null ? String(row[saIndex] ?? "").trim() : "";
    const industry =
      industryIndex !== null ? String(row[industryIndex] ?? "").trim() : "";
    if (sa) saValues.add(sa);
    if (industry) industryValues.add(industry);

    for (const column of monthColumns) {
      const { value, flags } = parseBfsValue(row[column.index]);
      const dateKey = `${year}-${column.month}`;
      const date = monthDateMap.get(dateKey) || getMonthEndIso(year, column.month);
      data.push({
        date,
        geo,
        series,
        value,
        flags,
        sa,
        industry,
      });
    }
  }

  return {
    data,
    geoLabels,
    saValues: Array.from(saValues),
    industryValues: Array.from(industryValues),
  };
};

const isoWeekStart = (year, week) => {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (day - 1));
  const target = new Date(monday);
  target.setUTCDate(monday.getUTCDate() + (week - 1) * 7);
  return target;
};

const getWeekEndIso = (year, week) => {
  const start = isoWeekStart(year, week);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return end.toISOString().slice(0, 10);
};

const parseWeekly = (weeklyText) => {
  const rows = csvParse(weeklyText);
  if (!rows.length) {
    throw new Error("Empty weekly BFS dataset.");
  }

  const headers = rows[0];
  const headerMap = buildHeaderMap(headers);
  const yearIndex = findHeaderIndex(headerMap, ["year"]);
  const weekIndex = findHeaderIndex(headerMap, ["week"]);
  const stateIndex = findHeaderIndex(headerMap, ["state", "st"]);

  if (yearIndex === null || weekIndex === null || stateIndex === null) {
    throw new Error("Weekly BFS headers do not match expected format.");
  }

  const metrics = ["BA_NSA", "HBA_NSA", "WBA_NSA", "CBA_NSA"];
  const metricIndexes = metrics.map((metric) => ({
    metric,
    index: findHeaderIndex(headerMap, [metric]),
  }));

  const data = [];
  const geos = new Set();

  for (const row of rows.slice(1)) {
    const year = Number(row[yearIndex]);
    const week = Number(row[weekIndex]);
    const geo = String(row[stateIndex] ?? "").trim();
    if (!geo || !Number.isFinite(year) || !Number.isFinite(week)) continue;
    const date = getWeekEndIso(year, week);
    geos.add(geo);

    metricIndexes.forEach(({ metric, index }) => {
      if (index === null) return;
      const { value, flags } = parseBfsValue(row[index]);
      data.push({
        date,
        geo,
        series: metric,
        value,
        flags,
      });
    });
  }

  return {
    data,
    geos: Array.from(geos),
  };
};

export const fetchBfsMonthly = async () => {
  if (parsedCache.monthly) return parsedCache.monthly;
  const [monthlyText, dateText] = await Promise.all([
    fetchCsv(BFS_MONTHLY_URL),
    fetchCsv(BFS_MONTH_DATE_URL),
  ]);
  const parsed = parseMonthly(monthlyText, dateText);
  const defaultSa =
    parsed.saValues.find((value) => value.toUpperCase() === "A") ??
    parsed.saValues[0] ??
    "";
  const defaultIndustry =
    parsed.industryValues.find((value) => value.toUpperCase() === "TOTAL") ??
    parsed.industryValues[0] ??
    "";
  parsedCache.monthly = {
    ...parsed,
    defaultSa,
    defaultIndustry,
  };
  return parsedCache.monthly;
};

export const fetchBfsWeeklyState = async () => {
  if (parsedCache.weekly) return parsedCache.weekly;
  const weeklyText = await fetchCsv(BFS_WEEKLY_STATE_URL);
  parsedCache.weekly = parseWeekly(weeklyText);
  return parsedCache.weekly;
};

export const BFS_ENDPOINTS = {
  monthly: BFS_MONTHLY_URL,
  monthlyDates: BFS_MONTH_DATE_URL,
  weeklyState: BFS_WEEKLY_STATE_URL,
};
