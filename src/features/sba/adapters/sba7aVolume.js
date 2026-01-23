import { discoverDataset, fetchResource, getCached } from "../sbaClient";
import {
  findFieldKey,
  parseDateParts,
  parseMonth,
  parseNumber,
  parseYear,
} from "../utils";

const KEYWORDS = [
  "7(a)",
  "7a",
  "7(a) loan",
  "SBA 7a",
  "loan program 7(a)",
];

const DATE_FIELDS = [
  "approval_date",
  "approval date",
  "date",
  "loan_date",
  "approved_date",
  "approvaldt",
];

const YEAR_FIELDS = [
  "approval_year",
  "approval year",
  "year",
  "fy",
  "fiscal_year",
  "fiscal year",
  "approval_fy",
];

const MONTH_FIELDS = ["month", "approval_month", "approval month"];

const PROGRAM_FIELDS = ["program", "loan_program", "loan program", "program_type"];

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

export const fetchSba7aVolume = async ({ forceRefresh = false } = {}) => {
  const cacheKey = "sba-7a-volume";
  const fetcher = async () => {
    const { resources } = await discoverDataset({
      keywords: KEYWORDS,
      forceRefresh,
    });
    let lastError = null;

    const buildFromRows = (rows) => {
      if (!rows.length) return null;

      const keys = Object.keys(rows[0]);
      const dateKey = findFieldKey(keys, DATE_FIELDS);
      const yearKey = findFieldKey(keys, YEAR_FIELDS);
      const monthKey = findFieldKey(keys, MONTH_FIELDS);
      const programKey = findFieldKey(keys, PROGRAM_FIELDS);
      const amountKey = findFieldKey(keys, AMOUNT_FIELDS);
      const countKey = findFieldKey(keys, COUNT_FIELDS);

      const entries = [];
      let hasAmount = false;
      let hasCountField = false;

      rows.forEach((row) => {
        const program = programKey ? String(row[programKey] ?? "") : "";
        if (programKey && !/7\s*\(?a\)?/i.test(program)) return;

        const dateParts = dateKey ? parseDateParts(row[dateKey]) : null;
        const year = dateParts?.year ?? parseYear(row[yearKey]);
        const month = dateParts?.month ?? parseMonth(row[monthKey]);
        if (!year) return;

        const amount = parseNumber(amountKey ? row[amountKey] : null);
        if (amount !== null) {
          hasAmount = true;
        }

        let count = 1;
        if (countKey) {
          const parsedCount = parseNumber(row[countKey]);
          if (Number.isFinite(parsedCount)) {
            count = parsedCount;
            hasCountField = true;
          }
        }

        entries.push({ year, month, amount, count });
      });

      if (!entries.length) return null;

      const monthlyEntries = entries.filter((entry) => entry.month);
      const useMonthly = monthlyEntries.length > 0;
      const sourceEntries = useMonthly ? monthlyEntries : entries;

      const grouped = new Map();
      sourceEntries.forEach((entry) => {
        const key = useMonthly
          ? `${entry.year}-${String(entry.month).padStart(2, "0")}`
          : String(entry.year);
        const current = grouped.get(key) ?? {
          year: entry.year,
          month: useMonthly ? entry.month : null,
          total: 0,
          count: 0,
        };
        current.total += entry.amount ?? 0;
        current.count += entry.count ?? 0;
        grouped.set(key, current);
      });

      const buckets = Array.from(grouped.values()).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return (a.month ?? 0) - (b.month ?? 0);
      });

      return {
        buckets,
        granularity: useMonthly ? "month" : "year",
        hasAmount,
        hasCountField,
      };
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
    throw new Error("No SBA loan records matched the required fields.");
  };

  if (forceRefresh) return fetcher();
  return getCached(cacheKey, fetcher);
};
