import { discoverDataset, fetchResource, getCached } from "../sbaClient";
import {
  findFieldKey,
  NAICS_SECTOR_NAMES,
  parseNaicsSector,
  parseNumber,
} from "../utils";

const KEYWORDS = ["504", "504 loan"];

const PROGRAM_FIELDS = ["program", "loan_program", "loan program", "program_type"];

const INDUSTRY_FIELDS = [
  "naics",
  "naics_code",
  "naics code",
  "naics2",
  "naics_2",
  "naics_2_digit",
  "industry",
  "industry_name",
  "industry_description",
  "sector",
];

const AMOUNT_FIELDS = [
  "amount",
  "loan_amount",
  "gross_approval",
  "grossapproval",
  "approval_amount",
  "current_approval_amount",
  "total_loan_amount",
  "approved_amount",
];

const COUNT_FIELDS = [
  "loan_count",
  "count",
  "number_of_loans",
  "total_loans",
];

export const fetchSba504Industry = async ({ forceRefresh = false } = {}) => {
  const cacheKey = "sba-504-industry";
  const fetcher = async () => {
    const { resources } = await discoverDataset({
      keywords: KEYWORDS,
      forceRefresh,
    });
    let lastError = null;

    const buildFromRows = (rows) => {
      if (!rows.length) return null;

      const keys = Object.keys(rows[0]);
      const programKey = findFieldKey(keys, PROGRAM_FIELDS);
      const industryKey = findFieldKey(keys, INDUSTRY_FIELDS);
      const amountKey = findFieldKey(keys, AMOUNT_FIELDS);
      const countKey = findFieldKey(keys, COUNT_FIELDS);

      const grouped = new Map();
      let hasAmount = false;

      rows.forEach((row) => {
        const program = programKey ? String(row[programKey] ?? "") : "";
        if (programKey && !/504/i.test(program)) return;

        const industryRaw = industryKey ? row[industryKey] : null;
        const sector = parseNaicsSector(industryRaw);
        const industryLabel = sector
          ? `${sector} — ${NAICS_SECTOR_NAMES[sector]}`
          : String(industryRaw ?? "").trim();
        if (!industryLabel) return;

        const amount = parseNumber(amountKey ? row[amountKey] : null);
        if (amount !== null) hasAmount = true;

        let count = 1;
        if (countKey) {
          const parsedCount = parseNumber(row[countKey]);
          if (Number.isFinite(parsedCount)) count = parsedCount;
        }

        const current = grouped.get(industryLabel) ?? {
          label: industryLabel,
          total: 0,
          count: 0,
        };

        current.total += amount ?? 0;
        current.count += count ?? 0;
        grouped.set(industryLabel, current);
      });

      const rowsOut = Array.from(grouped.values()).filter(
        (item) => item.count > 0
      );
      if (!rowsOut.length) return null;

      rowsOut.sort((a, b) => b.total - a.total);

      return { rows: rowsOut, hasAmount };
    };

    for (const resource of resources) {
      try {
        const rows = await fetchResource(resource);
        const result = buildFromRows(rows);
        if (result) return result;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) throw lastError;
    throw new Error("No SBA 504 records matched the required fields.");
  };

  if (forceRefresh) return fetcher();
  return getCached(cacheKey, fetcher);
};
