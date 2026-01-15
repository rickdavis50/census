import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import { buildUrl, cachedFetch, fetchJson } from "../lib/censusClient";
import { DATASETS } from "../lib/datasets";
import { getGeoLabel, getGeoParams } from "../lib/geography";

const MAX_RANKS = 8;

const formatNumber = (value) => Number(value).toLocaleString();

const parsePopulationRows = (data) =>
  data.slice(1).map((row) => ({
    name: row[0],
    value: Number(row[1]),
    state: row[2],
  }));

function Momentum({ geo, yearRange }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [popRows, setPopRows] = useState([]);
  const [momentumRows, setMomentumRows] = useState([]);

  const geoLabel = useMemo(() => getGeoLabel(geo), [geo]);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setStatus("loading");
      setError("");

      try {
        const popByYear = await Promise.all(
          yearRange.map(async (year) => {
            const url = buildUrl(DATASETS.acs.getBase(year), {
              get: ["NAME", DATASETS.acs.variables.population],
              ...getGeoParams(geo),
            });
            const data = await cachedFetch(url, () => fetchJson(url));
            const row = data[1];
            return { year, population: row?.[1] ?? "0" };
          })
        );

        const latestYear = yearRange[0];
        const earliestYear = yearRange[yearRange.length - 1];

        const latestUrl = buildUrl(DATASETS.acs.getBase(latestYear), {
          get: ["NAME", DATASETS.acs.variables.population],
          for: "state:*",
        });
        const earliestUrl = buildUrl(DATASETS.acs.getBase(earliestYear), {
          get: ["NAME", DATASETS.acs.variables.population],
          for: "state:*",
        });

        const [latestData, earliestData] = await Promise.all([
          cachedFetch(latestUrl, () => fetchJson(latestUrl)),
          cachedFetch(earliestUrl, () => fetchJson(earliestUrl)),
        ]);

        const latestRows = parsePopulationRows(latestData);
        const earliestRows = parsePopulationRows(earliestData);

        const earliestMap = new Map(
          earliestRows.map((row) => [row.state, row.value])
        );

        const momentum = latestRows
          .map((row) => {
            const base = earliestMap.get(row.state);
            if (!base) return null;
            const delta = row.value - base;
            const percent = base ? (delta / base) * 100 : 0;
            return {
              name: row.name,
              value: row.value,
              delta,
              percent,
            };
          })
          .filter(Boolean)
          .sort((a, b) => b.percent - a.percent)
          .slice(0, MAX_RANKS);

        if (!isActive) return;
        setPopRows(popByYear);
        setMomentumRows(momentum);
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
  }, [geo, yearRange]);

  const maxPercent =
    momentumRows.reduce((max, row) => Math.max(max, row.percent), 0) || 1;

  return (
    <Card className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Metro Population Momentum</h2>
        <p className="text-sm text-zb-ink-muted">
          3-year population change across major states, plus the latest trend
          for {geoLabel}.
        </p>
      </div>

      {status === "loading" && (
        <p className="text-sm text-zb-ink-muted">Loading ACS data...</p>
      )}

      {status === "error" && (
        <div className="rounded-zb-sm border border-zb-border bg-zb-subtle px-4 py-3 text-sm text-zb-ink">
          Error loading data: {error}
        </div>
      )}

      {status === "success" && (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-zb-md border border-zb-border">
            <table className="w-full text-sm">
              <thead className="bg-zb-surface-strong text-left text-zb-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Year</th>
                  <th className="px-4 py-3 font-medium">Population</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zb-border">
                {popRows.map((row) => (
                  <tr key={row.year} className="odd:bg-zb-surface">
                    <td className="px-4 py-3">{row.year}</td>
                    <td className="px-4 py-3">
                      {formatNumber(row.population)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-zb-ink">
              Top population momentum (3-year % change)
            </p>
            <div className="space-y-3">
              {momentumRows.map((row) => (
                <div key={row.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{row.name}</span>
                    <span className="text-zb-ink-muted">
                      {row.percent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zb-subtle">
                    <div
                      className="h-2 rounded-full bg-zb-green"
                      style={{
                        width: `${(row.percent / maxPercent) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-zb-ink-muted">
        Source: U.S. Census Bureau (ACS 1-Year Estimates)
      </p>
    </Card>
  );
}

export default Momentum;
