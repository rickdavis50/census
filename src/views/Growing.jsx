import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import { buildUrl, cachedFetch, fetchJson } from "../lib/censusClient";
import { DATASETS, NONEMP_YEARS } from "../lib/datasets";
import { getGeoLabel, getGeoParams } from "../lib/geography";

const MAX_ROWS = 10;

const isSectorCode = (code) => code.length === 2 && code !== "00";

const formatNumber = (value) => Number(value).toLocaleString();

function Growing({ geo }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  const geoLabel = useMemo(() => getGeoLabel(geo), [geo]);
  const latestYear = NONEMP_YEARS[0];
  const earliestYear = NONEMP_YEARS[NONEMP_YEARS.length - 1];

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const yearData = await Promise.all(
          NONEMP_YEARS.map(async (year) => {
            const variables = DATASETS.nonemp.variablesByYear[year];
            const url = buildUrl(DATASETS.nonemp.getBase(year), {
              get: [
                variables.naics,
                variables.label,
                DATASETS.nonemp.variables.establishments,
              ],
              ...getGeoParams(geo),
            });
            const data = await cachedFetch(url, () => fetchJson(url));
            const rows = data
              .slice(1)
              .map((row) => ({
                code: row[0],
                label: row[1],
                value: Number(row[2]),
              }))
              .filter((row) => isSectorCode(row.code));

            return { year, rows };
          })
        );

        const start = yearData.find((item) => item.year === earliestYear);
        const end = yearData.find((item) => item.year === latestYear);

        if (!start || !end) {
          throw new Error("Missing nonemployer data for year range.");
        }

        const startMap = new Map(
          start.rows.map((row) => [row.code, row])
        );
        const endMap = new Map(end.rows.map((row) => [row.code, row]));

        const growth = Array.from(endMap.values())
          .map((row) => {
            const base = startMap.get(row.code);
            if (!base || base.value === 0) return null;
            const delta = row.value - base.value;
            const percent = (delta / base.value) * 100;
            return {
              code: row.code,
              label: row.label,
              start: base.value,
              end: row.value,
              delta,
              percent,
            };
          })
          .filter(Boolean)
          .sort((a, b) => b.percent - a.percent)
          .slice(0, MAX_ROWS);

        if (!isActive) return;
        setRows(growth);
        setStatus("success");
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Failed to load data.");
        setStatus("error");
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, [geo]);

  const maxPercent =
    rows.reduce((max, row) => Math.max(max, row.percent), 0) || 1;

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          Fastest Growing Nonemployer Industries
        </h2>
        <p className="text-sm text-zb-ink-muted">
          3-year change in nonemployer establishments for {geoLabel}.
        </p>
      </div>

      {status === "loading" && (
        <p className="text-sm text-zb-ink-muted">Loading growth data...</p>
      )}

      {status === "error" && (
        <div className="rounded-zb-sm border border-zb-border bg-zb-subtle px-4 py-3 text-sm text-zb-ink">
          Error loading data: {error}
        </div>
      )}

      {status === "success" && (
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.code} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{row.label}</span>
                <span className="text-zb-ink-muted">
                  +{row.percent.toFixed(1)}% ({formatNumber(row.delta)})
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-zb-subtle">
                <div
                  className="h-2 rounded-full bg-zb-green"
                  style={{ width: `${(row.percent / maxPercent) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zb-ink-muted">
        Source: U.S. Census Bureau (Nonemployer Statistics, {earliestYear}-
        {latestYear})
      </p>
    </Card>
  );
}

export default Growing;
