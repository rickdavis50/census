import { discoverDataset, fetchResource, getCached } from "../sbaClient";
import { findFieldKey, parseNumber } from "../utils";

const KEYWORDS = ["PPP", "Paycheck Protection Program", "ppp foia"];

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
  "forgiveness_amount",
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

export const fetchSbaPppState = async ({ forceRefresh = false } = {}) => {
  const cacheKey = "sba-ppp-state";
  const fetcher = async () => {
    const { resources } = await discoverDataset({
      keywords: KEYWORDS,
      forceRefresh,
    });
    let lastError = null;

    const buildFromRows = (rows) => {
      if (!rows.length) return null;

      const keys = Object.keys(rows[0]);
      const stateKey = findFieldKey(keys, STATE_FIELDS);
      const amountKey = findFieldKey(keys, AMOUNT_FIELDS);
      const countKey = findFieldKey(keys, COUNT_FIELDS);

      const grouped = new Map();
      let hasAmount = false;

      rows.forEach((row) => {
        const stateValue = normalizeState(stateKey ? row[stateKey] : "");
        if (!stateValue) return;

        const amount = parseNumber(amountKey ? row[amountKey] : null);
        if (amount !== null) hasAmount = true;

        let count = 1;
        if (countKey) {
          const parsedCount = parseNumber(row[countKey]);
          if (Number.isFinite(parsedCount)) count = parsedCount;
        }

        const current = grouped.get(stateValue) ?? {
          label: stateValue,
          total: 0,
          count: 0,
        };

        current.total += amount ?? 0;
        current.count += count ?? 0;
        grouped.set(stateValue, current);
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
    throw new Error("No SBA PPP records matched the required fields.");
  };

  if (forceRefresh) return fetcher();
  return getCached(cacheKey, fetcher);
};
