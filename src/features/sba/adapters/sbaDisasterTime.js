import { discoverDataset, fetchResource, getCached } from "../sbaClient";
import { findFieldKey, parseDateParts, parseNumber, parseYear } from "../utils";

const KEYWORDS = ["disaster loan", "EIDL", "SBA disaster"];

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

const STATE_FIELDS = [
  "state",
  "borrower_state",
  "state_abbr",
  "statecode",
  "state_code",
  "state name",
  "state_name",
  "st",
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
  "disbursement_amount",
];

const COUNT_FIELDS = [
  "loan_count",
  "count",
  "number_of_loans",
  "total_loans",
];

const normalizeState = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (raw.length === 2) return raw.toUpperCase();
  return raw;
};

export const fetchSbaDisasterTime = async ({ forceRefresh = false } = {}) => {
  const cacheKey = "sba-disaster-time";
  const fetcher = async () => {
    const { resource } = await discoverDataset({
      keywords: KEYWORDS,
      forceRefresh,
    });
    const rows = await fetchResource(resource);
    if (!rows.length) {
      throw new Error("SBA dataset returned no rows.");
    }

    const keys = Object.keys(rows[0]);
    const dateKey = findFieldKey(keys, DATE_FIELDS);
    const yearKey = findFieldKey(keys, YEAR_FIELDS);
    const stateKey = findFieldKey(keys, STATE_FIELDS);
    const amountKey = findFieldKey(keys, AMOUNT_FIELDS);
    const countKey = findFieldKey(keys, COUNT_FIELDS);

    const totalsByYear = new Map();
    const totalsByState = new Map();
    let hasAmount = false;
    let hasStateData = false;

    rows.forEach((row) => {
      const dateParts = dateKey ? parseDateParts(row[dateKey]) : null;
      const year = dateParts?.year ?? parseYear(row[yearKey]);
      if (!year) return;

      const amount = parseNumber(amountKey ? row[amountKey] : null);
      if (amount !== null) hasAmount = true;

      let count = 1;
      if (countKey) {
        const parsedCount = parseNumber(row[countKey]);
        if (Number.isFinite(parsedCount)) count = parsedCount;
      }

      const value = amount ?? 0;

      const total = totalsByYear.get(year) ?? { year, total: 0, count: 0 };
      total.total += value;
      total.count += count;
      totalsByYear.set(year, total);

      if (stateKey) {
        const state = normalizeState(row[stateKey]);
        if (!state) return;
        hasStateData = true;
        const stateStats = totalsByState.get(state) ?? new Map();
        const yearStats = stateStats.get(year) ?? { year, total: 0, count: 0 };
        yearStats.total += value;
        yearStats.count += count;
        stateStats.set(year, yearStats);
        totalsByState.set(state, stateStats);
      }
    });

    const totalSeries = Array.from(totalsByYear.values()).sort(
      (a, b) => a.year - b.year
    );

    if (!totalSeries.length) {
      throw new Error("No SBA disaster records matched the required fields.");
    }

    let topStatesSeries = [];
    if (hasStateData) {
      const stateTotals = Array.from(totalsByState.entries()).map(
        ([state, yearMap]) => {
          const totals = Array.from(yearMap.values()).reduce(
            (acc, entry) => {
              acc.total += entry.total;
              acc.count += entry.count;
              return acc;
            },
            { total: 0, count: 0 }
          );
          return { state, ...totals };
        }
      );

      stateTotals.sort((a, b) => b.total - a.total);
      const topStates = stateTotals.slice(0, 10).map((entry) => entry.state);

      const topYearTotals = new Map();
      topStates.forEach((state) => {
        const yearMap = totalsByState.get(state);
        if (!yearMap) return;
        yearMap.forEach((entry) => {
          const current = topYearTotals.get(entry.year) ?? {
            year: entry.year,
            total: 0,
            count: 0,
          };
          current.total += entry.total;
          current.count += entry.count;
          topYearTotals.set(entry.year, current);
        });
      });

      topStatesSeries = Array.from(topYearTotals.values()).sort(
        (a, b) => a.year - b.year
      );
    }

    return {
      totalSeries,
      topStatesSeries,
      hasStateData,
      usesCount: !hasAmount,
    };
  };

  if (forceRefresh) return fetcher();
  return getCached(cacheKey, fetcher);
};
