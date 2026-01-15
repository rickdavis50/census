import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import { buildUrl, cachedFetch, fetchJson } from "../lib/censusClient";
import { DATASETS, NONEMP_YEARS } from "../lib/datasets";
import { getGeoLabel, getGeoParams } from "../lib/geography";

const MAX_ROWS = 10;

const isSectorCode = (code) => code.length === 2 && code !== "00";

const formatNumber = (value) => Number(value).toLocaleString();

function Popular({ geo }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  const geoLabel = useMemo(() => getGeoLabel(geo), [geo]);

  useEffect(() => {
    let isActive = true;
    const year = NONEMP_YEARS[0];
    const variables = DATASETS.nonemp.variablesByYear[year];

    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const url = buildUrl(DATASETS.nonemp.getBase(year), {
          get: [
            variables.naics,
            variables.label,
            DATASETS.nonemp.variables.establishments,
          ],
          ...getGeoParams(geo),
        });

        const data = await cachedFetch(url, () => fetchJson(url));
        const parsed = data
          .slice(1)
          .map((row) => ({
            code: row[0],
            label: row[1],
            value: Number(row[2]),
          }))
          .filter((row) => isSectorCode(row.code))
          .sort((a, b) => b.value - a.value)
          .slice(0, MAX_ROWS);

        if (!isActive) return;
        setRows(parsed);
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

  const maxValue = rows.reduce((max, row) => Math.max(max, row.value), 0) || 1;

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          Top Nonemployer Industries in {geoLabel}
        </h2>
        <p className="text-sm text-zb-ink-muted">
          Ranked by nonemployer establishment counts.
        </p>
      </div>

      {status === "loading" && (
        <p className="text-sm text-zb-ink-muted">Loading nonemployer data...</p>
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
                  {formatNumber(row.value)}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-zb-subtle">
                <div
                  className="h-2 rounded-full bg-zb-blue"
                  style={{ width: `${(row.value / maxValue) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zb-ink-muted">
        Source: U.S. Census Bureau (Nonemployer Statistics, {NONEMP_YEARS[0]})
      </p>
    </Card>
  );
}

export default Popular;
