import { discoverDataset, fetchResource, getCached } from "../sbaClient";
import {
  findFieldKey,
  NAICS_SECTOR_NAMES,
  parseNaicsSector,
  parseNumber,
} from "../utils";

const KEYWORDS = ["size standards", "small business size standards"];

const NAICS_FIELDS = [
  "naics",
  "naics_code",
  "naics code",
  "naics_2017",
  "naics2017",
  "industry_code",
  "industry",
  "sector",
];

const EMPLOYEE_FIELDS = [
  "employees",
  "employee",
  "employee_count",
  "employee_size_standard",
  "size_standard_employees",
];

const RECEIPTS_FIELDS = [
  "receipts",
  "receipt",
  "annual_receipts",
  "receipts_millions",
  "revenue",
  "revenues",
  "dollars",
  "size_standard_receipts",
];

const STANDARD_FIELDS = [
  "size_standard",
  "size standard",
  "standard",
  "size_standard_value",
  "size",
];

const MEASURE_FIELDS = [
  "measure",
  "size_standard_type",
  "type",
  "unit",
  "units",
];

const parseSizeValue = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.toLowerCase();
  const numeric = Number(text.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  if (normalized.includes("billion") || normalized.includes(" b")) {
    return numeric * 1_000_000_000;
  }
  if (normalized.includes("million") || normalized.includes(" m")) {
    return numeric * 1_000_000;
  }
  return numeric;
};

export const fetchSbaSizeStandards = async ({ forceRefresh = false } = {}) => {
  const cacheKey = "sba-size-standards";
  const fetcher = async () => {
    const { resources } = await discoverDataset({
      keywords: KEYWORDS,
      forceRefresh,
    });
    let lastError = null;

    const buildFromRows = (rows) => {
      if (!rows.length) return null;

      const keys = Object.keys(rows[0]);
      const naicsKey = findFieldKey(keys, NAICS_FIELDS);
      const employeesKey = findFieldKey(keys, EMPLOYEE_FIELDS);
      const receiptsKey = findFieldKey(keys, RECEIPTS_FIELDS);
      const standardKey = findFieldKey(keys, STANDARD_FIELDS);
      const measureKey = findFieldKey(keys, MEASURE_FIELDS);

      const grouped = new Map();
      let hasEmployees = false;
      let hasReceipts = false;

      rows.forEach((row) => {
        const naicsValue = naicsKey ? row[naicsKey] : null;
        const sector = parseNaicsSector(naicsValue);
        if (!sector) return;

        let employees = null;
        let receipts = null;

        if (employeesKey) {
          employees = parseSizeValue(row[employeesKey]);
        }

        if (receiptsKey) {
          receipts = parseSizeValue(row[receiptsKey]);
        }

        if (measureKey && standardKey) {
          const measure = String(row[measureKey] ?? "").toLowerCase();
          const standardValue = parseSizeValue(row[standardKey]);
          if (standardValue !== null) {
            if (measure.includes("employee")) {
              employees = standardValue;
            } else if (
              measure.includes("receipt") ||
              measure.includes("revenue") ||
              measure.includes("dollar")
            ) {
              receipts = standardValue;
            }
          }
        }

        if (employees !== null) hasEmployees = true;
        if (receipts !== null) hasReceipts = true;

        const current = grouped.get(sector) ?? {
          sector,
          label: `${sector} — ${NAICS_SECTOR_NAMES[sector]}`,
          employees: null,
          receipts: null,
        };

        if (employees !== null) {
          current.employees = Math.max(current.employees ?? 0, employees);
        }
        if (receipts !== null) {
          current.receipts = Math.max(current.receipts ?? 0, receipts);
        }

        grouped.set(sector, current);
      });

      const rowsOut = Array.from(grouped.values()).filter(
        (item) => item.employees !== null || item.receipts !== null
      );

      if (!rowsOut.length) return null;

      rowsOut.sort((a, b) => a.sector.localeCompare(b.sector));

      return { rows: rowsOut, hasEmployees, hasReceipts };
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
    throw new Error("No SBA size standard records matched the required fields.");
  };

  if (forceRefresh) return fetcher();
  return getCached(cacheKey, fetcher);
};
